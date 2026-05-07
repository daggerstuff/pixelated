import { Search, Loader2 } from 'lucide-react'
import React, { useState } from 'react'

import { cn } from '../lib/utils.js'
import { Button } from './ui/button/index.js'
import { Input } from './ui/input.js'

interface SearchResult {
  id: string
  title: string
  description: string
  slug: string
}

interface SearchResponse {
  results: SearchResult[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const isSearchResult = (value: unknown): value is SearchResult => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value['id'] === 'string' &&
    typeof value['title'] === 'string' &&
    typeof value['description'] === 'string' &&
    typeof value['slug'] === 'string'
  )
}

const isSearchResponse = (value: unknown): value is SearchResponse => {
  if (!isRecord(value)) {
    return false
  }

  return (
    Array.isArray(value['results']) && value['results'].every(isSearchResult)
  )
}

export function BlogSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  async function handleSearch(
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    e.preventDefault()
    if (!query.trim()) {
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const data: unknown = await response.json()
      if (isSearchResponse(data)) {
        setResults(data.results)
      } else {
        setResults([])
      }
    } catch (error: unknown) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className='mx-auto w-full max-w-2xl'>
      <form onSubmit={handleSearch} className='relative' role='search'>
        <Input
          type='search'
          placeholder='Search blog posts...'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className='w-full pl-10'
          aria-label='Search blog posts'
        />

        <Search
          className='text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2'
          aria-hidden='true'
        />

        <Button
          type='submit'
          variant='ghost'
          size='sm'
          className={cn(
            'absolute right-0 top-0 h-full px-3',
            isSearching && 'opacity-50 cursor-not-allowed',
          )}
          disabled={isSearching}
          aria-label={isSearching ? 'Searching...' : 'Search'}
        >
          {isSearching ? (
            <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
          ) : (
            'Search'
          )}
        </Button>
      </form>

      {/* Screen reader only live region for search status */}
      <div
        role='status'
        aria-live='polite'
        aria-atomic='true'
        className='sr-only'
      >
        {isSearching ? 'Searching...' : ''}
      </div>

      {results.length > 0 && (
        <div className='mt-4 space-y-4'>
          {results.map((result) => (
            <article key={result['id']} className='bg-muted/50 rounded-lg p-4'>
              <h3 className='mb-2 text-lg font-semibold'>
                <a
                  href={`/blog/${result['slug']}`}
                  className='hover:text-primary transition-colors'
                >
                  {result['title']}
                </a>
              </h3>
              <p className='text-muted-foreground'>{result['description']}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
