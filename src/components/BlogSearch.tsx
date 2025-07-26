import React, { useState } from 'react'
import { Input } from './ui/input.js'
import { Button } from './ui/button/index.js'
import { Search } from 'lucide-react'
import { cn } from '../lib/utils.js'

interface SearchResult {
  id: string
  title: string
  description: string
  slug: string
}

export function BlogSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!query.trim()) {
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      setResults(data.results)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSearch} className="relative">
        <Input
          type="search"
          placeholder="Search blog posts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10"
        />

        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className={cn(
            'absolute right-0 top-0 h-full px-3',
            isSearching && 'opacity-50 cursor-not-allowed',
          )}
          disabled={isSearching}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {results.length > 0 && (
        <div className="mt-4 space-y-4">
          {results.map((result) => (
            <article key={result.id} className="p-4 rounded-lg bg-muted/50">
              <h3 className="text-lg font-semibold mb-2">
                <a
                  href={`/blog/${result.slug}`}
                  className="hover:text-primary transition-colors"
                >
                  {result.title}
                </a>
              </h3>
              <p className="text-muted-foreground">{result.description}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
