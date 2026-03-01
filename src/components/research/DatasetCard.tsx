import { motion } from 'framer-motion'
import React from 'react'

import { type DatasetMetadata } from '@/lib/api/research'

interface DatasetCardProps {
  dataset: DatasetMetadata
  index?: number
}

const DatasetHeader = ({ dataset }: { dataset: DatasetMetadata }) => {
  const { name, source, quality_score, downloads } = dataset
  return (
    <div className='relative z-10 mb-3 flex items-start justify-between'>
      <div className='flex flex-col'>
        <div className='mb-1 flex items-center gap-2'>
          <span className='bg-slate-800 text-slate-400 border-slate-700 rounded-full border px-2 py-0.5 text-xs uppercase tracking-wider'>
            {source}
          </span>
          {quality_score > 0.7 && (
            <motion.span
              initial={{ scale: 0.9 }}
              animate={{ scale: [0.9, 1.1, 1] }}
              className='bg-emerald-900/40 text-emerald-400 border-emerald-800 flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs'
            >
              ✨ High Quality
            </motion.span>
          )}
        </div>
        <h3
          className='text-slate-100 group-hover:text-pink-400 line-clamp-1 text-lg font-bold transition-colors'
          title={name}
        >
          {name}
        </h3>
      </div>
      <div className='text-slate-400 bg-slate-800/50 flex items-center gap-1 rounded px-2 py-1'>
        <span className='text-xs'>⬇️</span>
        <span className='font-mono text-xs'>{downloads.toLocaleString()}</span>
      </div>
    </div>
  )
}

const DatasetStats = ({
  avg_turns,
  therapeutic_relevance,
}: {
  avg_turns?: number
  therapeutic_relevance?: number
}) => (
  <div className='text-slate-300 bg-slate-800/50 mb-4 grid grid-cols-2 gap-2 rounded-lg p-3 text-xs'>
    <div className='flex flex-col'>
      <span className='text-slate-500 text-[10px] uppercase tracking-wider'>
        Avg Turns
      </span>
      <span>
        {typeof avg_turns === 'number' ? avg_turns.toFixed(1) : 'N/A'}
      </span>
    </div>
    <div className='flex flex-col'>
      <span className='text-slate-500 text-[10px] uppercase tracking-wider'>
        Relevance
      </span>
      <div className='bg-slate-700 mt-1 h-1.5 w-full rounded-full'>
        <div
          className='bg-pink-500 h-1.5 rounded-full'
          style={{ width: `${(therapeutic_relevance || 0) * 100}%` }}
        ></div>
      </div>
    </div>
  </div>
)

const DatasetTags = ({ tags }: { tags?: string[] }) => (
  <div className='mt-auto flex flex-wrap gap-2'>
    {tags?.slice(0, 3).map((tag) => (
      <span
        key={tag}
        className='bg-slate-800 text-slate-400 border-slate-700 rounded border px-2 py-1 text-xs'
      >
        #{tag}
      </span>
    ))}
    {tags && tags.length > 3 && (
      <span className='text-slate-500 rounded px-2 py-1 text-xs'>
        +{tags.length - 3}
      </span>
    )}
  </div>
)

export default React.memo(function DatasetCard({
  dataset,
  index = 0,
}: DatasetCardProps) {
  const { url, description, avg_turns, therapeutic_relevance, tags } = dataset

  return (
    <motion.a
      href={url}
      target='_blank'
      rel='noopener noreferrer'
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      whileHover={{ y: -8, scale: 1.02, transition: { duration: 0.2 } }}
      whileFocus={{ scale: 1.02, boxShadow: '0 0 0 2px #ec4899' }}
      className='border-slate-700 hover:border-pink-500/50 hover:shadow-pink-900/10 focus:ring-pink-500 focus:border-transparent group relative block h-full cursor-pointer rounded-xl border bg-[#1e293b] p-5 outline-none transition-all hover:shadow-2xl focus:ring-2'
    >
      <div className='from-pink-500/5 to-transparent absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100'></div>

      <DatasetHeader dataset={dataset} />

      <p className='text-slate-400 mb-4 line-clamp-3 flex-grow text-sm'>
        {description || 'No description provided.'}
      </p>

      <DatasetStats
        avg_turns={avg_turns}
        therapeutic_relevance={therapeutic_relevance}
      />

      <DatasetTags tags={tags} />
    </motion.a>
  )
})
