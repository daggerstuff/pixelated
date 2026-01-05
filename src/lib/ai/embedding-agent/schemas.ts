/**
 * Zod validation schemas for the Embedding Agent API.
 *
 * These schemas provide runtime validation for API requests
 * and responses, ensuring type safety at the boundary.
 */

import { z } from 'zod'

/**
 * Embedding model enum schema.
 */
export const EmbeddingModelSchema = z.enum([
    'all-MiniLM-L6-v2',
    'all-MiniLM-L12-v2',
    'all-mpnet-base-v2',
    'BAAI/bge-small-en-v1.5',
    'BAAI/bge-base-en-v1.5',
    'emilyalsentzer/Bio_ClinicalBERT',
])

/**
 * Knowledge type enum schema.
 */
export const KnowledgeTypeSchema = z.enum([
    'dsm5',
    'pdm2',
    'clinical',
    'therapeutic_technique',
    'therapeutic_conversation',
    'general',
])

/**
 * Embedding request schema.
 */
export const EmbeddingRequestSchema = z.object({
    text: z
        .string()
        .min(1, 'Text cannot be empty')
        .max(10000, 'Text cannot exceed 10000 characters')
        .refine((val) => val.trim().length > 0, 'Text cannot be only whitespace'),
    knowledgeType: KnowledgeTypeSchema.optional().transform((val) => val ?? 'general'),
    metadata: z.record(z.string(), z.unknown()).optional().transform((val) => val ?? {}),
    model: EmbeddingModelSchema.optional(),
})

/**
 * Batch embedding request schema.
 */
export const BatchEmbeddingRequestSchema = z.object({
    texts: z
        .array(
            z
                .string()
                .min(1, 'Text cannot be empty')
                .max(10000, 'Text cannot exceed 10000 characters'),
        )
        .min(1, 'At least one text required')
        .max(100, 'Maximum 100 texts per batch'),
    knowledgeTypes: z.array(KnowledgeTypeSchema).optional(),
    metadataList: z.array(z.record(z.string(), z.unknown())).optional(),
    model: EmbeddingModelSchema.optional(),
})

/**
 * Similarity search request schema.
 */
export const SimilaritySearchRequestSchema = z.object({
    query: z
        .string()
        .min(1, 'Query cannot be empty')
        .max(10000, 'Query cannot exceed 10000 characters'),
    queryEmbedding: z.array(z.number()).optional(),
    topK: z.number().int().min(1).max(100).optional().transform((val) => val ?? 10),
    knowledgeTypes: z.array(KnowledgeTypeSchema).optional(),
    minSimilarity: z.number().min(0).max(1).optional().transform((val) => val ?? 0),
    includeMetadata: z.boolean().optional().transform((val) => val ?? true),
})

/**
 * Embedding response schema.
 */
export const EmbeddingResponseSchema = z.object({
    embedding: z.array(z.number()),
    embeddingId: z.string(),
    modelUsed: z.string(),
    dimension: z.number().int().positive(),
    textHash: z.string(),
    cached: z.boolean(),
    processingTimeMs: z.number().nonnegative(),
    createdAt: z.string().datetime(),
})

/**
 * Batch embedding item schema.
 */
export const BatchEmbeddingItemSchema = z.object({
    index: z.number().int().nonnegative(),
    embedding: z.array(z.number()),
    embeddingId: z.string(),
    textHash: z.string(),
    cached: z.boolean(),
})

/**
 * Batch embedding response schema.
 */
export const BatchEmbeddingResponseSchema = z.object({
    embeddings: z.array(BatchEmbeddingItemSchema),
    totalCount: z.number().int().nonnegative(),
    cachedCount: z.number().int().nonnegative(),
    generatedCount: z.number().int().nonnegative(),
    modelUsed: z.string(),
    dimension: z.number().int().positive(),
    processingTimeMs: z.number().nonnegative(),
    createdAt: z.string().datetime(),
})

/**
 * Similarity match schema.
 */
export const SimilarityMatchSchema = z.object({
    itemId: z.string(),
    content: z.string(),
    similarityScore: z.number().min(0).max(1),
    knowledgeType: KnowledgeTypeSchema,
    source: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Similarity search response schema.
 */
export const SimilaritySearchResponseSchema = z.object({
    matches: z.array(SimilarityMatchSchema),
    queryEmbeddingId: z.string(),
    totalSearched: z.number().int().nonnegative(),
    processingTimeMs: z.number().nonnegative(),
    modelUsed: z.string(),
})

/**
 * Embedding agent status schema.
 */
export const EmbeddingAgentStatusSchema = z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    modelLoaded: z.boolean(),
    modelName: z.string(),
    embeddingDimension: z.number().int().positive(),
    cacheSize: z.number().int().nonnegative(),
    knowledgeItemsCount: z.number().int().nonnegative(),
    gpuAvailable: z.boolean(),
    gpuMemoryUsedMb: z.number().nonnegative().optional().nullable(),
    uptimeSeconds: z.number().nonnegative(),
    requestsProcessed: z.number().int().nonnegative(),
    averageResponseTimeMs: z.number().nonnegative(),
    lastRequestAt: z.string().datetime().optional().nullable(),
})

/**
 * Health check response schema.
 */
export const HealthCheckResponseSchema = z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    version: z.string(),
    modelLoaded: z.boolean(),
    cacheAvailable: z.boolean(),
    timestamp: z.string().datetime(),
})

/**
 * Error response schema.
 */
export const EmbeddingErrorResponseSchema = z.object({
    error: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.string().datetime(),
    requestId: z.string().optional(),
})

/**
 * Cache stats schema.
 */
export const CacheStatsSchema = z.object({
    cacheSize: z.number().int().nonnegative(),
    cacheEnabled: z.boolean(),
})

/**
 * Knowledge load result schema.
 */
export const KnowledgeLoadResultSchema = z.object({
    success: z.boolean(),
    itemsLoaded: z.number().int().nonnegative(),
    message: z.string(),
})

/**
 * Cache clear result schema.
 */
export const CacheClearResultSchema = z.object({
    success: z.boolean(),
    itemsCleared: z.number().int().nonnegative(),
    message: z.string(),
})

/**
 * Model info schema.
 */
export const EmbeddingModelInfoSchema = z.object({
    id: EmbeddingModelSchema,
    name: z.string(),
    dimension: z.number().int().positive(),
    description: z.string(),
})

/**
 * Models list response schema.
 */
export const ModelsListResponseSchema = z.object({
    models: z.array(EmbeddingModelInfoSchema),
})

/**
 * Config response schema.
 */
export const EmbeddingConfigResponseSchema = z.object({
    modelName: z.string(),
    embeddingDimension: z.number().int().positive(),
    batchSize: z.number().int().positive(),
    maxTextLength: z.number().int().positive(),
    normalizeEmbeddings: z.boolean(),
    cacheEmbeddings: z.boolean(),
    useGpu: z.boolean(),
})

// Type exports from schemas
export type EmbeddingRequestInput = z.input<typeof EmbeddingRequestSchema>
export type EmbeddingRequestOutput = z.output<typeof EmbeddingRequestSchema>
export type BatchEmbeddingRequestInput = z.input<typeof BatchEmbeddingRequestSchema>
export type SimilaritySearchRequestInput = z.input<typeof SimilaritySearchRequestSchema>

