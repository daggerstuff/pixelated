'use client'

import { useState } from 'react'
import SearchBox from './ui/SearchBox'
import type { SearchResult } from '../lib/search'

export default function SearchDemoReact() {
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
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="mb-6">
        <SearchBox
          placeholder="Search documentation..."
          maxResults={5}
          minQueryLength={2}
          onSearch={handleSearch}
          onResultClick={handleResultClick}
          className="w-full"
        />
      </div>

      {lastQuery && (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Found {resultCount} results for &ldquo;{lastQuery}&rdquo;
        </div>
      )}

      {selectedResult && (
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Selected Result
          </h3>

          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
            <h4 className="font-semibold">{selectedResult.title}</h4>
            {selectedResult.content && (
              <p className="mt-2 text-gray-600 dark:text-gray-300 text-sm">
                {selectedResult.content.substring(0, 200)}...
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedResult.category && (
                <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-200">
                  {selectedResult.category}
                </span>
              )}
              {selectedResult.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-3">
              <a
                href={selectedResult.url}
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
              >
                View {selectedResult.url}
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
          FlexSearch Features:
        </h3>
        <ul className="list-disc pl-5 space-y-1">
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
