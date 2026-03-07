import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ResultsGrid from './ResultsGrid';
import SourceSelector from './SourceSelector';
import SearchFilters, { type SearchFiltersState } from './SearchFilters';
import ExportPanel from './ExportPanel';
import { researchAPI, type BookMetadata } from '@/lib/api/research';


const DEFAULT_FILTERS: SearchFiltersState = {
    topics: [],
    minRelevance: 0,
    publishers: [],
    sortBy: 'relevance'
};

export default function SearchInterface() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<BookMetadata[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedSources, setSelectedSources] = useState<string[]>(['all']);

    // Filter State
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<SearchFiltersState>(DEFAULT_FILTERS);

    // Export State
    const [showExport, setShowExport] = useState(false);

    const executeSearch = async (currentQuery: string, currentSources: string[], currentFilters: SearchFiltersState) => {
        if (!currentQuery.trim()) return;

        setLoading(true);
        setHasSearched(true);
        setError(null);
        setResults([]);

        try {
            // Track search event
            researchAPI.trackEvent('search_literature', {
                query: currentQuery,
                sources: currentSources,
                filter_count: (currentFilters.topics.length || 0) + (currentFilters.yearFrom ? 1 : 0) + (currentFilters.yearTo ? 1 : 0)
            });

            const data = await researchAPI.searchLiterature({
                q: currentQuery,
                limit: 12,
                sources: currentSources.includes('all') ? undefined : currentSources,
                year_from: currentFilters.yearFrom,
                year_to: currentFilters.yearTo,
                min_relevance: currentFilters.minRelevance,
                topics: currentFilters.topics,
                sort_by: currentFilters.sortBy
            });

            setResults(data.results);
        } catch (err: any) {
            console.error("Search error:", err);
            setError(err.message || "Failed to fetch results.");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        executeSearch(query, selectedSources, filters);
    };

    const handleFilterChange = (newFilters: SearchFiltersState) => {
        setFilters(newFilters);
        setShowFilters(false);
        // Auto-refresh search if we already have a query
        if (query.trim()) {
            executeSearch(query, selectedSources, newFilters);
        }
    };


    return (
        <motion.div
            className="w-full max-w-6xl mx-auto p-4"
        >
            <div className="flex flex-col gap-6 items-center">
                {/* Search Bar Container */}
                <div className="w-full max-w-2xl relative z-20">
                    <form onSubmit={handleSearch} className="relative w-full">
                        <input
                            type="text"
                            className="search-bar w-full ps-4 pe-24"
                            placeholder="Search for books, papers, articles..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowFilters(!showFilters)}
                                className={`p-2 rounded-md hover:bg-slate-700 transition-colors ${showFilters ? 'text-pink-400 bg-slate-700' : 'text-slate-400'}`}
                                title="Advanced Filters"
                                aria-label="Toggle advanced filters"
                                aria-expanded={showFilters}
                                aria-controls="search-filters-panel"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-pink-600 hover:bg-pink-700 disabled:bg-pink-800 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                                {loading ? (
                                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                ) : (
                                    <span>Search</span>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Filters Dropdown */}
                    {showFilters && (
                        <div
                            id="search-filters-panel"
                            className="absolute top-full left-0 right-0 mt-2 z-30 animate-fade-in-down"
                        >
                            <SearchFilters
                                filters={filters}
                                onChange={handleFilterChange}
                                onClose={() => setShowFilters(false)}
                            />
                        </div>
                    )}
                </div>

                {/* Source Selector */}
                <div className="w-full overflow-x-auto pb-2 relative z-10">
                    <SourceSelector selectedSources={selectedSources} onChange={setSelectedSources} />
                </div>

                {/* Results Area */}
                <div className="mt-8 w-full relative z-0">
                    {error && (
                        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200 text-center mb-6">
                            {error}
                        </div>
                    )}

                    {!hasSearched && !loading && (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4 opacity-20">🔬</div>
                            <p className="text-slate-400 text-lg">Enter a query to explore the academic literature.</p>
                        </div>
                    )}

                    {hasSearched && !loading && results.length > 0 && (
                        <div className="flex justify-between items-center mb-4 px-2">
                            <div className="text-sm text-slate-400">Found {results.length} results</div>
                            <button
                                onClick={() => setShowExport(true)}
                                className="text-sm flex items-center gap-2 text-pink-400 hover:text-pink-300 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Export Results
                            </button>
                        </div>
                    )}

                    {(hasSearched || loading) && (
                        <ResultsGrid results={results} loading={loading} />
                    )}

                    {hasSearched && !loading && results.length === 0 && !error && (
                        <div className="text-center py-12 text-slate-400">
                            <p>No results found for "{query}". Try broadening your search terms.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Export Panel */}
            <ExportPanel
                results={results}
                isOpen={showExport}
                onClose={() => setShowExport(false)}
            />
        </motion.div>
    );
}
