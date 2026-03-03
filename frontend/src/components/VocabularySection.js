import React, { useState, useRef, useEffect } from 'react';
import Pagination from './Pagination';

const VocabularySection = ({ vocabularyList, newVocabulary, handleNewVocabularyChange, handleAddVocabulary, onStartQuiz, currentPage, onPageChange, itemsPerPage, onEditVocabulary, onDeleteVocabulary, editingVocabulary, onUpdateVocabulary, onCancelEdit, hideAddForm = false }) => {
    const totalPages = Math.ceil(vocabularyList.length / itemsPerPage);
    const paginatedVocabulary = vocabularyList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const [showQuizMenu, setShowQuizMenu] = useState(false);
    const quizMenuRef = useRef(null);

    useEffect(() => {
        if (!showQuizMenu) return;
        const handleClick = (e) => {
            if (quizMenuRef.current && !quizMenuRef.current.contains(e.target)) {
                setShowQuizMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showQuizMenu]);

    const handleQuizSelect = (type) => {
        setShowQuizMenu(false);
        onStartQuiz(type);
    };

    return (
         <div className="p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Tanbou</h2>
            <div className="mb-8 p-4 border border-gray-200 rounded-lg">
                <h3 className="text-xl font-semibold mb-3 text-gray-700">Add new</h3>
                {!hideAddForm && (
                  <form onSubmit={handleAddVocabulary} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <input name="word_jp" value={newVocabulary.word_jp} onChange={handleNewVocabularyChange} placeholder="Từ vựng (Kanji)" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2" required />
                       <input name="word_kana" value={newVocabulary.word_kana} onChange={handleNewVocabularyChange} placeholder="Furigana (Kana)" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2" required />
                       <input name="meaning_vi" value={newVocabulary.meaning_vi} onChange={handleNewVocabularyChange} placeholder="Nghĩa tiếng Việt" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2" required />
                       <select name="jlpt_level" value={newVocabulary.jlpt_level} onChange={handleNewVocabularyChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2">
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
                )}
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-700">Goi</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Từ vựng (Kanji)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Furigana (Kana)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nghĩa (VI)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">JLPT</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedVocabulary.map((vocab) => (
                            <tr key={vocab.id}>
                                {editingVocabulary && editingVocabulary.id === vocab.id ? (
                                    <>
                                        <td className="px-6 py-4"><input value={editingVocabulary.word_jp} onChange={(e) => onEditVocabulary({...editingVocabulary, word_jp: e.target.value})} className="w-full p-1 border rounded" /></td>
                                        <td className="px-6 py-4"><input value={editingVocabulary.word_kana} onChange={(e) => onEditVocabulary({...editingVocabulary, word_kana: e.target.value})} className="w-full p-1 border rounded" /></td>
                                        <td className="px-6 py-4"><input value={editingVocabulary.meaning_vi} onChange={(e) => onEditVocabulary({...editingVocabulary, meaning_vi: e.target.value})} className="w-full p-1 border rounded" /></td>
                                        <td className="px-6 py-4">
                                            <select value={editingVocabulary.jlpt_level} onChange={(e) => onEditVocabulary({...editingVocabulary, jlpt_level: e.target.value})} className="w-full p-1 border rounded">
                                                <option value="N5">N5</option>
                                                <option value="N4">N4</option>
                                                <option value="N3">N3</option>
                                                <option value="N2">N2</option>
                                                <option value="N1">N1</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex space-x-2">
                                                <button onClick={() => onUpdateVocabulary(editingVocabulary)} className="bg-green-500 text-white px-2 py-1 rounded text-sm hover:bg-green-600">Lưu</button>
                                                <button onClick={onCancelEdit} className="bg-gray-500 text-white px-2 py-1 rounded text-sm hover:bg-gray-600">Hủy</button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-6 py-4">{vocab.word_jp}</td>
                                        <td className="px-6 py-4">{vocab.word_kana}</td>
                                        <td className="px-6 py-4">{vocab.meaning_vi}</td>
                                        <td className="px-6 py-4">{vocab.jlpt_level}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex space-x-2">
                                                <button onClick={() => onEditVocabulary(vocab)} className="bg-blue-500 text-white p-2 rounded text-sm hover:bg-blue-600 transition-colors" title="Sửa">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button onClick={() => onDeleteVocabulary(vocab.id)} className="bg-red-500 text-white p-2 rounded text-sm hover:bg-red-600 transition-colors" title="Xóa">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
            <div className="mt-6 text-center relative">
                <button
                    type="button"
                    onClick={() => setShowQuizMenu((v) => !v)}
                    className="bg-[#093FB4] text-white py-2 px-6 rounded-lg shadow-lg font-semibold text-lg flex items-center gap-2 hover:bg-[#072f8a] transition-all duration-150 mx-auto"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 9.4c.7-.4 1.5-.4 2.2 0 .7.4 1.1 1.1 1.1 1.8v4.5c0 .7-.4 1.4-1.1 1.8-.7.4-1.5.4-2.2 0l-7-4.1c-.7-.4-1.1-1.1-1.1-1.8s.4-1.4 1.1-1.8l7-4.1z"/></svg>
                    Quiz
                </button>
                {showQuizMenu && (
                    <>
                        <div className="fixed inset-0 z-30" style={{background:'rgba(0,0,0,0.1)'}}></div>
                        <div ref={quizMenuRef} className="absolute z-40 top-full left-1/2 -translate-x-1/2 mt-3 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 animate-fadeIn flex flex-col overflow-hidden">
                            <button onClick={() => handleQuizSelect('vocab-word_meaning')} className="flex items-center gap-3 px-5 py-3 text-base text-gray-800 hover:bg-[#F3F4F6] transition-all">
                                <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full text-blue-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/></svg></span>
                                Từ vựng → Nghĩa
                            </button>
                            <button onClick={() => handleQuizSelect('meaning-word')} className="flex items-center gap-3 px-5 py-3 text-base text-gray-800 hover:bg-[#F3F4F6] transition-all">
                                <span className="inline-flex items-center justify-center w-8 h-8 bg-green-100 rounded-full text-green-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18V12l-4-2"/></svg></span>
                                Nghĩa → Từ vựng
                            </button>
                            <button onClick={() => handleQuizSelect('kana-romaji')} className="flex items-center gap-3 px-5 py-3 text-base text-gray-800 hover:bg-[#F3F4F6] transition-all">
                                <span className="inline-flex items-center justify-center w-8 h-8 bg-yellow-100 rounded-full text-yellow-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8"/></svg></span>
                                Kana → Romaji
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default VocabularySection;
