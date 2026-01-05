/**
 * Embedding Agent Module.
 *
 * Provides client, types, and schemas for interacting with the
 * embedding agent service for vector embeddings and similarity search.
 *
 * @example
 * ```typescript
 * import {
 *   createEmbeddingAgentClient,
 *   EmbeddingRequestSchema,
 *   type EmbeddingRequest,
 *   type EmbeddingResponse,
 * } from '@/lib/ai/embedding-agent'
 *
 * // Create client
 * const client = createEmbeddingAgentClient()
 *
 * // Embed text
 * const response = await client.embedText({ text: 'Hello world' })
 * ```
 */

// Client exports
export {
  EmbeddingAgentClient,
  EmbeddingAgentError,
  createEmbeddingAgentClient,
  type EmbeddingAgentClientConfig,
} from './client'

// Type exports
export type {
  BatchEmbeddingItem,
  BatchEmbeddingRequest,
  BatchEmbeddingResponse,
  CacheClearResult,
  CacheStats,
  EmbeddingAgentConfig,
  EmbeddingAgentStatus,
  EmbeddingErrorResponse,
  EmbeddingModel,
  EmbeddingModelInfo,
  EmbeddingRequest,
  EmbeddingResponse,
  HealthCheckResponse,
  KnowledgeLoadResult,
  KnowledgeType,
  SimilarityMatch,
  SimilaritySearchRequest,
  SimilaritySearchResponse,
} from './types'

// Schema exports
export {
  BatchEmbeddingItemSchema,
  BatchEmbeddingRequestSchema,
  BatchEmbeddingResponseSchema,
  CacheClearResultSchema,
  CacheStatsSchema,
  EmbeddingAgentStatusSchema,
  EmbeddingConfigResponseSchema,
  EmbeddingErrorResponseSchema,
  EmbeddingModelInfoSchema,
  EmbeddingModelSchema,
  EmbeddingRequestSchema,
  EmbeddingResponseSchema,
  HealthCheckResponseSchema,
  KnowledgeLoadResultSchema,
  KnowledgeTypeSchema,
  ModelsListResponseSchema,
  SimilarityMatchSchema,
  SimilaritySearchRequestSchema,
  SimilaritySearchResponseSchema,
  type BatchEmbeddingRequestInput,
  type EmbeddingRequestInput,
  type EmbeddingRequestOutput,
  type SimilaritySearchRequestInput,
} from './schemas'

