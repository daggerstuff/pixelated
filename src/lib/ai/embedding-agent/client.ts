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
} from "./types";

/**
 * Configuration options for the embedding agent client.
 */
export interface EmbeddingAgentClientConfig {
  /** Base URL for the embedding agent API */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Optional authentication token */
  authToken?: string;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Partial<EmbeddingAgentClientConfig> = {
  timeout: 30000,
};

/**
 * Transform snake_case keys to camelCase.
 */
function toCamelCase<T>(obj: unknown): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item)) as T;
  }

  if (typeof obj === "object") {
    const newObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
        letter.toUpperCase(),
      );
      newObj[camelKey] = toCamelCase(value);
    }
    return newObj as T;
  }

  return obj as T;
}

/**
 * Transform camelCase keys to snake_case.
 */
function toSnakeCase<T>(obj: unknown): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCase(item)) as T;
  }

  if (typeof obj === "object") {
    const newObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`,
      );
      newObj[snakeKey] = toSnakeCase(value);
    }
    return newObj as T;
  }

  return obj as T;
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
  private readonly config: EmbeddingAgentClientConfig;

  constructor(config: EmbeddingAgentClientConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Make an HTTP request to the embedding agent API.
   */
  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.config.headers,
    };

    if (this.config.authToken) {
      headers["Authorization"] = `Bearer ${this.config.authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body:
          method === "GET"
            ? undefined
            : body
              ? JSON.stringify(toSnakeCase(body))
              : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        let errorData: { error?: string; message?: string } = {};
        try {
          errorData = JSON.parse(errorBody);
        } catch {
          // Not JSON
        }
        throw new EmbeddingAgentError(
          errorData.message || errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData,
        );
      }

      const data = await response.json();
      return toCamelCase<T>(data);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof EmbeddingAgentError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new EmbeddingAgentError("Request timeout", 408);
      }
      throw new EmbeddingAgentError(
        error instanceof Error ? error.message : "Unknown error",
        0,
      );
    }
  }

  // ==================== Embedding Operations ====================

  /**
   * Generate embedding for a single text.
   *
   * @param request - The embedding request
   * @returns The embedding response with vector and metadata
   */
  async embedText(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return this.request<EmbeddingResponse>(
      "POST",
      "/api/v1/embeddings/embed",
      request,
    );
  }

  /**
   * Generate embeddings for multiple texts in batch.
   *
   * @param request - The batch embedding request
   * @returns The batch embedding response
   */
  async embedBatch(
    request: BatchEmbeddingRequest,
  ): Promise<BatchEmbeddingResponse> {
    return this.request<BatchEmbeddingResponse>(
      "POST",
      "/api/v1/embeddings/embed/batch",
      request,
    );
  }

  /**
   * Search for similar items in the knowledge base.
   *
   * @param request - The similarity search request
   * @returns The search response with matches
   */
  async searchSimilar(
    request: SimilaritySearchRequest,
  ): Promise<SimilaritySearchResponse> {
    return this.request<SimilaritySearchResponse>(
      "POST",
      "/api/v1/embeddings/search",
      request,
    );
  }

  // ==================== Health & Status ====================

  /**
   * Check the health of the embedding service.
   *
   * @returns Health check response
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>("GET", "/health");
  }

  /**
   * Get detailed status of the embedding agent.
   *
   * @returns Detailed status information
   */
  async getStatus(): Promise<EmbeddingAgentStatus> {
    return this.request<EmbeddingAgentStatus>("GET", "/status");
  }

  // ==================== Knowledge Management ====================

  /**
   * Load clinical knowledge into the service.
   *
   * @returns Knowledge load result
   */
  async loadKnowledge(): Promise<KnowledgeLoadResult> {
    return this.request<KnowledgeLoadResult>(
      "POST",
      "/api/v1/embeddings/knowledge/load",
    );
  }

  // ==================== Cache Management ====================

  /**
   * Clear the embedding cache.
   *
   * @returns Cache clear result
   */
  async clearCache(): Promise<CacheClearResult> {
    return this.request<CacheClearResult>("DELETE", "/api/v1/embeddings/cache");
  }

  /**
   * Get cache statistics.
   *
   * @returns Cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    return this.request<CacheStats>("GET", "/api/v1/embeddings/cache/stats");
  }

  // ==================== Configuration ====================

  /**
   * Get current embedding agent configuration.
   *
   * @returns Current configuration
   */
  async getConfig(): Promise<EmbeddingAgentConfig> {
    return this.request<EmbeddingAgentConfig>(
      "GET",
      "/api/v1/embeddings/config",
    );
  }

  /**
   * List available embedding models.
   *
   * @returns List of available models
   */
  async listModels(): Promise<{
    models: Array<{
      id: string;
      name: string;
      dimension: number;
      description: string;
    }>;
  }> {
    return this.request<{
      models: Array<{
        id: string;
        name: string;
        dimension: number;
        description: string;
      }>;
    }>("GET", "/api/v1/embeddings/models");
  }
}

/**
 * Error class for embedding agent API errors.
 */
export class EmbeddingAgentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "EmbeddingAgentError";
  }
}

/**
 * Create an embedding agent client with default configuration.
 *
 * @param baseUrl - Base URL for the embedding agent API
 * @returns Configured client instance
 */
export function createEmbeddingAgentClient(
  baseUrl: string = getDefaultEmbeddingAgentUrl(),
): EmbeddingAgentClient {
  return new EmbeddingAgentClient({ baseUrl });
}

/**
 * Get the default embedding agent URL from environment.
 */
function getDefaultEmbeddingAgentUrl(): string {
  // Check for environment variable - works in Node.js
  if (typeof process !== "undefined" && process.env) {
    const envUrl =
      process.env["EMBEDDING_AGENT_URL"] ||
      process.env["PUBLIC_EMBEDDING_AGENT_URL"];
    if (envUrl) {
      return envUrl;
    }
  }
  // Default to localhost for development
  return "http://localhost:8001";
}
