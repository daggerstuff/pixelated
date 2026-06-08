/**
 * Embedding Agent API Client.
 *
 * Provides a typed client for interacting with the embedding agent service.
 * Handles request/response transformation, error handling, and caching.
 */

import type {
  BatchEmbeddingRequest,
  BatchEmbeddingResponse,
  CacheClearResult,
  CacheStats,
  EmbeddingAgentConfig,
  EmbeddingAgentStatus,
  EmbeddingRequest,
  EmbeddingResponse,
  HealthCheckResponse,
  KnowledgeLoadResult,
  SimilaritySearchRequest,
  SimilaritySearchResponse,
} from './types'

/**
 * Configuration options for the embedding agent client.
 */
export interface EmbeddingAgentClientConfig {
  /** Base URL for the embedding agent API */
  baseUrl: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Optional authentication token */
  authToken?: string
  /** Custom headers */
  headers?: Record<string, string>
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Partial<EmbeddingAgentClientConfig> = {
  timeout: 30000,
}

/**
 * Transform snake_case keys to camelCase.
 */
function toCamelCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj as unknown
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item)) as unknown
  }

  if (typeof obj === 'object') {
    const newObj: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
        letter.toUpperCase(),
      )
      newObj[camelKey] = toCamelCase(value)
    }
    return newObj as unknown
  }

  return obj as unknown
}

/**
 * Transform camelCase keys to snake_case.
 */
function toSnakeCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj as unknown
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCase(item)) as unknown
  }

  if (typeof obj === 'object') {
    const newObj: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`,
      )
      newObj[snakeKey] = toSnakeCase(value)
    }
    return newObj as unknown
  }

  return obj as unknown
}

/**
 * Client for the Embedding Agent API.
 *
 * @example
 * ```typescript
 * const client = new EmbeddingAgentClient({
 *   baseUrl: 'http://localhost:8001',
 * })
 *
 * // Embed single text
 * const result = await client.embedText({ text: 'Hello world' })
 * console.log(result.embedding)
 *
 * // Batch embed
 * const batchResult = await client.embedBatch({ texts: ['Hello', 'World'] })
 *
 * // Search similar
 * const searchResult = await client.searchSimilar({ query: 'depression treatment' })
 * ```
 */
export class EmbeddingAgentClient {
  private readonly config: EmbeddingAgentClientConfig

  constructor(config: EmbeddingAgentClientConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Make an HTTP request to the embedding agent API.
   */
   private async request<T>(
     method: 'GET' | 'POST' | 'DELETE',
     path: string,
     body?: Record<string, unknown>,
   ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    }

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(url, {
        method,
        headers,
        body:
          method === 'GET'
            ? undefined
            : body
              ? JSON.stringify(toSnakeCase(body))
              : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.text()
        let errorData: { error?: string; message?: string } = {}
        try {
          errorData = JSON.parse(errorBody)
        } catch {
          // Not JSON
        }
        throw new EmbeddingAgentError(
          (errorData.message ?? errorData.error) ?? `HTTP ${response.status}`,
          response.status,
          errorData,
        )
      }

      const data = await response.json()
      return toCamelCase<T>(data)
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      if (error instanceof EmbeddingAgentError) {
        throw error
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new EmbeddingAgentError('Request timeout', 408)
      }
      throw new EmbeddingAgentError(
        error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Unknown error',
        0,
      )
    }
  }

