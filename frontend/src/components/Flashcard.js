
import React, { useState } from 'react';

const Flashcard = ({ item, items, type }) => {
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const cardItems = Array.isArray(items) ? items : (item ? [item] : []);
  if (cardItems.length === 0) return null;
  const currentItem = cardItems[current];
  const handlePrev = () => {
    setFlipped(false);
    setCurrent((prev) => (prev === 0 ? cardItems.length - 1 : prev - 1));
  };
  const handleNext = () => {
    setFlipped(false);
    setCurrent((prev) => (prev === cardItems.length - 1 ? 0 : prev + 1));
  };

  // Render front/back for Kanji
  const renderFront = () => (
    <div className="flex flex-col items-center p-4">
      <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-blue-700 mb-2">
        {type === 'vocab'
          ? (currentItem.word_jp || currentItem.word || currentItem.word_kana)
          : (currentItem.kanji_char || currentItem.character)}
      </div>
      <div className="text-gray-500 text-base sm:text-lg mb-1 text-center">{currentItem.meaning_vi || currentItem.meaning}</div>
      <div className="text-gray-400 text-sm sm:text-base mb-1 text-center">{currentItem.meaning_en}</div>
      <div className="text-xs text-gray-400 text-center">
        {type === 'vocab'
          ? `${currentItem.part_of_speech || ''} ${currentItem.word_kana ? `| ${currentItem.word_kana}` : ''}`.trim()
          : `${currentItem.part_of_speech || ''} ${currentItem.jlpt_level ? `| JLPT: ${currentItem.jlpt_level}` : ''}`.trim()}
      </div>
    </div>
  );
  const renderBack = () => (
    <div className="flex flex-col items-center p-4">
      {type === 'vocab' ? (
        <>
          <div className="text-base sm:text-lg text-gray-700 mb-1 text-center">
            Kana: <span className="font-semibold">{currentItem.word_kana || currentItem.furigana || '-'}</span>
          </div>
          <div className="text-base sm:text-lg text-gray-700 mb-1 text-center">
            Romaji: <span className="font-semibold">{currentItem.word_romaji || currentItem.romaji || '-'}</span>
          </div>
          <div className="text-base sm:text-lg text-gray-700 mb-1 text-center">
            JLPT: <span className="font-semibold">{currentItem.jlpt_level || currentItem.level || '-'}</span>
          </div>
          <div className="text-xs text-gray-400 mt-2">Nhấn vào thẻ để lật</div>
        </>
      ) : (
        <>
          <div className="text-base sm:text-lg text-gray-700 mb-1 text-center">Onyomi: <span className="font-semibold">{currentItem.onyomi}</span></div>
          <div className="text-base sm:text-lg text-gray-700 mb-1 text-center">Kunyomi: <span className="font-semibold">{currentItem.kunyomi}</span></div>
          <div className="text-base sm:text-lg text-gray-700 mb-1 text-center">Hán tự: <span className="font-semibold">{currentItem.han_tu || currentItem.example_word}</span></div>
          <div className="text-xs text-gray-400 mt-2">Số nét: {currentItem.strokes}</div>
        </>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto px-4 mt-8">
      <div
        className="relative w-full h-56 sm:h-64 md:h-72 flex items-center justify-center cursor-pointer select-none"
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped(f => !f)}
      >
        <div
          className={`flashcard-inner w-full h-full` + (flipped ? ' flipped' : '')}
        >
          <div
            className="flashcard-front absolute w-full h-full rounded-2xl bg-white shadow-2xl flex flex-col items-center justify-center"
          >
            {renderFront()}
          </div>
          <div
            className="flashcard-back absolute w-full h-full rounded-2xl bg-white shadow-2xl flex flex-col items-center justify-center"
          >
            {renderBack()}
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center mt-4 gap-4">
        <button
          onClick={handlePrev}
          className="px-3 sm:px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm sm:text-base transition-colors"
        >
          Trước
        </button>
        <span className="text-gray-600 text-sm sm:text-base font-medium">{current + 1} / {cardItems.length}</span>
        <button
          onClick={handleNext}
          className="px-3 sm:px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm sm:text-base transition-colors"
        >
          Sau
        </button>
      </div>
      <style>{`
        .flashcard-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.6s cubic-bezier(.4,2,.6,1);
          transform-style: preserve-3d;
        }
        .flashcard-inner.flipped {
          transform: rotateY(180deg);
        }
        .flashcard-front, .flashcard-back {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
        }
        .flashcard-back {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
};

export default Flashcard;
