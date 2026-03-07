/**
 * This module provides a unified search interface for both server and client environments.
 * It uses dynamic imports to prevent SSR issues with browser-only dependencies.
 */

// Types we need in both environments
export interface SearchDocument {
  id: string | number
  title: string
  content: string
  url: string
  tags?: string[]
  category?: string
}

export interface SearchResult {
  id: string | number
  title: string
  content: string
  url: string
  score?: number
  matches?: Array<{ field: string; match: string }>
  category?: string
  tags?: string[]
}

export interface SearchConfig {
  tokenize?: string
  resolution?: number
  optimize?: boolean
  cache?: boolean | number
}

export interface SearchOptions {
  limit?: number
  threshold?: number
  boost?: Record<string, number>
  suggest?: boolean
}

export interface IndexOptions {
  tokenize?: string
  resolution?: number
  optimize?: boolean
  context?: boolean
}

export interface ISearchClient {
  search(query: string, options?: SearchOptions): SearchResult[]
  importDocuments(documents: SearchDocument[]): void
}

// Define post structure for content collections
export interface BlogPost {
  slug: string
  data: {
    title: string
    tags?: string[]
    category?: string
  }
}

// Define blogSearch interface for content collections
export interface PostInput {
  slug: string
  data: {
    title: string
    tags?: string[]
    category?: string
  }
}

export interface BlogSearchInterface {
  addPost: (post: PostInput, content: string) => void
  search: (query: string) => SearchResult[]
  _posts: SearchDocument[]
}

// Declare global extensions for browser environment
declare global {
  interface Window {
    searchClient: ISearchClient
    _pendingSearchDocs: SearchDocument[]
  }
}

// Server-side compatible dummy implementation
class ServerSearchClient implements ISearchClient {
  search(): SearchResult[] {
    return []
  }
  importDocuments() {
    /* No-op on server */
  }
}

// Blog search implementation for API route
export const blogSearch: BlogSearchInterface = {
  _posts: [] as SearchDocument[],

  addPost(post: PostInput, content: string): void {
    // Extract a summary for search results (first 200 chars)
    const summary = content.slice(0, 200).replace(/<[^>]*>?/gm, '')

    // Create a search document
    const doc: SearchDocument = {
      id: post.slug,
      title: post.data.title,
      content: summary,
      url: `/blog/${post.slug}`,
      tags: post.data.tags || [],
    }

    if (post.data.category) {
      doc.category = post.data.category
    }

    // Add to local store
    this._posts.push(doc)

    // If client is available, also add to search index
    if (typeof window !== 'undefined' && window.searchClient) {
      window.searchClient.importDocuments([doc])
    }
  },

  search(query: string): SearchResult[] {
    // In browser, use the real search client
    if (typeof window !== 'undefined' && window.searchClient) {
      return window.searchClient.search(query)
    }

    // Simple server-side fallback that does basic text matching
    if (!query) {
      return []
    }

    const lowerQuery = query.toLowerCase()
    return this._posts
      .filter((post: SearchDocument) => {
        return (
          post.title.toLowerCase().includes(lowerQuery) ||
          post.content.toLowerCase().includes(lowerQuery) ||
          post.tags?.some((tag: string) =>
            tag.toLowerCase().includes(lowerQuery),
          )
        )
      })
      .map((post: SearchDocument): SearchResult => {
        const result: SearchResult = {
          id: post.id,
          title: post.title,
          content: post.content,
          url: post.url,
          score: 1,
          matches: [{ field: 'title', match: post.title }],
        }

        if (post.category) {
          result.category = post.category
        }

        if (post.tags) {
          result.tags = post.tags
        }

        return result
      })
  },
}

// Helper function to create a search document
export function createSearchDocument(
  id: string | number,
  title: string,
  content: string,
  url: string,
  tags?: string[],
  category?: string,
): SearchDocument {
  const doc: SearchDocument = {
    id,
    title,
    content,
    url,
  }

  if (tags) {
    doc.tags = tags
  }

  if (category) {
    doc.category = category
  }

  return doc
}

// Create a client-side implementation with a safer approach for lazy loading
let searchClientInstance: ISearchClient = new ServerSearchClient()

// Only execute browser-specific code in browser environment
if (typeof window !== 'undefined') {
  // Safe storage for documents until real implementation loads
  window._pendingSearchDocs = window._pendingSearchDocs || []

  // Create a proxy client that stores documents and forwards to real implementation when ready
  const proxyClient: ISearchClient = {
    search(query: string, options?: SearchOptions): SearchResult[] {
      return searchClientInstance.search(query, options)
    },
    importDocuments(documents: SearchDocument[]): void {
      if (searchClientInstance instanceof ServerSearchClient) {
        // Store documents for when real client loads
        window._pendingSearchDocs = [...window._pendingSearchDocs, ...documents]
      } else {
        // Forward to real implementation
        searchClientInstance.importDocuments(documents)
      }
    },
  }

  // Make client available globally
  window.searchClient = proxyClient

  // Dynamically load the browser implementation
  // Using top-level await in an IIFE to avoid blocking
  ;(async () => {
    try {
      // Dynamic import with explicit .ts extension to help bundlers
      const { initBrowserSearch } = await import('./search-browser.js')
      const realClient = await initBrowserSearch()

      // Import any pending documents
      if (window._pendingSearchDocs.length > 0) {
        realClient.importDocuments(window._pendingSearchDocs)
        window._pendingSearchDocs = []
      }

      // Update the instance
      searchClientInstance = realClient
    } catch (error: unknown) {
      console.error('Failed to load search implementation:', error)
    }
  })()

  // Export the proxy client
  searchClientInstance = proxyClient
}

// Export the client instance
export const searchClient = searchClientInstance

// Add CommonJS compatibility for server contexts that may use require()
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Use the already-exported blogSearch
    get blogSearch() {
      return blogSearch
    },
    get searchClient() {
      return searchClient
    },
    get createSearchDocument() {
      return createSearchDocument
    },
  }
}
