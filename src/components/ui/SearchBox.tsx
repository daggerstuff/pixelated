import { useState, useEffect, useRef, useMemo } from 'react'
import type { SearchResult } from '../../lib/search'

interface SearchBoxProps {
  placeholder?: string
  maxResults?: number
  minQueryLength?: number
  showNoResults?: boolean
  autoFocus?: boolean
  className?: string
  onSearch?: (query: string, results: SearchResult[]) => void
  onResultClick?: (result: SearchResult) => void
}

export default function SearchBox({
  placeholder = 'Search...',
  maxResults = 5,
  minQueryLength = 2,
  showNoResults = true,
  autoFocus = false,
  className = '',
  onSearch,
  onResultClick,
}: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearchReady, setIsSearchReady] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Track if the search is actually showing results
  const hasResults = useMemo(() => results.length > 0, [results])
  const showResults = useMemo(
    () => isOpen && query.length >= minQueryLength,
    [isOpen, query, minQueryLength],
  )

  // Initialize search when component mounts
  useEffect(() => {
    const handleSearchReady = () => {
      setIsSearchReady(true)
    }

    // Check if search is already initialized
    if (typeof window !== 'undefined' && window.searchClient) {
      setIsSearchReady(true)
    }

    // Listen for search ready event
    window.addEventListener('search:ready', handleSearchReady)

    return () => {
      window.removeEventListener('search:ready', handleSearchReady)
    }
  }, [])

  // Handle auto focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1)
  }, [results])

  // Handle searching when query changes
  useEffect(() => {
    if (!isSearchReady || query.length < minQueryLength) {
      setResults([])
      return
    }

    try {
      // Use the global search client
      const searchResults = window.searchClient.search(query)

      // Apply filtering after search
      let limitedResults = searchResults
      if (maxResults && searchResults.length > maxResults) {
        limitedResults = searchResults.slice(0, maxResults)
      }

      setResults(limitedResults)

      // Call onSearch callback if provided
      if (onSearch) {
        onSearch(query, limitedResults)
      }
    } catch (error: unknown) {
      console.error('Search error:', error)
      setResults([])
    }
  }, [query, isSearchReady, maxResults, minQueryLength, onSearch])

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (query.length > 0) {
        // Clear text on Escape if present
        setQuery('')
        setIsOpen(false)
        if (onSearch) onSearch('', [])
        // Keep focus on input
      } else {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
      } else if (results.length > 0) {
        setActiveIndex((prev) => (prev + 1) % results.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
      } else if (results.length > 0) {
        setActiveIndex((prev) => (prev - 1 + results.length) % results.length)
      }
    } else if (e.key === 'Enter') {
      if (isOpen && activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault()
        handleResultClick(results[activeIndex])
      }
    }
  }

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    setIsOpen(newQuery.length > 0)
  }

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false)
    setQuery('')

    if (onResultClick) {
      onResultClick(result)
    } else {
      window.location.href = result.url
    }
  }

  return (
    <div
      className="relative w-full"
      role="combobox"
      aria-expanded={showResults}
      aria-haspopup="listbox"
      aria-controls="search-results"
    >
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= minQueryLength && setIsOpen(true)}
          placeholder={placeholder}
          aria-label="Search"
          className={`w-full py-2 px-4 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 ${className}`}
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-activedescendant={
            showResults && activeIndex >= 0 ? `result-${activeIndex}` : undefined
          }
          autoComplete="off"
        />

        {query.length > 0 && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={() => {
              setQuery('')
              setIsOpen(false)
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
            tabIndex={-1}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div
          ref={resultsRef}
          id="search-results"
          className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
          role="listbox"
        >
          {hasResults ? (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {results.map((result, index) => (
                <li key={result.id} role="presentation">
                  <button
                    id={`result-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`w-full text-left px-4 py-3 focus:outline-none ${
                      index === activeIndex
                        ? 'bg-gray-100 dark:bg-gray-700'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => handleResultClick(result)}
                    tabIndex={-1}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {result.title}
                    </div>
                    {result.content && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {result.content.substring(0, 150)}...
                      </div>
                    )}
                    {result.category && (
                      <div className="mt-1">
                        <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-200">
                          {result.category}
                        </span>
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            showNoResults &&
            query.length >= minQueryLength && (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                No results found for &quot;{query}&quot;
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
