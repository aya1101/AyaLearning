import React from 'react';

const DictionarySearchModal = ({ isOpen, onClose, searchResults, isLoading }) => {
  if (!isOpen) return null;

  const { query = '', results = {} } = searchResults || {};
  const { words = [], kanji = [], vocabulary = [] } = results;

  const totalResults = words.length + kanji.length + vocabulary.length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-400 to-red-500 text-white p-4 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-bold">
            「{query}」
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin">
                <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="mt-2 text-gray-600">Đang tìm kiếm...</p>
            </div>
          ) : totalResults === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">Không tìm thấy 😢</p>
              <p className="text-sm mt-2">Thử từ khóa khác hoặc kiểm tra cách viết</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Words Results - Mazii style */}
              {words.length > 0 && (
                <div>
                  <h3 className="font-bold text-sm uppercase text-gray-600 mb-3 px-2">
                    📝 Từ ({words.length})
                  </h3>
                  <div className="space-y-3">
                    {words.map((word, idx) => (
                      <div key={idx} className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded hover:bg-blue-100 transition-colors">
                        {/* Main word header */}
                        <div className="flex items-baseline justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {word.kanji && (
                                <span className="text-2xl font-bold text-blue-900">{word.kanji}</span>
                              )}
                              <span className="text-xl font-semibold text-gray-700">
                                {word.kana}
                              </span>
                              {word.romaji && (
                                <span className="text-sm text-gray-500 font-mono">
                                  [{word.romaji}]
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">
                            {word.jlptLevel}
                          </span>
                        </div>

                        {/* Meanings */}
                        {word.meanings ? (
                          <div className="mt-3 space-y-1">
                            {!(Array.isArray(word.meanings)) ? (
                              // Handle string format (old API)
                              <p className="text-sm text-gray-800">
                                {word.meanings}
                              </p>
                            ) : word.meanings.length > 0 ? (
                              // Handle array format (new API)
                              word.meanings.map((meaning, midx) => (
                                <div key={midx} className="flex items-start gap-2 text-sm">
                                  <span className="text-blue-600 font-bold min-w-max">
                                    {midx + 1}.
                                  </span>
                                  <div className="flex-1">
                                    <p className="text-gray-800">
                                      {meaning.meaning || meaning}
                                    </p>
                                    {meaning.pos && (
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        ({meaning.pos})
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-gray-600 italic">Chưa có dữ liệu ý nghĩa</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 italic mt-2">Chưa có dữ liệu ý nghĩa</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Kanji Results */}
              {kanji.length > 0 && (
                <div>
                  <h3 className="font-bold text-sm uppercase text-gray-600 mb-3 px-2">
                    🔤 Kanji ({kanji.length})
                  </h3>
                  <div className="space-y-3">
                    {kanji.map((k, idx) => (
                      <div key={idx} className="border-l-4 border-purple-500 bg-purple-50 p-4 rounded hover:bg-purple-100 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <p className="font-bold text-5xl text-purple-700">
                              {k.character}
                            </p>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div>
                              <p className="text-xs font-semibold text-purple-600 uppercase">音読み (Onyomi)</p>
                              <p className="text-gray-800">{k.onyomi || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-purple-600 uppercase">訓読み (Kunyomi)</p>
                              <p className="text-gray-800">{k.kunyomi || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-purple-600 uppercase">Ý nghĩa</p>
                              <p className="text-gray-800">{k.meaning_vi || k.meaning_en || '—'}</p>
                            </div>
                            <div className="pt-1">
                              <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-xs font-semibold">
                                {k.jlpt_level || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vocabulary Results */}
              {vocabulary.length > 0 && (
                <div>
                  <h3 className="font-bold text-sm uppercase text-gray-600 mb-3 px-2">
                    📚 Từ Vựng ({vocabulary.length})
                  </h3>
                  <div className="space-y-3">
                    {vocabulary.map((vocab, idx) => (
                      <div key={idx} className="border-l-4 border-green-500 bg-green-50 p-4 rounded hover:bg-green-100 transition-colors">
                        <div className="flex items-baseline justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xl font-bold text-green-900">
                                {vocab.word_jp}
                              </span>
                              {vocab.word_kana && (
                                <span className="text-sm text-gray-600">
                                  {vocab.word_kana}
                                </span>
                              )}
                              {vocab.word_romaji && (
                                <span className="text-sm text-gray-500 font-mono">
                                  [{vocab.word_romaji}]
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">
                            {vocab.jlpt_level || 'N/A'}
                          </span>
                        </div>
                        {vocab.meaning_vi && (
                          <p className="text-sm text-gray-800 mt-2">
                            {vocab.meaning_vi}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-100 p-3 border-t sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default DictionarySearchModal;
