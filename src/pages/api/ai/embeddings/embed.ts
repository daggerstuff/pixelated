/**
 * @file src/pages/api/ai/embeddings/embed.ts
 * @description API endpoint for generating text embeddings.
 *
 * This endpoint accepts POST requests with text to embed and returns
 * vector embeddings. It proxies to the Python embedding agent service
 * or falls back to a local implementation.
 */

import type { APIContext, APIRoute } from 'astro'
import { getSession } from '@/lib/auth/session'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import {
  createEmbeddingAgentClient,
  EmbeddingAgentError,
  EmbeddingRequestSchema,
} from '@/lib/ai/embedding-agent'
import type { EmbeddingRequest, EmbeddingResponse } from '@/lib/ai/embedding-agent'

const logger = createBuildSafeLogger('embeddings-embed')

/**
 * GET handler - returns information about the embed endpoint.
 */
export const GET: APIRoute = async ({ request }: APIContext) => {
  try {
    // Verify session for security
    const session = await getSession(request)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        name: 'Text Embedding API',
        description: 'Endpoint for generating text embeddings',
        methods: ['POST'],
        version: '1.0.0',
        status: 'active',
        authentication: 'required',
        supportedModels: [
          'all-MiniLM-L6-v2',
          'all-MiniLM-L12-v2',
          'all-mpnet-base-v2',
          'BAAI/bge-small-en-v1.5',
          'BAAI/bge-base-en-v1.5',
          'emilyalsentzer/Bio_ClinicalBERT',
        ],
        parameters: {
          required: ['text'],
          optional: ['knowledgeType', 'metadata', 'model'],
        },
        features: [
          'Single text embedding',
          'Multiple embedding models',
          'Caching support',
          'Clinical knowledge optimization',
        ],
        defaultModel: 'all-MiniLM-L6-v2',
        defaultDimension: 384,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    logger.error('Embed API info error:', error)
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
 * POST handler - generates embedding for provided text.
 */
export const POST: APIRoute = async ({ request }: APIContext) => {
  const startTime = Date.now()

  try {
    // Verify session
    const session = await getSession(request)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse and validate request body
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

    // Validate request schema
    const validation = EmbeddingRequestSchema.safeParse(body)
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

    const embeddingRequest: EmbeddingRequest = validation.data

    // Try to use the Python embedding agent service
    const agentUrl = import.meta.env['EMBEDDING_AGENT_URL'] || 'http://localhost:8001'
    const client = createEmbeddingAgentClient(agentUrl)

    try {
      const response = await client.embedText(embeddingRequest)

      logger.info('Generated embedding', {
        userId: session.user.id,
        textLength: embeddingRequest.text.length,
        model: response.modelUsed,
        dimension: response.dimension,
        cached: response.cached,
        processingTimeMs: response.processingTimeMs,
      })

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Processing-Time-Ms': String(Date.now() - startTime),
          'X-Model-Used': response.modelUsed,
          'X-Cached': String(response.cached),
        },
      })
    } catch (error) {
      // If the agent service is unavailable, fall back to local mock
      if (error instanceof EmbeddingAgentError && error.statusCode === 0) {
        logger.warn('Embedding agent unavailable, using mock implementation')
        const mockResponse = generateMockEmbedding(embeddingRequest.text)

        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Processing-Time-Ms': String(Date.now() - startTime),
            'X-Model-Used': 'mock',
            'X-Cached': 'false',
          },
        })
      }
      throw error
    }
  } catch (error) {
    logger.error('Embed endpoint error:', error)

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
 * Generate a mock embedding for testing when the agent is unavailable.
 */
function generateMockEmbedding(text: string): EmbeddingResponse {
  // Generate deterministic hash-based mock embedding
  const hash = simpleHash(text)
  const dimension = 384
  const embedding: number[] = []

  // Create pseudo-random but deterministic embedding
  let seed = hash
  for (let i = 0; i < dimension; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    embedding.push((seed / 0x7fffffff) * 2 - 1)
  }

  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0))
  const normalizedEmbedding = embedding.map((x) => x / norm)

  return {
    embedding: normalizedEmbedding,
    embeddingId: `mock_${hash.toString(16)}`,
    modelUsed: 'mock-embedding-v1',
    dimension,
    textHash: hash.toString(16),
    cached: false,
    processingTimeMs: 5,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Simple hash function for text.
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

