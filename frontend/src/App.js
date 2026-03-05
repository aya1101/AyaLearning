import React, { useState, useEffect } from 'react';
import ChatBot from './components/ChatBot';
import ExamGoalModal from './components/ExamGoalModal';
import SearchBar from './components/SearchBar';
import DictionarySearchModal from './components/DictionarySearchModal';
import KanjiPage from './pages/KanjiPage';
import VocabularyPage from './pages/VocabularyPage';
import HomePage from './pages/HomePage';
import GrammarPage from './pages/GrammarPage';
import GamesPage from './pages/GamesPage';
import KaiwaPage from './pages/KaiwaPage';
import LoginPage from './pages/LoginPage';
import { API_URL, buildApiUrl, buildBaseUrl } from './config/api';

// =================================================================
// main App component
// =================================================================

const ITEMS_PER_PAGE = 10;

const App = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [examGoals, setExamGoals] = useState([]);
  const [showExamModal, setShowExamModal] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const fetchServerProfile = async (token) => {
    const profileResponse = await fetch(buildBaseUrl('/auth/profile'), {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!profileResponse.ok) {
      throw new Error('Stored token is invalid or expired');
    }

    return profileResponse.json();
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      const savedToken = localStorage.getItem('authToken');
      const savedUser = localStorage.getItem('user');

      if (!savedToken || !savedUser) {
        return;
      }

      try {
        const profile = await fetchServerProfile(savedToken);

        setIsAuthenticated(true);
        setUser({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatar_url: profile.avatar_url
        });
        setAuthToken(savedToken);
        fetchExamGoals(savedToken);
      } catch (_error) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setUser(null);
        setAuthToken(null);
      }
    };

    bootstrapAuth();
  }, []);

  const fetchExamGoals = async (token) => {
    try {
      const response = await fetch(buildApiUrl('/exam-goals'), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setExamGoals(data);
      }
    } catch (err) {
      console.error('Error fetching exam goals:', err);
    }
  };

  const handleLoginSuccess = (userData, token) => {
    const syncProfile = async () => {
      try {
        const profile = await fetchServerProfile(token);
        const normalizedUser = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatar_url: profile.avatar_url
        };

        localStorage.setItem('user', JSON.stringify(normalizedUser));
        setIsAuthenticated(true);
        setUser(normalizedUser);
        setAuthToken(token);
        fetchExamGoals(token);
      } catch (_error) {
        setIsAuthenticated(true);
        setUser(userData);
        setAuthToken(token);
        fetchExamGoals(token);
      }
    };

    syncProfile();
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setAuthToken(null);
    setExamGoals([]);
    setActiveTab('home');
    sessionStorage.removeItem('aya_assistant_navigation');
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleAssistantNavigate = (navigation) => {
    if (!navigation || !navigation.tab) return;
    setActiveTab(navigation.tab);
    setMobileMenuOpen(false);
    sessionStorage.setItem(
      'aya_assistant_navigation',
      JSON.stringify({
        ...navigation,
        requestedAt: Date.now()
      })
    );
  };

  const handleSearch = async (query) => {
    setIsSearching(true);
    setShowSearchModal(true);
    try {
      const response = await fetch(`${buildApiUrl('/search')}?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      } else {
        setSearchResults({ query, results: { words: [], kanji: [], vocabulary: [] } });
      }
    } catch (err) {
      console.error('Error searching:', err);
      setSearchResults({ query, results: { words: [], kanji: [], vocabulary: [] } });
    } finally {
      setIsSearching(false);
    }
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const activeExamGoal = examGoals.find(goal => !goal.completed) || examGoals[0];

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col">
      <header className="fixed top-0 inset-x-0 z-40 bg-gradient-to-r from-rose-400 to-red-500 text-white shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            {/* Logo and Brand - Clickable to go home */}
            <button
              onClick={() => handleTabChange('home')}
              className="flex items-center hover:opacity-80 transition-opacity cursor-pointer"
            >
              <img
                src="/logo_page.png"
                alt="Logo Học tiếng Nhật"
                className="h-8 w-8 sm:h-10 sm:w-10 mr-2 sm:mr-3 rounded-full bg-white"
              />
              <h1 className="text-lg sm:text-2xl font-bold">AyaLearning</h1>
            </button>
            
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1 xl:space-x-2">
              <SearchBar onSearch={handleSearch} isSearching={isSearching} />
              
              <button 
                onClick={() => handleTabChange('kanji')} 
                className={`flex items-center space-x-2 py-2 px-3 xl:px-4 border-b-2 transition-all duration-300 ${
                  activeTab === 'kanji' 
                    ? 'text-white border-b-white' 
                    : 'text-white border-b-transparent hover:border-b-white/50'
                }`}
              >
                <span className="text-lg font-bold">字</span>
                <span className="hidden xl:inline">Kanji</span>
              </button>
              
              <button 
                onClick={() => handleTabChange('vocabulary')} 
                className={`flex items-center space-x-2 py-2 px-3 xl:px-4 border-b-2 transition-all duration-300 ${
                  activeTab === 'vocabulary' 
                    ? 'text-white border-b-white' 
                    : 'text-white border-b-transparent hover:border-b-white/50'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                </svg>
                <span className="hidden xl:inline">Vocabulary</span>
              </button>
              
              <button 
                onClick={() => handleTabChange('grammar')} 
                className={`flex items-center space-x-2 py-2 px-3 xl:px-4 border-b-2 transition-all duration-300 ${
                  activeTab === 'grammar' 
                    ? 'text-white border-b-white' 
                    : 'text-white border-b-transparent hover:border-b-white/50'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
                </svg>
                <span className="hidden xl:inline">Grammar</span>
              </button>
              
              <button 
                onClick={() => handleTabChange('games')} 
                className={`flex items-center space-x-2 py-2 px-3 xl:px-4 border-b-2 transition-all duration-300 ${
                  activeTab === 'games' 
                    ? 'text-white border-b-white' 
                    : 'text-white border-b-transparent hover:border-b-white/50'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                </svg>
                <span className="hidden xl:inline">Game</span>
              </button>

              <button 
                onClick={() => handleTabChange('kaiwa')} 
                className={`flex items-center space-x-2 py-2 px-3 xl:px-4 border-b-2 transition-all duration-300 ${
                  activeTab === 'kaiwa' 
                    ? 'text-white border-b-white' 
                    : 'text-white border-b-transparent hover:border-b-white/50'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
                </svg>
                <span className="hidden xl:inline">Kaiwa</span>
              </button>
            </nav>
            
            {/* Desktop User Menu - Right side */}
            <div className="hidden lg:block relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                {user?.avatar_url && (
                  <img src={user.avatar_url} alt={user.name} className="h-6 w-6 rounded-full" />
                )}
                <span className="hidden sm:inline text-sm font-semibold">{user?.name || 'Account'}</span>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white text-gray-900 rounded-lg shadow-lg z-50">
                  <div className="px-4 py-3 border-b border-gray-200 text-xs text-gray-600">
                    <div className="font-semibold text-gray-800">{user?.email || 'No email'}</div>
                    <div>User #{user?.id || '-'}</div>
                  </div>
                  <button
                    onClick={() => {
                      setShowExamModal(true);
                      setUserMenuOpen(false);
                    }}
                    className="block w-full text-left px-4 py-3 hover:bg-gray-100 border-b border-gray-200 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    </svg>
                    <span>Mục tiêu thi</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center space-x-2 text-red-600"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
                    </svg>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
            
            {/* Mobile Hamburger Menu Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              )}
            </button>
          </div>
          
          {/* Mobile Menu - Dropdown */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-white/20 py-4 animate-fadeIn">
              <nav className="flex flex-col space-y-2">
                <button 
                  onClick={() => handleTabChange('kanji')} 
                  className={`flex items-center space-x-3 py-3 px-4 rounded-lg transition-all duration-300 ${
                    activeTab === 'kanji' 
                      ? 'bg-white text-rose-500 font-semibold' 
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <span className="text-lg font-bold">字</span>
                  <span>Kanji</span>
                </button>
                
                <button 
                  onClick={() => handleTabChange('vocabulary')} 
                  className={`flex items-center space-x-3 py-3 px-4 rounded-lg transition-all duration-300 ${
                    activeTab === 'vocabulary' 
                      ? 'bg-white text-rose-500 font-semibold' 
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                  </svg>
                  <span>Vocabulary</span>
                </button>
                
                <button 
                  onClick={() => handleTabChange('grammar')} 
                  className={`flex items-center space-x-3 py-3 px-4 rounded-lg transition-all duration-300 ${
                    activeTab === 'grammar' 
                      ? 'bg-white text-rose-500 font-semibold' 
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
                  </svg>
                  <span>Grammar</span>
                </button>
                
                <button 
                  onClick={() => handleTabChange('games')} 
                  className={`flex items-center space-x-3 py-3 px-4 rounded-lg transition-all duration-300 ${
                    activeTab === 'games' 
                      ? 'bg-white text-rose-500 font-semibold' 
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                  </svg>
                  <span>Game</span>
                </button>

                <button 
                  onClick={() => handleTabChange('kaiwa')} 
                  className={`flex items-center space-x-3 py-3 px-4 rounded-lg transition-all duration-300 ${
                    activeTab === 'kaiwa' 
                      ? 'bg-white text-rose-500 font-semibold' 
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
                  </svg>
                  <span>Kaiwa</span>
                </button>
                
                <hr className="border-white/20 my-3" />
                
                <button
                  onClick={() => {
                    setShowExamModal(true);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 py-3 px-4 text-white hover:bg-white/20 rounded-lg transition-colors w-full"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                  </svg>
                  <span>Mục tiêu thi</span>
                </button>
                
                {user && (
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 py-3 px-4 text-white hover:bg-white/20 rounded-lg transition-colors w-full"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
                    </svg>
                    <span>Đăng xuất</span>
                  </button>
                )}
              </nav>
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow pt-20 lg:pt-24">
        {activeTab === 'home' && <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-8"><HomePage activeExamGoal={activeExamGoal} authToken={authToken} /></div>}
        {activeTab === 'kanji' && <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-8"><KanjiPage API_URL={API_URL} ITEMS_PER_PAGE={ITEMS_PER_PAGE} token={authToken} /></div>}
        {activeTab === 'vocabulary' && <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-8"><VocabularyPage API_URL={API_URL} ITEMS_PER_PAGE={ITEMS_PER_PAGE} token={authToken} /></div>}
        {activeTab === 'grammar' && <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-8"><GrammarPage /></div>}
        {activeTab === 'games' && <GamesPage token={authToken} />}
        {activeTab === 'kaiwa' && <KaiwaPage token={authToken} />}
      </main>

      <footer className="bg-gray-800 text-white p-4 text-center mt-8">
        <p className="text-sm sm:text-base">Learning Japanese with Aya ✍(◔◡◔)</p>
      </footer>

      <ExamGoalModal 
        isOpen={showExamModal} 
        onClose={() => setShowExamModal(false)}
        onSave={(goal) => setExamGoals([...examGoals, goal])}
        authToken={authToken}
      />

      <DictionarySearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        searchResults={searchResults}
        isLoading={isSearching}
      />

      <ChatBot token={authToken} onNavigate={handleAssistantNavigate} currentPage={activeTab} />
    </div>
  );
};

export default App;
