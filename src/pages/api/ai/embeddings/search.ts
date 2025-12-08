/**
 * @file src/pages/api/ai/embeddings/search.ts
 * @description API endpoint for similarity search in clinical knowledge.
 *
 * This endpoint accepts POST requests with a query and returns
 * the most similar knowledge items based on embedding similarity.
 */

import type { APIContext, APIRoute } from 'astro'
import { getSession } from '@/lib/auth/session'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import {
  createEmbeddingAgentClient,
  EmbeddingAgentError,
  SimilaritySearchRequestSchema,
} from '@/lib/ai/embedding-agent'
import type { SimilaritySearchRequest, SimilaritySearchResponse, SimilarityMatch } from '@/lib/ai/embedding-agent'

const logger = createBuildSafeLogger('embeddings-search')

/**
 * GET handler - returns information about the search endpoint.
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
        name: 'Similarity Search API',
        description: 'Endpoint for searching similar items in clinical knowledge',
        methods: ['POST'],
        version: '1.0.0',
        status: 'active',
        authentication: 'required',
        parameters: {
          required: ['query'],
          optional: ['queryEmbedding', 'topK', 'knowledgeTypes', 'minSimilarity', 'includeMetadata'],
        },
        knowledgeTypes: [
          'dsm5',
          'pdm2',
          'clinical',
          'therapeutic_technique',
          'therapeutic_conversation',
          'general',
        ],
        features: [
          'Semantic similarity search',
          'Knowledge type filtering',
          'Configurable result count',
          'Metadata inclusion',
        ],
        defaultTopK: 10,
        maxTopK: 100,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    logger.error('Search API info error:', error)
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
 * POST handler - performs similarity search.
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

    const validation = SimilaritySearchRequestSchema.safeParse(body)
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

    const searchRequest: SimilaritySearchRequest = validation.data

    const agentUrl = import.meta.env['EMBEDDING_AGENT_URL'] || 'http://localhost:8001'
    const client = createEmbeddingAgentClient(agentUrl)

    try {
      const response = await client.searchSimilar(searchRequest)

      logger.info('Similarity search completed', {
        userId: session.user.id,
        queryLength: searchRequest.query.length,
        matchCount: response.matches.length,
        totalSearched: response.totalSearched,
        processingTimeMs: response.processingTimeMs,
      })

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Processing-Time-Ms': String(Date.now() - startTime),
          'X-Match-Count': String(response.matches.length),
        },
      })
    } catch (error) {
      if (error instanceof EmbeddingAgentError && error.statusCode === 0) {
        logger.warn('Embedding agent unavailable, returning mock results')
        const mockResponse = generateMockSearchResults(searchRequest)

        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Processing-Time-Ms': String(Date.now() - startTime),
            'X-Mock-Results': 'true',
          },
        })
      }
      throw error
    }
  } catch (error) {
    logger.error('Search endpoint error:', error)

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
 * Generate mock search results for testing.
 */
function generateMockSearchResults(request: SimilaritySearchRequest): SimilaritySearchResponse {
  const topK = request.topK ?? 10
  const mockMatches: SimilarityMatch[] = []

  // Generate some relevant mock results
  const mockKnowledge = [
    {
      id: 'mock_dsm5_depression',
      content: 'Major Depressive Disorder: Characterized by persistent sadness, loss of interest, and impaired functioning.',
      type: 'dsm5' as const,
      source: 'DSM-5 Criteria',
    },
    {
      id: 'mock_cbt_technique',
      content: 'Cognitive Behavioral Therapy: Focuses on identifying and changing negative thought patterns.',
      type: 'therapeutic_technique' as const,
      source: 'CBT Manual',
    },
    {
      id: 'mock_pdm2_attachment',
      content: 'Attachment Theory: Describes the dynamics of interpersonal relationships.',
      type: 'pdm2' as const,
      source: 'PDM-2 Reference',
    },
    {
      id: 'mock_clinical_anxiety',
      content: 'Generalized Anxiety Disorder: Excessive worry about various aspects of life.',
      type: 'clinical' as const,
      source: 'Clinical Guidelines',
    },
    {
      id: 'mock_conversation_empathy',
      content: 'Empathic response example: "I hear that you\'re feeling overwhelmed right now."',
      type: 'therapeutic_conversation' as const,
      source: 'Therapeutic Dialogue Examples',
    },
  ]

  // Generate matches with descending similarity scores
  for (let i = 0; i < Math.min(topK, mockKnowledge.length); i++) {
    const item = mockKnowledge[i]
    const similarity = 0.95 - i * 0.1 // Decreasing similarity

    if (similarity >= (request.minSimilarity ?? 0)) {
      if (
        !request.knowledgeTypes ||
        request.knowledgeTypes.includes(item.type)
      ) {
        mockMatches.push({
          itemId: item.id,
          content: item.content,
          similarityScore: similarity,
          knowledgeType: item.type,
          source: item.source,
          metadata: request.includeMetadata !== false ? { mock: true } : undefined,
        })
      }
    }
  }

  return {
    matches: mockMatches,
    queryEmbeddingId: `mock_query_${Date.now()}`,
    totalSearched: mockKnowledge.length,
    processingTimeMs: 15,
    modelUsed: 'mock-embedding-v1',
  }
}

