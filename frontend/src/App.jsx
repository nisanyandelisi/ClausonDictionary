import React, { useState, useEffect } from 'react';
import BetaHome from './pages/BetaHome';
import WordDetail from './pages/WordDetail';
import api from './utils/api';

const App = () => {
    const [currentPath, setCurrentPath] = useState(window.location.hash.slice(1) || '/');
    const [wordList, setWordList] = useState(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [language, setLanguage] = useState('tr'); // 'tr' or 'en'

    useEffect(() => {
        const handleHashChange = () => {
            const newPath = window.location.hash.slice(1) || '/';
            console.log(`[App.jsx] Hash changed. New path: ${newPath}`);
            setCurrentPath(newPath);
        };

        window.addEventListener('hashchange', handleHashChange);
        console.log(`[App.jsx] Initial path: ${currentPath}`);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Fetch word list for smart linking (lightweight)
    useEffect(() => {
        const fetchWordList = async () => {
            try {
                const data = await api.get('/api/words/list');
                setWordList(new Set(data));
            } catch (error) {
                console.error('Error fetching word list:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWordList();
    }, []);

    const renderContent = () => {
        let selectedWord = null;
        if (currentPath.startsWith('/kelime/')) {
            selectedWord = decodeURIComponent(currentPath.split('/kelime/')[1]);
            console.log(`[App.jsx] Selected word: "${selectedWord}"`);
        }

        return (
            <BetaHome
                isLoading={isLoading}
                wordList={wordList}
                selectedWord={selectedWord}
                language={language}
                setLanguage={setLanguage}
            />
        );
    };

    return (
        <div className="min-h-screen bg-bg-main">
            {renderContent()}
        </div>
    );
};

export default App;