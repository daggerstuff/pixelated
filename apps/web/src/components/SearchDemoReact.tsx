import { useState, useCallback } from 'react'

import type { SearchResult } from '../lib/search'
import SearchBox from './ui/SearchBox'

export default function SearchDemoReact() {
  const [lastQuery, setLastQuery] = useState<string>('')
  const [resultCount, setResultCount] = useState<number>(0)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
    null,
  )

  // ⚡ Bolt: Wrapped in useCallback to provide stable function reference and prevent unnecessary re-renders of the SearchBox child component
  const handleSearch = useCallback((query: string, results: SearchResult[]) => {
    setLastQuery(query)
    setResultCount(results.length)
  }, [])

  // ⚡ Bolt: Wrapped in useCallback to provide stable function reference and prevent unnecessary re-renders of the SearchBox child component
  const handleResultClick = useCallback((result: SearchResult) => {
    setSelectedResult(result)
    // Normally you would navigate to the result URL, but for demo purposes
    // we'll just display the selected result
  }, [])

  return (
    <div className="rounded-none border border-border bg-card p-4">
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

      <div
        className="mt-4 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {lastQuery ? `Found ${resultCount} results for "${lastQuery}"` : ''}
      </div>

      {selectedResult && (
        <div className="mt-6 border-t border-border pt-4">
          <h3 className="mb-2 text-lg font-medium text-foreground">
            Selected Result
          </h3>

          <div className="rounded-none bg-secondary p-3">
            <h4 className="font-semibold">{selectedResult.title}</h4>
            {selectedResult.content && (
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedResult.content.substring(0, 200)}...
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedResult.category && (
                <span className="inline-flex items-center rounded-none border border-border bg-secondary px-2 py-1 text-xs font-medium text-foreground">
                  {selectedResult.category}
                </span>
              )}
              {selectedResult.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-none px-2 py-1 text-xs font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-3">
              <a
                href={selectedResult.url}
                className="text-sm text-foreground hover:underline"
              >
                View {selectedResult.url}
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-sm text-muted-foreground">
        <h3 className="mb-2 font-medium text-foreground">
          FlexSearch Features:
        </h3>
        <ul className="list-disc space-y-1 pl-5">
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
