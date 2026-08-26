// Export types from search.ts
export interface SearchDocument {
  id: string | number
  title: string
  content: string
  url: string
  tags?: string[]
  category?: string
}

// Define search options interface
export interface SearchOptions {
  limit?: number
  threshold?: number
  fuzzy?: boolean
  boost?: Record<string, number>
  includeScore?: boolean
  includeMatches?: boolean
  keys?: string[]
}

export interface ISearchClient {
  search: (query: string, options?: SearchOptions) => SearchDocument[]
  importDocuments: (documents: SearchDocument[]) => void
}

export declare class SearchClient implements ISearchClient {
  search(query: string, options?: SearchOptions): SearchDocument[]
  importDocuments(docs: SearchDocument[]): void
}

interface CustomEvent {
  detail: {
    size: number
  }
}

declare global {
  interface Window {
    searchClient: SearchClient
    searchIndex: SearchDocument[]
    initSearch?: () => void
  }
}
