import React, { useState, useEffect, useMemo } from 'react';
import ChatBot from './components/ChatBot';

// Hàm trợ giúp để xáo trộn mảng (Không thay đổi)
const shuffleArray = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
};

// =================================================================
// COMPONENT MÀN HÌNH KẾT THÚC QUIZ
// =================================================================
const QuizEndScreen = ({ score, total, imageSrc, imageAlt, onRestart, onGoBack }) => {
  return (
    <div className="p-6 bg-white rounded-lg shadow-xl text-center max-w-md mx-auto my-8">
      <h2 className="text-3xl font-bold mb-4 text-gray-800">End Game!</h2>
      <p className="text-2xl font-semibold mb-6 text-blue-700">
        ✔ Đúng <span className="text-green-600">{score}</span> / <span className="text-red-500">{total}</span> câu.
      </p>
      
      {imageSrc && (
        <div className="mb-6">
          <img 
            src={imageSrc} 
            alt={imageAlt} 
            className="mx-auto rounded-lg shadow-md max-w-full h-auto"
          />
        </div>
      )}
      
      <div className="flex flex-col space-y-4">
        <button
          onClick={onRestart}
          className="bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-150 ease-in-out text-lg font-semibold"
        >
          Làm lại
        </button>
        <button
          onClick={onGoBack}
          className="bg-gray-500 text-white py-3 px-6 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition duration-150 ease-in-out text-lg font-semibold"
        >
          Về Home
        </button>
      </div>
    </div>
  );
};


// =================================================================
// COMPONENT PHÂN TRANG (PAGINATION)
// =================================================================
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const handlePrev = () => onPageChange(p => Math.max(p - 1, 1));
  const handleNext = () => onPageChange(p => Math.min(p + 1, totalPages));

  return (
    <div className="mt-6 flex justify-center items-center space-x-4">
      <button onClick={handlePrev} disabled={currentPage === 1} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
        Trước
      </button>
      <span className="font-semibold text-gray-600">
        Trang {currentPage} / {totalPages}
      </span>
      <button onClick={handleNext} disabled={currentPage === totalPages} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
        Sau
      </button>
    </div>
  );
};


// =================================================================
// COMPONENT MÀN HÌNH CHÍNH (KANJI & TỪ VỰNG)
// =================================================================
// -- Kanji Section --
const KanjiSection = ({ kanjiList, newKanji, handleNewKanjiChange, handleAddKanji, onStartQuiz, currentPage, onPageChange, itemsPerPage }) => {
    const totalPages = Math.ceil(kanjiList.length / itemsPerPage);
    const paginatedKanji = kanjiList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">漢字を勉強</h2>
            <div className="mb-8 p-4 border border-gray-200 rounded-lg">
                <h3 className="text-xl font-semibold mb-3 text-gray-700">Add new</h3>
                <form onSubmit={handleAddKanji} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="kanji_char" value={newKanji.kanji_char} onChange={handleNewKanjiChange} placeholder="Chữ Kanji" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2" required />
                    <input name="han_tu" value={newKanji.han_tu} onChange={handleNewKanjiChange} placeholder="Hán tự" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2" required />
                    <input name="onyomi" value={newKanji.onyomi} onChange={handleNewKanjiChange} placeholder="On'yomi" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2" />
                    <input name="kunyomi" value={newKanji.kunyomi} onChange={handleNewKanjiChange} placeholder="Kun'yomi" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2" />
                    <input name="meaning" value={newKanji.meaning} onChange={handleNewKanjiChange} placeholder="Nghĩa" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2" required />
                    <select name="level" value={newKanji.level} onChange={handleNewKanjiChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2">
                        <option value="N5">N5</option>
                        <option value="N4">N4</option>
                        <option value="N3">N3</option>
                        <option value="N2">N2</option>
                        <option value="N1">N1</option>
                    </select>
                    <div className="md:col-span-2">
                        <button type="submit" className="w-full bg-[#FFD8D8] text-slate-900 font-semibold py-2 px-4 rounded-md hover:bg-red-200 transition-colors">Thêm Kanji</button>
                    </div>
                </form>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-700">List Kanji</h3>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kanji</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hán tự</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">On'yomi</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kun'yomi</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nghĩa</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cấp độ</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedKanji.map((kanji) => (
                            <tr key={kanji.id}>
                                <td className="px-6 py-4">{kanji.kanji_char}</td>
                                <td className="px-6 py-4">{kanji.han_tu}</td>
                                <td className="px-6 py-4">{kanji.onyomi}</td>
                                <td className="px-6 py-4">{kanji.kunyomi}</td>
                                <td className="px-6 py-4">{kanji.meaning}</td>
                                <td className="px-6 py-4">{kanji.level}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
            <div className="mt-6 text-center">
                <button onClick={onStartQuiz} className="bg-[#093FB4] text-white py-2 px-4 rounded-md hover:bg-[#072f8a] transition-colors">
                    練習しましょう！(Quiz)
                </button>
            </div>
        </div>
    );
};

// -- Vocabulary Section --
const VocabularySection = ({ vocabularyList, newVocabulary, handleNewVocabularyChange, handleAddVocabulary, onStartQuiz, currentPage, onPageChange, itemsPerPage }) => {
    const totalPages = Math.ceil(vocabularyList.length / itemsPerPage);
    const paginatedVocabulary = vocabularyList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
         <div className="p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Tanbou</h2>
            <div className="mb-8 p-4 border border-gray-200 rounded-lg">
                <h3 className="text-xl font-semibold mb-3 text-gray-700">Add new</h3>
                <form onSubmit={handleAddVocabulary} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <input name="word" value={newVocabulary.word} onChange={handleNewVocabularyChange} placeholder="Từ vựng" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2" required />
                     <input name="furigana" value={newVocabulary.furigana} onChange={handleNewVocabularyChange} placeholder="Furigana" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2" required />
                     <input name="meaning" value={newVocabulary.meaning} onChange={handleNewVocabularyChange} placeholder="Nghĩa" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2" required />
                     <select name="level" value={newVocabulary.level} onChange={handleNewVocabularyChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2">
                        <option value="N5">N5</option>
                        <option value="N4">N4</option>
                        <option value="N3">N3</option>
                        <option value="N2">N2</option>
                        <option value="N1">N1</option>
                    </select>
                    <div className="md:col-span-2">
                        <button type="submit" className="w-full bg-[#FFD8D8] text-slate-900 font-semibold py-2 px-4 rounded-md hover:bg-red-200 transition-colors">Thêm Từ Vựng</button>
                    </div>
                </form>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-700">Goi</h3>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">探訪</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Furigana</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">意味</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedVocabulary.map((vocab) => (
                            <tr key={vocab.id}>
                                <td className="px-6 py-4">{vocab.word}</td>
                                <td className="px-6 py-4">{vocab.furigana}</td>
                                <td className="px-6 py-4">{vocab.meaning}</td>
                                <td className="px-6 py-4">{vocab.level}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
            <div className="mt-6 text-center">
                <button onClick={onStartQuiz} className="bg-[#093FB4] text-white py-2 px-4 rounded-md hover:bg-[#072f8a] transition-colors">
                    勉強初めて！
                </button>
            </div>
        </div>
    );
};

// =================================================================
// COMPONENT QUIZ (ĐÃ CẬP NHẬT)
// =================================================================

// -- Kanji Quiz Section --
const KanjiQuizSection = ({ kanjiList, onQuizEnd, onGoBack }) => {
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [options, setOptions] = useState([]);
    const [quizType, setQuizType] = useState('');
    const [feedback, setFeedback] = useState('');
    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);

    const generateQuestion = (type) => {
        if (kanjiList.length < 4) return;
        const correctKanji = kanjiList[Math.floor(Math.random() * kanjiList.length)];
        let questionText = '', correctAnswer = '', incorrectOptions = [];

        switch (type) {
            case 'kanji-han_tu':
                questionText = correctKanji.kanji_char;
                correctAnswer = correctKanji.han_tu;
                incorrectOptions = kanjiList.filter(k => k.id !== correctKanji.id).map(k => k.han_tu);
                break;
            case 'han_tu-kanji':
                questionText = correctKanji.han_tu;
                correctAnswer = correctKanji.kanji_char;
                incorrectOptions = kanjiList.filter(k => k.id !== correctKanji.id).map(k => k.kanji_char);
                break;
            default: return;
        }

        const uniqueIncorrectOptions = Array.from(new Set(incorrectOptions)).filter(opt => opt && opt !== correctAnswer);
        const finalOptions = shuffleArray([...shuffleArray(uniqueIncorrectOptions).slice(0, 3), correctAnswer]);

        setCurrentQuestion({ question: questionText, correctAnswer: correctAnswer });
        setOptions(finalOptions);
    };

    const startQuiz = (type) => {
        if (kanjiList.length < 4) {
            setFeedback('Cần ít nhất 4 Kanji để bắt đầu quiz.');
            return;
        }
        setQuizType(type);
        setCorrectAnswers(0);
        setTotalQuestions(0);
        setFeedback('');
        generateQuestion(type);
    };

    const handleAnswer = (selectedAnswer) => {
        setTotalQuestions(prev => prev + 1);
        if (selectedAnswer === currentQuestion.correctAnswer) {
            setCorrectAnswers(prev => prev + 1);
            setFeedback('🎉ビンゴ!');
        } else {
            setFeedback(`ちょっと. Đáp án đúng là: ${currentQuestion.correctAnswer}`);
        }
        setTimeout(() => {
            setFeedback('');
            generateQuestion(quizType);
        }, 1500);
    };

    const handleStopQuiz = () => {
        onQuizEnd(correctAnswers, totalQuestions, quizType);
    }
    
    if (!quizType) {
        return (
            <div className="p-4 bg-white rounded-lg shadow-md text-center">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Chọn loại Quiz Kanji</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => startQuiz('kanji-han_tu')} className="bg-[#093FB4] text-white py-3 px-6 rounded-md hover:bg-[#072f8a] transition-colors">Kanji → Hán tự</button>
                    <button onClick={() => startQuiz('han_tu-kanji')} className="bg-[#093FB4] text-white py-3 px-6 rounded-md hover:bg-[#072f8a] transition-colors">Hán tự → Kanji</button>
                </div>
                {feedback && <p className="mt-4 text-red-500 font-medium">{feedback}</p>}
                 <button onClick={onGoBack} className="mt-6 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600">Quay lại</button>
            </div>
        );
    }

    if (!currentQuestion) {
        return (
            <div className="p-4 bg-white rounded-lg shadow-md text-center">
                <p className="text-lg text-gray-700">Đang chuẩn bị câu hỏi...</p>
            </div>
        );
    }

    return (
        <div className="p-4 bg-white rounded-lg shadow-md text-center">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">{currentQuestion.question}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {options.map((option, index) => (
                    <button key={index} onClick={() => handleAnswer(option)} className="bg-[#FFD8D8] text-slate-900 py-3 px-6 rounded-md hover:bg-red-200 text-lg font-semibold transition-colors">
                        {option}
                    </button>
                ))}
            </div>
            {feedback && (
                <p className={`mt-4 text-xl font-bold ${feedback.includes('🎉ビンゴ!') ? 'text-green-600' : 'text-red-600'}`}>{feedback}</p>
            )}
            <button onClick={handleStopQuiz} className="mt-6 bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600">
                End game hoy 👉
            </button>
        </div>
    );
};

// -- Vocabulary Quiz Section --
const VocabularyQuizSection = ({ vocabularyList, onQuizEnd, onGoBack }) => {
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [options, setOptions] = useState([]);
    const [quizType, setQuizType] = useState('');
    const [feedback, setFeedback] = useState('');
    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);

    const generateQuestion = (type) => {
        if (vocabularyList.length < 4) return;
        const correctVocab = vocabularyList[Math.floor(Math.random() * vocabularyList.length)];
        let questionText = '', correctAnswer = '', incorrectOptions = [];
        
        switch (type) {
            case 'word_furigana-meaning':
                questionText = `${correctVocab.word} (${correctVocab.furigana})`;
                correctAnswer = correctVocab.meaning;
                incorrectOptions = vocabularyList.filter(v => v.id !== correctVocab.id).map(v => v.meaning);
                break;
            case 'meaning-word_furigana':
                questionText = correctVocab.meaning;
                correctAnswer = `${correctVocab.word} (${correctVocab.furigana})`;
                incorrectOptions = vocabularyList.filter(v => v.id !== correctVocab.id).map(v => `${v.word} (${v.furigana})`);
                break;
            default: return;
        }

        const uniqueIncorrectOptions = Array.from(new Set(incorrectOptions)).filter(opt => opt && opt !== correctAnswer);
        const finalOptions = shuffleArray([...shuffleArray(uniqueIncorrectOptions).slice(0, 3), correctAnswer]);

        setCurrentQuestion({ question: questionText, correctAnswer: correctAnswer });
        setOptions(finalOptions);
    };

    const startQuiz = (type) => {
        if (vocabularyList.length < 4) {
            setFeedback('Cần ít nhất 4 từ vựng để bắt đầu quiz.');
            return;
        }
        setQuizType(type);
        setCorrectAnswers(0);
        setTotalQuestions(0);
        setFeedback('');
        generateQuestion(type);
    };

    const handleAnswer = (selectedAnswer) => {
        setTotalQuestions(prev => prev + 1);
        if (selectedAnswer === currentQuestion.correctAnswer) {
            setCorrectAnswers(prev => prev + 1);
            setFeedback('�ビンゴ!');
        } else {
            setFeedback(`ちょっと. Đáp án đúng là: ${currentQuestion.correctAnswer}`);
        }
        setTimeout(() => {
            setFeedback('');
            generateQuestion(quizType);
        }, 1500);
    };
    
    const handleStopQuiz = () => {
        onQuizEnd(correctAnswers, totalQuestions, quizType);
    };

    if (!quizType) {
        return (
             <div className="p-4 bg-white rounded-lg shadow-md text-center">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Chọn loại Quiz Từ Vựng</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => startQuiz('word_furigana-meaning')} className="bg-[#093FB4] text-white py-3 px-6 rounded-md hover:bg-[#072f8a] transition-colors">Từ vựng → Nghĩa</button>
                    <button onClick={() => startQuiz('meaning-word_furigana')} className="bg-[#093FB4] text-white py-3 px-6 rounded-md hover:bg-[#072f8a] transition-colors">Nghĩa → Từ vựng</button>
                </div>
                {feedback && <p className="mt-4 text-red-500 font-medium">{feedback}</p>}
                <button onClick={onGoBack} className="mt-6 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600">Quay lại</button>
            </div>
        );
    }
    
    if (!currentQuestion) {
        return (
            <div className="p-4 bg-white rounded-lg shadow-md text-center">
                <p className="text-lg text-gray-700">Đang chuẩn bị câu hỏi...</p>
            </div>
        );
    }
    
     return (
        <div className="p-4 bg-white rounded-lg shadow-md text-center">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">{currentQuestion.question}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {options.map((option, index) => (
                    <button key={index} onClick={() => handleAnswer(option)} className="bg-[#FFD8D8] text-slate-900 py-3 px-6 rounded-md hover:bg-red-200 text-lg font-semibold transition-colors">
                        {option}
                    </button>
                ))}
            </div>
            {feedback && (
                <p className={`mt-4 text-xl font-bold ${feedback.includes('🎉ビンゴ!') ? 'text-green-600' : 'text-red-600'}`}>{feedback}</p>
            )}
            <button onClick={handleStopQuiz} className="mt-6 bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600">
                End game hoy 👉
            </button>
        </div>
    );
};


// =================================================================
// MAIN APP COMPONENT
// =================================================================
const App = () => {
  const API_URL = 'http://localhost:3001/api';
  const ITEMS_PER_PAGE = 10;

  // --- STATE QUẢN LÝ CHUNG ---
  const [activeTab, setActiveTab] = useState('kanji');
  const [kanjiList, setKanjiList] = useState([]);
  const [vocabularyList, setVocabularyList] = useState([]);
  const [viewState, setViewState] = useState('main'); // 'main', 'quiz', 'end'
  
  // State cho phân trang
  const [kanjiPage, setKanjiPage] = useState(1);
  const [vocabPage, setVocabPage] = useState(1);

  // THÊM MỚI: State cho tìm kiếm
  const [kanjiSearchTerm, setKanjiSearchTerm] = useState('');
  const [vocabSearchTerm, setVocabSearchTerm] = useState('');

  const [quizResult, setQuizResult] = useState({ score: 0, total: 0, type: '' });
  const [newKanji, setNewKanji] = useState({ kanji_char: '', han_tu: '', onyomi: '', kunyomi: '', meaning: '', level: 'N3' });
  const [newVocabulary, setNewVocabulary] = useState({ word: '', furigana: '', meaning: '', level: 'N3' });

  // Tải dữ liệu từ Backend
  useEffect(() => {
    const fetchData = async () => {
        try {
            const [kanjiRes, vocabRes] = await Promise.all([
                fetch(`${API_URL}/kanji`),
                fetch(`${API_URL}/vocabulary`)
            ]);
            if (!kanjiRes.ok || !vocabRes.ok) {
                throw new Error('Lỗi mạng khi tải dữ liệu');
            }
            const kanjiData = await kanjiRes.json();
            const vocabData = await vocabRes.json();
            setKanjiList(kanjiData);
            setVocabularyList(vocabData);
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu từ server:", error);
            alert("Không thể kết nối đến server. Vui lòng đảm bảo backend đang chạy.");
        }
    };
    fetchData();
  }, []);

  // THÊM MỚI: Lọc danh sách dựa trên từ khóa tìm kiếm
  const filteredKanji = useMemo(() => {
    const term = kanjiSearchTerm.toLowerCase();
    if (!term) return kanjiList;
    return kanjiList.filter(k => 
        (k.kanji_char || '').toLowerCase().includes(term) ||
        (k.han_tu || '').toLowerCase().includes(term) ||
        (k.onyomi || '').toLowerCase().includes(term) ||
        (k.kunyomi || '').toLowerCase().includes(term) ||
        (k.meaning || '').toLowerCase().includes(term)
    );
  }, [kanjiSearchTerm, kanjiList]);

  const filteredVocab = useMemo(() => {
    const term = vocabSearchTerm.toLowerCase();
    if (!term) return vocabularyList;
    return vocabularyList.filter(v => 
        (v.word || '').toLowerCase().includes(term) ||
        (v.furigana || '').toLowerCase().includes(term) ||
        (v.meaning || '').toLowerCase().includes(term)
    );
  }, [vocabSearchTerm, vocabularyList]);

  // --- HÀM XỬ LÝ (Handlers) ĐỂ GỌI API ---
  const handleNewKanjiChange = (e) => setNewKanji(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleAddKanji = async (e) => {
    e.preventDefault();
    try {
        const response = await fetch(`${API_URL}/kanji`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newKanji)
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Lỗi khi thêm Kanji');
        }
        const addedKanji = await response.json();
        setKanjiList(prev => [addedKanji, ...prev]);
        setKanjiPage(1);
        setNewKanji({ kanji_char: '', han_tu: '', onyomi: '', kunyomi: '', meaning: '', level: 'N3' });
    } catch (error) {
        console.error("Lỗi khi thêm Kanji:", error);
        alert(`Lỗi: ${error.message}`);
    }
  };
  
  const handleNewVocabularyChange = (e) => setNewVocabulary(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleAddVocabulary = async (e) => {
    e.preventDefault();
    try {
        const vocabToSend = {
            word: newVocabulary.word,
            furigana: newVocabulary.furigana,
            meaning: newVocabulary.meaning,
            level: newVocabulary.level
        };
        const response = await fetch(`${API_URL}/vocabulary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vocabToSend)
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Lỗi khi thêm từ vựng');
        }
        const addedVocab = await response.json();
        setVocabularyList(prev => [addedVocab, ...prev]);
        setVocabPage(1);
        setNewVocabulary({ word: '', furigana: '', meaning: '', level: 'N3' });
    } catch (error) {
        console.error("Lỗi khi thêm từ vựng:", error);
        alert(`Lỗi: ${error.message}`);
    }
  };
  
  const handleQuizEnd = (score, total, type) => {
      console.log("Quiz đã kết thúc! Điểm số:", score, "Tổng số câu:", total);
      setQuizResult({ score, total, type });
      setViewState('end');
  };
  
  const handleRestartQuiz = () => {
      setQuizResult({ score: 0, total: 0, type: '' });
      setViewState('quiz');
  };
  
  const handleGoBackToMain = () => {
       setViewState('main');
  };

  const handleTabChange = (tab) => {
      setActiveTab(tab);
      setViewState('main');
  };

  // --- HÀM LẤY GIF DỰA TRÊN ĐIỂM SỐ ---
  const getFeedbackGif = (score, total) => {
    if (total === 0) {
        return "/Mucho Estudio GIF - Anime Study Concentrate - Discover & Share GIFs.gif";
    }
    const percentage = (score / total) * 100;

    if (percentage >= 70) {
        return "/yay-yeah.gif";
    } else {
        return "/OpOe.gif"; 
    } 
  };

  return (
    <div className="min-h-screen bg-[#FFFCFB] font-sans text-gray-900 flex flex-col">
      <header className="bg-gradient-to-r from-rose-400 to-red-500 text-white p-4 shadow-lg">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center">
            <img
              src="/logo_page.png"
              alt="Logo Học tiếng Nhật"
              className="h-10 w-10 mr-3 rounded-full bg-white"
            />
            <h1 className="text-3xl font-bold">AyaLearning</h1>
          </div>

          {/* THAY ĐỔI: Di chuyển thanh tìm kiếm lên header */}
          {viewState === 'main' && (
            <div className="relative flex-grow max-w-lg w-full">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none">
                        <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </span>
                <input
                    type="text"
                    placeholder={activeTab === 'kanji' ? "Tìm kiếm Kanji..." : "Tìm kiếm từ vựng..."}
                    value={activeTab === 'kanji' ? kanjiSearchTerm : vocabSearchTerm}
                    onChange={activeTab === 'kanji' ? (e) => setKanjiSearchTerm(e.target.value) : (e) => setVocabSearchTerm(e.target.value)}
                    className="w-full py-2 pl-10 pr-4 text-gray-700 bg-white border border-transparent rounded-full focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-200"
                />
            </div>
          )}

          <nav className="flex space-x-4">
            <button onClick={() => handleTabChange('kanji')} className={`py-2 px-4 rounded-md transition-colors duration-300 ${activeTab === 'kanji' ? 'bg-white text-red-600 shadow-md font-semibold' : 'hover:bg-white/20'}`}>Học Kanji</button>
            <button onClick={() => handleTabChange('vocabulary')} className={`py-2 px-4 rounded-md transition-colors duration-300 ${activeTab === 'vocabulary' ? 'bg-white text-red-600 shadow-md font-semibold' : 'hover:bg-white/20'}`}>Học Từ Vựng</button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto p-4 mt-4 flex-grow">
        {viewState === 'main' && activeTab === 'kanji' && (
          <KanjiSection
            kanjiList={filteredKanji}
            newKanji={newKanji}
            handleNewKanjiChange={handleNewKanjiChange}
            handleAddKanji={handleAddKanji}
            onStartQuiz={() => setViewState('quiz')}
            currentPage={kanjiPage}
            onPageChange={setKanjiPage}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        )}
        {viewState === 'main' && activeTab === 'vocabulary' && (
          <VocabularySection
            vocabularyList={filteredVocab}
            newVocabulary={newVocabulary}
            handleNewVocabularyChange={handleNewVocabularyChange}
            handleAddVocabulary={handleAddVocabulary}
            onStartQuiz={() => setViewState('quiz')}
            currentPage={vocabPage}
            onPageChange={setVocabPage}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        )}
        {viewState === 'quiz' && activeTab === 'kanji' && (
          <KanjiQuizSection
            kanjiList={kanjiList}
            onQuizEnd={handleQuizEnd}
            onGoBack={handleGoBackToMain}
          />
        )}
        {viewState === 'quiz' && activeTab === 'vocabulary' && (
          <VocabularyQuizSection
            vocabularyList={vocabularyList}
            onQuizEnd={handleQuizEnd}
            onGoBack={handleGoBackToMain}
          />
        )}
        {viewState === 'end' && (
          <QuizEndScreen
            score={quizResult.score}
            total={quizResult.total}
            imageSrc={getFeedbackGif(quizResult.score, quizResult.total)}
            imageAlt="Feedback GIF"
            onRestart={handleRestartQuiz}
            onGoBack={handleGoBackToMain}
          />
        )}
      </main>

      <footer className="bg-gray-800 text-white p-4 text-center mt-8">
        <p>Learning Japanese with Aya ✍(◔◡◔)</p>
      </footer>

      {/* Add ChatBot component */}
      <ChatBot />
    </div>
  );
};

export default App;
