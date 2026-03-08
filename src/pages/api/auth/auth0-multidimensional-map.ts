/**
 * Auth0-based Multidimensional Emotion Map API Endpoint
 * Handles multidimensional emotion analysis with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { getUserById } from '@/services/auth0.service'
import { AIRepository } from '@/lib/db/ai/repository'
import { MultidimensionalEmotionMapper } from '@/lib/ai/emotions/MultidimensionalEmotionMapper'
import { analyzeMultidimensionalPatterns } from '@/lib/ai/temporal/TemporalAnalysisAlgorithm'
import type { EmotionAnalysis as TypesEmotionAnalysis } from '@/lib/ai/emotions/types'
import { createAuditLog } from '@/lib/audit'

export const prerender = false

const logger = createBuildSafeLogger('auth0-multidimensional-emotions-api')

/**
 * API route to retrieve multidimensional emotion maps or patterns
 * GET /api/auth/auth0-multidimensional-map
 *
 * Query parameters:
 * - clientId: Client ID (required if sessionId not provided)
 * - sessionId: Session ID (required if clientId not provided)
 * - type: 'map' or 'patterns' (default: 'map')
 * - timeRange: Time range in days (default: 30)
 * - dataPoints: Number of data points to return (default: 100)
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
    const clientId = url.searchParams.get('clientId')
    const sessionId = url.searchParams.get('sessionId')
    const type = url.searchParams.get('type') || 'map'
    const timeRange = parseInt(url.searchParams.get('timeRange') || '30', 10)
    const dataPoints = parseInt(url.searchParams.get('dataPoints') || '100', 10)

    // Validate parameters
    if (!clientId && !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Either clientId or sessionId is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Initialize repository and mapper
    const repository = new AIRepository()
    const emotionMapper = new MultidimensionalEmotionMapper()

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - timeRange)

    let fetchedSessions: Array<{ sessionId?: string }> = []

    // Get sessions based on provided parameters
    if (sessionId) {
      // Fetch specific session
      fetchedSessions = await repository.getSessionsByIds([sessionId])
    } else if (clientId) {
      // Fetch client sessions within time range
      fetchedSessions = await repository.getSessions({
        clientId,
        startDate,
        endDate,
      })
    }

    const sessions = fetchedSessions.filter(
      (s): s is { sessionId: string } => !!s.sessionId,
    )

    if (sessions.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No sessions found for the specified criteria',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Get emotion data for all sessions
    const emotionData: Array<TypesEmotionAnalysis> = []

    for (const session of sessions) {
      const emotionsFromRepo = await repository.getEmotionsForSession(
        session.sessionId,
      )
      const emotionsForDTO = emotionsFromRepo.map(
        (e) =>
          ({
            ...e,
            timestamp: e.timestamp,
          }) as TypesEmotionAnalysis,
      )
      emotionData.push(...emotionsForDTO)
    }

    // Apply data point limit if needed
    let limitedEmotionData = emotionData
    if (emotionData.length > dataPoints) {
      // Sample data points evenly
      const interval = Math.floor(emotionData.length / dataPoints)
      limitedEmotionData = emotionData
        .filter((_, index) => index % interval === 0)
        .slice(0, dataPoints)
    }

    // Sort by timestamp
    limitedEmotionData.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

    // Process based on requested type
    if (type === 'map') {
      // Map emotions to dimensions
      const dimensionalMaps = limitedEmotionData.map((emotion) =>
        emotionMapper.mapEmotionsToDimensions(emotion as TypesEmotionAnalysis),
      )

      // Create audit log
      await createAuditLog(
        'emotion_map_access',
        'auth.emotions.map.access',
        user.id,
        'auth-emotions',
        { action: 'get_emotion_map', count: dimensionalMaps.length }
      )

      logger.info('Returning dimensional maps', {
        count: dimensionalMaps.length,
      })
      return new Response(JSON.stringify(dimensionalMaps), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } else if (type === 'patterns') {
      // Get multidimensional patterns
      // First create dimensional maps
      const dimensionalMaps = limitedEmotionData.map((emotion) =>
        emotionMapper.mapEmotionsToDimensions(emotion as TypesEmotionAnalysis),
      )

      // Analyze multidimensional patterns
      const patterns = analyzeMultidimensionalPatterns(
        limitedEmotionData as TypesEmotionAnalysis[],
        dimensionalMaps,
      )

      // Create audit log
      await createAuditLog(
        'emotion_patterns_access',
        'auth.emotions.patterns.access',
        user.id,
        'auth-emotions',
        { action: 'get_emotion_patterns', count: patterns.length }
      )

      logger.info('Returning multidimensional patterns', {
        count: patterns.length,
      })
      return new Response(JSON.stringify(patterns), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } else {
      return new Response(
        JSON.stringify({
          error: 'Invalid type parameter. Must be "map" or "patterns"',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (error: unknown) {
    logger.error('Error processing multidimensional emotion request', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.emotions.error',
      'anonymous',
      'auth-emotions',
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