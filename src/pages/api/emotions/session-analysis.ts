import type { APIRoute } from 'astro'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { protectRoute } from '@/lib/auth/serverAuth'
import { AIRepository } from '@/lib/db/ai/repository'
import { MultidimensionalEmotionMapper } from '@/lib/ai/emotions/MultidimensionalEmotionMapper'

export const prerender = false

const logger = createBuildSafeLogger('session-analysis-api')

/**
 * API route to retrieve emotion analysis data for a therapy session
 * GET /api/emotions/session-analysis
 *
 * Query parameters:
 * - sessionId: The ID of the session to get emotion data for (required)
 *
 * NOTE: The { locals, request } destructuring works due to a workaround for
 * Astro 5.x type inheritance bug. See /docs/ASTRO_TYPE_INHERITANCE_BUG.md
 */
export const GET: APIRoute = protectRoute()(async ({ locals, request }) => {
  try {
    const { user } = locals
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse query parameters
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')

    // Validate parameters
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Initialize repository and mapper
    const repository = new AIRepository()
    const emotionMapper = new MultidimensionalEmotionMapper()

    // Get the session to verify access
    const sessions = await repository.getSessionsByIds([sessionId])

    if (sessions.length === 0) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verify the user has access to this session
    const session = sessions[0]
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (session.therapistId !== user.id && session.clientId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Access denied for this session' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get emotion data for the session
    const emotions = await repository.getEmotionsForSession(sessionId)

    if (emotions.length === 0) {
      return new Response(
        JSON.stringify([]), // Return empty array instead of error
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Sort by timestamp
    emotions.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

    // Enrich with dimensional mappings
    const emotionsWithDimensions = emotions.map((emotion) => {
      const dimensions = emotionMapper.mapEmotionsToDimensions(emotion)
      return {
        ...emotion,
        dimensions: dimensions.dimensions,
        primaryEmotion: dimensions.primaryEmotion,
        intensity: dimensions.intensity,
      }
    })

    logger.info('Returning session emotion data', {
      sessionId,
      count: emotionsWithDimensions.length,
    })

    return new Response(JSON.stringify(emotionsWithDimensions), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    logger.error('Error processing session emotion data request', { error })

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? String(error) : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})
