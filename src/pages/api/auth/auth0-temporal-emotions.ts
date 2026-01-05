/**
 * Auth0-based Temporal Emotions API Endpoint
 * Handles temporal emotion analysis with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { getUserById } from '@/services/auth0.service'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { AIRepository } from '@/lib/db/ai/repository'
import {
  EmotionTemporalAnalyzer,
  type EmotionAnalysisResult,
  type EmotionTrendline,
  type EmotionData,
  type EmotionProgression,
  type EmotionCorrelation,
} from '@/lib/ai/temporal/EmotionTemporalAnalyzer'
import { createAuditLog } from '@/lib/audit'

export const prerender = false

const logger = createBuildSafeLogger('auth0-temporal-emotions-api')

/**
 * API route to retrieve temporal emotion analysis for a user's sessions
 * GET /api/auth/auth0-temporal-emotions/:sessionId
 *
 * Optional query parameters:
 * - includePatterns: Whether to include pattern detection (default: false)
 * - timeWindow: Time window to analyze (in days, default: 90)
 * - emotionTypes: Comma-separated list of emotions to include
 * - analysisType: Type of analysis to perform (default: 'full')
 *   Options: 'full', 'trends', 'critical', 'progression', 'transitions', 'relationships'
 */
export const GET: APIRoute = async ({ params, request }): Promise<Response> => {
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

    const sessionId = params['sessionId']

    // Validate session ID
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Missing session ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const includePatterns = url.searchParams.get('includePatterns') === 'true'
    const timeWindow = parseInt(url.searchParams.get('timeWindow') || '90', 10)
    const emotionTypes = url.searchParams.get('emotionTypes')?.split(',') || []
    const analysisType = url.searchParams.get('analysisType') || 'full'

    // Validate time window (between 1 and 365 days)
    const validTimeWindow = Math.min(Math.max(timeWindow, 1), 365)

    // Calculate time range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - validTimeWindow)

    // Initialize services
    const repository = new AIRepository()
    const analyzer = new EmotionTemporalAnalyzer(repository)

    // Get client ID (using user ID if not specified)
    const clientId = user.id

    // Perform analysis based on requested type
    let result:
      | {
          trendlines: EmotionTrendline[] | undefined
          volatility: number | undefined
        }
      | EmotionAnalysisResult
      | EmotionData[]
      | EmotionProgression
      | EmotionCorrelation[]
      | undefined = undefined

    switch (analysisType) {
      case 'trends': {
        // Only analyze emotion trends
        const sessions = await analyzer.analyzeSessionEmotions([sessionId], {
          timeRange: { startDate, endDate },
          filter: {
            emotionTypes: emotionTypes.length > 0 ? emotionTypes : undefined,
          },
          config: { detectPatterns: false, includeDimensionalAnalysis: false },
        })

        result = {
          trendlines: sessions.trendlines,
          volatility: sessions.volatility,
        }
        break
      }

      case 'emotions': {
        // Analyze emotions with full configuration
        const sessions = await analyzer.analyzeSessionEmotions([sessionId], {
          timeRange: { startDate, endDate },
          config: {
            includeDimensionalAnalysis: true,
            detectPatterns: true,
          },
        })

        result = sessions
        break
      }

      case 'critical': {
        // Get critical emotional points
        const criticalPoints = await analyzer.getCriticalEmotionalMoments(
          clientId,
          {
            emotionTypes: emotionTypes.length > 0 ? emotionTypes : undefined,
          },
        )

        result = criticalPoints
        break
      }

      case 'progression': {
        // Get progression metrics using the time range
        const progression = await analyzer.calculateEmotionProgression(
          clientId,
          startDate,
          endDate,
        )

        result = progression
        break
      }

      case 'transitions': {
        // Get emotional transitions
        const transitions = await analyzer.analyzeSessionEmotions([sessionId], {
          timeRange: { startDate, endDate },
          config: {
            includeDimensionalAnalysis: true,
          },
        })

        result = transitions
        break
      }

      case 'relationships': {
        // Get emotion relationships
        const relationships = await analyzer.findEmotionCorrelations(clientId)

        result = relationships
        break
      }

      case 'full':
      default: {
        // Perform full analysis
        result = await analyzer.analyzeSessionEmotions([sessionId], {
          timeRange: { startDate, endDate },
          filter: {
            emotionTypes: emotionTypes.length > 0 ? emotionTypes : undefined,
          },
          config: {
            detectPatterns: includePatterns,
            includeDimensionalAnalysis: true,
          },
        })
      }
    }

    // Create audit log
    await createAuditLog(
      'temporal_emotions_access',
      'auth.temporal.emotions.access',
      user.id,
      'auth-temporal-emotions',
      {
        action: 'get_temporal_emotions',
        sessionId,
        analysisType,
        timeWindow: validTimeWindow
      }
    )

    // Log API access
    logger.info('Temporal emotion analysis accessed', {
      userId: user.id,
      sessionId,
      analysisType,
      timeWindow: validTimeWindow,
    })

    // Return analysis result
    return new Response(
      JSON.stringify({
        success: true,
        analysisType,
        timeWindow: validTimeWindow,
        data: result,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    logger.error('Error retrieving temporal emotion analysis', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.temporal.emotions.error',
      'anonymous',
      'auth-temporal-emotions',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({ error: 'Failed to retrieve temporal emotion analysis' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}