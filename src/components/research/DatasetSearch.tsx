import React, { useState } from 'react'

import { researchAPI, type DatasetMetadata } from '@/lib/api/research'

import DatasetCard from './DatasetCard'

export default function DatasetSearch() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<DatasetMetadata[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Filters
  const [minTurns, setMinTurns] = useState(1)
  const [minQuality, setMinQuality] = useState(0.0)

  // Automatically search when filters change
  React.useEffect(() => {
    if (hasSearched) {
      const timer = setTimeout(() => {
        void handleSearch().catch((err) => {
          console.error('Auto-search failure:', err)
        })
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [minTurns, minQuality])

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    setLoading(true)
    setHasSearched(true)
    setError(null)

    try {
      // Track search event
      void researchAPI.trackEvent('search_datasets', {
        query,
        min_turns: minTurns,
        min_quality: minQuality,
      })

      const data = await researchAPI.searchDatasets({
        q: query,
        min_turns: minTurns,
        min_quality: minQuality,
        limit: 20,
      })

      setResults(data.results || [])
    } catch (err: any) {
      console.error('Dataset search error:', err)
      setError(
        err.message ||
        'Failed to fetch datasets. Please ensure the backend services are running.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='mx-auto w-full max-w-6xl p-4' role='main'>
      <div className='flex flex-col gap-8'>
        {/* Search Header & Controls */}
        <div
          className='bg-slate-800/50 border-slate-700 flex flex-col items-end gap-4 rounded-2xl border p-6 md:flex-row'
          role='search'
        >
          <div className='w-full flex-grow'>
            <label
              htmlFor='dataset-search'
              className='text-slate-300 mb-2 block text-sm font-medium'
            >
              Search Datasets
            </label>
            <div className='relative'>
              <input
                id='dataset-search'
                type='text'
                className='bg-slate-900 border-slate-700 text-white focus:ring-pink-500 focus:border-transparent w-full rounded-lg border px-4 py-3 outline-none focus:ring-2'
                placeholder='e.g., cbt therapy, depression, multi-turn'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
                aria-label='Search therapeutic datasets'
              />
              <div className='absolute right-2 top-1/2 -translate-y-1/2 transform'>
                <button
                  onClick={() => void handleSearch()}
                  className='bg-pink-600 hover:bg-pink-700 text-white rounded-md p-2 transition-colors'
                  aria-label='Run search'
                >
                  <svg
                    className='h-5 w-5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                    ></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className='flex w-full gap-4 md:w-auto'>
            <div className='w-full md:w-40'>
              <div className='mb-1 flex justify-between'>
                <label htmlFor='min-turns' className='text-slate-400 text-xs'>
                  Min Turns
                </label>
                <span className='text-pink-400 font-mono text-xs'>
                  {minTurns}
                </span>
              </div>
              <input
                id='min-turns'
                type='range'
                min='1'
                max='50'
                value={minTurns}
                onChange={(e) => setMinTurns(parseInt(e.target.value))}
                className='bg-slate-700 accent-pink-500 h-2 w-full cursor-pointer appearance-none rounded-lg'
                aria-label='Minimum conversation turns'
              />
            </div>

            <div className='w-full md:w-40'>
              <div className='mb-1 flex justify-between'>
                <label htmlFor='min-quality' className='text-slate-400 text-xs'>
                  Min Quality
                </label>
                <span className='text-pink-400 font-mono text-xs'>
                  {minQuality.toFixed(1)}
                </span>
              </div>
              <input
                id='min-quality'
                type='range'
                min='0'
                max='1'
                step='0.1'
                value={minQuality}
                onChange={(e) => setMinQuality(parseFloat(e.target.value))}
                className='bg-slate-700 accent-pink-500 h-2 w-full cursor-pointer appearance-none rounded-lg'
                aria-label='Minimum dataset quality score'
              />
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div>
          {loading && (
            <div className='grid animate-pulse grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
              {[...Array(6)].map((_, i) => (
                <div key={i} className='bg-slate-800 h-64 rounded-xl'></div>
              ))}
            </div>
          )}

          {error && (
            <div className='bg-red-900/20 border-red-800 text-red-200 rounded-lg border p-4 text-center'>
              {error}
            </div>
          )}

          {!loading && !hasSearched && (
            <div className='py-20 text-center'>
              <div className='mb-6 text-6xl opacity-20'>📊</div>
              <h3 className='text-slate-200 mb-2 text-2xl font-bold'>
                Explore Therapy Datasets
              </h3>
              <p className='text-slate-400 mx-auto max-w-lg'>
                Search across HuggingFace, Kaggle, and open repositories for
                high-quality, multi-turn therapeutic conversations.
              </p>
              <button
                onClick={() => void handleSearch()}
                className='bg-slate-800 hover:bg-slate-700 text-pink-400 border-slate-700 mt-6 rounded-full border px-6 py-2 transition-colors'
              >
                Browse All Datasets
              </button>
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && !error && (
            <div className='text-slate-400 py-20 text-center'>
              <p>
                No datasets found matching your criteria. Try adjusting the
                filters.
              </p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
              {results.map((dataset) => (
                <DatasetCard key={dataset.url} dataset={dataset} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
