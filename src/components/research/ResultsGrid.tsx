import React from 'react';
import ResultCard from './ResultCard';
import { type BookMetadata } from '@/lib/api/research';

interface ResultsGridProps {
    results: BookMetadata[];
    loading?: boolean;
}

export default function ResultsGrid({ results, loading }: ResultsGridProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-64 bg-slate-800 rounded-xl"></div>
                ))}
            </div>
        );
    }

    if (results.length === 0) {
        return null;
    }

    return (
        <div className="w-full">
            <div className="mb-4 flex justify-between items-center text-slate-400 text-sm px-1">
                <span>Found {results.length} results</span>
                <div className="flex gap-2">
                    {/* View toggles could go here */}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {results.map((result, index) => (
                    <ResultCard key={`${result.title}-${index}`} result={result} />
                ))}
            </div>
        </div>
    );
}
