import React, { useState, useEffect } from 'react';

const ShiritoriGame = ({ token, difficulty = 'N5', gameMode = 'casual' }) => {
  const API_URL = 'http://localhost:3001/api';
  
  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [currentWord, setCurrentWord] = useState(null);
  const [userInput, setUserInput] = useState('');
  const [wordChain, setWordChain] = useState([]);
  const [usedWords, setUsedWords] = useState([]);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState('');
  const [isComputerThinking, setIsComputerThinking] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState(difficulty);

  const getLastKanaFromWord = (word) => {
    if (!word || !word.kana) return '';
    const kana = word.kana.trim();
    return kana.length > 0 ? kana[kana.length - 1] : '';
  };

  const findComputerWordFallback = async (lastWordKana, usedKanaList) => {
    const response = await fetch(
      `${API_URL}/games/shiritori/starting-words?difficulty=${selectedDifficulty}&limit=200`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const requiredKana = getLastKanaFromWord({ kana: lastWordKana });
    const normalizedUsed = new Set(usedKanaList.map((item) => (item || '').trim()));

    const candidate = (data.words || []).find((word) => {
      const kana = (word.kana || '').trim();
      if (!kana || normalizedUsed.has(kana)) return false;
      return kana[0] === requiredKana;
    });

    return candidate || null;
  };

  // Timer effect
  useEffect(() => {
    let interval;
    if (gameStarted && !gameOver) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameOver, startTime]);

  // Start game
  const startNewGame = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${API_URL}/games/shiritori/starting-words?difficulty=${selectedDifficulty}&limit=1`
      );
      const data = await response.json();

      if (data.words.length > 0) {
        const startWord = data.words[0];
        setCurrentWord(startWord);
        setWordChain([startWord]);
        setUsedWords([startWord.kana]);
        setGameStarted(true);
        setGameOver(false);
        setScore(0);
        setUserInput('');
        setMessage('Game started! Đến lượt bạn.');
        setMessageType('success');
        setStartTime(Date.now());
        setElapsed(0);
      }
    } catch (err) {
      setMessage('Error starting game: ' + err.message);
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Validate and add word
  const handleAddWord = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || gameOver || isComputerThinking) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/games/shiritori/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newWord: userInput,
          lastWordKana: currentWord.kana,
          usedWords,
          difficulty: selectedDifficulty
        })
      });

      const data = await response.json();

      if (data.gameOver) {
        // Game over - word ends with ん
        setGameOver(true);
        setGameOverReason('Game Over! Cannot use words ending in ん');
        setMessage(data.message);
        setMessageType('error');
        saveGameResult('game_over_n');
      } else if (data.valid) {
        // Valid move
        const playerWord = data.word;
        const playerChain = [...wordChain, playerWord];
        const playerUsed = [...usedWords, playerWord.kana];

        setCurrentWord(playerWord);
        setWordChain(playerChain);
        setUsedWords(playerUsed);
        setScore(score + 1);
        setUserInput('');
        setMessage(`✓ Bạn: ${playerWord.kanji || playerWord.kana} (${playerWord.kana})`);
        setMessageType('success');

        // Computer turn
        setIsComputerThinking(true);
        let computerWord = null;
        let computerGameOver = false;

        try {
          const computerResponse = await fetch(`${API_URL}/games/shiritori/computer-move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lastWordKana: playerWord.kana,
              usedWords: playerUsed,
              difficulty: selectedDifficulty
            })
          });

          if (computerResponse.ok) {
            const computerData = await computerResponse.json();
            if (computerData.valid) {
              computerWord = computerData.word;
            } else if (computerData.gameOver) {
              computerGameOver = true;
            }
          }
        } catch (moveErr) {
          console.error('Computer move endpoint failed, fallback to local selection:', moveErr);
        }

        if (!computerWord && !computerGameOver) {
          computerWord = await findComputerWordFallback(playerWord.kana, playerUsed);
          if (!computerWord) {
            computerGameOver = true;
          }
        }

        if (computerGameOver) {
          setGameOver(true);
          setGameOverReason('Bạn thắng! Máy không tìm được từ tiếp theo.');
          setMessage('🎉 Bạn thắng! Máy bí từ rồi.');
          setMessageType('success');
          await saveGameResult('computer_no_move');
        } else if (computerWord) {
          setCurrentWord(computerWord);
          setWordChain(prev => [...prev, computerWord]);
          setUsedWords(prev => [...prev, computerWord.kana]);
          const meaningText = computerWord.meaningVi ? ` - ${computerWord.meaningVi}` : '';
          setMessage(`🤖 Máy: ${computerWord.kanji || computerWord.kana} (${computerWord.kana})${meaningText} — tới lượt bạn!`);
          setMessageType('success');
        } else {
          setMessage('Máy không đi được từ hợp lệ. Bạn thắng!');
          setMessageType('success');
          setGameOver(true);
          setGameOverReason('Bạn thắng! Máy không đi được từ hợp lệ.');
          await saveGameResult('computer_invalid_move');
        }
      } else {
        // Invalid move
        if (data.repeated) {
          setMessage('❌ Word already used!');
        } else if (data.notInDict) {
          setMessage('❌ Word not in dictionary');
        } else {
          setMessage(`❌ ${data.message}`);
        }
        setMessageType('error');
      }
    } catch (err) {
      setMessage('Error: ' + err.message);
      setMessageType('error');
    } finally {
      setIsComputerThinking(false);
      setIsLoading(false);
    }
  };

  // Save game result
  const saveGameResult = async (reason = 'normal') => {
    try {
      if (!token) return;

      await fetch(`${API_URL}/games/shiritori/save-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          score: wordChain.length - 1, // Subtract starting word
          wordsPlayed: wordChain,
          duration: elapsed,
          difficulty: selectedDifficulty,
          gameMode: gameMode,
          endReason: reason
        })
      });
    } catch (err) {
      console.error('Error saving game:', err);
    }
  };

  // Reset game
  const resetGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setCurrentWord(null);
    setWordChain([]);
    setUsedWords([]);
    setScore(0);
    setUserInput('');
    setMessage('');
    setElapsed(0);
    setStartTime(null);
  };

  const handleSurrender = async () => {
    if (gameOver || isLoading || isComputerThinking) return;

    setGameOver(true);
    setGameOverReason('あなたは降参しました。');
    setMessage('🏳️ あなたは降参しました。ゲーム終了。');
    setMessageType('error');

    await saveGameResult('surrender');
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!gameStarted) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold text-center mb-2">🎮 Shiritori</h1>
          <p className="text-center text-gray-600 mb-6">Word Chain Game</p>

          {/* Difficulty Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-3">Difficulty Level:</label>
            <div className="flex gap-3">
              {['N5', 'N4', 'N3'].map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedDifficulty(level)}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    selectedDifficulty === level
                      ? 'bg-rose-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Rules */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <h3 className="font-semibold mb-2">Rules:</h3>
            <ul className="text-sm space-y-1 text-gray-700">
              <li>✓ Next word must start with the last character of the previous word</li>
              <li>✓ Cannot use words ending with ん</li>
              <li>✓ Cannot repeat words</li>
              <li>✓ Words must exist in the dictionary</li>
            </ul>
          </div>

          <button
            onClick={startNewGame}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-rose-400 to-red-500 text-white font-bold py-4 rounded-lg hover:shadow-lg transition-shadow disabled:opacity-50"
          >
            {isLoading ? 'Starting...' : 'Start Game'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header with score and timer */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <div className="text-center">
            <p className="text-sm text-gray-600">Score</p>
            <p className="text-3xl font-bold text-rose-500">{wordChain.length - 1}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Time</p>
            <p className="text-3xl font-bold text-blue-500">{formatTime(elapsed)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Difficulty</p>
            <p className="text-3xl font-bold text-purple-500">{selectedDifficulty}</p>
          </div>
        </div>

        {/* Current word */}
        {currentWord && !gameOver && (
          <div className="bg-gradient-to-r from-rose-50 to-red-50 rounded-lg p-6 mb-6 border-2 border-rose-200">
            <p className="text-sm text-gray-600 mb-2">Current word:</p>
            <div className="text-center">
              <p className="text-5xl font-bold text-rose-600 mb-2">
                {currentWord.kanji || currentWord.kana}
              </p>
              <p className="text-2xl text-gray-700 mb-1">{currentWord.kana}</p>
              {currentWord.meaningVi && (
                <p className="text-sm text-emerald-700 mb-1">Nghĩa: {currentWord.meaningVi}</p>
              )}
              <p className="text-sm text-gray-500">{currentWord.romaji} [{currentWord.jlptLevel}]</p>
            </div>
            <p className="text-center text-2xl font-bold text-blue-600 mt-4">
              Next word must start with: <span className="text-4xl">「{getLastKanaFromWord(currentWord)}」</span>
            </p>
          </div>
        )}

        {/* Input form */}
        {!gameOver && (
          <form onSubmit={handleAddWord} className="mb-6">
            <div className="flex gap-3">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Enter a word (kanji, kana, or romaji)..."
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-rose-500"
                disabled={gameOver || isComputerThinking}
                autoFocus
              />
              <button
                type="submit"
                disabled={!userInput.trim() || isLoading || isComputerThinking}
                className="px-6 py-3 bg-rose-500 text-white font-bold rounded-lg hover:bg-rose-600 disabled:opacity-50 transition-colors"
              >
                {isComputerThinking ? 'Machine Turn...' : 'Submit'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">💡 Tip: You can type in romanji (e.g., "taberu"), kana (たべる), or kanji (食べる)</p>
          </form>
        )}

        {!gameOver && (
          <button
            onClick={handleSurrender}
            disabled={isLoading || isComputerThinking}
            className="w-full mb-6 px-6 py-3 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            降参する
          </button>
        )}

        {/* Message */}
        {message && (
          <div
            className={`p-3 rounded-lg mb-6 font-semibold ${
              messageType === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}
          >
            {message}
          </div>
        )}

        {/* Word chain */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-600 mb-3">Words Used ({wordChain.length}):</p>
          <div className="flex flex-wrap gap-2">
            {wordChain.map((word, idx) => (
              <div
                key={idx}
                className="px-3 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
              >
                {idx + 1}. {word.kanji || word.kana}{word.meaningVi ? ` - ${word.meaningVi}` : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Game Over */}
        {gameOver && (
          <div className="bg-red-100 border-2 border-red-500 rounded-lg p-6 mb-6">
            <p className="text-2xl font-bold text-red-700 mb-2">🎮 Game Over!</p>
            <p className="text-gray-700 mb-4">{gameOverReason}</p>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Score</p>
                <p className="text-2xl font-bold text-red-600">{wordChain.length - 1}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Duration</p>
                <p className="text-2xl font-bold text-red-600">{formatTime(elapsed)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Difficulty</p>
                <p className="text-2xl font-bold text-red-600">{selectedDifficulty}</p>
              </div>
            </div>
            <button
              onClick={resetGame}
              className="w-full bg-gradient-to-r from-rose-400 to-red-500 text-white font-bold py-3 rounded-lg hover:shadow-lg transition-shadow"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiritoriGame;
