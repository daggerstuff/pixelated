import React, { useState } from 'react';
import DatasetCard from './DatasetCard';
import { researchAPI, type DatasetMetadata } from '@/lib/api/research';

export default function DatasetSearch() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<DatasetMetadata[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [minTurns, setMinTurns] = useState(1);
    const [minQuality, setMinQuality] = useState(0.0);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        setLoading(true);
        setHasSearched(true);
        setError(null);
        setResults([]);

        try {
            // Track search event
            researchAPI.trackEvent('search_datasets', {
                query,
                min_turns: minTurns,
                min_quality: minQuality
            });

            const data = await researchAPI.searchDatasets({
                q: query,
                min_turns: minTurns,
                min_quality: minQuality,
                limit: 20
            });

            setResults(data.results);
        } catch (err: any) {
            console.error("Dataset search error:", err);
            setError(err.message || "Failed to fetch datasets. Please ensure the backend services are running.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-4">
            <div className="flex flex-col gap-8">

                {/* Search Header & Controls */}
                <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <div className="flex-grow w-full">
                        <label className="block text-sm font-medium text-slate-300 mb-2">Search Datasets</label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                                placeholder="e.g., cbt therapy, depression, multi-turn"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                <button
                                    onClick={() => handleSearch()}
                                    className="bg-pink-600 hover:bg-pink-700 text-white p-2 rounded-md transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 w-full md:w-auto">
                        <div className="w-full md:w-40">
                            <div className="flex justify-between mb-1">
                                <label className="text-xs text-slate-400">Min Turns</label>
                                <span className="text-xs text-pink-400 font-mono">{minTurns}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={minTurns}
                                onChange={(e) => setMinTurns(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                            />
                        </div>

                        <div className="w-full md:w-40">
                            <div className="flex justify-between mb-1">
                                <label className="text-xs text-slate-400">Min Quality</label>
                                <span className="text-xs text-pink-400 font-mono">{minQuality.toFixed(1)}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={minQuality}
                                onChange={(e) => setMinQuality(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Results Area */}
                <div>
                    {loading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-64 bg-slate-800 rounded-xl"></div>
                            ))}
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200 text-center">
                            {error}
                        </div>
                    )}

                    {!loading && !hasSearched && (
                        <div className="text-center py-20">
                            <div className="text-6xl mb-6 opacity-20">📊</div>
                            <h3 className="text-2xl font-bold text-slate-200 mb-2">Explore Therapy Datasets</h3>
                            <p className="text-slate-400 max-w-lg mx-auto">
                                Search across HuggingFace, Kaggle, and open repositories for high-quality, multi-turn therapeutic conversations.
                            </p>
                            <button
                                onClick={() => handleSearch()}
                                className="mt-6 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-pink-400 rounded-full border border-slate-700 transition-colors"
                            >
                                Browse All Datasets
                            </button>
                        </div>
                    )}

                    {!loading && hasSearched && results.length === 0 && !error && (
                        <div className="text-center py-20 text-slate-400">
                            <p>No datasets found matching your criteria. Try adjusting the filters.</p>
                        </div>
                    )}

                    {!loading && results.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {results.map((dataset) => (
                                <DatasetCard key={dataset.url} dataset={dataset} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
