import React from 'react';
import { motion } from 'framer-motion';
import { type DatasetMetadata } from '@/lib/api/research';

interface DatasetCardProps {
    dataset: DatasetMetadata;
    index?: number;
}

export default React.memo(function DatasetCard({ dataset, index = 0 }: DatasetCardProps) {
    const {
        name, description, tags, downloads, avg_turns,
        quality_score, source, url
    } = dataset;

    return (
        <motion.a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
            whileHover={{ y: -8, scale: 1.02, transition: { duration: 0.2 } }}
            whileFocus={{ scale: 1.02, boxShadow: "0 0 0 2px #ec4899" }}
            className="block h-full bg-[#1e293b] border border-slate-700 rounded-xl p-5 hover:border-pink-500/50 hover:shadow-2xl hover:shadow-pink-900/10 transition-all cursor-pointer group relative outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>

            <div className="flex justify-between items-start mb-3 relative z-10">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider">
                            {source}
                        </span>
                        {quality_score > 0.7 && (
                            <motion.span
                                initial={{ scale: 0.9 }}
                                animate={{ scale: [0.9, 1.1, 1] }}
                                className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800 flex items-center gap-1"
                            >
                                ✨ High Quality
                            </motion.span>
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-100 group-hover:text-pink-400 transition-colors line-clamp-1" title={name}>
                        {name}
                    </h3>
                </div>
                <div className="flex items-center gap-1 text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                    <span className="text-xs">⬇️</span>
                    <span className="text-xs font-mono">{downloads.toLocaleString()}</span>
                </div>
            </div>

            <p className="text-sm text-slate-400 mb-4 line-clamp-3 flex-grow">
                {description || "No description provided."}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 mb-4 bg-slate-800/50 p-3 rounded-lg">
                <div className="flex flex-col">
                    <span className="text-slate-500 uppercase tracking-wider text-[10px]">Avg Turns</span>
                    <span>{typeof avg_turns === 'number' ? avg_turns.toFixed(1) : 'N/A'}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-slate-500 uppercase tracking-wider text-[10px]">Relevance</span>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full mt-1">
                        <div
                            className="bg-pink-500 h-1.5 rounded-full"
                            style={{ width: `${(dataset.therapeutic_relevance || 0) * 100}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-auto">
                {tags?.slice(0, 3).map(tag => (
                    <span key={tag} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        #{tag}
                    </span>
                ))}
                {tags?.length > 3 && (
                    <span className="text-xs px-2 py-1 rounded text-slate-500">
                        +{tags.length - 3}
                    </span>
                )}
            </div>
        </motion.a>
    );
});
