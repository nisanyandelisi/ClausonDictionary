import React, { useState, useEffect, useMemo, useRef } from 'react';
import { normalizeClausonWord } from '../utils/textUtils';
import WordDetail from './WordDetail';

// API Base URL for backend
const API_BASE_URL = import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD
        ? 'https://clauson-sozluk-backend.clausondictionary.workers.dev'
        : 'http://localhost:8787');

const FILE_MAPPING = {
    1: "PROCESSED_1. A-EGE.json",
    2: "PROCESSED_2. EGE-ARD.json",
    3: "PROCESSED_3. ARD-BDD.json",
    4: "PROCESSED_4. BDĞ-CCĞ.json",
    5: "PROCESSED_5. CD-DLM.json",
    6: "PROCESSED_6. DLS-ĞDĞ.json",
    7: "PROCESSED_7. ĞDL-GCY.json",
    8: "PROCESSED_8. GDE-SDĞ.json",
    9: "PROCESSED_9. SDM-YĞĞ.json",
    10: "PROCESSED_10. YĞL-ZR.json"
};

const BetaHome = ({ isLoading, wordList, selectedWord, language, setLanguage }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchScope, setSearchScope] = useState('word');
    const [searchMode, setSearchMode] = useState('contains');
    const [etymologyFilter, setEtymologyFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedLetter, setSelectedLetter] = useState('');
    const [showEtymologyDropdown, setShowEtymologyDropdown] = useState(false);
    const etymologyDropdownRef = useRef(null);

    const [showDropdown, setShowDropdown] = useState(false);
    const [showAllAlphabet, setShowAllAlphabet] = useState(false);
    const [visibleLetterCount, setVisibleLetterCount] = useState(15);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Practice Mode State
    const [showPracticeModal, setShowPracticeModal] = useState(false);
    const [practiceSelectedFiles, setPracticeSelectedFiles] = useState([]);
    const [isPracticeMode, setIsPracticeMode] = useState(false);
    const [practiceQueue, setPracticeQueue] = useState([]);
    const [practiceIndex, setPracticeIndex] = useState(0);
    const [seenWords, setSeenWords] = useState(new Set());
    const [practiceLoading, setPracticeLoading] = useState(false);

    // Reporting State
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState('meaning');
    const [reportDescription, setReportDescription] = useState('');

    // Admin Panel State
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [reportsList, setReportsList] = useState([]);
    const [adminError, setAdminError] = useState('');
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

    // Review Mode State (Completely separate from search)
    const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
    const [reviewModeWord, setReviewModeWord] = useState(null);
    const [reviewModeLoading, setReviewModeLoading] = useState(false);
    const [totalWordCount, setTotalWordCount] = useState(0);

    const itemsPerPage = 9;
    const allLetters = ['A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'Ğ', 'H', 'I', 'İ', 'J', 'K', 'L', 'M', 'N', 'O', 'Ö', 'P', 'R', 'S', 'Ş', 'T', 'U', 'Ü', 'V', 'Y', 'Z'];

    // Load seen words from local storage
    useEffect(() => {
        const storedSeen = localStorage.getItem('clauson_seen_words');
        if (storedSeen) {
            setSeenWords(new Set(JSON.parse(storedSeen)));
        }
    }, []);

    const saveSeenWord = (word) => {
        const newSeen = new Set(seenWords);
        newSeen.add(word);
        setSeenWords(newSeen);
        localStorage.setItem('clauson_seen_words', JSON.stringify([...newSeen]));
    };

    // Keyboard Navigation for Practice Mode
    useEffect(() => {
        if (!isPracticeMode) return;

        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') {
                handleNextPracticeWord();
            } else if (e.key === 'ArrowLeft') {
                handlePrevPracticeWord();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPracticeMode, practiceIndex, practiceQueue]);

    // Responsive alphabet count
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 640) {
                setVisibleLetterCount(7);
            } else if (window.innerWidth < 768) {
                setVisibleLetterCount(9);
            } else if (window.innerWidth < 1024) {
                setVisibleLetterCount(11);
            } else {
                setVisibleLetterCount(15);
            }
        };

        handleResize(); // Initial check
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Reset search when a word is selected via URL
    useEffect(() => {
        if (selectedWord) {
            // Optional: Clear search term or keep it? 
        }
    }, [selectedWord]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
            if (etymologyDropdownRef.current && !etymologyDropdownRef.current.contains(event.target)) {
                setShowEtymologyDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [searchResults, setSearchResults] = useState([]);
    const [totalResults, setTotalResults] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
    const [randomWords, setRandomWords] = useState([]);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch random words on mount
    useEffect(() => {
        const fetchRandomWords = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/search/random?count=3`);
                if (response.ok) {
                    const data = await response.json();
                    setRandomWords(data);
                }
            } catch (error) {
                console.error('Error fetching random words:', error);
            }
        };

        if (!selectedWord && !searchTerm && !selectedLetter && !isPracticeMode) {
            fetchRandomWords();
        }
    }, [isPracticeMode]);

    // ============================================
    // REVIEW MODE - Completely separate from search
    // ============================================
    const fetchReviewWord = async (index) => {
        setReviewModeLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/word/by-offset?offset=${index}`);
            if (response.ok) {
                const data = await response.json();
                setReviewModeWord(data); // TEK kelime, array değil!
                setCurrentReviewIndex(index);
            } else {
                console.error('Failed to fetch review word');
                setReviewModeWord(null);
            }
        } catch (error) {
            console.error('Error fetching review word:', error);
            setReviewModeWord(null);
        } finally {
            setReviewModeLoading(false);
        }
    };

    // Fetch total word count on mount
    useEffect(() => {
        const fetchTotalCount = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/stats`);
                if (response.ok) {
                    const data = await response.json();
                    setTotalWordCount(data.total || 8589);
                }
            } catch (error) {
                setTotalWordCount(8589); // fallback
            }
        };
        fetchTotalCount();
    }, []);

    const startReviewMode = () => {
        setIsPracticeMode(true);
        setCurrentReviewIndex(0);
        fetchReviewWord(0);
    };

    const exitReviewMode = () => {
        setIsPracticeMode(false);
        setReviewModeWord(null);
        setCurrentReviewIndex(0);
    };

    const handleNextReviewWord = () => {
        const nextIndex = currentReviewIndex + 1;
        if (nextIndex < totalWordCount) {
            fetchReviewWord(nextIndex);
        }
    };

    const handlePrevReviewWord = () => {
        if (currentReviewIndex > 0) {
            fetchReviewWord(currentReviewIndex - 1);
        }
    };
    useEffect(() => {
        if (isPracticeMode) return; // Don't search in practice mode

        const fetchResults = async () => {
            setIsSearching(true);
            try {
                let query = debouncedSearchTerm;

                // Add prefix based on searchMode if not already present
                if (query && !query.includes('=')) {
                    if (searchMode === 'startsWith') query = `baş=${query}`;
                    else if (searchMode === 'endsWith') query = `son=${query}`;
                    else if (searchMode === 'exact') query = `tam=${query}`;
                }

                // If no query but letter selected
                if (!query && selectedLetter) {
                    query = `baş=${selectedLetter}`;
                }

                // If selected word (detail view), fetch exact word
                if (selectedWord) {
                    query = `tam=${selectedWord}`;
                }

                if (!query) {
                    setSearchResults([]);
                    setTotalResults(0);
                    setIsSearching(false);
                    return;
                }

                const url = `${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}&limit=${itemsPerPage}&offset=${(currentPage - 1) * itemsPerPage}&scope=${searchScope}${etymologyFilter !== 'all' ? `&etymology=${etymologyFilter}` : ''}`;
                console.log(`[BetaHome.jsx] Fetching: ${url}`);
                const response = await fetch(url);

                if (!response.ok) throw new Error('Search failed');
                const data = await response.json();

                setSearchResults(data.results);
                setTotalResults(data.total);
            } catch (error) {
                console.error('Error fetching search results:', error);
                // Fallback or error state
            } finally {
                setIsSearching(false);
            }
        };

        fetchResults();
    }, [debouncedSearchTerm, selectedLetter, currentPage, selectedWord, searchScope, searchMode, etymologyFilter, isPracticeMode]);

    // Use searchResults instead of filteredResults
    const currentResults = searchResults;
    const totalPages = Math.ceil(totalResults / itemsPerPage);

    // No slicing needed as backend returns paginated results
    // const startIndex = (currentPage - 1) * itemsPerPage;
    // const currentResults = filteredResults.slice(startIndex, startIndex + itemsPerPage);

    const handleLetterClick = (letter) => {
        const newLetter = letter === selectedLetter ? '' : letter;
        console.log(`[BetaHome.jsx] Letter button clicked. New letter: "${newLetter}"`);
        setSelectedLetter(newLetter);
        setCurrentPage(1);
        setSearchTerm('');
        setIsPracticeMode(false); // Exit practice mode
        if (selectedWord) {
            window.location.hash = '#/';
        }
    };

    const handleSearch = () => {
        console.log(`[BetaHome.jsx] Search button clicked. Term: "${searchTerm}"`);
        setSelectedLetter('');
        setCurrentPage(1);
        setIsPracticeMode(false); // Exit practice mode
        if (selectedWord) {
            window.location.hash = '#/';
        }
    };

    const handleResultClick = (entry) => {
        console.log(`[BetaHome.jsx] Result card clicked. Navigating to word: "${entry.word}"`);
        window.location.hash = `#/kelime/${encodeURIComponent(entry.word)}`;
    };

    const handleDropdownSelect = (mode) => {
        console.log(`[BetaHome.jsx] Search mode changed to: "${mode}"`);
        setSearchMode(mode);
        setShowDropdown(false);
    };

    const getModeDisplayName = (mode) => {
        const labels = {
            contains: language === 'tr' ? 'İçerir' : 'Contains',
            startsWith: language === 'tr' ? 'İle Başlar' : 'Starts With',
            endsWith: language === 'tr' ? 'İle Biter' : 'Ends With',
            exact: language === 'tr' ? 'Tam Eşleşme' : 'Exact Match'
        };
        return labels[mode] || labels.contains;
    };

    const handlePlusClick = () => {
        setShowAllAlphabet(!showAllAlphabet);
    };

    const getPaginationNumbers = () => {
        const maxButtons = 6;
        const maxPagesToShow = Math.min(totalPages, maxButtons);
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
    };

    const handleLogoClick = () => {
        window.location.hash = '#/';
        setSearchTerm('');
        setSelectedLetter('');
        setCurrentPage(1);
        setIsPracticeMode(false);
    };

    const handleRandomWord = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/search/random`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.word) {
                    console.log(`[BetaHome.jsx] Random word selected: "${data.word}"`);
                    window.location.hash = `#/kelime/${encodeURIComponent(data.word)}`;
                }
            }
        } catch (error) {
            console.error('Error fetching random word:', error);
        }
    };

    // Practice Mode Handlers
    const togglePracticeFile = (fileNum) => {
        setPracticeSelectedFiles(prev =>
            prev.includes(fileNum)
                ? prev.filter(n => n !== fileNum)
                : [...prev, fileNum]
        );
    };

    const startPractice = async () => {
        if (practiceSelectedFiles.length === 0) {
            alert("Lütfen en az bir bölüm seçin.");
            return;
        }

        setPracticeLoading(true);
        setShowPracticeModal(false);

        try {
            // Seçilen bölümlere göre offset aralığını hesapla
            // Her bölüm yaklaşık 850-900 kelime içeriyor
            const WORDS_PER_FILE = 860;
            let allWords = [];

            for (const fileNum of practiceSelectedFiles.sort((a, b) => a - b)) {
                const startOffset = (fileNum - 1) * WORDS_PER_FILE;

                // API'den bu aralıktaki kelimeleri çek
                const response = await fetch(`${API_BASE_URL}/api/words/range?offset=${startOffset}&limit=${WORDS_PER_FILE}`);
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        allWords = [...allWords, ...data];
                    }
                }
            }

            if (allWords.length === 0) {
                alert("Veri yüklenemedi!");
                setPracticeLoading(false);
                return;
            }

            // Filter out seen words
            const unseenWords = allWords.filter(w => !seenWords.has(w.word));

            if (unseenWords.length === 0) {
                alert("Seçilen bölümlerdeki tüm kelimeler zaten çalışılmış!");
                setPracticeLoading(false);
                return;
            }

            setPracticeQueue(unseenWords);
            setPracticeIndex(0);
            setIsPracticeMode(true);

        } catch (error) {
            console.error(error);
            alert("Bir hata oluştu: " + error.message);
        } finally {
            setPracticeLoading(false);
        }
    };

    const handleNextPracticeWord = () => {
        if (practiceIndex < practiceQueue.length) {
            const currentWord = practiceQueue[practiceIndex];
            saveSeenWord(currentWord.word); // Mark as seen
        }

        if (practiceIndex + 1 >= practiceQueue.length) {
            alert("Tebrikler! Seçilen tüm kelimeleri tamamladınız.");
            setIsPracticeMode(false);
            setPracticeQueue([]);
            setPracticeIndex(0);
        } else {
            setPracticeIndex(practiceIndex + 1);
        }
    };

    const handlePrevPracticeWord = () => {
        if (practiceIndex > 0) {
            setPracticeIndex(practiceIndex - 1);
        }
    };

    const resetPracticeProgress = () => {
        if (confirm("Tüm ilerlemeniz silinecek. Emin misiniz?")) {
            localStorage.removeItem('clauson_seen_words');
            setSeenWords(new Set());
            alert("İlerleme sıfırlandı.");
        }
    };

    // Reporting Handlers
    const handleReportSubmit = async () => {
        const currentWord = practiceQueue[practiceIndex];
        const report = {
            word: currentWord.word,
            page: currentWord.page || 'N/A',
            reason: reportReason,
            description: reportDescription,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reportData),
            });

            if (response.ok) {
                setShowSuccessAnimation(true);
                setTimeout(() => {
                    setShowSuccessAnimation(false);
                    setShowReportModal(false);
                    setReportDescription('');
                }, 2000);
            } else {
                alert('Bir hata oluştu, lütfen tekrar deneyin.');
            }
        } catch (error) {
            console.error('Report error:', error);
            alert('Sunucu hatası.');
        }
    };

    const fetchReports = async () => {
        if (!adminPassword) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/reports`, {
                headers: {
                    'X-Admin-Secret': adminPassword
                }
            });
            if (response.ok) {
                const data = await response.json();
                setReportsList(data);
                setIsAdminLoggedIn(true);
                setAdminError('');
            } else {
                setAdminError('Hatalı şifre!');
                setIsAdminLoggedIn(false);
            }
        } catch (error) {
            console.error('Fetch reports error:', error);
            setAdminError('Sunucu hatası.');
        }
    };

    const handleAdminLogin = (e) => {
        e.preventDefault();
        fetchReports();
    };

    const downloadReports = async () => {
        // ... existing download logic if needed, or remove
        // For now, let's keep it but use the new password logic if logged in
        const secret = isAdminLoggedIn ? adminPassword : prompt("Yönetici şifresini girin:");
        if (!secret) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/reports`, {
                headers: {
                    'X-Admin-Secret': secret
                }
            });
            if (response.ok) {
                const reports = await response.json();
                const blob = new Blob([JSON.stringify(reports, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'clauson_reports_server.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                alert("Yetkisiz erişim veya hata.");
            }
        } catch (error) {
            console.error('Download error:', error);
            alert("Raporlar indirilemedi.");
        }
    };

    const visibleLetters = allLetters.slice(0, visibleLetterCount);
    const hiddenLetters = allLetters.slice(visibleLetterCount);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen w-full">
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 border-4 border-text-primary border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
                    <h2 className="text-xl font-medium">{language === 'tr' ? 'Sözlük Yükleniyor...' : 'Loading Dictionary...'}</h2>
                    <p className="text-text-secondary text-sm mt-2">{language === 'tr' ? 'Lütfen bekleyin...' : 'Please wait...'}</p>
                </div>
            </div>
        );
    }

    // Dynamic classes based on whether a word is selected
    const headerClass = selectedWord
        ? "py-2 bg-bg-main border-b border-border-color mb-[2vh]"
        : "py-2 md:py-12 bg-bg-main mb-[2vh]";



    const headerContainerClass = selectedWord
        ? "max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        : "text-center";

    const searchBarContainerClass = selectedWord
        ? "flex-1 flex justify-center w-full"
        : "max-w-3xl mx-auto px-4 mb-2 md:mb-8";

    const searchBarInnerClass = selectedWord
        ? "w-[90%] md:w-full max-w-2xl"
        : "w-full";

    const handleEtymologySelect = (type) => {
        console.log(`[BetaHome.jsx] Etymology filter changed to: "${type}"`);
        setEtymologyFilter(type);
        setShowEtymologyDropdown(false);
    };

    const getEtymologyDisplayName = (type) => {
        return type === 'all' ? (language === 'tr' ? 'Tüm Tipler' : 'All Types') : type;
    };

    return (
        <div className="min-h-screen bg-bg-main flex flex-col">
            {/* Practice Mode Modal */}
            {showPracticeModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 fade-in">
                    <div className="bg-bg-card border border-border-color rounded-lg shadow-xl max-w-md w-full p-6 text-text-primary">
                        <h2 className="text-xl font-bold mb-4">İnceleme Modu Ayarları</h2>
                        <div className="mb-4 max-h-60 overflow-y-auto">
                            <p className="mb-2 text-sm text-text-secondary">Dahil edilecek dosyaları seçin:</p>
                            <div className="grid grid-cols-1 gap-2">
                                {Object.keys(FILE_MAPPING).map(num => (
                                    <label key={num} className="flex items-center space-x-2 cursor-pointer hover:bg-bg-card-hover p-2 rounded border border-border-color transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={practiceSelectedFiles.includes(parseInt(num))}
                                            onChange={() => togglePracticeFile(parseInt(num))}
                                            className="form-checkbox h-4 w-4 text-text-primary bg-bg-main border-border-color rounded focus:ring-0"
                                        />
                                        <span className="text-sm">Bölüm {num}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-between items-center mt-6">
                            <div className="flex gap-4">
                                <button
                                    onClick={resetPracticeProgress}
                                    className="text-red-500 text-sm hover:underline"
                                >
                                    Sıfırla
                                </button>
                                <button
                                    onClick={downloadReports}
                                    className="text-text-secondary text-sm hover:text-text-primary hover:underline"
                                >
                                    Raporları İndir
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowPracticeModal(false)}
                                    className="px-4 py-2 text-text-secondary hover:bg-bg-card-hover rounded transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={startPractice}
                                    className="px-4 py-2 bg-bg-card border border-border-color text-text-primary rounded hover:border-text-primary font-medium transition-colors"
                                >
                                    Başla
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-bg-main border border-border-color rounded-lg w-full max-w-md p-6 shadow-2xl relative">
                        {showSuccessAnimation ? (
                            <div className="flex flex-col items-center justify-center py-8 fade-in">
                                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 animate-bounce">
                                    <i className="fas fa-check text-white text-3xl"></i>
                                </div>
                                <h3 className="text-xl font-bold text-text-primary">Kaydedildi</h3>
                                <p className="text-text-secondary mt-2">Geri bildiriminiz için teşekkürler.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold text-text-primary">Hata Bildir</h3>
                                    <button onClick={() => setShowReportModal(false)} className="text-text-secondary hover:text-text-primary">
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                                <p className="text-text-secondary mb-4">
                                    "<span className="font-bold text-accent-color">{selectedWordForReport?.word}</span>" kelimesi için hata bildiriyorsunuz.
                                </p>
                                <div className="flex gap-2 mb-4">
                                    <button
                                        onClick={() => setReportReason('meaning')}
                                        className={`flex-1 py-2 rounded border ${reportReason === 'meaning' ? 'bg-accent-color text-bg-main border-accent-color' : 'bg-bg-card border-border-color text-text-secondary'}`}
                                    >
                                        Anlam Hatası
                                    </button>
                                    <button
                                        onClick={() => setReportReason('typo')}
                                        className={`flex-1 py-2 rounded border ${reportReason === 'typo' ? 'bg-accent-color text-bg-main border-accent-color' : 'bg-bg-card border-border-color text-text-secondary'}`}
                                    >
                                        Yazım Hatası
                                    </button>
                                    <button
                                        onClick={() => setReportReason('other')}
                                        className={`flex-1 py-2 rounded border ${reportReason === 'other' ? 'bg-accent-color text-bg-main border-accent-color' : 'bg-bg-card border-border-color text-text-secondary'}`}
                                    >
                                        Diğer
                                    </button>
                                </div>
                                <textarea
                                    value={reportDescription}
                                    onChange={(e) => setReportDescription(e.target.value)}
                                    placeholder="Lütfen hatayı detaylandırın..."
                                    className="w-full bg-bg-card border border-border-color rounded p-3 text-text-primary mb-4 h-32 outline-none focus:border-accent-color"
                                ></textarea>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowReportModal(false)} className="px-4 py-2 text-text-secondary hover:text-text-primary">
                                        İptal
                                    </button>
                                    <button onClick={handleReportSubmit} className="bg-accent-color text-bg-main px-6 py-2 rounded font-bold hover:bg-opacity-90">
                                        Gönder
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <header className={headerClass}>
                {/* Mobile Header Row */}
                <div className="flex md:hidden justify-between items-center px-4 py-3 mb-2">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={handleLogoClick}>
                        <img src="./logo.png" alt="Clauson" className="h-10 w-auto" />
                        <div className="flex flex-col">
                            <span className="text-[1.35rem] font-bold text-text-primary leading-none font-inter">Clauson</span>
                            <span className="text-[13px] text-text-secondary font-inter">{language === 'tr' ? 'Türkçe Etimoloji Sözlüğü' : 'Turkish Etymological Dictionary'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Language Toggle */}
                        <button
                            onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}
                            className="px-2 py-1 rounded-md bg-bg-card border border-border-color text-sm font-medium"
                            title={language === 'tr' ? 'Switch to English' : 'Türkçe\'ye geç'}
                        >
                            {language === 'tr' ? '🇹🇷 TR' : '🇬🇧 EN'}
                        </button>
                        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-text-primary">
                            <i className="fas fa-bars text-2xl"></i>
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden px-4 mb-4 fade-in">
                        <button
                            onClick={() => {
                                setShowPracticeModal(true);
                                setMobileMenuOpen(false);
                            }}
                            className="w-full py-2 bg-bg-card border border-border-color text-text-primary rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-bg-card-hover transition-colors"
                        >
                            <i className="fas fa-graduation-cap"></i>
                            {language === 'tr' ? 'İnceleme Modu' : 'Review Mode'}
                        </button>
                    </div>
                )}

                {/* Desktop Header Row */}
                <div className={`hidden md:flex justify-center items-center mb-8 ${selectedWord ? 'mt-[10px]' : ''} relative`}>
                    {/* Language Toggle - Desktop */}
                    <button
                        onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}
                        className="absolute right-4 top-0 px-3 py-1.5 rounded-lg bg-bg-card border border-border-color text-sm font-medium hover:border-text-primary transition-colors"
                        title={language === 'tr' ? 'Switch to English' : 'Türkçe\'ye geç'}
                    >
                        {language === 'tr' ? '🇹🇷 Türkçe' : '🇬🇧 English'}
                    </button>

                    {/* Review Mode Button - Sol üstte, modal açar */}
                    <button
                        onClick={() => setShowPracticeModal(true)}
                        className={`absolute left-4 top-0 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${isPracticeMode ? 'bg-accent-color text-bg-main border-accent-color' : 'bg-bg-card border-border-color text-text-primary hover:border-text-primary'}`}
                        title="İnceleme Modu"
                    >
                        <i className="fas fa-book-reader"></i>
                        {language === 'tr' ? 'İncele' : 'Review'}
                    </button>

                    <div
                        onClick={handleLogoClick}
                        className={`flex items-center cursor-pointer ${selectedWord ? '' : 'flex-col justify-center'}`}
                    >
                        <img
                            src="./logo.png"
                            alt="Clauson Logo"
                            className={`${selectedWord ? 'h-12' : 'h-32'} w-auto transition-all duration-300`}
                        />

                        {!selectedWord && (
                            <div className="text-center mt-4">
                                <h1 className="text-5xl font-bold text-text-primary mb-2 font-inter">Clauson</h1>
                                <p className="text-lg text-text-secondary font-inter">{language === 'tr' ? 'Türkçe Etimoloji Sözlüğü' : 'Turkish Etymological Dictionary'}</p>
                            </div>
                        )}

                        {selectedWord && (
                            <div className="ml-4 text-left">
                                <h1 className="text-xl font-bold text-text-primary font-inter leading-tight">Clauson</h1>
                                <p className="text-sm text-text-secondary font-inter">{language === 'tr' ? 'Türkçe Etimoloji Sözlüğü' : 'Turkish Etymological Dictionary'}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Search Bar */}
                <div className={searchBarContainerClass}>
                    <div className={`search-bar ${selectedWord ? 'p-[0.3rem]' : 'p-[0.3rem] md:p-[0.9rem]'} ${searchBarInnerClass} mx-auto`}>
                        <div className="flex items-center justify-center">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder={language === 'tr' ? "Bir kelime veya anlam arayın..." : "Search for a word or meaning..."}
                                className="flex-1 bg-transparent text-text-primary placeholder-text-secondary text-lg outline-none px-4 font-inter"
                            />
                            <button
                                onClick={handleRandomWord}
                                className="p-2 text-text-primary hover:text-text-secondary transition-colors mr-1"
                                title="Random Word"
                            >
                                <i className="fas fa-dice text-xl"></i>
                            </button>
                            <button
                                onClick={handleSearch}
                                className="p-2 text-text-primary hover:text-text-secondary transition-colors"
                            >
                                <i className="fas fa-search text-xl"></i>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters - Visible on Desktop, Hidden on Mobile (unless menu open) */}
                <div className={`flex flex-col items-center justify-center gap-4 mt-4 px-4 fade-in ${mobileMenuOpen ? 'block' : 'hidden md:flex'}`}>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <div className="toggle-control">
                            <div className={`toggle-option ${searchScope === 'word' ? 'active' : ''}`} onClick={() => setSearchScope('word')}>
                                {language === 'tr' ? 'Kelime' : 'Word'}
                            </div>
                            <div className={`toggle-option ${searchScope === 'meaning' ? 'active' : ''}`} onClick={() => setSearchScope('meaning')}>
                                {language === 'tr' ? 'Açıklama' : 'Meaning'}
                            </div>
                        </div>

                        {/* İnceleme Modu butonu sol üstte, burada değil! */}

                        {!isPracticeMode && (
                            <div className="flex gap-2">
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        className="filter-button"
                                        onClick={() => setShowDropdown(!showDropdown)}
                                    >
                                        <span>{getModeDisplayName(searchMode)}</span>
                                        <i className="fas fa-chevron-down text-xs"></i>
                                    </button>
                                    {showDropdown && (
                                        <div className="dropdown-menu">
                                            <div className="dropdown-item" onClick={() => handleDropdownSelect('contains')}>{language === 'tr' ? 'İçerir' : 'Contains'}</div>
                                            <div className="dropdown-item" onClick={() => handleDropdownSelect('startsWith')}>{language === 'tr' ? 'İle Başlar' : 'Starts With'}</div>
                                            <div className="dropdown-item" onClick={() => handleDropdownSelect('endsWith')}>{language === 'tr' ? 'İle Biter' : 'Ends With'}</div>
                                            <div className="dropdown-item" onClick={() => handleDropdownSelect('exact')}>{language === 'tr' ? 'Tam Eşleşme' : 'Exact Match'}</div>
                                        </div>
                                    )}
                                </div>

                                <div className="relative" ref={etymologyDropdownRef}>
                                    <button
                                        className="filter-button"
                                        onClick={() => setShowEtymologyDropdown(!showEtymologyDropdown)}
                                    >
                                        <span>{getEtymologyDisplayName(etymologyFilter)}</span>
                                        <i className="fas fa-chevron-down text-xs"></i>
                                    </button>
                                    {showEtymologyDropdown && (
                                        <div className="dropdown-menu">
                                            <div className="dropdown-item" onClick={() => handleEtymologySelect('all')}>{language === 'tr' ? 'Tüm Tipler' : 'All Types'}</div>
                                            <div className="dropdown-item" onClick={() => handleEtymologySelect('Basic')}>Basic</div>
                                            <div className="dropdown-item" onClick={() => handleEtymologySelect('D')}>D</div>
                                            <div className="dropdown-item" onClick={() => handleEtymologySelect('F')}>F</div>
                                            <div className="dropdown-item" onClick={() => handleEtymologySelect('VU')}>VU</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                        {visibleLetters.map(letter => (
                            <button
                                key={letter}
                                className={`alphabet-btn ${selectedLetter === letter ? 'active' : ''}`}
                                onClick={() => handleLetterClick(letter)}
                            >
                                {letter}
                            </button>
                        ))}
                        {hiddenLetters.length > 0 && (
                            <button
                                className="alphabet-btn plus"
                                onClick={handlePlusClick}
                            >
                                {showAllAlphabet ? '-' : '+'}
                            </button>
                        )}
                    </div>

                    {
                        showAllAlphabet && hiddenLetters.length > 0 && (
                            <div className="alphabet-expanded fade-in flex flex-wrap justify-center gap-2">
                                {hiddenLetters.map(letter => (
                                    <button
                                        key={letter}
                                        className={`alphabet-btn ${selectedLetter === letter ? 'active' : ''}`}
                                        onClick={() => handleLetterClick(letter)}
                                    >
                                        {letter}
                                    </button>
                                ))}
                            </div>
                        )
                    }
                </div >
            </header >

            <main className="flex-1 py-8 px-4">
                {/* ============================================ */}
                {/* REVIEW MODE - Tamamen ayrı UI */}
                {/* ============================================ */}
                {isPracticeMode && practiceQueue.length > 0 ? (
                    <div className="max-w-3xl mx-auto">
                        {/* Review Mode Header */}
                        <div className="flex justify-between items-center mb-6 bg-bg-card p-4 rounded-lg border border-border-color">
                            <div className="flex items-center gap-4">
                                <span className="text-text-primary font-bold text-lg">
                                    <i className="fas fa-book-reader mr-2 text-accent-color"></i>
                                    {language === 'tr' ? 'İnceleme Modu' : 'Review Mode'}
                                </span>
                                <span className="text-text-secondary">
                                    {practiceIndex + 1} / {practiceQueue.length}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowReportModal(true)}
                                    className="px-3 py-2 bg-bg-main border border-red-500/30 text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                                    title="Hata Bildir"
                                >
                                    <i className="fas fa-exclamation-triangle"></i>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsPracticeMode(false);
                                        setPracticeQueue([]);
                                        setPracticeIndex(0);
                                    }}
                                    className="px-4 py-2 bg-bg-main border border-border-color text-text-primary rounded-lg hover:border-red-500 hover:text-red-500 transition-colors"
                                >
                                    <i className="fas fa-times mr-2"></i>
                                    {language === 'tr' ? 'Çıkış' : 'Exit'}
                                </button>
                            </div>
                        </div>

                        {/* Single Word Display */}
                        {practiceLoading ? (
                            <div className="card p-12 text-center">
                                <div className="w-12 h-12 border-4 border-accent-color border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-text-secondary">{language === 'tr' ? 'Yükleniyor...' : 'Loading...'}</p>
                            </div>
                        ) : (
                            <div className="card p-8 fade-in">
                                <div className="card-tag mb-4">
                                    {practiceQueue[practiceIndex]?.etymology_type || 'Basic'}
                                </div>
                                <h2 className="text-4xl font-bold text-text-primary mb-6">
                                    {practiceQueue[practiceIndex]?.word}
                                </h2>
                                <div className="text-lg text-text-secondary mb-6 leading-relaxed" dangerouslySetInnerHTML={{
                                    __html: language === 'tr'
                                        ? (practiceQueue[practiceIndex]?.meaning_tr || practiceQueue[practiceIndex]?.meaning || 'Anlam bulunamadı')
                                        : (practiceQueue[practiceIndex]?.meaning || 'Meaning not found')
                                }}></div>

                                {practiceQueue[practiceIndex]?.full_entry_text && (
                                    <div className="border-t border-border-color pt-6 mt-6">
                                        <p className="text-sm text-text-secondary leading-relaxed" dangerouslySetInnerHTML={{
                                            __html: language === 'tr'
                                                ? (practiceQueue[practiceIndex]?.full_entry_text_tr || practiceQueue[practiceIndex]?.full_entry_text)
                                                : practiceQueue[practiceIndex]?.full_entry_text
                                        }}></p>
                                    </div>
                                )}

                                {practiceQueue[practiceIndex]?.page && (
                                    <div className="mt-6 text-sm text-text-secondary">
                                        <i className="fas fa-book mr-2"></i>
                                        Sayfa: {practiceQueue[practiceIndex]?.page}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex flex-row justify-center items-center gap-6 mt-8 w-full">
                            <button
                                onClick={handlePrevPracticeWord}
                                disabled={practiceIndex === 0}
                                className="bg-bg-card border border-border-color px-6 py-3 rounded-lg disabled:opacity-30 hover:border-text-primary transition-colors flex items-center gap-2 text-text-primary"
                            >
                                <i className="fas fa-arrow-left"></i>
                                <span>{language === 'tr' ? 'Önceki' : 'Previous'}</span>
                            </button>
                            <button
                                onClick={handleNextPracticeWord}
                                disabled={practiceIndex >= practiceQueue.length - 1}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-30"
                            >
                                <span>{language === 'tr' ? 'Sonraki' : 'Next'}</span>
                                <i className="fas fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                ) : selectedWord ? (
                    /* Normal Word Detail View */
                    <div className="flex flex-col items-center w-full">
                        <WordDetail
                            word={selectedWord}
                            wordList={wordList}
                            language={language}
                        />
                    </div>
                ) : (
                    /* Normal Search Results / Random Words */
                    <div className="max-w-7xl mx-auto space-y-6 w-full mb-[2vh]">
                        {(searchTerm || selectedLetter) ? (
                            <>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-text-primary">
                                        {totalResults} {language === 'tr' ? 'sonuç bulundu' : 'results found'}
                                    </h2>
                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-text-secondary">
                                                {language === 'tr' ? 'Sayfa' : 'Page'} {currentPage} / {totalPages}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {currentResults.map(entry => (
                                        <div
                                            key={entry.id || entry.word}
                                            className="card p-[1.3rem] cursor-pointer hover:bg-bg-card-hover transition-colors fade-in"
                                            onClick={() => handleResultClick(entry)}
                                        >
                                            <div className="card-tag">
                                                {entry.etymology_type || 'Basic'}
                                            </div>
                                            <div className="card-title">
                                                {entry.word}
                                            </div>
                                            <div className="card-description">
                                                {language === 'tr'
                                                    ? (entry.meaning_tr || entry.meaning || 'Anlam bulunamadı')
                                                    : (entry.meaning || 'Meaning not found')}
                                            </div>
                                            <div className="card-meta">
                                                {entry.page && `Sayfa: ${entry.page}`}
                                                {entry.skeleton && ` | İskelet: ${entry.skeleton}`}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {currentResults.length === 0 && (
                                    <div className="card p-12 text-center fade-in">
                                        <i className="fas fa-search text-6xl text-text-secondary mb-6"></i>
                                        <h3 className="text-2xl font-bold mb-3">{language === 'tr' ? 'Sonuç Bulunamadı' : 'No Results Found'}</h3>
                                        <p className="text-text-secondary text-lg">
                                            {language === 'tr' ? 'Arama kriterlerinize uygun kelime bulunamadı.' : 'No words found matching your search criteria.'}
                                        </p>
                                    </div>
                                )}

                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-12 mb-8">
                                        <button
                                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                            disabled={currentPage === 1}
                                            className="bg-bg-card border border-border-color px-4 py-2 rounded-lg disabled:opacity-50 hover:border-text-primary transition-colors"
                                        >
                                            <i className="fas fa-chevron-left"></i>
                                        </button>

                                        {getPaginationNumbers().map(pageNum => (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`px-4 py-2 rounded-lg transition-colors ${currentPage === pageNum
                                                    ? 'bg-active-bg text-active-text'
                                                    : 'bg-bg-card border border-border-color hover:border-text-primary'
                                                    }`}
                                            >
                                                {pageNum}
                                            </button>
                                        ))}

                                        <button
                                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage === totalPages}
                                            className="bg-bg-card border border-border-color px-4 py-2 rounded-lg disabled:opacity-50 hover:border-text-primary transition-colors"
                                        >
                                            <i className="fas fa-chevron-right"></i>
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {randomWords.map(entry => (
                                    <div
                                        key={entry.id || entry.word}
                                        className="card p-[1.3rem] cursor-pointer hover:bg-bg-card-hover transition-colors fade-in"
                                        onClick={() => handleResultClick(entry)}
                                    >
                                        <div className="card-tag">
                                            {entry.etymology_type || 'Basic'}
                                        </div>
                                        <div className="card-title">
                                            {entry.word}
                                        </div>
                                        <div className="card-description">
                                            {language === 'tr'
                                                ? (entry.meaning_tr || entry.meaning || 'Anlam bulunamadı')
                                                : (entry.meaning || 'Meaning not found')}
                                        </div>
                                        <div className="card-meta">
                                            {entry.page && `Sayfa: ${entry.page}`}
                                            {entry.skeleton && ` | İskelet: ${entry.skeleton}`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main >

            <footer className="footer-text text-center py-4 relative">
                {language === 'tr' ? 'Aristokles yaptı' : 'Made by Aristokles'}
                <button
                    onClick={() => setShowAdminModal(true)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xs text-text-secondary opacity-30 hover:opacity-100 transition-opacity"
                >
                    <i className="fas fa-lock"></i>
                </button>
            </footer>

            {/* Admin Modal */}
            {
                showAdminModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                        <div className="bg-bg-main border border-border-color rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
                            <div className="flex justify-between items-center p-4 border-b border-border-color">
                                <h3 className="text-xl font-bold text-text-primary">Yönetici Paneli</h3>
                                <button onClick={() => setShowAdminModal(false)} className="text-text-secondary hover:text-text-primary">
                                    <i className="fas fa-times text-xl"></i>
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1">
                                {!isAdminLoggedIn ? (
                                    <form onSubmit={handleAdminLogin} className="flex flex-col gap-4 max-w-sm mx-auto mt-10">
                                        <div className="text-center mb-4">
                                            <i className="fas fa-user-shield text-4xl text-accent-color mb-2"></i>
                                            <p className="text-text-secondary">Lütfen yönetici şifresini girin.</p>
                                        </div>
                                        <input
                                            type="password"
                                            value={adminPassword}
                                            onChange={(e) => setAdminPassword(e.target.value)}
                                            placeholder="Şifre"
                                            className="bg-bg-card border border-border-color rounded px-4 py-2 text-text-primary focus:border-accent-color outline-none"
                                            autoFocus
                                        />
                                        {adminError && <p className="text-red-500 text-sm">{adminError}</p>}
                                        <button type="submit" className="bg-accent-color text-bg-main font-bold py-2 rounded hover:bg-opacity-90 transition-colors">
                                            Giriş Yap
                                        </button>
                                    </form>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-lg font-bold">Raporlar ({reportsList.length})</h4>
                                            <button onClick={downloadReports} className="bg-bg-card border border-border-color px-3 py-1 rounded hover:border-text-primary transition-colors text-sm">
                                                <i className="fas fa-download mr-2"></i> İndir
                                            </button>
                                        </div>

                                        {reportsList.length === 0 ? (
                                            <p className="text-text-secondary text-center py-8">Henüz rapor yok.</p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-border-color text-text-secondary text-sm">
                                                            <th className="p-2">Tarih</th>
                                                            <th className="p-2">Kelime</th>
                                                            <th className="p-2">Sayfa</th>
                                                            <th className="p-2">Sebep</th>
                                                            <th className="p-2">Açıklama</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {reportsList.map((report, idx) => (
                                                            <tr key={idx} className="border-b border-border-color hover:bg-bg-card transition-colors">
                                                                <td className="p-2 text-sm text-text-secondary whitespace-nowrap">
                                                                    {new Date(report.timestamp).toLocaleString('tr-TR')}
                                                                </td>
                                                                <td className="p-2 font-bold text-accent-color">{report.word}</td>
                                                                <td className="p-2 text-sm">{report.page}</td>
                                                                <td className="p-2 text-sm capitalize">{report.reason}</td>
                                                                <td className="p-2 text-sm text-text-secondary max-w-xs truncate" title={report.description}>
                                                                    {report.description}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default BetaHome;