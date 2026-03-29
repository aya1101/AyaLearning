import React, { useEffect, useMemo, useState } from 'react';

const TarotCard = ({ character, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="relative group cursor-pointer perspective-1000"
    >
      {/* Tarot Card Container */}
      <div className="relative w-full h-full min-h-[480px] flex flex-col transform transition-all duration-500 hover:scale-105 hover:-translate-y-2">
        {/* Card Border & Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-200 via-yellow-100 to-amber-300 rounded-2xl shadow-2xl group-hover:shadow-amber-500/50 transition-shadow duration-500" />
        
        {/* Inner Card */}
        <div className="absolute inset-2 bg-gradient-to-b from-amber-50 to-white rounded-xl overflow-hidden border-2 border-amber-400/50 flex flex-col">
          {/* Decorative Top Border */}
          <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-amber-300/30 to-transparent" />
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-20 h-1 bg-amber-600/40 rounded-full" />
          
          {/* Character Image */}
          <div className="relative w-full pt-10 pb-4 px-4 flex-none flex items-center justify-center">
            <div className="relative w-40 h-40 rounded-full bg-gradient-to-br from-amber-100 to-yellow-50 shadow-inner flex items-center justify-center overflow-hidden border-4 border-amber-300/50">
              {character.image ? (
                <img 
                  src={character.image} 
                  alt={character.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-6xl">{character.icon || '✨'}</div>
              )}
            </div>
            
            {/* Decorative Stars */}
            <div className="absolute top-2 left-4 text-amber-400 text-2xl opacity-70">★</div>
            <div className="absolute top-4 right-4 text-amber-300 text-xl opacity-60">✦</div>
            <div className="absolute bottom-4 left-6 text-yellow-400 text-lg opacity-50">✧</div>
          </div>
          
          {/* Character Info */}
          <div className="relative px-6 pb-10 text-center flex-1 flex flex-col">
            {/* Name with Japanese style */}
            <h3 className="text-2xl font-bold text-gray-800 mb-1 tracking-wide">
              {character.name}
            </h3>
            <p className="text-sm text-amber-700 font-semibold mb-2">
              {character.nameJp}
            </p>
            
            {/* Age & Info */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                {character.age}歳
              </span>
              <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-semibold">
                {character.level}
              </span>
            </div>
            
            {/* Personality Tags */}
            <div className="flex flex-wrap gap-2 justify-center mb-2">
              {character.personality.slice(0, 3).map((trait, idx) => (
                <span 
                  key={idx}
                  className="text-xs px-2 py-1 bg-gradient-to-r from-amber-50 to-yellow-50 text-gray-700 rounded-full border border-amber-200"
                >
                  {trait}
                </span>
              ))}
            </div>
            
            {/* Description */}
            <p className="text-sm text-gray-600 leading-relaxed flex-1 flex items-center justify-center">
              {character.description}
            </p>
          </div>
          
          {/* Decorative Bottom Border */}
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-amber-300/30 to-transparent" />
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-amber-600/40 rounded-full" />
        </div>
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-6">
          <span className="text-amber-900 font-bold text-lg drop-shadow-lg">
            会話を始める
          </span>
        </div>
      </div>
    </div>
  );
};

const CharacterSelection = ({ token, onCharacterSelect }) => {
  const NYANKO_MODEL_PATH = '/game-data/nyanko_model/nyanko_model/free1/free1.model3.json';
  const fallbackCharacters = useMemo(() => [
    {
      id: 'anya',
      name: 'Anya',
      nameJp: 'アーニャ',
      age: 6,
      level: 'N5-N4',
      personality: ['天真爛漫', '好奇心旺盛', 'かわいい'],
      description: '明るくて元気な女の子。ピーナッツが大好き。簡単な日本語で楽しく会話できます。',
      icon: '🎀',
      image: '/game-data/ANIYA/ANIYA/1.png',
      difficulty: 'beginner',
      topics: ['家族', '学校', '食べ物', '遊び'],
      hasLive2D: true,
      live2dModelPath: '/game-data/ANIYA/ANIYA/ANIYA.model3.json',
      greeting: 'わくわく！こんにちは！アーニャだよ！一緒に遊ぼう！🎀'
    },
    {
      id: 'sensei',
      name: 'Asuka Sensei',
      nameJp: 'アスカ先生',
      age: 25,
      level: 'N3-N2',
      personality: ['優しい', '教育熱心', '丁寧'],
      description: '経験豊富な日本語の先生。丁寧な言葉遣いで、文法や表現を教えてくれます。',
      icon: '👩‍🏫',
      image: '/game-data/ASUKA/ASUKA/ICON.PNG',
      difficulty: 'intermediate',
      topics: ['文法', 'ビジネス', '敬語', '文化'],
      hasLive2D: true,
      live2dModelPath: '/game-data/ASUKA/ASUKA/Asuka.model3.json',
      greeting: 'こんにちは。アスカと申します。日本語の勉強を頑張りましょうね。よろしくお願いします。'
    },
    {
      id: 'yuki',
      name: 'Nyanko-chan',
      nameJp: 'ニャンコちゃん',
      age: 13,
      level: 'N4-N3',
      personality: ['猫好き', '甘えん坊', 'いたずら好き'],
      description: '13歳の可愛い猫耳メイド。セクシーで甘い話し方。アニメやゲームが大好き。',
      icon: '🐱‍👩‍🍳',
      image: '/game-data/nyanko_model/nyanko_model/ava.png',
      difficulty: 'intermediate',
      topics: ['アニメ', 'ゲーム', '猫', 'ファッション'],
      hasLive2D: true,
      live2dModelPath: '/game-data/nyanko_model/nyanko_model/free1/free1.model3.json',
      greeting: 'にゃあ〜！ニャンコちゃんだよ♡ 何かお手伝いしましょうか？🐱'
    }
  ], [NYANKO_MODEL_PATH]);

  const [characters, setCharacters] = useState(fallbackCharacters);

  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const response = await fetch('/api/kaiwa/characters', {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch characters');
        }

        const data = await response.json();
        if (Array.isArray(data.characters) && data.characters.length > 0) {
          const fallbackMap = new Map(fallbackCharacters.map((char) => [char.id, char]));

          const normalizedCharacters = data.characters.map((character) => {
            const fallbackCharacter = fallbackMap.get(character.id) || {};
            const live2dModelPath =
              character.live2dModelPath ||
              (character.id === 'yuki' ? NYANKO_MODEL_PATH : fallbackCharacter.live2dModelPath || null);

            return {
              ...fallbackCharacter,
              ...character,
              live2dModelPath,
              hasLive2D: Boolean(live2dModelPath)
            };
          });

          setCharacters(normalizedCharacters);
        }
      } catch (error) {
        console.warn('Using fallback Kaiwa characters:', error.message);
      }
    };

    loadCharacters();
  }, [token, fallbackCharacters]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50">
      {/* Header */}
      <div className="container mx-auto px-4 py-12 sm:py-16">
        {/* Title Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 text-transparent bg-clip-text">
            Kaiwa 会話
          </h1>
          <p className="text-xl text-gray-700 mb-2">
            キャラクターと日本語で話しましょう
          </p>
          <p className="text-gray-600">
            Choose a character to practice Japanese conversation
          </p>
        </div>

        {/* Introduction Card */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="bg-white rounded-2xl shadow-lg p-8 border-l-4 border-amber-500">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-3xl">💬</span>
              会話練習について
            </h2>
            <div className="space-y-3 text-gray-700">
              <p className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">✨</span>
                <span>各キャラクターには独自の性格と話し方があります</span>
              </p>
              <p className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">🎯</span>
                <span>レベルに合わせてキャラクターを選びましょう</span>
              </p>
              <p className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">🌟</span>
                <span>自然な日本語の会話を体験できます</span>
              </p>
              <p className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">📚</span>
                <span>間違いを恐れずに、たくさん話してみましょう！</span>
              </p>
            </div>
          </div>
        </div>

        {/* Character Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 max-w-7xl mx-auto mb-12">
          {characters.map(character => (
            <TarotCard
              key={character.id}
              character={character}
              onClick={() => onCharacterSelect(character)}
            />
          ))}
        </div>

        {/* Coming Soon Section */}
        <div className="mt-16 pt-12 border-t-2 border-amber-300">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            🌟 もっとキャラクターが登場予定
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 max-w-7xl mx-auto">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="relative w-full h-full min-h-[480px]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 rounded-2xl shadow-lg opacity-60" />
                <div className="absolute inset-2 bg-white rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-gray-300">
                  <div className="text-6xl mb-4 opacity-30">❓</div>
                  <p className="text-gray-500 font-semibold">Coming Soon</p>
                  <p className="text-gray-400 text-sm mt-2">新しいキャラクター</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips Section */}
        <div className="mt-16 max-w-4xl mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="text-3xl">💡</span>
            会話のコツ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 shadow">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="text-xl">🎯</span>
                自己紹介から始めよう
              </h3>
              <p className="text-sm text-gray-600">
                まず自己紹介をして、相手のことも聞いてみましょう
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="text-xl">❓</span>
                質問をたくさんしよう
              </h3>
              <p className="text-sm text-gray-600">
                分からないことは遠慮なく質問してください
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="text-xl">🌱</span>
                簡単な言葉でOK
              </h3>
              <p className="text-sm text-gray-600">
                完璧じゃなくても大丈夫。シンプルに伝えましょう
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="text-xl">🔄</span>
                繰り返し練習しよう
              </h3>
              <p className="text-sm text-gray-600">
                何度も会話して、自然な表現を身につけよう
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterSelection;
