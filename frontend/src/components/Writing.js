import React from 'react';

const Writing = () => {
  return (
    <div className="p-8 bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-8">
      <h2 className="text-3xl font-bold mb-6 text-orange-600">Luyện viết Kanji</h2>
      <p className="mb-4 text-gray-700">Tính năng luyện viết, upload ảnh và nhận diện chữ viết sẽ được phát triển tại đây.</p>
      <div className="bg-orange-100 p-6 rounded-lg shadow text-center">
        <span className="text-2xl">✍️</span>
        <p className="mt-2 text-orange-700">Hãy luyện viết Kanji thường xuyên để nhớ lâu hơn!</p>
      </div>
    </div>
  );
};

export default Writing;
