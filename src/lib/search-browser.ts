// Define search document structure
export interface SearchDocument {
  id: string | number
  title: string
  content: string
  url: string
  tags?: string[]
  category?: string
}

// Define search result structure
export interface SearchResult {
  id: string | number
  title: string
  content: string
  url: string
  tags?: string[]
  category?: string
  score?: number
  match?: string[]
}

// Define minimal types for flexsearch
export interface IndexOptions {
  tokenize?: string
  cache?: number
  context?: boolean
}

export interface SearchOptions {
  limit?: number
  suggest?: boolean
  fuzzy?: number
  enrich?: boolean
}

// FlexSearch Document configuration interface
interface FlexSearchDocumentConfig {
  document: {
    id: string
    index: string[]
    store: boolean
  }
  tokenize?: string
  cache?: number
  context?: boolean
}

// FlexSearch Document instance interface
interface FlexSearchDocumentInstance {
  search(
    query: string,
    options?: SearchOptions,
  ): Array<{
    field: string
    result: Array<string | number>
  }>
  add(document: SearchDocument): void
}

// FlexSearch Document constructor interface
interface FlexSearchDocumentConstructor {
  new (config: FlexSearchDocumentConfig): FlexSearchDocumentInstance
}

// Define search index configuration type
export interface SearchConfig {
  // FlexSearch indexing options
  indexOptions?: IndexOptions

  // FlexSearch search options
  searchOptions?: SearchOptions

  // Custom tokenizer function
  tokenize?: (text: string) => string[]

  // Fields to include in search
  fields?: string[]

  // Search boost values per field
  boost?: Record<string, number>
}

// Interface for search functionality
export interface ISearchClient {
  search: (query: string) => SearchDocument[]
  importDocuments: (documents: SearchDocument[]) => void
}

// Default configuration
const DEFAULT_CONFIG: SearchConfig = {
  indexOptions: {
    tokenize: 'forward',
    cache: 100,
    context: true,
  },
  searchOptions: {
    limit: 10,
    suggest: true,
    fuzzy: 0.2,
  },
  fields: ['title', 'content', 'tags'],
  boost: {
    title: 2,
    content: 1,
    tags: 3,
  },
}

// Fallback search client when flexsearch fails to load
function createFallbackClient(): ISearchClient {
  console.warn('Using fallback search implementation')
  return {
    search: () => [],
    importDocuments: () => {},
  }
}

// Client-side search implementation
class BrowserSearchClient implements ISearchClient {
  private index: FlexSearchDocumentInstance
  private documents: Map<string | number, SearchDocument> = new Map()
  private config: SearchConfig

  constructor(
    Document: FlexSearchDocumentConstructor,
    config: Partial<SearchConfig> = {},
  ) {
    // Merge default config with provided config
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      indexOptions: {
        ...DEFAULT_CONFIG.indexOptions,
        ...config.indexOptions,
      },
      searchOptions: {
        ...DEFAULT_CONFIG.searchOptions,
        ...config.searchOptions,
      },
      boost: {
        ...DEFAULT_CONFIG.boost,
        ...config.boost,
      },
    }

    // Create the index
    this.index = new Document({
      document: {
        id: 'id',
        index: this.config.fields || ['title', 'content', 'tags'],
        store: true,
      },
      ...this.config.indexOptions,
    })
  }

  search(
    query: string,
    options: Partial<SearchOptions> = {},
  ): SearchDocument[] {
    if (!this.index || !query) {
      return []
    }

    const searchOptions = {
      ...this.config.searchOptions,
      ...options,
    }

    try {
      // Get search results from the index
      const results = this.index.search(query, searchOptions)

      // Process and format the results
      const searchResults: SearchDocument[] = []
      const processedIds = new Set<string | number>()

      // Process results for each field
      for (const result of results) {
        // Each result contains document IDs matching the search

        const matches = result.result

        for (const docId of matches) {
          // If document already exists in results, update score if higher
          if (processedIds.has(docId)) {
            continue
          }

          processedIds.add(docId)

          // Add original document from storage with score
          const originalDoc = this.documents.get(docId)
          if (originalDoc) {
            searchResults.push(originalDoc)
          }
        }
      }

      return searchResults
    } catch (error: unknown) {
      console.error('Search failed:', error)
      return []
    }
  }

  importDocuments(docs: SearchDocument[]): void {
    if (!this.index) {
      return
    }

    // Add documents to the storage and index
    for (const doc of docs) {
      this.documents.set(doc.id, doc)
      try {
        this.index.add(doc)
      } catch (error: unknown) {
        console.error(`Failed to add document ${doc.id} to index:`, error)
      }
    }
  }
}

// This loads and initializes flexsearch only in the browser
export async function initBrowserSearch(
  config: Partial<SearchConfig> = {},
): Promise<ISearchClient> {
  // In SSR environment, return a stub client
  if (typeof window === 'undefined') {
    return createFallbackClient()
  }

  // Browser implementation
  try {
    // Dynamic import with proper error handling
    let Document: FlexSearchDocumentConstructor

    try {
      // Use dynamic import with module specifier pattern that Vite can analyze
      // First attempt - standard import path for ESM
      const flexsearchPath = 'flexsearch'
      const flexsearch = await import(flexsearchPath)
      Document = (flexsearch.default?.Document ||
        flexsearch.Document) as FlexSearchDocumentConstructor
    } catch (err: unknown) {
      console.warn(
        'Failed to load flexsearch directly, trying alternative path:',
        err,
      )
      try {
        // Second attempt - alternate path for CommonJS fallback
        const documentModulePath = 'flexsearch/dist/module/document'
        const documentModule = await import(documentModulePath)
        // Use default export as the Document class
        Document = documentModule.default as FlexSearchDocumentConstructor
      } catch (docErr) {
        console.error(
          'Failed to load flexsearch Document from alternate path:',
          docErr,
        )
        throw new Error(
          'Cannot load flexsearch Document',
          { cause: err },
          { cause: docErr },
        )
      }
    }

    if (Document) {
      return new BrowserSearchClient(Document, config)
    } else {
      console.error(
        'Failed to load flexsearch Document class - module loaded but Document not found',
      )
      return createFallbackClient()
    }
  } catch (error: unknown) {
    console.error('Error loading flexsearch:', error)
    return createFallbackClient()
  }
}
