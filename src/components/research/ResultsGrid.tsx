import React from 'react'

import { type BookMetadata } from '@/lib/api/research'

import ResultCard from './ResultCard'

interface ResultsGridProps {
  results: BookMetadata[]
  loading?: boolean
}

export default function ResultsGrid({ results, loading }: ResultsGridProps) {
  if (loading) {
    return (
      <div className='grid animate-pulse grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
        {[...Array(6)].map((_, i) => (
          <div key={i} className='bg-slate-800 h-64 rounded-xl'></div>
        ))}
      </div>
    )
  }

  if (results.length === 0) {
    return null
  }

  return (
    <div className='w-full'>
      <div className='text-slate-400 mb-4 flex items-center justify-between px-1 text-sm'>
        <span>Found {results.length} results</span>
        <div className='flex gap-2'>{/* View toggles could go here */}</div>
      </div>
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        {results.map((result, index) => (
          <ResultCard key={`${result.title}-${index}`} result={result} />
        ))}
      </div>
    </div>
  )
}
