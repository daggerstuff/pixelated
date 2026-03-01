import { motion } from 'framer-motion'
import React, { useState } from 'react'

import { researchAPI, type BookMetadata } from '@/lib/api/research'

import ExportPanel from './ExportPanel'
import ResultsGrid from './ResultsGrid'
import SearchFilters, { type SearchFiltersState } from './SearchFilters'
import SourceSelector from './SourceSelector'

const DEFAULT_FILTERS: SearchFiltersState = {
  topics: [],
  minRelevance: 0,
  publishers: [],
  sortBy: 'relevance',
}

export default function SearchInterface() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<BookMetadata[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSources, setSelectedSources] = useState<string[]>(['all'])

  // Filter State
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFiltersState>(DEFAULT_FILTERS)

  // Export State
  const [showExport, setShowExport] = useState(false)

  const executeSearch = async (
    currentQuery: string,
    currentSources: string[],
    currentFilters: SearchFiltersState,
  ) => {
    if (!currentQuery.trim()) return

    setLoading(true)
    setHasSearched(true)
    setError(null)
    setResults([])

    try {
      // Track search event
      void researchAPI.trackEvent('search_literature', {
        query: currentQuery,
        sources: currentSources,
        filter_count:
          (currentFilters.topics.length || 0) +
          (currentFilters.yearFrom ? 1 : 0) +
          (currentFilters.yearTo ? 1 : 0),
      })

      const data = await researchAPI.searchLiterature({
        q: currentQuery,
        limit: 12,
        sources: currentSources.includes('all') ? undefined : currentSources,
        year_from: currentFilters.yearFrom,
        year_to: currentFilters.yearTo,
        min_relevance: currentFilters.minRelevance,
        topics: currentFilters.topics,
        sort_by: currentFilters.sortBy,
      })

      setResults(data.results)
    } catch (err: any) {
      console.error('Search error:', err)
      setError(err.message || 'Failed to fetch results.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    void executeSearch(query, selectedSources, filters)
  }

  const handleFilterChange = (newFilters: SearchFiltersState) => {
    setFilters(newFilters)
    setShowFilters(false)
    // Auto-refresh search if we already have a query
    if (query.trim()) {
      void executeSearch(query, selectedSources, newFilters)
    }
  }

  return (
    <motion.div className='mx-auto w-full max-w-6xl p-4'>
      <div className='flex flex-col items-center gap-6'>
        {/* Search Bar Container */}
        <div className='relative z-20 w-full max-w-2xl'>
          <form onSubmit={handleSearch} className='relative w-full'>
            <input
              type='text'
              className='search-bar w-full pe-24 ps-4'
              placeholder='Search for books, papers, articles...'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className='absolute right-2 top-1/2 flex -translate-y-1/2 transform items-center gap-2'>
              <button
                type='button'
                onClick={() => setShowFilters(!showFilters)}
                className={`hover:bg-slate-700 rounded-md p-2 transition-colors ${showFilters ? 'text-pink-400 bg-slate-700' : 'text-slate-400'}`}
                title='Advanced Filters'
                aria-label='Toggle advanced filters'
                aria-expanded={showFilters}
                aria-controls='search-filters-panel'
              >
                <svg
                  className='h-5 w-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
                  ></path>
                </svg>
              </button>
              <button
                type='submit'
                disabled={loading}
                className='bg-pink-600 hover:bg-pink-700 disabled:bg-pink-800 text-white flex items-center gap-2 rounded-lg px-4 py-2 transition-colors'
              >
                {loading ? (
                  <span className='border-white border-t-transparent h-4 w-4 animate-spin rounded-full border-2'></span>
                ) : (
                  <span>Search</span>
                )}
              </button>
            </div>
          </form>

          {/* Filters Dropdown */}
          {showFilters && (
            <div
              id='search-filters-panel'
              className='animate-fade-in-down absolute left-0 right-0 top-full z-30 mt-2'
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
        <div className='relative z-10 w-full overflow-x-auto pb-2'>
          <SourceSelector
            selectedSources={selectedSources}
            onChange={setSelectedSources}
          />
        </div>

        {/* Results Area */}
        <div className='relative z-0 mt-8 w-full'>
          {error && (
            <div className='bg-red-900/20 border-red-800 text-red-200 mb-6 rounded-lg border p-4 text-center'>
              {error}
            </div>
          )}

          {!hasSearched && !loading && (
            <div className='py-12 text-center'>
              <div className='mb-4 text-6xl opacity-20'>🔬</div>
              <p className='text-slate-400 text-lg'>
                Enter a query to explore the academic literature.
              </p>
            </div>
          )}

          {hasSearched && !loading && results.length > 0 && (
            <div className='mb-4 flex items-center justify-between px-2'>
              <div className='text-slate-400 text-sm'>
                Found {results.length} results
              </div>
              <button
                onClick={() => setShowExport(true)}
                className='text-pink-400 hover:text-pink-300 flex items-center gap-2 text-sm transition-colors'
              >
                <svg
                  className='h-4 w-4'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                  />
                </svg>
                Export Results
              </button>
            </div>
          )}

          {(hasSearched || loading) && (
            <ResultsGrid results={results} loading={loading} />
          )}

          {hasSearched && !loading && results.length === 0 && !error && (
            <div className='text-slate-400 py-12 text-center'>
              <p>
                No results found for "{query}". Try broadening your search
                terms.
              </p>
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
  )
}
