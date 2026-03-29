import React, { useState, useEffect, useRef, useCallback } from 'react';
import HanziWriter from 'hanzi-writer';

const HandwritingPractice = ({ kanjiList, onExit }) => {
    const [index, setIndex] = useState(0);
    const [missingData, setMissingData] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isRandomized, setIsRandomized] = useState(false);
    
    // Use a ref to store the writer instance so it doesn't trigger re-renders
    const writerRef = useRef(null);
    // Use a ref for the target div so we don't recreate it
    const targetRef = useRef(null);

    // Ensure kanjiList is valid
    const list = Array.isArray(kanjiList) ? kanjiList : [];
    const currentItem = list[index] || {};
    const char = currentItem.character || currentItem.kanji_char;

    const cleanupWriter = useCallback(() => {
        if (writerRef.current) {
            writerRef.current.cancelQuiz();
            writerRef.current = null;
        }
        if (targetRef.current) {
            targetRef.current.innerHTML = ''; // Clear SVG
        }
    }, []);

    useEffect(() => {
        let isActive = true;

        const loadAndCreateWriter = async () => {
            if (!char || !targetRef.current) return;
            
            cleanupWriter();
            setLoading(true);
            setMissingData(false);

            try {
                // Check if stroke data loads successfully first
                await HanziWriter.loadCharacterData(char);
                
                if (!isActive) return; // Prevent race conditions from React 18 Strict Mode
                
                // Double check innerHTML clear to prevent phantom instances
                targetRef.current.innerHTML = '';
                
                // Only if data loads do we create the writer instance
                const writer = HanziWriter.create(targetRef.current, char, {
                    width: 300,
                    height: 300,
                    padding: 10,
                    showOutline: true,
                    showCharacter: false, // Hide character so user has to draw it
                    showHintAfterMisses: 2, // Ghost strokes feature
                    highlightOnComplete: true,
                    strokeAnimationSpeed: 1.5,
                    delayBetweenStrokes: 50,
                });

                writer.quiz();
                writerRef.current = writer;
            } catch (error) {
                if (isActive) {
                    console.error(`Stroke data unavailable for character: ${char}`, error);
                    setMissingData(true);
                }
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        loadAndCreateWriter();

        return () => {
            isActive = false;
            cleanupWriter(); // Clean up on unmount or character change
        };
    }, [char, cleanupWriter]);

    // --- Navigation & Controls ---

    const handleNext = useCallback(() => {
        if (loading) return;
        if (isRandomized && list.length > 1) {
            let nextIndex;
            do {
                nextIndex = Math.floor(Math.random() * list.length);
            } while (nextIndex === index);
            setIndex(nextIndex);
        } else {
            setIndex(prev => (prev === list.length - 1 ? 0 : prev + 1));
        }
    }, [list.length, loading, isRandomized, index]);

    const handlePrev = useCallback(() => {
        if (loading) return;
        if (isRandomized && list.length > 1) {
            let prevIndex;
            do {
                prevIndex = Math.floor(Math.random() * list.length);
            } while (prevIndex === index);
            setIndex(prevIndex);
        } else {
            setIndex(prev => (prev === 0 ? list.length - 1 : prev - 1));
        }
    }, [list.length, loading, isRandomized, index]);

    const handleRestart = useCallback(() => {
        if (!writerRef.current || loading || missingData) return;
        writerRef.current.quiz(); // Restart quiz
    }, [loading, missingData]);

    const handleHint = useCallback(() => {
        if (!writerRef.current || loading || missingData) return;
        writerRef.current.quiz({
            showHintAfterMisses: 0 // force hint immediately on next mistake, or just use built-in functions
        });
        // Alternatively, many implementations just draw next stroke:
        // writerRef.current.quiz({ onMistake: ... })
        // For simplicity, we can rely on the showHintAfterMisses configuration which handles it automatically.
    }, [loading, missingData]);
    
    const showStrokeOrder = useCallback(() => {
        if (!writerRef.current || loading || missingData) return;
        writerRef.current.animateCharacter({
            onComplete: () => {
                writerRef.current.quiz(); // Resume quiz after animation
            }
        });
    }, [loading, missingData]);

    // --- Keyboard Bindings ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key.toLowerCase() === 'r') handleRestart();
            if (e.key.toLowerCase() === 'h') handleHint(); // Placeholder if we hook it manually, but hanzi-writer hints automatically based on showHintAfterMisses: 2
            if (e.key.toLowerCase() === 's') showStrokeOrder(); 
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleNext, handlePrev, handleRestart, handleHint, showStrokeOrder]);

    if (list.length === 0) return null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl w-full mx-auto space-y-6 flex-1 flex flex-col">
                
                {/* Header / Action Bar Context */}
                <div className="flex items-center justify-between bg-white rounded-lg shadow-sm p-4">
                    <button
                        onClick={onExit}
                        className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                        <span className="font-medium">Exit Practice</span>
                    </button>
                    
                    <div className="flex items-center space-x-4">
                        <label className="flex items-center cursor-pointer space-x-2">
                            <span className={`text-sm font-medium ${isRandomized ? 'text-purple-600' : 'text-gray-500'}`}>Randomize</span>
                            <div className={`relative inline-block w-10 h-6 transition-colors duration-200 ease-in-out rounded-full ${isRandomized ? 'bg-purple-500' : 'bg-gray-200'}`}>
                                <input
                                    type="checkbox"
                                    className="opacity-0 w-0 h-0"
                                    checked={isRandomized}
                                    onChange={(e) => {
                                        const randomized = e.target.checked;
                                        setIsRandomized(randomized);
                                        if (randomized && list.length > 1) {
                                            // Immediately jump to a random index if toggled on
                                            let nextIndex;
                                            do {
                                                nextIndex = Math.floor(Math.random() * list.length);
                                            } while (nextIndex === index);
                                            setIndex(nextIndex);
                                        }
                                    }}
                                />
                                <span className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${isRandomized ? 'transform translate-x-4' : ''}`} />
                            </div>
                        </label>
                        <div className="text-gray-600 font-medium border-l pl-4 border-gray-200">
                            {isRandomized ? '?' : index + 1} / {list.length}
                        </div>
                    </div>
                </div>

                {/* Main Content Area: Two-panel layout */}
                <div className="flex flex-col md:flex-row gap-6 lg:gap-8 flex-1">
                    
                    {/* Left Panel: Drawing Canvas */}
                    <div className="flex-1 bg-white rounded-xl shadow-sm p-6 flex flex-col items-center justify-center min-h-[500px]">
                        
                        <div className="flex-1 flex flex-col items-center justify-center w-full relative">
                            {/* The static DOM node for hanzi-writer. 
                                We don't conditionally unmount this to safeguard the writer instance. */}
                            <div 
                                ref={targetRef} 
                                className={`w-[300px] h-[300px] border-2 border-dashed border-gray-200 rounded-lg select-none bg-[#fefefe] 
                                    ${missingData ? 'opacity-30' : 'opacity-100'} 
                                    transition-opacity duration-300 relative`}
                            />
                            
                            {/* Missing Data Fallback UI Layered over the grid/canvas */}
                            {missingData && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <svg className="w-12 h-12 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    <p className="text-gray-600 font-medium bg-white/90 px-4 py-2 rounded shadow-sm">
                                        Stroke data unavailable
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Controls underneath canvas */}
                        <div className="mt-8 flex flex-wrap justify-center gap-3">
                            <button
                                onClick={handleRestart}
                                disabled={loading || missingData}
                                title="Restart [R]"
                                className="px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Restart
                            </button>
                            <button
                                onClick={showStrokeOrder}
                                disabled={loading || missingData}
                                title="Show Stroke Order [S]"
                                className="px-5 py-2.5 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Animate
                            </button>
                        </div>
                    </div>

                    {/* Right Panel: Kanji Information */}
                    <div className="md:w-[350px] lg:w-[400px] flex flex-col gap-4">
                        <div className="bg-white rounded-xl shadow-sm p-6 flex-1 flex flex-col justify-center">
                            
                            {/* JLPT Badge directly inside info panel */}
                            <div className="flex self-end mb-4">
                                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide ${
                                    currentItem.jlpt_level === 'N5' ? 'bg-green-100 text-green-800' :
                                    currentItem.jlpt_level === 'N4' ? 'bg-blue-100 text-blue-800' :
                                    currentItem.jlpt_level === 'N3' ? 'bg-yellow-100 text-yellow-800' :
                                    currentItem.jlpt_level === 'N2' ? 'bg-orange-100 text-orange-800' :
                                    'bg-red-100 text-red-800'
                                }`}>
                                    {currentItem.jlpt_level || 'N?'}
                                </span>
                            </div>

                            <div className="text-center mb-8">
                                <h1 className="text-6xl font-black text-gray-800 mb-6 drop-shadow-sm">
                                    {char}
                                </h1>
                                <p className="text-xl text-gray-600 font-medium">
                                    {currentItem.meaning_en || currentItem.meaning_vi}
                                </p>
                                {currentItem.meaning_vi && currentItem.meaning_en && (
                                     <p className="text-sm text-gray-400 mt-2">{currentItem.meaning_vi}</p>
                                )}
                            </div>
                            
                            <div className="space-y-4 bg-gray-50 rounded-lg p-5 border border-gray-100">
                                <div className="flex justify-between items-baseline border-b border-gray-200 pb-3">
                                    <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">Onyomi</span>
                                    <span className="text-lg font-semibold text-gray-800">{currentItem.onyomi || 'ー'}</span>
                                </div>
                                <div className="flex justify-between items-baseline border-b border-gray-200 pb-3">
                                    <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">Kunyomi</span>
                                    <span className="text-lg font-semibold text-gray-800">{currentItem.kunyomi || 'ー'}</span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">Words</span>
                                    <span className="text-[17px] font-medium text-gray-700">{currentItem.example_word || currentItem.han_tu || 'ー'}</span>
                                </div>
                            </div>

                        </div>

                        {/* Pagination Navigation */}
                        <div className="flex justify-between gap-3 bg-white p-4 rounded-xl shadow-sm">
                            <button
                                onClick={handlePrev}
                                disabled={loading}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center group"
                            >
                                <svg className="w-5 h-5 mr-2 text-gray-500 group-hover:text-gray-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                </svg>
                                <span>Previous</span>
                            </button>
                            <button
                                onClick={handleNext}
                                disabled={loading}
                                className={
                                    `flex-1 py-3 font-medium rounded-lg transition-colors flex items-center justify-center group
                                    ${missingData 
                                        ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200'
                                    }`
                                }
                            >
                                <span>{missingData ? 'Skip' : 'Next'}</span>
                                <svg className={`w-5 h-5 ml-2 ${missingData ? 'text-orange-500 group-hover:text-orange-600' : 'text-blue-100 group-hover:text-white'} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                    </div>
                    
                </div>
            </div>
        </div>
    );
};

export default HandwritingPractice;
