import React, { useState, useMemo, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Flashcard from '../components/Flashcard';
import Modal from '../components/Modal';
import MultipleChoiceQuiz from '../components/MultipleChoiceQuiz';

const KanjiPage = ({ API_URL, ITEMS_PER_PAGE, token }) => {
    const [kanjiList, setKanjiList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingKanji, setEditingKanji] = useState(null);
    const [newKanji, setNewKanji] = useState({
        kanji_char: '',
        han_tu: '',
        onyomi: '',
        kunyomi: '',
        meaning: '',
        meaning_en: '',
        strokes: '',
        level: 'N3'
    });
    const [kanjiModalOpen, setKanjiModalOpen] = useState(false);
    const [isImportingKanji, setIsImportingKanji] = useState(false);
    const [showStudyCards, setShowStudyCards] = useState(false);
    const [quizType, setQuizType] = useState(null);

    const getAuthHeaders = useCallback(() => (
        token ? { Authorization: `Bearer ${token}` } : {}
    ), [token]);

    const fetchKanji = useCallback(async () => {
        const response = await fetch(`${API_URL}/kanji`, { headers: { ...getAuthHeaders() } });
        const data = await response.json();
        setKanjiList(Array.isArray(data) ? data : []);
    }, [API_URL, getAuthHeaders]);

    const broadcastKanjiSync = useCallback(() => {
        localStorage.setItem(
            'aya_data_sync',
            JSON.stringify({ scope: 'kanji', updatedAt: Date.now() })
        );
    }, []);

    const filteredKanji = useMemo(
        () => kanjiList.filter(k => 
            (k?.kanji_char || '').includes(searchTerm) ||
            (k?.meaning_vi || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (k?.meaning_en || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (k?.onyomi || '').includes(searchTerm) ||
            (k?.kunyomi || '').includes(searchTerm) ||
            (k?.jlpt_level || '').toLowerCase().includes(searchTerm.toLowerCase())
        ),
        [kanjiList, searchTerm]
    );

    // Flashcard navigation state
    const [currentCardIndex, setCurrentCardIndex] = useState(0);

    const handleNewKanjiChange = (e) => setNewKanji(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleAddKanji = async (e) => {
        e.preventDefault();
        try {
            const kanjiToSend = {
                character: newKanji.kanji_char,
                onyomi: newKanji.onyomi,
                kunyomi: newKanji.kunyomi,
                meaning_vi: newKanji.meaning,
                meaning_en: newKanji.meaning_en || '',
                strokes: newKanji.strokes ? Number(newKanji.strokes) : null,
                jlpt_level: newKanji.level,
                example_word: newKanji.han_tu
            };
            const response = await fetch(`${API_URL}/kanji`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(kanjiToSend)
            });
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                throw new Error(`Server không trả về JSON (status ${response.status})`);
            }
            if (!response.ok) throw new Error(data.message || 'Lỗi khi thêm Kanji');
            setNewKanji({
                kanji_char: '',
                han_tu: '',
                onyomi: '',
                kunyomi: '',
                meaning: '',
                meaning_en: '',
                strokes: '',
                level: 'N3'
            });
            setKanjiModalOpen(false);
            await fetchKanji();
            broadcastKanjiSync();
            alert('Thêm Kanji thành công!');
        } catch (error) {
            console.error('Lỗi khi thêm Kanji:', error);
            alert(`Lỗi: ${error.message}`);
        }
    };
    const handleEditKanji = (kanji) => setEditingKanji(kanji);
    const handleDeleteKanji = async (id) => {
        if (!window.confirm('Bạn có chắc muốn xóa Kanji này?')) return;
        try {
            const response = await fetch(`${API_URL}/kanji/${id}`, {
                method: 'DELETE',
                headers: { ...getAuthHeaders() }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Lỗi khi xóa Kanji');
            setKanjiList(prev => prev.filter(k => k.id !== id));
            broadcastKanjiSync();
            alert('Đã xóa Kanji thành công!');
        } catch (error) {
            alert('Lỗi khi xóa Kanji: ' + error.message);
        }
    };
    const handleUpdateKanji = async (updatedKanji) => {
        try {
            const kanjiToSend = {
                character: updatedKanji.character,
                onyomi: updatedKanji.onyomi,
                kunyomi: updatedKanji.kunyomi,
                meaning_vi: updatedKanji.meaning_vi,
                meaning_en: updatedKanji.meaning_en || '',
                strokes: updatedKanji.strokes ? Number(updatedKanji.strokes) : null,
                jlpt_level: updatedKanji.jlpt_level,
                example_word: updatedKanji.example_word
            };
            const response = await fetch(`${API_URL}/kanji/${updatedKanji.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(kanjiToSend)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Lỗi khi cập nhật Kanji');
            setKanjiList(prev => prev.map(k => k.id === updatedKanji.id ? data : k));
            setEditingKanji(null);
            broadcastKanjiSync();
            alert('Cập nhật Kanji thành công!');
        } catch (error) {
            alert('Lỗi khi cập nhật Kanji: ' + error.message);
        }
    };
    const handleCancelEdit = () => setEditingKanji(null);

    const parseSpreadsheetFile = async (file) => {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
    };

    const handleImportKanjiFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) return;

        try {
            setIsImportingKanji(true);
            const rows = await parseSpreadsheetFile(file);
            if (!rows.length) {
                alert('File không có dữ liệu để import.');
                return;
            }

            const response = await fetch(`${API_URL}/kanji/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ rows })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Lỗi khi import Kanji');

            const failedPreview = (data.failed || [])
                .slice(0, 5)
                .map((item) => `- Dòng ${item.row}: ${item.error}`)
                .join('\n');

            alert(
                `${data.message}\n\n` +
                (failedPreview ? `Một số lỗi:\n${failedPreview}` : 'Không có lỗi.')
            );

            await fetchKanji();
            broadcastKanjiSync();
        } catch (error) {
            alert(`Import thất bại: ${error.message}`);
        } finally {
            setIsImportingKanji(false);
        }
    };

    // Fetch kanji list on mount
    useEffect(() => {
        fetchKanji()
            .catch(err => alert('Lỗi khi tải Kanji: ' + err.message));
    }, [fetchKanji]);

    useEffect(() => {
        const handleStorageSync = (event) => {
            if (event.key !== 'aya_data_sync' || !event.newValue) return;
            try {
                const payload = JSON.parse(event.newValue);
                if (payload.scope === 'kanji') {
                    fetchKanji().catch(() => {});
                }
            } catch (_error) {
                // ignore invalid payload
            }
        };

        const handleFocus = () => {
            fetchKanji().catch(() => {});
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchKanji().catch(() => {});
            }
        };

        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchKanji().catch(() => {});
            }
        }, 15000);

        window.addEventListener('storage', handleStorageSync);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('storage', handleStorageSync);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchKanji]);

    useEffect(() => {
        if (!token) return;

        const streamUrl = `${API_URL}/realtime/stream?token=${encodeURIComponent(token)}`;
        const stream = new EventSource(streamUrl);

        const handleKanjiChanged = () => {
            fetchKanji().catch(() => {});
        };

        stream.addEventListener('kanji_changed', handleKanjiChanged);

        stream.onerror = () => {
            // stream may reconnect automatically; keep silent
        };

        return () => {
            stream.removeEventListener('kanji_changed', handleKanjiChanged);
            stream.close();
        };
    }, [token, fetchKanji]);

    useEffect(() => {
        const raw = sessionStorage.getItem('aya_assistant_navigation');
        if (!raw) return;

        try {
            const navigation = JSON.parse(raw);
            if (navigation.tab !== 'kanji') return;

            if (navigation.level) {
                setSearchTerm(String(navigation.level));
            }

            sessionStorage.removeItem('aya_assistant_navigation');
        } catch (_error) {
            sessionStorage.removeItem('aya_assistant_navigation');
        }
    }, []);

    return (
        <>
            {quizType ? (
                <MultipleChoiceQuiz
                    items={filteredKanji}
                    quizType={quizType}
                    onGoBack={() => setQuizType(null)}
                />
            ) : showStudyCards ? (
                <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
                            <button
                                onClick={() => setShowStudyCards(false)}
                                className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors text-sm sm:text-base"
                            >
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                                </svg>
                                <span>Back to Kanji List</span>
                            </button>
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Study Cards</h2>
                            <div className="text-gray-600 text-sm sm:text-base">
                                {currentCardIndex + 1} of {filteredKanji.length}
                            </div>
                        </div>
                        
                        {filteredKanji.length > 0 && (
                            <div className="flex justify-center">
                                <Flashcard 
                                    item={filteredKanji[currentCardIndex]} 
                                    type="kanji"
                                />
                            </div>
                        )}
                        
                        <div className="flex justify-center space-x-4 mt-8">
                            <button
                                onClick={() => setCurrentCardIndex(prev => Math.max(0, prev - 1))}
                                disabled={currentCardIndex === 0}
                                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentCardIndex(prev => Math.min(filteredKanji.length - 1, prev + 1))}
                                disabled={currentCardIndex === filteredKanji.length - 1}
                                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="min-h-screen bg-gray-50 p-6">
                    <div className="max-w-7xl mx-auto">
                        {/* Header with Search and Actions */}
                        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                {/* Search Bar */}
                                <div className="flex-1 max-w-full lg:max-w-md">
                                    <div className="relative">
                                        <svg className="absolute left-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                        </svg>
                                        <input
                                            type="text"
                                            placeholder="Search kanji..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                                        />
                                    </div>
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                                    <button
                                        onClick={() => setKanjiModalOpen(true)}
                                        className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
                                    >
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                                        </svg>
                                        <span>Add Kanji</span>
                                    </button>

                                    <div className="relative group">
                                        <label className="flex items-center justify-center space-x-2 bg-white border-2 border-purple-600 text-purple-600 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-purple-50 transition-colors font-medium text-sm sm:text-base cursor-pointer">
                                            <input
                                                type="file"
                                                accept=".csv,.xlsx,.xls"
                                                className="hidden"
                                                onChange={handleImportKanjiFile}
                                                disabled={isImportingKanji}
                                            />
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
                                            </svg>
                                            <span>{isImportingKanji ? 'Importing...' : 'Import File'}</span>
                                        </label>
                                        <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-[340px] max-w-[80vw] rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                                            Hỗ trợ CSV/XLSX. Bắt buộc: character (hoặc kanji_char), meaning_vi (hoặc meaning). Tùy chọn: onyomi, kunyomi, meaning_en, strokes, jlpt_level (hoặc level), example_word (hoặc han_tu).
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={() => setShowStudyCards(true)}
                                        disabled={filteredKanji.length === 0}
                                        className="flex items-center justify-center space-x-2 bg-white border-2 border-blue-600 text-blue-600 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-blue-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                                    >
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                                        </svg>
                                        <span>Study Cards</span>
                                    </button>
                                    
                                    <button
                                        onClick={() => setQuizType('kanji-han_tu')}
                                        disabled={filteredKanji.length === 0}
                                        className="flex items-center justify-center space-x-2 bg-white border-2 border-gray-300 text-gray-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                                    >
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                                        </svg>
                                        <span>Quiz</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {/* Kanji Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {filteredKanji.map((kanji) => (
                                <div key={kanji.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-6 relative group">
                                    {/* Edit and Delete Icons */}
                                    <div className="absolute top-3 right-3 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEditKanji(kanji)}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteKanji(kanji.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                            </svg>
                                        </button>
                                    </div>
                                    
                                    {/* Kanji Character */}
                                    <div className="text-center mb-4">
                                        <div className="text-6xl font-bold text-gray-800 mb-2">
                                            {kanji.character}
                                        </div>
                                        <div className="text-lg text-gray-600 font-medium">
                                            {kanji.kunyomi || kanji.onyomi}
                                        </div>
                                    </div>
                                    
                                    {/* Meaning */}
                                    <div className="text-center mb-4">
                                        <div className="text-base text-gray-700 font-medium">
                                            {kanji.meaning_en || kanji.meaning_vi}
                                        </div>
                                    </div>
                                    
                                    {/* JLPT Level Badge */}
                                    <div className="flex justify-center">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                            kanji.jlpt_level === 'N5' ? 'bg-green-100 text-green-800' :
                                            kanji.jlpt_level === 'N4' ? 'bg-blue-100 text-blue-800' :
                                            kanji.jlpt_level === 'N3' ? 'bg-yellow-100 text-yellow-800' :
                                            kanji.jlpt_level === 'N2' ? 'bg-orange-100 text-orange-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {kanji.jlpt_level}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {filteredKanji.length === 0 && (
                            <div className="text-center py-12">
                                <div className="text-gray-400 text-lg">No kanji found</div>
                                <div className="text-gray-500 text-sm mt-2">Try adjusting your search terms</div>
                            </div>
                        )}
                    </div>
                    
                    {/* Add Kanji Modal */}
                    <Modal isOpen={kanjiModalOpen} onClose={() => setKanjiModalOpen(false)} title="Thêm Kanji mới">
                        <form onSubmit={handleAddKanji} className="space-y-4">
                            <input name="kanji_char" value={newKanji.kanji_char} onChange={handleNewKanjiChange} placeholder="Ký tự Kanji" className="w-full border rounded p-3" required />
                            <input name="han_tu" value={newKanji.han_tu} onChange={handleNewKanjiChange} placeholder="Hán tự" className="w-full border rounded p-3" />
                            <input name="onyomi" value={newKanji.onyomi} onChange={handleNewKanjiChange} placeholder="Onyomi" className="w-full border rounded p-3" />
                            <input name="kunyomi" value={newKanji.kunyomi} onChange={handleNewKanjiChange} placeholder="Kunyomi" className="w-full border rounded p-3" />
                            <input name="meaning" value={newKanji.meaning} onChange={handleNewKanjiChange} placeholder="Nghĩa tiếng Việt" className="w-full border rounded p-3" />
                            <input name="meaning_en" value={newKanji.meaning_en} onChange={handleNewKanjiChange} placeholder="Nghĩa tiếng Anh" className="w-full border rounded p-3" />
                            <input name="strokes" value={newKanji.strokes} onChange={handleNewKanjiChange} placeholder="Số nét (strokes)" className="w-full border rounded p-3" type="number" min="1" />
                            <select name="level" value={newKanji.level} onChange={handleNewKanjiChange} className="w-full border rounded p-3">
                                <option value="N5">N5</option>
                                <option value="N4">N4</option>
                                <option value="N3">N3</option>
                                <option value="N2">N2</option>
                                <option value="N1">N1</option>
                            </select>
                            <button type="submit" className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 transition-colors">
                                Add Kanji
                            </button>
                        </form>
                    </Modal>

                    {editingKanji && (
                        <Modal isOpen={true} onClose={handleCancelEdit} title="Chỉnh sửa Kanji">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleUpdateKanji(editingKanji);
                                }}
                                className="space-y-4"
                            >
                                <input
                                    value={editingKanji.character || editingKanji.kanji_char || ''}
                                    onChange={(e) => setEditingKanji(prev => ({ ...prev, character: e.target.value }))}
                                    placeholder="Ký tự Kanji"
                                    className="w-full border rounded p-3"
                                    required
                                />
                                <input
                                    value={editingKanji.example_word || editingKanji.han_tu || ''}
                                    onChange={(e) => setEditingKanji(prev => ({ ...prev, example_word: e.target.value }))}
                                    placeholder="Hán tự"
                                    className="w-full border rounded p-3"
                                />
                                <input
                                    value={editingKanji.onyomi || ''}
                                    onChange={(e) => setEditingKanji(prev => ({ ...prev, onyomi: e.target.value }))}
                                    placeholder="Onyomi"
                                    className="w-full border rounded p-3"
                                />
                                <input
                                    value={editingKanji.kunyomi || ''}
                                    onChange={(e) => setEditingKanji(prev => ({ ...prev, kunyomi: e.target.value }))}
                                    placeholder="Kunyomi"
                                    className="w-full border rounded p-3"
                                />
                                <input
                                    value={editingKanji.meaning_vi || ''}
                                    onChange={(e) => setEditingKanji(prev => ({ ...prev, meaning_vi: e.target.value }))}
                                    placeholder="Nghĩa tiếng Việt"
                                    className="w-full border rounded p-3"
                                />
                                <input
                                    value={editingKanji.meaning_en || ''}
                                    onChange={(e) => setEditingKanji(prev => ({ ...prev, meaning_en: e.target.value }))}
                                    placeholder="Nghĩa tiếng Anh"
                                    className="w-full border rounded p-3"
                                />
                                <input
                                    value={editingKanji.strokes ?? ''}
                                    onChange={(e) => setEditingKanji(prev => ({ ...prev, strokes: e.target.value }))}
                                    placeholder="Số nét (strokes)"
                                    className="w-full border rounded p-3"
                                    type="number"
                                    min="1"
                                />
                                <select
                                    value={editingKanji.jlpt_level || 'N3'}
                                    onChange={(e) => setEditingKanji(prev => ({ ...prev, jlpt_level: e.target.value }))}
                                    className="w-full border rounded p-3"
                                >
                                    <option value="N5">N5</option>
                                    <option value="N4">N4</option>
                                    <option value="N3">N3</option>
                                    <option value="N2">N2</option>
                                    <option value="N1">N1</option>
                                </select>
                                <div className="flex space-x-4">
                                    <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 transition-colors">
                                        Cập nhật
                                    </button>
                                    <button type="button" onClick={handleCancelEdit} className="flex-1 bg-gray-300 text-gray-700 rounded-lg py-3 font-medium hover:bg-gray-400 transition-colors">
                                        Hủy
                                    </button>
                                </div>
                            </form>
                        </Modal>
                    )}
                </div>
            )}
        </>
    );
};

export default KanjiPage;
