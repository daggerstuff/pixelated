/**
 * Auth0-based Session Analysis API Endpoint
 * Handles session emotion analysis with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { getUserById } from '@/services/auth0.service'
import { AIRepository } from '@/lib/db/ai/repository'
import { MultidimensionalEmotionMapper } from '@/lib/ai/emotions/MultidimensionalEmotionMapper'
import { createAuditLog } from '@/lib/audit'

export const prerender = false

const logger = createBuildSafeLogger('auth0-session-analysis-api')

/**
 * API route to retrieve emotion analysis data for a therapy session
 * GET /api/auth/auth0-session-analysis
 *
 * Query parameters:
 * - sessionId: The ID of the session to get emotion data for (required)
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user from Auth0
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
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
      // Create audit log for forbidden access
      await createAuditLog(
        'access_denied',
        'auth.session.analysis.forbidden',
        user.id,
        'auth-session-analysis',
        { action: 'get_session_analysis', sessionId, reason: 'no_access_to_session' }
      )

      return new Response(
        JSON.stringify({ error: 'Access denied for this session' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
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
        }
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

    // Create audit log
    await createAuditLog(
      'session_analysis_access',
      'auth.session.analysis.access',
      user.id,
      'auth-session-analysis',
      { action: 'get_session_analysis', sessionId, count: emotionsWithDimensions.length }
    )

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

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.session.analysis.error',
      'anonymous',
      'auth-session-analysis',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? String(error) : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}