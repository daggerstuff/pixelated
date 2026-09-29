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
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isSearchReady, setIsSearchReady] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [shortcutSymbol] = useState(() =>
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
      ? '⌘'
      : 'Ctrl',
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // ⚡ Bolt: Debounce query to prevent synchronous main thread blocking during rapid typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const results = useMemo(() => {
    if (!isSearchReady || debouncedQuery.length < minQueryLength) {
      return []
    }

    try {
      // Use the global search client
      const searchResults = window.searchClient.search(debouncedQuery)

      // Apply filtering after search
      let limitedResults = searchResults
      if (maxResults && searchResults.length > maxResults) {
        limitedResults = searchResults.slice(0, maxResults)
      }

      return limitedResults
    } catch (error: unknown) {
      console.error('Search error:', error)
      return []
    }
  }, [debouncedQuery, isSearchReady, maxResults, minQueryLength])

  // Track if the search is actually showing results
  const hasResults = useMemo(() => results.length > 0, [results])
  const showResults = useMemo(
    () => isOpen && query.length >= minQueryLength,
    [isOpen, query, minQueryLength],
  )

  const isSearching = query !== debouncedQuery

  // Initialize search when component mounts
  useEffect(() => {
    const handleSearchReady = () => {
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

  // Handle global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [])

  useEffect(() => {
    if (onSearch && results.length > 0) {
      onSearch(debouncedQuery, results)
    }
  }, [debouncedQuery, onSearch, results])

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (
        resultsRef.current &&
        !resultsRef.current.contains(target) &&
        !inputRef.current?.contains(target)
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
    setActiveIndex(-1)
  }

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false)
    setQuery('')
    setActiveIndex(-1)

    if (onResultClick) {
      onResultClick(result)
    } else {
      window.location.href = result.url
    }
  }

  return (
    <>
      {/* Screen reader announcement for search results */}
      <div className="sr-only" aria-live="polite" role="status">
        {!isSearching &&
        isSearchReady &&
        isOpen &&
        query === debouncedQuery &&
        query.length >= minQueryLength
          ? hasResults
            ? `${results.length} result${results.length === 1 ? '' : 's'} found.`
            : showNoResults
              ? `No results found for "${query}".`
              : ''
          : ''}
      </div>

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
            aria-keyshortcuts={shortcutSymbol === '⌘' ? 'Meta+K' : 'Control+K'}
            className={`w-full rounded-none border border-input bg-background px-4 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-activedescendant={
              showResults && activeIndex >= 0
                ? `result-${activeIndex}`
                : undefined
            }
            autoComplete="off"
          />

          {query.length === 0 && (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <kbd className="hidden h-5 select-none items-center gap-1 rounded-none border border-border bg-secondary px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:inline-flex">
                <span className="text-xs">{shortcutSymbol}</span>K
              </kbd>
            </div>
          )}

          {query.length > 0 && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
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
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-none border border-border bg-card"
            role="listbox"
          >
            {hasResults ? (
              <ul className="divide-y divide-border">
                {results.map((result, index) => (
                  <li key={result.id} role="presentation">
                    <button
                      id={`result-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className={`w-full px-4 py-3 text-left focus:outline-none ${
                        index === activeIndex
                          ? 'bg-secondary'
                          : 'transition-colors hover:bg-secondary'
                      }`}
                      onClick={() => handleResultClick(result)}
                      tabIndex={-1}
                    >
                      <div className="font-medium text-foreground">
                        {result.title}
                      </div>
                      {result.content && (
                        <div className="line-clamp-2 text-sm text-muted-foreground">
                          {result.content.substring(0, 150)}...
                        </div>
                      )}
                      {result.category && (
                        <div className="mt-1">
                          <span className="inline-flex items-center rounded-none border border-border bg-secondary px-2 py-1 text-xs font-medium text-foreground">
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
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  No results found for &quot;{query}&quot;
                </div>
              )
            )}
          </div>
        )}
      </div>
    </>
  )
}
