import React, { useState, useEffect } from 'react';
import { useGameData, useGameResults } from '../hooks/useGameData';

/**
 * Shiritori Game Component
 * Word chaining game where last character of current word 
 * must match first character of next word
 */
const ShiritoriGame = ({ token, difficulty = 'N5', onExit }) => {
  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [usedWords, setUsedWords] = useState(new Set());
  const [gameOver, setGameOver] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [wordChain, setWordChain] = useState([]);
  const [message, setMessage] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState(difficulty);

  // Fetch game data from API
  const { data: words, loading: dataLoading, error: dataError } = useGameData(
    'shiritori',
    selectedDifficulty,
    50,
    token
  );

  // Save game results
  const { saveResult, saving: resultSaving } = useGameResults(token);

  // Timer effect
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [gameStarted, gameOver, startTime]);

  // Start game
  const startGame = () => {
    if (words.length === 0) {
      setMessage('No words available. Please try again.');
      return;
    }
    setGameStarted(true);
    setStartTime(Date.now());
    setCurrentWordIndex(0);
    setScore(0);
    setUsedWords(new Set([0])); // Mark first word as used
    setWordChain([words[0]]);
    setMessage('');
    setUserInput('');
  };

  // Get current word
  const getCurrentWord = () => {
    if (currentWordIndex >= words.length) return null;
    return words[currentWordIndex];
  };

  // Get the required first character for next word
  const getRequiredFirstChar = () => {
    if (wordChain.length === 0) return null;
    const lastWord = wordChain[wordChain.length - 1];
    const lastKana = lastWord.last_kana || lastWord.kana.slice(-1);
    return lastKana;
  };

  // Find word by first character
  const findNextWord = (firstChar) => {
    const filtered = words.filter((word, idx) => {
      if (usedWords.has(idx)) return false; // Skip used words
      const wordFirstKana = word.first_kana || word.kana.charAt(0);
      return wordFirstKana === firstChar;
    });

    return filtered.length > 0 ? filtered[Math.floor(Math.random() * filtered.length)] : null;
  };

  // Handle player's word input
  const handleSubmitWord = () => {
    if (!userInput.trim()) {
      setMessage('Please enter a word');
      return;
    }

    const requiredChar = getRequiredFirstChar();
    const inputFirstChar = userInput.charAt(0);

    // Check if input starts with correct character
    if (inputFirstChar.toLowerCase() !== requiredChar.toLowerCase()) {
      setMessage(`❌ Word must start with "${requiredChar}". Try again!`);
      setUserInput('');
      return;
    }

    // Find matching word from database
    const nextWord = findNextWord(inputFirstChar);

    if (!nextWord) {
      // Game ends - no more words available
      endGame(true);
      return;
    }

    // Word found - add to chain
    const nextWordIdx = words.findIndex(w => w.id === nextWord.id);
    setUsedWords(prev => new Set([...prev, nextWordIdx]));
    setWordChain(prev => [...prev, nextWord]);
    setScore(prev => prev + 1);
    setCurrentWordIndex(nextWordIdx);
    setUserInput('');
    setMessage('✅ Correct! Nice!');

    // Auto-clear message after 1 second
    setTimeout(() => setMessage(''), 1000);
  };

  // End game
  const endGame = async (gameEnded = false) => {
    setGameOver(true);

    const accuracy = score > 0 ? Math.round((score / wordChain.length) * 100) : 0;
    const gameResult = {
      gameType: 'shiritori',
      score,
      accuracy,
      duration_seconds: elapsedTime,
      difficulty: selectedDifficulty,
      words_used: wordChain.length
    };

    try {
      await saveResult(gameResult);
    } catch (err) {
      console.error('Failed to save game result:', err);
    }

    setMessage(
      gameEnded
        ? `Game Over! No more words starting with "${getRequiredFirstChar()}" available.`
        : 'Game complete!'
    );
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Difficulty selector
  if (!gameStarted && !dataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
          <h1 className="text-4xl font-bold text-center mb-2 text-indigo-600">Shiritori</h1>
          <p className="text-center text-gray-600 mb-8">
            Word Chaining Game - Last character of current word must match first character of next word
          </p>

          <div className="space-y-6">
            <div>
              <p className="text-center text-sm font-semibold text-gray-700 mb-4">
                Select Difficulty Level
              </p>
              <div className="grid grid-cols-2 gap-3">
                {['N5', 'N4', 'N3'].map(level => (
                  <button
                    key={level}
                    onClick={() => setSelectedDifficulty(level)}
                    className={`py-2 px-3 rounded-lg font-semibold transition-all ${
                      selectedDifficulty === level
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startGame}
              disabled={dataLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all disabled:opacity-50"
            >
              {dataLoading ? 'Loading...' : 'Start Game'}
            </button>

            {dataError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                Error: {dataError}
              </div>
            )}

            <button
              onClick={onExit}
              className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition-all"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading game data...</p>
        </div>
      </div>
    );
  }

  if (gameOver) {
    const accuracy = score > 0 ? Math.round((score / wordChain.length) * 100) : 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-4xl font-bold mb-6 text-emerald-600">Game Over!</h1>

          <div className="space-y-4 mb-8">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4">
              <p className="text-gray-600 text-sm mb-1">Words Chained</p>
              <p className="text-5xl font-bold text-emerald-600">{score}</p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
              <p className="text-gray-600 text-sm mb-1">Accuracy</p>
              <p className="text-3xl font-bold text-blue-600">{accuracy}%</p>
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4">
              <p className="text-gray-600 text-sm mb-1">Time</p>
              <p className="text-3xl font-bold text-orange-600">{formatTime(elapsedTime)}</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-8 max-h-48 overflow-y-auto">
            <p className="text-sm font-semibold text-gray-700 mb-3">Word Chain:</p>
            <div className="flex flex-wrap gap-2">
              {wordChain.map((word, idx) => (
                <span
                  key={idx}
                  className="bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-semibold"
                >
                  {word.kanji || word.kana}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all mb-3"
          >
            Play Again
          </button>

          <button
            onClick={onExit}
            className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition-all"
          >
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  const currentWord = wordChain[wordChain.length - 1];
  const requiredChar = getRequiredFirstChar();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-600 mb-2">Shiritori</h1>
          <p className="text-gray-600">Chain words by character</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-gray-600 text-sm">Score</p>
            <p className="text-3xl font-bold text-indigo-600">{score}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-gray-600 text-sm">Words Used</p>
            <p className="text-3xl font-bold text-blue-600">{wordChain.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-gray-600 text-sm">Time</p>
            <p className="text-3xl font-bold text-orange-600">{formatTime(elapsedTime)}</p>
          </div>
        </div>

        {/* Game Area */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          {/* Current Word */}
          <div className="text-center mb-8">
            <p className="text-gray-600 text-sm mb-2">Current Word</p>
            <div className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg p-6 mb-4">
              <p className="text-5xl font-bold text-indigo-600 mb-2">
                {currentWord.kanji || currentWord.kana}
              </p>
              <p className="text-lg text-gray-700 mb-2">
                {currentWord.romaji}
              </p>
              <p className="text-sm text-gray-600">
                その{currentWord.romaji.split('')[0]}で始まる言葉をチェーンしてください
              </p>
            </div>

            {/* Required Character */}
            <div className="inline-block bg-red-100 text-red-700 px-4 py-2 rounded-lg font-bold text-lg">
              Next word must start with: <span className="text-2xl">{requiredChar}</span>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`p-4 rounded-lg mb-6 text-center font-semibold ${
                message.includes('❌')
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {message}
            </div>
          )}

          {/* Input Area */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Enter your word:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmitWord()}
                  placeholder={`Start with ${requiredChar}...`}
                  className="flex-1 px-4 py-3 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600"
                  autoFocus
                />
                <button
                  onClick={handleSubmitWord}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                >
                  Submit
                </button>
              </div>
            </div>

            <button
              onClick={() => endGame()}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-all"
            >
              End Game
            </button>
          </div>
        </div>

        {/* Word Chain Display */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="font-bold text-lg text-gray-800 mb-4">Word Chain:</h3>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {wordChain.map((word, idx) => (
              <div
                key={idx}
                className={`px-3 py-2 rounded-full font-semibold text-white transition-all ${
                  idx === wordChain.length - 1
                    ? 'bg-indigo-600 scale-110'
                    : 'bg-gray-400'
                }`}
              >
                {word.kanji || word.kana}
                <span className="text-xs ml-1">({word.romaji})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiritoriGame;
