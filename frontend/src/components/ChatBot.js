import React, { useState, useEffect, useRef, useCallback } from 'react';

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "こんにちは！私はあなたの日本語の先生です。何か質問がありますか？",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [spaceHoldTimer, setSpaceHoldTimer] = useState(null);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'ja-JP';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  // Handle space key press for voice input with 3-second delay
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle space when chat is open AND input field is NOT focused
      if (e.code === 'Space' && isOpen && !isListening && !isSpaceHeld && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        setIsSpaceHeld(true);
        
        // Start 3-second timer
        const timer = setTimeout(() => {
          startListening();
        }, 3000);
        
        setSpaceHoldTimer(timer);
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && isSpaceHeld) {
        e.preventDefault();
        
        // Clear timer if space is released before 3 seconds
        if (spaceHoldTimer) {
          clearTimeout(spaceHoldTimer);
          setSpaceHoldTimer(null);
        }
        
        setIsSpaceHeld(false);
        
        // Stop listening if currently active
        if (isListening) {
          stopListening();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      
      // Clean up timer on unmount
      if (spaceHoldTimer) {
        clearTimeout(spaceHoldTimer);
      }
    };
  }, [isOpen, isListening, startListening, stopListening, isSpaceHeld, spaceHoldTimer]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    const newMessage = {
      id: Date.now(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const geminiApiKey = process.env.REACT_APP_GEMINI_API_KEY;
      const geminiApiUrl = process.env.REACT_APP_GEMINI_API_URL;

      // Debug logging
      console.log('Environment variables:', {
        geminiApiKey: geminiApiKey ? 'Set' : 'Not set',
        geminiApiUrl: geminiApiUrl ? 'Set' : 'Not set'
      });

      if (!geminiApiKey) {
        console.error('REACT_APP_GEMINI_API_KEY is not set in environment variables');
        throw new Error('Gemini API key not configured');
      }

      console.log('Calling Gemini API...');

      const response = await fetch(`${geminiApiUrl}?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `あなたの名前は「コロ先生」です。あなたは20代の優しい日本語の先生で、N3レベル（中級）の学習者と会話しています。

重要なルール：
- マークダウン記号（**、*、#など）は一切使わない
- 絵文字は適度に使う（😊、🌸、✨など）
- 学習者が日本語で話したら日本語で返事する
- 学習者がベトナム語で話したら、ベトナム語と日本語を混ぜて返事する
- 質問されたら詳しく教える（どちらの言語でも）
- 質問でない場合は自然な会話をする
- N3レベルに適した語彙と文法を使う

会話スタイル：
- 親しみやすく、フレンドリーに話す
- 学習者のミスは優しく訂正する
- 日本の文化や習慣も教える
- ベトナム語の質問には適切に答える
- 日本語学習のサポートを最優先にする

学習者からのメッセージ: ${text}

上記のルールに従って返答してください。マークダウン記号は絶対に使わないでください。`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 1,
            topP: 1,
            maxOutputTokens: 200,
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Gemini response:', data);
      
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "申し訳ありませんが、今は応答できません。もう一度試してください。";
      
      const botMessage = {
        id: Date.now() + 1,
        text: responseText,
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      let errorText = "申し訳ありませんが、接続に問題があります。後でもう一度試してください。";
      
      if (error.message === 'Gemini API key not configured') {
        errorText = "APIキーが設定されていません。管理者にお問い合わせください。";
      }
      
      const errorMessage = {
        id: Date.now() + 1,
        text: errorText,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <>
      {/* Floating Chat Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center"
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
        </button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className={`fixed bottom-24 right-6 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50 transition-all duration-300 ${
          isExpanded 
            ? 'w-[500px] h-[600px]' 
            : 'w-80 h-96'
        }`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-lg flex justify-between items-center">
            <div>
              <h3 className="font-semibold flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                コロ先生 AI
              </h3>
              <p className="text-xs opacity-90">あなたの日本語学習をサポートします</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title={isExpanded ? "小さくする" : "大きくする"}
              >
                {isExpanded ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title="閉じる"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`px-3 py-2 rounded-lg text-sm ${
                    message.sender === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  } ${isExpanded ? 'max-w-md' : 'max-w-xs'}`}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  <p className={`text-xs mt-1 ${
                    message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg text-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="メッセージを入力..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`p-2 rounded-lg transition-colors ${
                  isListening 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                }`}
                disabled={isLoading}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2a1 1 0 0 1 2 0v2a5 5 0 0 0 10 0v-2a1 1 0 0 1 2 0z"/>
                  <path d="M12 19a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0v-1a1 1 0 0 1 1-1z"/>
                </svg>
              </button>
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {isSpaceHeld ? (
                <span className="text-blue-600 font-medium">
                  Spaceキーを3秒間押し続けてください... 
                  <span className="animate-pulse">🎤</span>
                </span>
              ) : (
                "入力欄外でSpaceキーを3秒間押し続けて音声入力"
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;
