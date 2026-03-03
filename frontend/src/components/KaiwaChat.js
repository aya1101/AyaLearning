import React, { useState, useEffect, useRef } from 'react';
import Live2DViewer from './Live2DViewer';

const KaiwaChat = ({ character, token, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [conversationTopic, setConversationTopic] = useState('');
  const [topicDraft, setTopicDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputMode, setInputMode] = useState('text');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const [recordingNotice, setRecordingNotice] = useState('');
  const messagesEndRef = useRef(null);
  const recorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const responseAudioRef = useRef(null);
  const topicSuggestions = ['自己紹介', '旅行', '学校生活', 'アニメ', '仕事', '日本文化'];

  const createMessage = (sender, text, extra = {}) => ({
    id: Date.now() + Math.floor(Math.random() * 1000),
    sender,
    text,
    timestamp: new Date(),
    ...extra
  });

  const addMessage = (sender, text, extra = {}) => {
    const message = createMessage(sender, text, extra);
    setMessages((prev) => [...prev, message]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const greeting = character?.greeting || 'こんにちは！';
    const defaultTopic = character?.topics?.[0] || '';
    setConversationTopic(defaultTopic);
    setTopicDraft(defaultTopic);
    setMessages([
      createMessage('character', greeting)
    ]);
    if (responseAudioRef.current) {
      responseAudioRef.current.pause();
      responseAudioRef.current = null;
    }
  }, [character]);

  useEffect(() => {
    return () => {
      if (responseAudioRef.current) {
        responseAudioRef.current.pause();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const callKaiwaChat = async (userMessage) => {
    const response = await fetch('http://localhost:3001/api/kaiwa/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        character,
        userMessage,
        conversationHistory: messages.slice(-10),
        topic: conversationTopic
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    return response.json();
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessageText = inputText;
    addMessage('user', userMessageText);
    setInputText('');
    setIsLoading(true);
    setRecordingNotice('');

    try {
      const data = await callKaiwaChat(userMessageText);
      addMessage('character', data.reply, { corrections: data.corrections || null });
      playCharacterAudio(data.audioUrl, data.reply || '');
      if (data.ttsWarning) {
        setRecordingNotice('TTS chưa sẵn sàng, đang trả phản hồi dạng văn bản (không có audio).');
      }
    } catch (err) {
      console.error('Chat error:', err);
      addMessage('character', 'ごめんなさい、今ちょっと聞こえなかった。もう一度言ってもらえる？');
    } finally {
      setIsLoading(false);
    }
  };

  const blobToBase64 = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let index = 0; index < bytes.byteLength; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return window.btoa(binary);
  };

  const playCharacterAudio = (audioUrl, fallbackText = '') => {
    if (!audioUrl) {
      if (!('speechSynthesis' in window) || !fallbackText) return;

      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(fallbackText);
        utterance.lang = 'ja-JP';
        utterance.rate = 1;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      } catch (speechError) {
        console.error('Local browser TTS failed:', speechError);
      }
      return;
    }

    if (responseAudioRef.current) {
      responseAudioRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    responseAudioRef.current = audio;
    if (window.live2dController?.startLipSync) {
      window.live2dController.startLipSync(audio);
    } else {
      const retryStart = () => {
        if (audio.paused || audio.ended) return;
        if (window.live2dController?.startLipSync) {
          window.live2dController.startLipSync(audio);
          return;
        }
        setTimeout(retryStart, 150);
      };
      setTimeout(retryStart, 150);
    }

    audio.play().catch((error) => {
      console.error('Audio play failed:', error);
    });
  };

  const sendVoiceTurn = async (audioBlob) => {
    if (!audioBlob || isLoading) return;

    setIsLoading(true);
    setRecordingError('');
    setRecordingNotice('');

    try {
      const audioBase64 = await blobToBase64(audioBlob);
      const response = await fetch('http://localhost:3001/api/kaiwa/voice-turn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          character,
          conversationHistory: messages.slice(-10),
          topic: conversationTopic,
          audioBase64,
          mimeType: audioBlob.type || 'audio/webm'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.transcript) {
          addMessage('user', errorData.transcript);
        }
        if (errorData.reply) {
          addMessage('character', errorData.reply);
        }

        if (errorData.error && errorData.error.includes('No speech detected from ASR input')) {
          setRecordingError('Không nghe rõ giọng nói. Hãy nói lớn hơn và giữ nút ghi âm lâu hơn một chút.');
          return;
        }

        throw new Error(errorData.error || errorData.message || 'Voice mode request failed');
      }

      const data = await response.json();

      addMessage('user', data.transcript || '(voice input)');
      addMessage('character', data.reply, { corrections: data.corrections || null });
      if (data.llmWarning) {
        setRecordingError(data.llmWarning);
      }
      if (data.ttsWarning) {
        setRecordingNotice('TTS chưa sẵn sàng, đang trả phản hồi dạng văn bản (không có audio).');
      }
      playCharacterAudio(data.audioUrl, data.reply || '');
    } catch (error) {
      console.error('Voice turn error:', error);
      setRecordingNotice('');
      setRecordingError(error.message || 'Voice mode failed');
      addMessage('character', '音声モードで問題が発生しました。テキストモードで続けてください。');
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    if (isLoading || isRecording) return;

    setRecordingError('');
    setRecordingNotice('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      recorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        if (blob.size > 0) {
          await sendVoiceTurn(blob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording failed:', error);
      setRecordingError('Không truy cập được microphone. Hãy kiểm tra quyền truy cập.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const modelPath = character?.live2dModelPath || null;
  const latestCorrection = [...messages].reverse().find((message) => message.corrections)?.corrections || null;

  return (
    <div className="w-full h-screen bg-gradient-to-br from-amber-50 to-yellow-50 flex flex-col overflow-hidden">
      <div className="bg-white/95 border-b border-amber-100 shadow-sm px-4 lg:px-6 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold"
        >
          ← Back
        </button>
        <div className="text-center">
          <p className="text-xs text-gray-500">Kaiwa Conversation</p>
          <h2 className="text-base lg:text-lg font-bold text-gray-800">{character.name} ・ {character.nameJp}</h2>
        </div>
        <button
          onClick={() => setInputMode((prev) => (prev === 'text' ? 'voice' : 'text'))}
          className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold"
        >
          {inputMode === 'text' ? '🎙 Voice' : '⌨ Text'}
        </button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 lg:p-5">
        <aside className="bg-white rounded-2xl border border-amber-100 shadow-sm flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-amber-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200 to-yellow-200 flex items-center justify-center text-2xl border-2 border-white shadow-sm">
                {character.icon}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">{character.name}</h3>
                <p className="text-xs text-amber-700">{character.level} ・ {character.age}歳</p>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-[280px] bg-gray-50">
            {modelPath ? (
              <Live2DViewer modelPath={modelPath} className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-7xl mb-3">{character.icon}</div>
                  <p className="text-sm text-gray-500">Live2D model not available</p>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="bg-white rounded-2xl border border-blue-100 shadow-sm flex flex-col min-h-0 relative">
          <div className="px-4 py-3 border-b border-blue-100 flex items-center justify-between">
            <h3 className="text-sm lg:text-base font-bold text-gray-800">💬 Conversation</h3>
            <span className="text-xs text-gray-500">{messages.length} messages</span>
          </div>

          <div className="flex-1 min-h-0 p-4 overflow-y-auto">
            <div className="space-y-4 pb-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${
                      message.sender === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                        : 'bg-gradient-to-r from-amber-100 to-yellow-100 text-gray-800'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                    {message.corrections && (
                      <div className="mt-2 pt-2 border-t border-amber-300/70">
                        <p className="text-xs text-amber-700">💡 {message.corrections}</p>
                      </div>
                    )}
                    <p className="text-[11px] mt-1 opacity-70">
                      {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gradient-to-r from-amber-100 to-yellow-100 rounded-2xl px-5 py-3 shadow-sm">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-gray-100 p-4 pb-24 bg-gradient-to-r from-gray-50 to-gray-100">
            {inputMode === 'text' ? (
              <div className="flex gap-2">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="日本語でメッセージを入力..."
                  className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 resize-none text-sm"
                  rows="2"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isLoading}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-600 text-center">
                {isRecording ? 'Đang ghi âm... bấm micro lần nữa để gửi.' : 'Voice mode: bấm micro ở giữa để bắt đầu nói.'}
              </p>
            )}
          </div>

          <div className="absolute left-1/2 bottom-4 -translate-x-1/2">
            <button
              onClick={() => {
                if (inputMode === 'text') {
                  setInputMode('voice');
                  return;
                }
                if (isRecording) {
                  stopRecording();
                } else {
                  startRecording();
                }
              }}
              disabled={isLoading}
              className={`w-14 h-14 rounded-full text-white shadow-lg border-4 border-white transition-all ${
                isRecording
                  ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isRecording ? 'Stop recording' : 'Start voice mode'}
            >
              {isRecording ? '⏹' : '🎙'}
            </button>
          </div>
        </main>

        <aside className="bg-white rounded-2xl border border-purple-100 shadow-sm p-4 flex flex-col gap-4 overflow-y-auto min-h-0">
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
            <p className="text-xs text-indigo-600 font-semibold mb-2">Conversation Topic</p>
            <div className="flex gap-2 mb-2">
              <input
                value={topicDraft}
                onChange={(event) => setTopicDraft(event.target.value)}
                placeholder="Ví dụ: du lịch Nhật Bản"
                className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                onClick={() => setConversationTopic(topicDraft.trim())}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-500 text-white hover:bg-indigo-600"
              >
                Áp dụng
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {topicSuggestions.map((topic) => (
                <button
                  key={topic}
                  onClick={() => {
                    setTopicDraft(topic);
                    setConversationTopic(topic);
                  }}
                  className="px-2 py-1 text-xs rounded-full border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-100"
                >
                  {topic}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600">
              Chủ đề hiện tại: <span className="font-semibold text-gray-800">{conversationTopic || 'Tự do'}</span>
            </p>
          </div>

          <div className="rounded-xl bg-purple-50 border border-purple-100 p-3">
            <p className="text-xs text-purple-500 font-semibold mb-1">Character Profile</p>
            <p className="text-sm text-gray-700">{character.description}</p>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <p className="text-xs text-amber-600 font-semibold mb-2">Personality</p>
            <div className="flex flex-wrap gap-2">
              {character.personality.map((trait, index) => (
                <span key={index} className="text-xs px-2 py-1 bg-white rounded-full text-gray-700 border border-amber-200">
                  {trait}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-green-50 border border-green-100 p-3">
            <p className="text-xs text-green-700 font-semibold mb-2">Live Feedback</p>
            <p className="text-sm text-gray-700">
              {latestCorrection || 'Chưa có correction. Hãy tiếp tục hội thoại để nhận góp ý.'}
            </p>
            {recordingError && <p className="text-xs text-red-600 mt-2">⚠ {recordingError}</p>}
            {recordingNotice && <p className="text-xs text-amber-700 mt-2">ℹ {recordingNotice}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default KaiwaChat;
