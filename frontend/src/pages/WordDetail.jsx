import React, { useState, useEffect } from 'react';
import RichTextParser from '../components/RichTextParser';

const WordDetail = ({ word, wordList, language = 'tr' }) => {
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchWordDetail = async () => {
            if (!word) return;

            setIsLoading(true);
            try {
                console.log(`[WordDetail.jsx] Fetching details for word: "${word}"`);
                // Use the 'tam=' operator for exact match
                const response = await fetch(`/api/search?q=tam=${encodeURIComponent(word)}`);
                const data = await response.json();

                if (data.results && data.results.length > 0) {
                    setEntries(data.results);
                } else {
                    setEntries([]);
                }
            } catch (error) {
                console.error('Error fetching word details:', error);
                setEntries([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWordDetail();
    }, [word]);

    // Helper function to get meaning based on language
    const getMeaning = (entry) => {
        if (language === 'tr') {
            return entry.meaning_tr || entry.meaning || 'Anlam bulunamadı';
        }
        return entry.meaning || 'Meaning not found';
    };

    // Helper function to get full entry text based on language
    const getFullEntryText = (entry) => {
        if (language === 'tr') {
            return entry.full_entry_text_tr || entry.full_entry_text;
        }
        return entry.full_entry_text;
    };

    if (isLoading) {
        return (
            <div className="w-full max-w-4xl mx-auto">
                <div className="card p-8 fade-in">
                    <div className="loading-shimmer h-12 w-3/4 rounded mb-4"></div>
                    <div className="loading-shimmer h-4 w-1/2 rounded mb-6"></div>
                    <div className="space-y-3">
                        <div className="loading-shimmer h-4 w-full rounded"></div>
                        <div className="loading-shimmer h-4 w-5/6 rounded"></div>
                        <div className="loading-shimmer h-4 w-3/4 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!word || entries.length === 0) {
        return (
            <div className="w-full max-w-4xl mx-auto">
                <div className="card p-12 text-center fade-in">
                    <i className="fas fa-search text-6xl text-text-secondary mb-6"></i>
                    <h2 className="text-3xl font-bold mb-4">
                        {language === 'tr' ? 'Kelime Bulunamadı' : 'Word Not Found'}
                    </h2>
                    <p className="text-text-secondary text-lg mb-8">
                        {language === 'tr'
                            ? 'Aradığınız kelime sözlükte bulunamadı.'
                            : 'The word you are looking for was not found in the dictionary.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[50rem] mx-auto mb-[2vh]">
            {entries.map((entry, index) => (
                <div key={entry.id || index} className="card p-[1.3rem] md:p-8 mb-6 fade-in relative">
                    <div className="card-tag">
                        {entry.etymology_type || 'Basic'}
                    </div>
                    <div className="mb-6">
                        <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3 break-words">
                            {entry.word}
                        </h1>
                        <div className="flex flex-wrap items-center gap-3">
                            {entry.page && (
                                <span style={{ color: '#dcdcdc' }} className="text-sm text-text-secondary font-mono">
                                    {language === 'tr' ? 'Sayfa' : 'Page'}: {entry.page};
                                </span>
                            )}
                            {entry.skeleton && (
                                <span style={{ color: '#dcdcdc' }} className="text-sm text-text-secondary font-mono">
                                    {language === 'tr' ? 'İskelet' : 'Skeleton'}: {entry.skeleton}
                                </span>
                            )}
                        </div>
                    </div>

                    {(entry.meaning || entry.meaning_tr) && (
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-text-secondary mb-3">
                                {language === 'tr' ? 'ANLAM' : 'MEANING'}
                            </h3>
                            <div style={{ color: '#f4f4f4' }} className="bg-bg-card p-[1.3rem] rounded-lg">
                                <p className="text-base leading-relaxed text-[#f4f4f4]">{getMeaning(entry)}</p>
                            </div>
                        </div>
                    )}

                    {entry.variants && entry.variants.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-text-secondary mb-3">
                                {language === 'tr' ? 'VARYANTLAR' : 'VARIANTS'}
                            </h3>
                            <div className="bg-bg-card p-[1.3rem] rounded-lg">
                                <div className="flex flex-wrap gap-2">
                                    {entry.variants.map((variant, vIndex) => (
                                        <span
                                            key={vIndex}
                                            onClick={() => window.location.hash = `#/kelime/${encodeURIComponent(variant)}`}
                                            className="text-[#89b1d4] font-semibold hover:underline transition-colors mr-3 cursor-pointer text-base"
                                        >
                                            {variant}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {entry.cross_reference && (
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-text-secondary mb-3">
                                {language === 'tr' ? 'ÇAPRAZ REFERANS' : 'CROSS REFERENCE'}
                            </h3>
                            <div className="bg-bg-card p-[1.3rem] rounded-lg">
                                <span
                                    onClick={() => window.location.hash = `#/kelime/${encodeURIComponent(entry.cross_reference)}`}
                                    className="text-[#89b1d4] font-semibold hover:underline transition-colors cursor-pointer text-base"
                                >
                                    {entry.cross_reference}
                                </span>
                            </div>
                        </div>
                    )}

                    {(entry.full_entry_text || entry.full_entry_text_tr) && (
                        <div>
                            <h3 className="text-lg font-bold text-text-secondary mb-3">
                                {language === 'tr' ? 'AÇIKLAMA' : 'DESCRIPTION'}
                            </h3>
                            <div style={{ color: '#f4f4f4 !important' }} className="bg-bg-card p-[1.3rem] rounded-lg text-base">
                                <RichTextParser text={getFullEntryText(entry)} wordList={wordList} />
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default WordDetail;