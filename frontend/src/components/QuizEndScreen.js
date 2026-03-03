import React from 'react';

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

export default QuizEndScreen;
