/**
 * @file src/pages/api/ai/embeddings/batch.ts
 * @description API endpoint for batch text embeddings.
 *
 * This endpoint accepts POST requests with multiple texts to embed
 * and returns vector embeddings for all texts efficiently.
 */

import type { APIContext, APIRoute } from 'astro'
import { getSession } from '@/lib/auth/session'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import {
  createEmbeddingAgentClient,
  EmbeddingAgentError,
  BatchEmbeddingRequestSchema,
} from '@/lib/ai/embedding-agent'
import type { BatchEmbeddingRequest, BatchEmbeddingResponse, BatchEmbeddingItem } from '@/lib/ai/embedding-agent'

const logger = createBuildSafeLogger('embeddings-batch')

/**
 * GET handler - returns information about the batch embed endpoint.
 */
export const GET: APIRoute = async ({ request }: APIContext) => {
  try {
    const session = await getSession(request)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        name: 'Batch Text Embedding API',
        description: 'Endpoint for generating embeddings for multiple texts',
        methods: ['POST'],
        version: '1.0.0',
        status: 'active',
        authentication: 'required',
        parameters: {
          required: ['texts'],
          optional: ['knowledgeTypes', 'metadataList', 'model'],
        },
        limits: {
          maxTexts: 100,
          maxTextLength: 10000,
        },
        features: [
          'Batch processing optimization',
          'Per-item caching',
          'Progress tracking',
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    logger.error('Batch embed API info error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to get endpoint information',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

/**
 * POST handler - generates embeddings for multiple texts.
 */
export const POST: APIRoute = async ({ request }: APIContext) => {
  const startTime = Date.now()

  try {
    const session = await getSession(request)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const validation = BatchEmbeddingRequestSchema.safeParse(body)
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          message: 'Invalid request format',
          details: validation.error.flatten(),
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const batchRequest: BatchEmbeddingRequest = validation.data

    const agentUrl = import.meta.env['EMBEDDING_AGENT_URL'] || 'http://localhost:8001'
    const client = createEmbeddingAgentClient(agentUrl)

    try {
      const response = await client.embedBatch(batchRequest)

      logger.info('Generated batch embeddings', {
        userId: session.user.id,
        totalCount: response.totalCount,
        cachedCount: response.cachedCount,
        generatedCount: response.generatedCount,
        processingTimeMs: response.processingTimeMs,
      })

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Processing-Time-Ms': String(Date.now() - startTime),
          'X-Total-Count': String(response.totalCount),
          'X-Cached-Count': String(response.cachedCount),
        },
      })
    } catch (error) {
      if (error instanceof EmbeddingAgentError && error.statusCode === 0) {
        logger.warn('Embedding agent unavailable, using mock implementation')
        const mockResponse = generateMockBatchEmbeddings(batchRequest.texts)

        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Processing-Time-Ms': String(Date.now() - startTime),
            'X-Model-Used': 'mock',
          },
        })
      }
      throw error
    }
  } catch (error) {
    logger.error('Batch embed endpoint error:', error)

    if (error instanceof EmbeddingAgentError) {
      return new Response(
        JSON.stringify({
          error: 'Embedding service error',
          message: error.message,
          statusCode: error.statusCode,
        }),
        {
          status: error.statusCode || 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

/**
 * Generate mock embeddings for testing.
 */
function generateMockBatchEmbeddings(texts: string[]): BatchEmbeddingResponse {
  const dimension = 384
  const embeddings: BatchEmbeddingItem[] = texts.map((text, index) => {
    const hash = simpleHash(text)
    const embedding = generateMockVector(hash, dimension)

    return {
      index,
      embedding,
      embeddingId: `mock_batch_${hash.toString(16)}_${index}`,
      textHash: hash.toString(16),
      cached: false,
    }
  })

  return {
    embeddings,
    totalCount: texts.length,
    cachedCount: 0,
    generatedCount: texts.length,
    modelUsed: 'mock-embedding-v1',
    dimension,
    processingTimeMs: texts.length * 2,
    createdAt: new Date().toISOString(),
  }
}

function generateMockVector(seed: number, dimension: number): number[] {
  const embedding: number[] = []
  for (let i = 0; i < dimension; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    embedding.push((seed / 0x7fffffff) * 2 - 1)
  }
  const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0))
  return embedding.map((x) => x / norm)
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

