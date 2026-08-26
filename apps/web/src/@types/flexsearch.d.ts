// Type declarations for flexsearch modules
declare module 'flexsearch/dist/module/document' {
  export interface DocumentOptions {
    id?: string
    index?: Record<string, unknown>
    store?: boolean | string[]
    tag?: string
    tokenize?: string | ((content: string) => string[])
    cache?: boolean | number
    async?: boolean
    worker?: boolean | number
    threshold?: number
    resolution?: number
    context?: boolean | object
  }

  export interface SearchOptions {
    limit?: number
    suggest?: boolean
    where?: Record<string, unknown>
    field?: string | string[]
    boolean?: boolean
    boost?: Record<string, number>
    tag?: string | string[]
  }

  export interface SearchResult<T = Record<string, unknown>> {
    field: string
    result: T[]
  }

  export default class Document {
    constructor(options: DocumentOptions)
    add(doc: Record<string, unknown>): void
    remove(id: string | number): void
    search<T = unknown>(query: string, options?: SearchOptions): T[]
  }
}

declare module 'flexsearch' {
  export interface CreateOptions {
    preset?: string
    tokenize?: string
    cache?: boolean | number
    async?: boolean
    worker?: boolean | number
    encode?: (content: string) => string
    context?: boolean | object
    filter?: ((content: string) => boolean) | Array<string>
    stemmer?: object | ((content: string) => string)
  }

  export interface IndexSearchOptions {
    limit?: number
    suggest?: boolean
    bool?: 'and' | 'or' | 'not'
    where?: Record<string, unknown>
    field?: string | string[]
    offset?: number
    page?: number
  }

  export class Index {
    constructor(options?: CreateOptions)
    add(id: string | number, content: string): void
    search<T = unknown>(query: string, options?: IndexSearchOptions): T[]
    remove(id: string | number): void
  }

  export function create(options?: CreateOptions): Index

  export interface DocumentOptions {
    id?: string
    index?: Record<string, unknown>
    store?: boolean | string[]
    tag?: string
    tokenize?: string | ((content: string) => string[])
    cache?: boolean | number
    async?: boolean
    worker?: boolean | number
    threshold?: number
    resolution?: number
    context?: boolean | object
  }

  export interface SearchOptions {
    limit?: number
    suggest?: boolean
    where?: Record<string, unknown>
    field?: string | string[]
    boolean?: boolean
    boost?: Record<string, number>
    tag?: string | string[]
  }

  export interface SearchResult<T = Record<string, unknown>> {
    field: string
    result: T[]
  }

  export class Document {
    constructor(options: DocumentOptions)
    add(doc: Record<string, unknown>): void
    remove(id: string | number): void
    search<T = unknown>(query: string, options?: SearchOptions): T[]
  }

  export default {
    Document,
    Index,
    create,
  }
}
