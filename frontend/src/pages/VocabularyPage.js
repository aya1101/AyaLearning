import * as wanakana from 'wanakana';
import * as XLSX from 'xlsx';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Flashcard from '../components/Flashcard';
import Modal from '../components/Modal';
import MultipleChoiceQuizVocab from '../components/MultipleChoiceQuizVocab';

const VocabularyPage = ({ API_URL, ITEMS_PER_PAGE, token }) => {
    const [vocabularyList, setVocabularyList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingVocabulary, setEditingVocabulary] = useState(null);
    const [newVocabulary, setNewVocabulary] = useState({
        word_jp: '',
        word_kana: '',
        word_romaji: '',
        meaning_vi: '',
        meaning_en: '',
        part_of_speech: '',
        jlpt_level: 'N3'
    });
    const [vocabModalOpen, setVocabModalOpen] = useState(false);
    const [isImportingVocabulary, setIsImportingVocabulary] = useState(false);
    const [showStudyCards, setShowStudyCards] = useState(false);
    const [quizType, setQuizType] = useState(null);

    const getAuthHeaders = useCallback(() => (
        token ? { Authorization: `Bearer ${token}` } : {}
    ), [token]);

    const broadcastVocabularySync = useCallback(() => {
        localStorage.setItem(
            'aya_data_sync',
            JSON.stringify({ scope: 'vocabulary', updatedAt: Date.now() })
        );
    }, []);

    const fetchVocabulary = useCallback(async () => {
        const response = await fetch(`${API_URL}/vocabulary`, { headers: { ...getAuthHeaders() } });
        const data = await response.json();
        setVocabularyList(Array.isArray(data) ? data : []);
    }, [API_URL, getAuthHeaders]);

    const filteredVocab = useMemo(() => 
        vocabularyList.filter(v => 
            (v?.word || '').includes(searchTerm) ||
            (v?.word_kana || '').includes(searchTerm) ||
            (v?.word_romaji || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (v?.meaning_vi || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (v?.meaning_en || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (v?.jlpt_level || '').toLowerCase().includes(searchTerm.toLowerCase())
        ), 
        [vocabularyList, searchTerm]
    );

    // Flashcard navigation state
    const [currentCardIndex, setCurrentCardIndex] = useState(0);

    const handleNewVocabularyChange = (e) => setNewVocabulary(prev => ({ ...prev, [e.target.name]: e.target.value }));
    
    // Audio playback function
    const playAudio = (text) => {
        if ('speechSynthesis' in window) {
            // Stop any ongoing speech
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ja-JP'; // Japanese language
            utterance.rate = 0.8; // Slightly slower for learning
            utterance.pitch = 1;
            
            window.speechSynthesis.speak(utterance);
        } else {
            alert('ブラウザが音声合成をサポートしていません。');
        }
    };
    const handleAddVocabulary = async (e) => {
        e.preventDefault();
        try {
            let romaji = newVocabulary.word_romaji;
            if (!romaji && newVocabulary.word_kana) {
                romaji = wanakana.toRomaji(newVocabulary.word_kana);
            }
            const vocabToSend = {
                word_jp: newVocabulary.word_jp,
                word_kana: newVocabulary.word_kana,
                word_romaji: romaji,
                meaning_vi: newVocabulary.meaning_vi,
                meaning_en: newVocabulary.meaning_en,
                part_of_speech: newVocabulary.part_of_speech,
                jlpt_level: newVocabulary.jlpt_level
            };
            const response = await fetch(`${API_URL}/vocabulary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(vocabToSend)
            });
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                throw new Error(`Server không trả về JSON (status ${response.status})`);
            }
            if (!response.ok) throw new Error(data.message || 'Lỗi khi thêm từ vựng');
            setNewVocabulary({
                word_jp: '',
                word_kana: '',
                word_romaji: '',
                meaning_vi: '',
                meaning_en: '',
                part_of_speech: '',
                jlpt_level: 'N3'
            });
            setVocabModalOpen(false);
            await fetchVocabulary();
            broadcastVocabularySync();
            alert('Thêm từ vựng thành công!');
        } catch (error) {
            console.error('Lỗi khi thêm từ vựng:', error);
            alert(`Lỗi: ${error.message}`);
        }
    };
    const handleEditVocabulary = (vocabulary) => {
        console.log('Edit vocabulary clicked:', vocabulary);
        setEditingVocabulary(vocabulary);
    };
    const handleUpdateVocabulary = async (e) => {
        e.preventDefault();
        try {
            let romaji = editingVocabulary.word_romaji;
            if (!romaji && editingVocabulary.word_kana) {
                romaji = wanakana.toRomaji(editingVocabulary.word_kana);
            }
            
            const vocabToSend = {
                word_jp: editingVocabulary.word_jp || editingVocabulary.word,
                word_kana: editingVocabulary.word_kana,
                word_romaji: romaji,
                meaning_vi: editingVocabulary.meaning_vi,
                meaning_en: editingVocabulary.meaning_en,
                part_of_speech: editingVocabulary.part_of_speech,
                jlpt_level: editingVocabulary.jlpt_level
            };
            
            console.log('Updating vocabulary:', vocabToSend);
            
            const response = await fetch(`${API_URL}/vocabulary/${editingVocabulary.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(vocabToSend)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Lỗi khi cập nhật từ vựng');
            setVocabularyList(prev => prev.map(v => v.id === editingVocabulary.id ? data : v));
            setEditingVocabulary(null);
            broadcastVocabularySync();
            alert('Cập nhật từ vựng thành công!');
        } catch (error) {
            console.error('Update error:', error);
            alert('Lỗi khi cập nhật từ vựng: ' + error.message);
        }
    };
    const handleDeleteVocabulary = async (id) => {
        if (!window.confirm('Bạn có chắc muốn xóa từ vựng này?')) return;
        try {
            const response = await fetch(`${API_URL}/vocabulary/${id}`, {
                method: 'DELETE',
                headers: { ...getAuthHeaders() }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Lỗi khi xóa từ vựng');
            setVocabularyList(prev => prev.filter(v => v.id !== id));
            broadcastVocabularySync();
            alert('Đã xóa từ vựng thành công!');
        } catch (error) {
            alert('Lỗi khi xóa từ vựng: ' + error.message);
        }
    };
    const handleEditVocabularyChange = (e) => {
        const { name, value } = e.target;
        setEditingVocabulary(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const parseSpreadsheetFile = async (file) => {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
    };

    const handleImportVocabularyFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) return;

        try {
            setIsImportingVocabulary(true);
            const rows = await parseSpreadsheetFile(file);
            if (!rows.length) {
                alert('File không có dữ liệu để import.');
                return;
            }

            const response = await fetch(`${API_URL}/vocabulary/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ rows })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Lỗi khi import Vocabulary');

            const failedPreview = (data.failed || [])
                .slice(0, 5)
                .map((item) => `- Dòng ${item.row}: ${item.error}`)
                .join('\n');

            alert(
                `${data.message}\n\n` +
                (failedPreview ? `Một số lỗi:\n${failedPreview}` : 'Không có lỗi.')
            );

            await fetchVocabulary();
            broadcastVocabularySync();
        } catch (error) {
            alert(`Import thất bại: ${error.message}`);
        } finally {
            setIsImportingVocabulary(false);
        }
    };

    // Fetch vocabulary list on mount
    useEffect(() => {
        fetchVocabulary()
            .catch(err => alert('Lỗi khi tải từ vựng: ' + err.message));
    }, [fetchVocabulary]);

    useEffect(() => {
        const handleStorageSync = (event) => {
            if (event.key !== 'aya_data_sync' || !event.newValue) return;
            try {
                const payload = JSON.parse(event.newValue);
                if (payload.scope === 'vocabulary') {
                    fetchVocabulary().catch(() => {});
                }
            } catch (_error) {
                // ignore invalid payload
            }
        };

        const handleFocus = () => {
            fetchVocabulary().catch(() => {});
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchVocabulary().catch(() => {});
            }
        };

        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchVocabulary().catch(() => {});
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
    }, [fetchVocabulary]);

    useEffect(() => {
        if (!token) return;

        const streamUrl = `http://localhost:3001/api/realtime/stream?token=${encodeURIComponent(token)}`;
        const stream = new EventSource(streamUrl);

        const handleVocabularyChanged = () => {
            fetchVocabulary().catch(() => {});
        };

        stream.addEventListener('vocabulary_changed', handleVocabularyChanged);

        stream.onerror = () => {
            // stream may reconnect automatically; keep silent
        };

        return () => {
            stream.removeEventListener('vocabulary_changed', handleVocabularyChanged);
            stream.close();
        };
    }, [token, fetchVocabulary]);

    useEffect(() => {
        const raw = sessionStorage.getItem('aya_assistant_navigation');
        if (!raw) return;

        try {
            const navigation = JSON.parse(raw);
            if (navigation.tab !== 'vocabulary') return;

            if (navigation.level) {
                setSearchTerm(String(navigation.level));
            }

            if (navigation.startQuiz) {
                setQuizType(navigation.quizType || 'vocab-word_meaning');
            }

            sessionStorage.removeItem('aya_assistant_navigation');
        } catch (_error) {
            sessionStorage.removeItem('aya_assistant_navigation');
        }
    }, []);

    return (
        <>
            {quizType ? (
                <MultipleChoiceQuizVocab
                    items={filteredVocab}
                    quizType={quizType}
                    onGoBack={() => setQuizType(null)}
                />
            ) : showStudyCards ? (
                <div className="min-h-screen bg-white p-4 sm:p-6">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
                            <button
                                onClick={() => setShowStudyCards(false)}
                                className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors text-sm sm:text-base"
                            >
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                                </svg>
                                <span>Back to Vocabulary List</span>
                            </button>
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Study Cards</h2>
                            <div className="text-gray-600 text-sm sm:text-base">
                                {currentCardIndex + 1} of {filteredVocab.length}
                            </div>
                        </div>
                        
                        {filteredVocab.length > 0 && (
                            <div className="flex justify-center">
                                <Flashcard 
                                    item={filteredVocab[currentCardIndex]} 
                                    type="vocab"
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
                                onClick={() => setCurrentCardIndex(prev => Math.min(filteredVocab.length - 1, prev + 1))}
                                disabled={currentCardIndex === filteredVocab.length - 1}
                                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="min-h-screen bg-white p-4 sm:p-6">
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
                                            placeholder="Search vocabulary..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                                        />
                                    </div>
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                                    <button
                                        onClick={() => setVocabModalOpen(true)}
                                        className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
                                    >
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                                        </svg>
                                        <span>Add Word</span>
                                    </button>

                                    <div className="relative group">
                                        <label className="flex items-center justify-center space-x-2 bg-white border-2 border-purple-600 text-purple-600 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-purple-50 transition-colors font-medium text-sm sm:text-base cursor-pointer">
                                            <input
                                                type="file"
                                                accept=".csv,.xlsx,.xls"
                                                className="hidden"
                                                onChange={handleImportVocabularyFile}
                                                disabled={isImportingVocabulary}
                                            />
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
                                            </svg>
                                            <span>{isImportingVocabulary ? 'Importing...' : 'Import File'}</span>
                                        </label>
                                        <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-[340px] max-w-[80vw] rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                                            Hỗ trợ CSV/XLSX. Bắt buộc: word_jp (hoặc word), meaning_vi (hoặc meaning). Tùy chọn: word_kana (hoặc furigana), word_romaji (hoặc romaji), meaning_en, part_of_speech, jlpt_level (hoặc level).
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={() => setShowStudyCards(true)}
                                        disabled={filteredVocab.length === 0}
                                        className="flex items-center justify-center space-x-2 bg-white border-2 border-blue-600 text-blue-600 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-blue-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                                    >
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                                        </svg>
                                        <span>Study Cards</span>
                                    </button>
                                    
                                    <button
                                        onClick={() => setQuizType('vocab-word_meaning')}
                                        disabled={filteredVocab.length === 0}
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
                        
                        {/* Vocabulary Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {filteredVocab.map((vocab) => (
                                <div key={vocab.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-6 relative group">
                                    {/* Edit and Delete Icons */}
                                    <div className="absolute top-3 right-3 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => playAudio(vocab.word_kana || vocab.word)}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Play Audio"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => {
                                                console.log('Edit button clicked, vocab:', vocab);
                                                handleEditVocabulary(vocab);
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteVocabulary(vocab.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                            </svg>
                                        </button>
                                    </div>
                                    
                                    {/* Japanese Word */}
                                    <div className="text-center mb-4">
                                        <div className="text-3xl font-bold text-gray-800 mb-2">
                                            {vocab.word_jp || vocab.word_kana || vocab.word}
                                        </div>
                                        <div className="text-lg text-gray-600 font-medium">
                                            {vocab.word_kana}
                                        </div>
                                    </div>
                                    
                                    {/* Meaning */}
                                    <div className="text-center mb-4">
                                        <div className="text-base text-gray-700 font-medium">
                                            {vocab.meaning_en || vocab.meaning_vi}
                                        </div>
                                    </div>
                                    
                                    {/* JLPT Level Badge */}
                                    <div className="flex justify-center">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                            vocab.jlpt_level === 'N5' ? 'bg-green-100 text-green-800' :
                                            vocab.jlpt_level === 'N4' ? 'bg-blue-100 text-blue-800' :
                                            vocab.jlpt_level === 'N3' ? 'bg-yellow-100 text-yellow-800' :
                                            vocab.jlpt_level === 'N2' ? 'bg-orange-100 text-orange-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {vocab.jlpt_level}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {filteredVocab.length === 0 && (
                            <div className="text-center py-12">
                                <div className="text-gray-400 text-lg">No vocabulary found</div>
                                <div className="text-gray-500 text-sm mt-2">Try adjusting your search terms</div>
                            </div>
                        )}
                    </div>
                    
                    {/* Add Vocabulary Modal */}
                    <Modal isOpen={vocabModalOpen} onClose={() => setVocabModalOpen(false)} title="Thêm Từ Vựng mới">
                        <form onSubmit={handleAddVocabulary} className="space-y-4">
                            <input name="word_jp" value={newVocabulary.word_jp} onChange={handleNewVocabularyChange} placeholder="Từ vựng (Kanji, ví dụ: 灰皿)" className="w-full border rounded p-3" required />
                            <input name="word_kana" value={newVocabulary.word_kana} onChange={handleNewVocabularyChange} placeholder="Furigana (Kana, ví dụ: はいざら)" className="w-full border rounded p-3" required />
                            <input name="meaning_vi" value={newVocabulary.meaning_vi} onChange={handleNewVocabularyChange} placeholder="Nghĩa tiếng Việt (ví dụ: gạc tàn)" className="w-full border rounded p-3" required />
                            <input name="meaning_en" value={newVocabulary.meaning_en} onChange={handleNewVocabularyChange} placeholder="Nghĩa tiếng Anh (ví dụ: ashtray)" className="w-full border rounded p-3" />
                            <select name="part_of_speech" value={newVocabulary.part_of_speech} onChange={handleNewVocabularyChange} className="w-full border rounded p-3">
                                <option value="">Chọn từ loại</option>
                                <option value="noun">noun (danh từ)</option>
                                <option value="verb">verb (động từ)</option>
                                <option value="adj-i">adj-i (tính từ đuôi i)</option>
                                <option value="adj-na">adj-na (tính từ đuôi na)</option>
                                <option value="adv">adv (trạng từ)</option>
                                <option value="other">other (khác)</option>
                            </select>
                            <select name="jlpt_level" value={newVocabulary.jlpt_level} onChange={handleNewVocabularyChange} className="w-full border rounded p-3">
                                <option value="N5">N5</option>
                                <option value="N4">N4</option>
                                <option value="N3">N3</option>
                                <option value="N2">N2</option>
                                <option value="N1">N1</option>
                            </select>
                            <button type="submit" className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 transition-colors">
                                Add Vocabulary
                            </button>
                        </form>
                    </Modal>
                    
                    {/* Edit Vocabulary Modal */}
                    {editingVocabulary && (
                        <Modal isOpen={true} onClose={() => setEditingVocabulary(null)} title="Chỉnh sửa Từ Vựng">
                            <form onSubmit={handleUpdateVocabulary} className="space-y-4">
                                <input 
                                    name="word_jp" 
                                    value={editingVocabulary.word_jp || editingVocabulary.word || ''} 
                                    onChange={handleEditVocabularyChange} 
                                    placeholder="Từ vựng (Kanji, ví dụ: 灰皿)" 
                                    className="w-full border rounded p-3" 
                                    required 
                                />
                                <input 
                                    name="word_kana" 
                                    value={editingVocabulary.word_kana || ''} 
                                    onChange={handleEditVocabularyChange} 
                                    placeholder="Furigana (Kana, ví dụ: はいざら)" 
                                    className="w-full border rounded p-3" 
                                    required 
                                />
                                <input 
                                    name="meaning_vi" 
                                    value={editingVocabulary.meaning_vi || ''} 
                                    onChange={handleEditVocabularyChange} 
                                    placeholder="Nghĩa tiếng Việt (ví dụ: gạc tàn)" 
                                    className="w-full border rounded p-3" 
                                    required 
                                />
                                <input 
                                    name="meaning_en" 
                                    value={editingVocabulary.meaning_en || ''} 
                                    onChange={handleEditVocabularyChange} 
                                    placeholder="Nghĩa tiếng Anh (ví dụ: ashtray)" 
                                    className="w-full border rounded p-3" 
                                />
                                <select 
                                    name="part_of_speech" 
                                    value={editingVocabulary.part_of_speech || ''} 
                                    onChange={handleEditVocabularyChange} 
                                    className="w-full border rounded p-3"
                                >
                                    <option value="">Chọn từ loại</option>
                                    <option value="noun">noun (danh từ)</option>
                                    <option value="verb">verb (động từ)</option>
                                    <option value="adj-i">adj-i (tính từ đuôi i)</option>
                                    <option value="adj-na">adj-na (tính từ đuôi na)</option>
                                    <option value="adv">adv (trạng từ)</option>
                                    <option value="other">other (khác)</option>
                                </select>
                                <select 
                                    name="jlpt_level" 
                                    value={editingVocabulary.jlpt_level || 'N3'} 
                                    onChange={handleEditVocabularyChange} 
                                    className="w-full border rounded p-3"
                                >
                                    <option value="N5">N5</option>
                                    <option value="N4">N4</option>
                                    <option value="N3">N3</option>
                                    <option value="N2">N2</option>
                                    <option value="N1">N1</option>
                                </select>
                                <div className="flex space-x-4">
                                    <button 
                                        type="submit" 
                                        className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 transition-colors"
                                    >
                                        Cập nhật
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setEditingVocabulary(null)}
                                        className="flex-1 bg-gray-300 text-gray-700 rounded-lg py-3 font-medium hover:bg-gray-400 transition-colors"
                                    >
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

export default VocabularyPage;
