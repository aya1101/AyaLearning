import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = 'http://localhost:3001';

const ChatBot = ({ token, onNavigate, currentPage = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [spaceHoldTimer, setSpaceHoldTimer] = useState(null);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  const buildWelcomeMessage = () => ({
    id: Date.now(),
    text: 'Xin chào! Mình là Aya Assistant. Mình có thể gợi ý lộ trình học, mở nhanh đúng màn hình, và giúp bạn lên lịch Google Calendar.',
    sender: 'bot',
    timestamp: new Date(),
    actions: [
      { type: 'prompt', label: 'Hôm nay nên học gì?', payload: 'Hôm nay nên học gì?' },
      { type: 'prompt', label: 'Mở Kanji N3', payload: 'Mở Kanji N3' },
      { type: 'prompt', label: 'Lên lịch ôn tập 19h mai', payload: 'Lên lịch ôn tập 19h mai' }
    ]
  });

  const loadHistory = () => {
    try {
      const raw = localStorage.getItem('aya_assistant_history');
      if (!raw) return [buildWelcomeMessage()];
      const parsed = JSON.parse(raw);
      return parsed.map((message) => ({
        ...message,
        timestamp: new Date(message.timestamp)
      }));
    } catch (_error) {
      return [buildWelcomeMessage()];
    }
  };

  const [messages, setMessages] = useState(loadHistory());

  useEffect(() => {
    try {
      localStorage.setItem('aya_assistant_history', JSON.stringify(messages.slice(-50)));
    } catch (_error) {
      // Ignore storage errors
    }
  }, [messages]);

  const addMessage = useCallback((sender, text, options = {}) => {
    const entry = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      sender,
      text,
      timestamp: new Date(),
      actions: options.actions || []
    };
    setMessages((prev) => [...prev, entry]);
  }, []);

  const formatTime = (date) => date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const checkCalendarStatus = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/assistant/calendar/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      setCalendarConnected(Boolean(data.connected));
    } catch (_error) {
      // Ignore temporary network issues
    }
  }, [token]);

  useEffect(() => {
    checkCalendarStatus();
  }, [checkCalendarStatus]);

  const openCalendarConnectPopup = useCallback((url) => {
    const popup = window.open(url, 'ayaCalendarConnect', 'width=520,height=680');
    if (!popup) {
      addMessage('bot', 'Không thể mở popup kết nối Calendar. Vui lòng bật popup cho trình duyệt.');
      return;
    }

    const onMessage = (event) => {
      if (!event?.data || event.data.type !== 'aya-calendar-connected') return;
      if (event.data.success) {
        setCalendarConnected(true);
        addMessage('bot', 'Google Calendar đã kết nối thành công. Bạn có thể xác nhận tạo lịch ngay.');
      }
      window.removeEventListener('message', onMessage);
    };

    window.addEventListener('message', onMessage);
  }, [addMessage]);

  const connectCalendar = useCallback(async () => {
    if (!token) {
      addMessage('bot', 'Bạn cần đăng nhập để kết nối Google Calendar.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/assistant/calendar/connect-url`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Không thể tạo link kết nối.');

      const data = await response.json();
      if (!data.url) throw new Error('Thiếu URL kết nối calendar.');

      openCalendarConnectPopup(data.url);
    } catch (error) {
      addMessage('bot', error.message || 'Kết nối Google Calendar thất bại.');
    }
  }, [token, addMessage, openCalendarConnectPopup]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'vi-VN';

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

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space' && isOpen && !isListening && !isSpaceHeld && document.activeElement.tagName !== 'INPUT') {
        event.preventDefault();
        setIsSpaceHeld(true);
        const timer = setTimeout(() => startListening(), 2000);
        setSpaceHoldTimer(timer);
      }
    };

    const handleKeyUp = (event) => {
      if (event.code !== 'Space' || !isSpaceHeld) return;
      event.preventDefault();

      if (spaceHoldTimer) {
        clearTimeout(spaceHoldTimer);
        setSpaceHoldTimer(null);
      }

      setIsSpaceHeld(false);

      if (isListening) {
        stopListening();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if (spaceHoldTimer) {
        clearTimeout(spaceHoldTimer);
      }
    };
  }, [isOpen, isListening, startListening, stopListening, isSpaceHeld, spaceHoldTimer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingSchedule, pendingPlan]);

  const performAssistantAction = async (action) => {
    if (!action?.type) return;

    if (action.type === 'prompt' && action.payload) {
      await sendMessage(action.payload);
      return;
    }

    if (action.type === 'navigate' && action.payload && onNavigate) {
      onNavigate(action.payload);
      addMessage('bot', `Đã điều hướng tới ${action.payload.tab}.`);
      return;
    }

    if (action.type === 'suggest_schedule') {
      setInputText('Lên lịch ôn tập 19h tối nay');
      return;
    }

    if (action.type === 'connect_calendar') {
      if (action.payload) {
        openCalendarConnectPopup(action.payload);
        return;
      }
      await connectCalendar();
      return;
    }

    if (action.type === 'open_link' && action.payload) {
      window.open(String(action.payload), '_blank', 'noopener,noreferrer');
    }
  };

  const renderMessageText = (text) => {
    const safeText = String(text || '');
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = safeText.split(urlRegex);

    return parts.map((part, index) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a
            key={`url-${index}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline break-all text-blue-700"
          >
            {part.length > 60 ? `${part.slice(0, 60)}...` : part}
          </a>
        );
      }
      return <span key={`txt-${index}`}>{part}</span>;
    });
  };

  const sendMessage = async (textToSend = inputText) => {
    const finalText = String(textToSend || '').trim();
    if (!finalText || isLoading) return;

    if (!token) {
      addMessage('bot', 'Bạn cần đăng nhập để dùng Aya Assistant.');
      return;
    }

    addMessage('user', finalText);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/assistant/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: finalText,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          conversationHistory: messages.slice(-8).map((message) => ({ sender: message.sender, text: message.text })),
          currentPage
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Assistant không phản hồi được.');
      }

      const data = await response.json();

      addMessage('bot', data.reply || 'Mình đã nhận yêu cầu của bạn.', {
        actions: Array.isArray(data.actions) ? data.actions : []
      });

      if (data.pendingPlan) {
        setPendingPlan(data.pendingPlan);
      }

      if (data.pendingSchedule) {
        setPendingSchedule(data.pendingSchedule);
        setCalendarConnected(Boolean(data.calendarConnected));
      }
    } catch (error) {
      addMessage('bot', error.message || 'Có lỗi khi gọi assistant. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmCreateSchedule = async () => {
    if (!pendingSchedule || !token || isLoading) return;

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/assistant/calendar/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(pendingSchedule)
      });

      if (response.status === 412) {
        const data = await response.json();
        addMessage('bot', 'Bạn cần kết nối Google Calendar trước khi tạo lịch.', {
          actions: [{ type: 'connect_calendar', label: 'Kết nối Google Calendar', payload: data.connectUrl }]
        });
        if (data.connectUrl) {
          openCalendarConnectPopup(data.connectUrl);
        }
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Không thể tạo sự kiện Calendar.');
      }

      const data = await response.json();
      const link = data?.event?.htmlLink || '';
      addMessage('bot', 'Đã tạo sự kiện thành công ✅', {
        actions: link
          ? [{ type: 'open_link', label: 'Mở Google Calendar', payload: link }]
          : []
      });
      setPendingSchedule(null);
      await checkCalendarStatus();
    } catch (error) {
      addMessage('bot', error.message || 'Tạo lịch thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmExecutePlan = async () => {
    if (!pendingPlan || !token || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/assistant/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          executionPlan: pendingPlan,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          currentPage,
          clientContext: {
            currentPage
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Không thể thực thi plan.');
      }

      const data = await response.json();
      addMessage('bot', data.reply || 'Đã thực thi plan.', {
        actions: Array.isArray(data.actions) ? data.actions : []
      });
      setPendingPlan(null);
    } catch (error) {
      addMessage('bot', error.message || 'Thực thi plan thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearChatHistory = () => {
    localStorage.removeItem('aya_assistant_history');
    setPendingSchedule(null);
    setPendingPlan(null);
    setMessages([buildWelcomeMessage()]);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(inputText);
  };

  const quickPrompts = [
    'Hôm nay nên học gì?',
    'Mở Kanji N3',
    'Quiz 10 câu từ vựng',
    'Lên lịch ôn tập 19h mai'
  ];

  return (
    <>
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center"
        >
          {isOpen ? (
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
        </button>
      </div>

      {isOpen && (
        <div className={`fixed bottom-20 right-4 sm:bottom-24 sm:right-6 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50 transition-all duration-300 ${
          isExpanded
            ? 'w-[calc(100vw-2rem)] sm:w-[520px] h-[calc(100vh-8rem)] sm:h-[640px]'
            : 'w-[calc(100vw-2rem)] sm:w-96 h-[460px] sm:h-[520px]'
        }`}>
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-3 sm:p-4 rounded-t-lg flex justify-between items-center">
            <div>
              <h3 className="font-semibold flex items-center text-sm sm:text-base">
                <span className={`w-2 h-2 rounded-full mr-2 ${calendarConnected ? 'bg-green-400' : 'bg-amber-300'}`}></span>
                Aya Assistant
              </h3>
              <p className="text-xs opacity-90 hidden sm:block">
                Gợi ý học • Điều hướng • Google Calendar
              </p>
            </div>
            <div className="flex space-x-1 sm:space-x-2">
              <button
                onClick={connectCalendar}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title="Kết nối Google Calendar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={clearChatHistory}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title="Xóa lịch sử"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
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
                title="Đóng"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-3 pt-3 flex flex-wrap gap-2 border-b border-gray-100 pb-3">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt)}
                className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
                disabled={isLoading}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`px-3 py-2 rounded-lg text-sm ${
                    message.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'
                  } ${isExpanded ? 'max-w-md' : 'max-w-xs'}`}
                >
                  <p className="whitespace-pre-wrap break-words">{renderMessageText(message.text)}</p>
                  {Array.isArray(message.actions) && message.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.actions.map((action, index) => (
                        <button
                          key={`${message.id}-${index}`}
                          type="button"
                          onClick={() => performAssistantAction(action)}
                          className="text-xs px-2 py-1 rounded-full bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
                        >
                          {action.label || 'Thực hiện'}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className={`text-xs mt-1 ${message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}

            {pendingSchedule && (
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-sm text-gray-800">
                <p className="font-semibold text-amber-800 mb-1">Lịch nháp chờ xác nhận</p>
                <p>{pendingSchedule.summary}</p>
                <p className="text-xs text-gray-600 mt-1">Bắt đầu: {new Date(pendingSchedule.startTime).toLocaleString('vi-VN')}</p>
                <p className="text-xs text-gray-600">Kết thúc: {new Date(pendingSchedule.endTime).toLocaleString('vi-VN')}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={confirmCreateSchedule}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-60"
                  >
                    Xác nhận tạo lịch
                  </button>
                  {!calendarConnected && (
                    <button
                      type="button"
                      onClick={connectCalendar}
                      className="px-3 py-1.5 text-xs bg-white border border-amber-300 text-amber-700 rounded-md hover:bg-amber-100"
                    >
                      Kết nối Calendar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingSchedule(null)}
                    className="px-3 py-1.5 text-xs bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-100"
                  >
                    Hủy nháp
                  </button>
                </div>
              </div>
            )}

            {pendingPlan && (
              <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-3 text-sm text-gray-800">
                <p className="font-semibold text-indigo-800 mb-1">Plan chờ xác nhận</p>
                <p className="text-sm text-gray-700">{pendingPlan.title}</p>
                <ol className="mt-2 list-decimal list-inside text-xs text-gray-700 space-y-1">
                  {(pendingPlan.steps || []).map((step, index) => (
                    <li key={`${step.type}-${index}`}>{step.label || step.type}</li>
                  ))}
                </ol>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={confirmExecutePlan}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-60"
                  >
                    Xác nhận thực thi
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingPlan(null)}
                    className="px-3 py-1.5 text-xs bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-100"
                  >
                    Hủy plan
                  </button>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg text-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-gray-200">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <input
                type="text"
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                placeholder="Nhắn cho assistant..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`p-2 rounded-lg transition-colors ${
                  isListening ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                }`}
                disabled={isLoading}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2a1 1 0 0 1 2 0v2a5 5 0 0 0 10 0v-2a1 1 0 0 1 2 0z" />
                  <path d="M12 19a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0v-1a1 1 0 0 1 1-1z" />
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
              {isSpaceHeld ? 'Giữ Space 2 giây để bật mic...' : 'Giữ Space 2 giây (khi không focus input) để nhập giọng nói'}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;
