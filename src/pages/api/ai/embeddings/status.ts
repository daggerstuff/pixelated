/**
 * @file src/pages/api/ai/embeddings/status.ts
 * @description API endpoint for embedding agent status and health.
 *
 * This endpoint provides health checks and detailed status information
 * for the embedding agent service.
 */

import type { APIContext, APIRoute } from 'astro'
import { getSession } from '@/lib/auth/session'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import {
  createEmbeddingAgentClient,
  EmbeddingAgentError,
} from '@/lib/ai/embedding-agent'
import type { EmbeddingAgentStatus, HealthCheckResponse } from '@/lib/ai/embedding-agent'

const logger = createBuildSafeLogger('embeddings-status')

/**
 * GET handler - returns status information about the embedding service.
 */
export const GET: APIRoute = async ({ request, url }: APIContext) => {
  try {
    // Check if this is a health check (no auth required)
    const isHealthCheck = url.searchParams.get('health') === 'true'

    if (!isHealthCheck) {
      // Detailed status requires authentication
      const session = await getSession(request)
      if (!session?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    const agentUrl = import.meta.env['EMBEDDING_AGENT_URL'] || 'http://localhost:8001'
    const client = createEmbeddingAgentClient(agentUrl)

    try {
      if (isHealthCheck) {
        // Simple health check
        const health = await client.healthCheck()
        return new Response(JSON.stringify(health), {
          status: health.status === 'healthy' ? 200 : 503,
          headers: { 'Content-Type': 'application/json' },
        })
      } else {
        // Detailed status
        const status = await client.getStatus()
        return new Response(JSON.stringify(status), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } catch (error) {
      if (error instanceof EmbeddingAgentError && error.statusCode === 0) {
        logger.warn('Embedding agent unavailable')

        if (isHealthCheck) {
          const mockHealth: HealthCheckResponse = {
            status: 'degraded',
            version: '1.0.0',
            modelLoaded: false,
            cacheAvailable: false,
            timestamp: new Date().toISOString(),
          }
          return new Response(JSON.stringify(mockHealth), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        } else {
          const mockStatus: EmbeddingAgentStatus = {
            status: 'unhealthy',
            modelLoaded: false,
            modelName: 'unavailable',
            embeddingDimension: 0,
            cacheSize: 0,
            knowledgeItemsCount: 0,
            gpuAvailable: false,
            uptimeSeconds: 0,
            requestsProcessed: 0,
            averageResponseTimeMs: 0,
          }
          return new Response(JSON.stringify(mockStatus), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }
      throw error
    }
  } catch (error) {
    logger.error('Status endpoint error:', error)

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
 * POST handler for administrative actions.
 */
export const POST: APIRoute = async ({ request }: APIContext) => {
  try {
    const session = await getSession(request)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check for admin role (optional - depends on your auth setup)
    // if (session.user.role !== 'admin') {
    //   return new Response(JSON.stringify({ error: 'Forbidden' }), {
    //     status: 403,
    //     headers: { 'Content-Type': 'application/json' },
    //   })
    // }

    let body: { action?: string } = {}
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

    const agentUrl = import.meta.env['EMBEDDING_AGENT_URL'] || 'http://localhost:8001'
    const client = createEmbeddingAgentClient(agentUrl)

    switch (body.action) {
      case 'clear_cache': {
        const result = await client.clearCache()
        logger.info('Cache cleared', { userId: session.user.id, result })
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      case 'load_knowledge': {
        const result = await client.loadKnowledge()
        logger.info('Knowledge loaded', { userId: session.user.id, result })
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      default:
        return new Response(
          JSON.stringify({
            error: 'Invalid action',
            message: 'Supported actions: clear_cache, load_knowledge',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
    }
  } catch (error) {
    logger.error('Status POST endpoint error:', error)

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

