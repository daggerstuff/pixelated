import React from 'react';
import { motion } from 'framer-motion';
import { type BookMetadata } from '@/lib/api/research';

interface ResultCardProps {
    result: BookMetadata;
}

export default React.memo(function ResultCard({ result }: ResultCardProps) {
    const { title, authors, publication_year, source, therapeutic_relevance_score, url } = result;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="result-card group h-full flex flex-col bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:shadow-xl hover:border-pink-500/30 transition-colors"
        >
            {/* Visual Placeholder (Gradient based on source/relevance) */}
            <div className="h-32 bg-gradient-to-br from-slate-700 to-slate-800 relative flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-60"></div>
                <motion.span
                    className="text-4xl opacity-20 select-none"
                    whileHover={{ rotate: [-5, 5, -5], scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                >
                    📚
                </motion.span>

                {/* Relevance Score Badge */}
                {therapeutic_relevance_score && (
                    <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md border border-white/10 flex items-center gap-1">
                        <span className="text-yellow-400 text-xs" aria-hidden="true">⭐</span>
                        <span className="text-white text-xs font-mono">{therapeutic_relevance_score.toFixed(2)}</span>
                    </div>
                )}
            </div>

            <div className="p-5 flex-grow flex flex-col">
                {/* Metadata Badges */}
                <div className="flex gap-2 mb-3 text-xs">
                    <span className="px-2 py-1 rounded bg-slate-700 text-slate-300 capitalize border border-slate-600">
                        {(source || 'unknown').replace('_', ' ')}
                    </span>
                    {(publication_year || 0) > 0 && (
                        <span className="px-2 py-1 rounded bg-slate-700 text-slate-300 border border-slate-600">
                            {publication_year}
                        </span>
                    )}
                </div>

                <h3 className="text-lg font-bold text-slate-100 mb-2 leading-tight line-clamp-2 group-hover:text-pink-400 transition-colors">
                    {title}
                </h3>

                <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                    {authors.join(', ')}
                </p>

                <div className="mt-auto flex gap-2 pt-4 border-t border-slate-700/50">
                    {url ? (
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors uppercase tracking-wide flex items-center gap-1"
                        >
                            View Details
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                    ) : (
                        <button className="text-xs font-medium text-slate-500 cursor-not-allowed uppercase tracking-wide" disabled>
                            Details Unavailable
                        </button>
                    )}

                    <div className="flex-grow"></div>
                    <button
                        className="text-slate-500 hover:text-white transition-colors"
                        title="Save to favorites"
                        aria-label="Save to favorites"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                    </button>
                </div>
            </div>
        </motion.div>
    );
});

