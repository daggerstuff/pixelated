/**
 * TypeScript types for the Embedding Agent API.
 *
 * These types mirror the Python Pydantic models and provide
 * type safety for the frontend/TypeScript side of the API.
 */

/**
 * Supported embedding models.
 */
export type EmbeddingModel =
  | 'all-MiniLM-L6-v2'
  | 'all-MiniLM-L12-v2'
  | 'all-mpnet-base-v2'
  | 'BAAI/bge-small-en-v1.5'
  | 'BAAI/bge-base-en-v1.5'
  | 'emilyalsentzer/Bio_ClinicalBERT'

/**
 * Types of clinical/psychological knowledge.
 */
export type KnowledgeType =
  | 'dsm5'
  | 'pdm2'
  | 'clinical'
  | 'therapeutic_technique'
  | 'therapeutic_conversation'
  | 'general'

/**
 * Configuration for the embedding agent.
 */
export interface EmbeddingAgentConfig {
  modelName: EmbeddingModel
  embeddingDimension: number
  batchSize: number
  maxTextLength: number
  normalizeEmbeddings: boolean
  cacheEmbeddings: boolean
  useGpu: boolean
}

/**
 * Request for embedding a single text.
 */
export interface EmbeddingRequest {
  /** Text to embed (1-10000 characters) */
  text: string
  /** Type of knowledge for categorization */
  knowledgeType?: KnowledgeType
  /** Additional metadata to associate with the embedding */
  metadata?: Record<string, unknown>
  /** Override the default embedding model */
  model?: EmbeddingModel
}

/**
 * Response from a single text embedding request.
 */
export interface EmbeddingResponse {
  /** The embedding vector */
  embedding: number[]
  /** Unique identifier for this embedding */
  embeddingId: string
  /** The model used to generate the embedding */
  modelUsed: string
  /** Dimension of the embedding vector */
  dimension: number
  /** Hash of the input text for caching */
  textHash: string
  /** Whether the embedding was retrieved from cache */
  cached: boolean
  /** Time taken to generate the embedding in milliseconds */
  processingTimeMs: number
  /** Timestamp of embedding creation */
  createdAt: string
}

/**
 * Request for batch text embedding.
 */
export interface BatchEmbeddingRequest {
  /** List of texts to embed (1-100 items) */
  texts: string[]
  /** Knowledge types for each text */
  knowledgeTypes?: KnowledgeType[]
  /** Metadata for each text */
  metadataList?: Record<string, unknown>[]
  /** Override the default embedding model */
  model?: EmbeddingModel
}

/**
 * Individual item in batch embedding response.
 */
export interface BatchEmbeddingItem {
  /** Index in the original request */
  index: number
  /** The embedding vector */
  embedding: number[]
  /** Unique identifier */
  embeddingId: string
  /** Hash of the input text */
  textHash: string
  /** Whether from cache */
  cached: boolean
}

/**
 * Response from a batch embedding request.
 */
export interface BatchEmbeddingResponse {
  /** List of embedding results */
  embeddings: BatchEmbeddingItem[]
  /** Total number of embeddings */
  totalCount: number
  /** Number of embeddings retrieved from cache */
  cachedCount: number
  /** Number of newly generated embeddings */
  generatedCount: number
  /** The model used */
  modelUsed: string
  /** Embedding dimension */
  dimension: number
  /** Total processing time in milliseconds */
  processingTimeMs: number
  /** Timestamp */
  createdAt: string
}

/**
 * Request for similarity search.
 */
export interface SimilaritySearchRequest {
  /** Query text to search for similar items */
  query: string
  /** Pre-computed query embedding (optional) */
  queryEmbedding?: number[]
  /** Number of similar items to return (1-100) */
  topK?: number
  /** Filter by knowledge types */
  knowledgeTypes?: KnowledgeType[]
  /** Minimum similarity threshold (0-1) */
  minSimilarity?: number
  /** Whether to include metadata in results */
  includeMetadata?: boolean
}

/**
 * Individual similarity search result.
 */
export interface SimilarityMatch {
  /** ID of the matching item */
  itemId: string
  /** Content of the matching item */
  content: string
  /** Cosine similarity score (0-1) */
  similarityScore: number
  /** Type of the matching knowledge */
  knowledgeType: KnowledgeType
  /** Source of the knowledge item */
  source: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Response from similarity search.
 */
export interface SimilaritySearchResponse {
  /** List of similar items */
  matches: SimilarityMatch[]
  /** ID of the query embedding used */
  queryEmbeddingId: string
  /** Total number of items searched */
  totalSearched: number
  /** Search processing time in milliseconds */
  processingTimeMs: number
  /** Embedding model used */
  modelUsed: string
}

/**
 * Status information for the embedding agent.
 */
export interface EmbeddingAgentStatus {
  /** Current agent status */
  status: 'healthy' | 'degraded' | 'unhealthy'
  /** Whether the embedding model is loaded */
  modelLoaded: boolean
  /** Name of the loaded model */
  modelName: string
  /** Dimension of embeddings */
  embeddingDimension: number
  /** Number of cached embeddings */
  cacheSize: number
  /** Number of indexed knowledge items */
  knowledgeItemsCount: number
  /** Whether GPU is available */
  gpuAvailable: boolean
  /** GPU memory used in MB */
  gpuMemoryUsedMb?: number
  /** Agent uptime in seconds */
  uptimeSeconds: number
  /** Total requests processed */
  requestsProcessed: number
  /** Average response time in milliseconds */
  averageResponseTimeMs: number
  /** Timestamp of last request */
  lastRequestAt?: string
}

/**
 * Health check response.
 */
export interface HealthCheckResponse {
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy'
  /** API version */
  version: string
  /** Whether model is loaded */
  modelLoaded: boolean
  /** Whether cache is available */
  cacheAvailable: boolean
  /** Timestamp */
  timestamp: string
}

/**
 * Error response.
 */
export interface EmbeddingErrorResponse {
  /** Error type */
  error: string
  /** Error message */
  message: string
  /** Additional error details */
  details?: Record<string, unknown>
  /** Timestamp */
  timestamp: string
  /** Request ID for tracking */
  requestId?: string
}

/**
 * Model information.
 */
export interface EmbeddingModelInfo {
  /** Model identifier */
  id: EmbeddingModel
  /** Model name */
  name: string
  /** Embedding dimension */
  dimension: number
  /** Model description */
  description: string
}

/**
 * Cache statistics.
 */
export interface CacheStats {
  /** Number of cached embeddings */
  cacheSize: number
  /** Whether caching is enabled */
  cacheEnabled: boolean
}

/**
 * Knowledge load result.
 */
export interface KnowledgeLoadResult {
  /** Whether loading succeeded */
  success: boolean
  /** Number of knowledge items loaded */
  itemsLoaded: number
  /** Status message */
  message: string
}

/**
 * Cache clear result.
 */
export interface CacheClearResult {
  /** Whether clearing succeeded */
  success: boolean
  /** Number of cached items removed */
  itemsCleared: number
  /** Status message */
  message: string
}

