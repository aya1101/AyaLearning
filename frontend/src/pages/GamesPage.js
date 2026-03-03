import React, { useState } from 'react';
import Games from '../components/Games';
import ShiritoriGameNew from '../components/ShiritoriGameNew';

const GamesPage = ({ token }) => {
  const [selectedGame, setSelectedGame] = useState(null);

  if (selectedGame === 'shiritori') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b shadow-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center">
            <button
              onClick={() => setSelectedGame(null)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 font-semibold"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to Games</span>
            </button>
          </div>
        </div>
        <ShiritoriGameNew 
          token={token}
          difficulty="N5"
          gameMode="casual"
        />
      </div>
    );
  }

  return <Games token={token} onGameClick={setSelectedGame} />;
};

export default GamesPage;
