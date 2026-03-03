import React from 'react';

const GameCard = ({ title, description, icon, image, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="relative rounded-2xl overflow-hidden group cursor-pointer"
    >
      {/* Shadow/Fade effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-rose-200/30 via-pink-200/20 to-rose-300/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      {/* Card */}
      <div className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 min-h-64 flex flex-col items-center justify-center text-center border border-rose-100/50">
        <div className="w-full mb-4 group-hover:scale-110 transition-transform duration-300 flex justify-center">
          {image ? (
            <img 
              src={image} 
              alt={title}
              className="max-h-40 max-w-full object-contain"
            />
          ) : (
            <div className="text-8xl">{icon}</div>
          )}
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-700 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
};

const Games = ({ token, onGameClick }) => {
  const games = [
    {
      id: 'shiritori',
      title: 'Shiritori (Nối chữ)',
      description: 'Nối các từ tiếng Nhật theo chữ cuối cùng. Thử thách trí nhớ và vốn từ của bạn!',
      icon: '🔤',
      image: '/shiritori_1.webp'
    },
    {
      id: 'karuta',
      title: 'Karuta',
      description: 'Trò chơi ghép thẻ truyền thống Nhật Bản. Tìm và khớp các cặp thẻ nhanh nhất!',
      icon: '🃏',
      image: '/OpOe.gif'
    },
    {
      id: 'fukuwarai',
      title: 'Fukuwarai (Vui Ghép chữ)',
      description: 'Ghép bộ thủ kanji đúng vị trí hoặc hoàn thành câu. Kiểm tra kiến thức cấu trúc chữ!',
      icon: '🧩',
      image: '/furiwakai.jpg'
    }
  ];

  const handleGameClick = (gameId) => {
    if (onGameClick) {
      onGameClick(gameId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 sm:py-16">
        {/* Introduction */}
        <div className="mb-12">
          <div className="bg-white rounded-2xl shadow-lg p-8 border-l-4 border-rose-500">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">📚 Cách chơi</h2>
            <p className="text-gray-700 leading-relaxed">
              Chọn một trò chơi và bắt đầu hành trình học tiếng Nhật của bạn! Mỗi trò chơi được thiết kế để rèn luyện các kỹ năng khác nhau như từ vựng, cấu trúc kanji, và khả năng phản xạ. Hãy thử thách bản thân và nâng cao trình độ của bạn!
            </p>
          </div>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {games.map(game => (
            <GameCard
              key={game.id}
              title={game.title}
              description={game.description}
              icon={game.icon}
              image={game.image}
              onClick={() => handleGameClick(game.id)}
            />
          ))}
        </div>

        {/* Coming Soon Section */}
        <div className="mt-16 pt-12 border-t-2 border-gray-300">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">🚀 Sắp ra mắt</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="bg-gray-200 rounded-2xl p-8 shadow-lg opacity-60 min-h-64 flex flex-col items-center justify-center text-center"
              >
                <div className="text-6xl mb-4 opacity-50">❓</div>
                <h3 className="text-xl font-bold text-gray-600">Trò chơi mới</h3>
                <p className="text-gray-500 text-sm mt-2">Chúng tôi sẽ sớm thêm các trò chơi mới!</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tips Section */}
        <div className="mt-16 bg-blue-50 rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">💡 Mẹo học tập</h2>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start">
              <span className="text-2xl mr-3">✨</span>
              <span>Chơi hàng ngày để xây dựng thói quen học tập</span>
            </li>
            <li className="flex items-start">
              <span className="text-2xl mr-3">📈</span>
              <span>Bắt đầu từ mức độ dễ trước khi nâng lên khó</span>
            </li>
            <li className="flex items-start">
              <span className="text-2xl mr-3">🏆</span>
              <span>Thu thập điểm và hoàn thành các thử thách để mở khóa phần thưởng</span>
            </li>
            <li className="flex items-start">
              <span className="text-2xl mr-3">👥</span>
              <span>Chia sẻ kết quả với bạn bè và tạo động lực cùng nhau</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Games;
