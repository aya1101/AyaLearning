import React, { useState } from 'react';
import QuizEndScreen from './QuizEndScreen';

// quizType: 'kanji-han_tu' | 'han_tu-kanji' | 'kanji-onyomi_kunyomi'
// items: array of kanji objects
const MultipleChoiceQuiz = ({ items, quizType, onGoBack }) => {
  // Generate 10 random questions
  const generateQuestions = () => {
    const shuffled = [...items].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);
    return selected.map((item) => {
      let question = '', correct = '', options = [];
      if (quizType === 'kanji-han_tu') {
        question = item.kanji_char || item.character;
        correct = item.han_tu || item.example_word;
        // pick 3 random wrong han_tu
        const wrongs = items.filter(k => (k.han_tu || k.example_word) !== correct)
          .sort(() => 0.5 - Math.random()).slice(0, 3).map(k => k.han_tu || k.example_word);
        options = [...wrongs, correct].sort(() => 0.5 - Math.random());
      } else if (quizType === 'han_tu-kanji') {
        question = item.han_tu || item.example_word;
        correct = item.kanji_char || item.character;
        const wrongs = items.filter(k => (k.kanji_char || k.character) !== correct)
          .sort(() => 0.5 - Math.random()).slice(0, 3).map(k => k.kanji_char || k.character);
        options = [...wrongs, correct].sort(() => 0.5 - Math.random());
      } else if (quizType === 'kanji-onyomi_kunyomi') {
        question = item.kanji_char || item.character;
        correct = (item.onyomi || '') + (item.kunyomi ? ' / ' + item.kunyomi : '');
        const wrongs = items.filter(k => (k.onyomi + k.kunyomi) !== (item.onyomi + item.kunyomi))
          .sort(() => 0.5 - Math.random()).slice(0, 3)
          .map(k => (k.onyomi || '') + (k.kunyomi ? ' / ' + k.kunyomi : ''));
        options = [...wrongs, correct].sort(() => 0.5 - Math.random());
      }
      return { question, correct, options };
    });
  };



  // Always call hooks first
  const [questions] = useState(items && items.length >= 4 ? generateQuestions() : []);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [showEnd, setShowEnd] = useState(false);
  const [selected, setSelected] = useState(null);

  // Guard: need at least 4 items to make a quiz
  if (!items || items.length < 4) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-lg shadow-lg p-6 mt-8 text-center">
        <div className="text-2xl font-bold text-red-500 mb-4">Không đủ dữ liệu để tạo quiz!</div>
        <div className="mb-4 text-gray-700">Cần ít nhất 4 Kanji để tạo câu hỏi trắc nghiệm.</div>
        <button onClick={onGoBack} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Quay lại</button>
      </div>
    );
  }

  const handleSelect = (opt) => {
    setSelected(opt);
    if (opt === questions[current].correct) setScore(s => s + 1);
    setTimeout(() => {
      if (current === 9) setShowEnd(true);
      else {
        setCurrent(c => c + 1);
        setSelected(null);
      }
    }, 700);
  };

  const handleRestart = () => {
    setCurrent(0);
    setScore(0);
    setShowEnd(false);
    setSelected(null);
  };

  if (showEnd) {
    return <QuizEndScreen score={score} total={10} onRestart={handleRestart} onGoBack={onGoBack} imageSrc={score >= 8 ? '/yay-yeah.gif' : '/OpOe.gif'} imageAlt="Quiz result" />;
  }

  // Defensive: questions[current] may be undefined if something went wrong
  const q = questions[current];
  if (!q) return null;

  return (
    <div className="max-w-xl mx-auto bg-white rounded-lg shadow-lg p-6 mt-8">
      <div className="mb-4 text-lg font-semibold text-blue-700">Câu {current + 1} / 10</div>
      <div className="mb-6 text-2xl font-bold text-gray-800">{q.question}</div>
      <div className="grid grid-cols-1 gap-4">
        {q.options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => !selected && handleSelect(opt)}
            className={`py-3 px-4 rounded-lg border text-lg font-medium transition-all duration-150
              ${selected
                ? opt === q.correct
                  ? 'bg-green-100 border-green-500 text-green-700'
                  : opt === selected
                  ? 'bg-red-100 border-red-500 text-red-700'
                  : 'bg-gray-100 border-gray-200 text-gray-500'
                : 'bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-400'}
            `}
            disabled={!!selected}
          >
            {opt || <span className="italic text-gray-400">(trống)</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MultipleChoiceQuiz;
