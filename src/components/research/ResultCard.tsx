import { motion } from 'framer-motion'
import React from 'react'

import { type BookMetadata } from '../../lib/api/research'

interface ResultCardProps {
  result: BookMetadata
}

const ResultCardHeader = ({
  therapeutic_relevance_score,
}: {
  therapeutic_relevance_score?: number
}) => (
  <div className='from-slate-700 to-slate-800 relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br'>
    <div className='from-slate-900 to-transparent absolute inset-0 bg-gradient-to-t opacity-60'></div>

    {/* Relevance Score Badge */}
    {therapeutic_relevance_score !== undefined &&
      therapeutic_relevance_score !== null && (
        <div className='bg-black/40 border-white/10 absolute right-2 top-2 flex items-center gap-1 rounded-md border px-2 py-1 backdrop-blur-sm'>
          <span className='text-white font-mono text-xs'>
            {therapeutic_relevance_score.toFixed(2)}
          </span>
        </div>
      )}
  </div>
)

const ResultCardMetadata = ({
  source,
  publication_year,
}: {
  source?: string
  publication_year?: number
}) => (
  <div className='mb-3 flex gap-2 text-xs'>
    <span className='bg-slate-700 text-slate-300 border-slate-600 rounded border px-2 py-1 capitalize'>
      {(source || 'unknown').replace('_', ' ')}
    </span>
    {(publication_year || 0) > 0 && (
      <span className='bg-slate-700 text-slate-300 border-slate-600 rounded border px-2 py-1'>
        {publication_year}
      </span>
    )}
  </div>
)

const ResultCardActions = ({ url }: { url?: string }) => (
  <div className='border-slate-700/50 mt-auto flex gap-2 border-t pt-4'>
    {url ? (
      <a
        href={url}
        target='_blank'
        rel='noopener noreferrer'
        className='text-pink-400 hover:text-pink-300 flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-colors'
      >
        View Details
        <svg
          className='h-3 w-3'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
          />
        </svg>
      </a>
    ) : (
      <button
        className='text-slate-500 cursor-not-allowed text-xs font-medium uppercase tracking-wide'
        disabled
      >
        Details Unavailable
      </button>
    )}

    <div className='flex-grow'></div>
    <button
      className='text-slate-500 hover:text-white transition-colors'
      title='Save to favorites'
      aria-label='Save to favorites'
    >
      <svg
        className='h-5 w-5'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={1.5}
          d='M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z'
        />
      </svg>
    </button>
  </div>
)

export default React.memo(function ResultCard({ result }: ResultCardProps) {
  const {
    title,
    authors,
    publication_year,
    source,
    therapeutic_relevance_score,
    url,
  } = result

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className='result-card bg-slate-800 border-slate-700 hover:border-pink-500/30 group flex h-full flex-col overflow-hidden rounded-xl border transition-colors hover:shadow-xl'
    >
      <ResultCardHeader
        therapeutic_relevance_score={therapeutic_relevance_score}
      />

      <div className='flex flex-grow flex-col p-5'>
        <ResultCardMetadata
          source={source}
          publication_year={publication_year}
        />

        <h3 className='text-slate-100 group-hover:text-pink-400 mb-2 line-clamp-2 text-lg font-bold leading-tight transition-colors'>
          {title}
        </h3>

        <p className='text-slate-400 mb-4 line-clamp-2 text-sm'>
          {authors.join(', ')}
        </p>

        <ResultCardActions url={url} />
      </div>
    </motion.div>
  )
})
