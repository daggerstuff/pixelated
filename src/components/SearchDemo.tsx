import { useState } from 'react'

import type { SearchResult } from '../lib/search'
import SearchBox from './ui/SearchBox'

export default function SearchDemo() {
  const [lastQuery, setLastQuery] = useState<string>('')
  const [resultCount, setResultCount] = useState<number>(0)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
    null,
  )

  // Handle search events
  const handleSearch = (query: string, results: SearchResult[]) => {
    setLastQuery(query)
    setResultCount(results.length)
  }

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result)
    // Normally you would navigate to the result URL, but for demo purposes
    // we'll just display the selected result
  }

  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md'>
      <h2 className='mb-4 text-xl font-semibold'>Search Demo</h2>

      <div className='mb-6'>
        <SearchBox
          placeholder='Search documentation...'
          maxResults={5}
          minQueryLength={2}
          onSearch={handleSearch}
          onResultClick={handleResultClick}
          className='w-full'
        />
      </div>

      {lastQuery && (
        <div className='text-gray-500 dark:text-gray-400 mt-4 text-sm'>
          Found {resultCount} results for &ldquo;{lastQuery}&rdquo;
        </div>
      )}

      {selectedResult && (
        <div className='border-gray-200 dark:border-gray-700 mt-6 border-t pt-4'>
          <h3 className='text-gray-900 dark:text-white mb-2 text-lg font-medium'>
            Selected Result
          </h3>

          <div className='bg-gray-50 dark:bg-gray-900 rounded-md p-3'>
            <h4 className='font-semibold'>{selectedResult.title}</h4>
            {selectedResult.content && (
              <p className='text-gray-600 dark:text-gray-300 mt-2 text-sm'>
                {selectedResult.content.substring(0, 200)}...
              </p>
            )}
            <div className='mt-3 flex flex-wrap gap-2'>
              {selectedResult.category && (
                <span className='bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium'>
                  {selectedResult.category}
                </span>
              )}
              {selectedResult.tags?.map((tag) => (
                <span
                  key={tag}
                  className='bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium'
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className='mt-3'>
              <a
                href={selectedResult.url}
                className='text-blue-600 dark:text-blue-400 text-sm hover:underline'
              >
                View {selectedResult.url}
              </a>
            </div>
          </div>
        </div>
      )}

      <div className='text-gray-500 dark:text-gray-400 mt-6 text-sm'>
        <h3 className='text-gray-700 dark:text-gray-300 mb-2 font-medium'>
          FlexSearch Features:
        </h3>
        <ul className='list-disc space-y-1 pl-5'>
          <li>Client-side search for privacy (no server requests)</li>
          <li>Fast performance even with large datasets</li>
          <li>Fuzzy search with typo-tolerance</li>
          <li>Contextual relevance ranking</li>
          <li>Lightweight (only ~5KB)</li>
        </ul>
      </div>
    </div>
  )
}
