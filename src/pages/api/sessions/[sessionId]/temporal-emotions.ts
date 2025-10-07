export const prerender = false

// import type { APIRoute } from 'astro'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { protectRoute } from '@/lib/auth/serverAuth'
import { AIRepository } from '@/lib/db/ai/repository'
import type { AuthUser } from '@/lib/auth/types'
import { 
  EmotionTemporalAnalyzer, 
  type EmotionAnalysisResult,
  type EmotionTrendline,
  type EmotionData,
  type EmotionProgression,
  type EmotionCorrelation
} from '@/lib/ai/temporal/EmotionTemporalAnalyzer'

const logger = createBuildSafeLogger('temporal-emotions-api')

/**
 * API route to retrieve temporal emotion analysis for a user's sessions
 * GET /api/sessions/:sessionId/temporal-emotions
 *
 * Optional query parameters:
 * - includePatterns: Whether to include pattern detection (default: false)
 * - timeWindow: Time window to analyze (in days, default: 90)
 * - emotionTypes: Comma-separated list of emotions to include
 * - analysisType: Type of analysis to perform (default: 'full')
 *   Options: 'full', 'trends', 'critical', 'progression', 'transitions', 'relationships'
 */
export const GET = protectRoute({
  requiredRole: 'user',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({
  params,
  request,
  locals,
}: {
  params: Record<string, string | undefined>
  request: Request
  locals: { user: AuthUser }
}): Promise<Response> => {
  try {
    const { user } = locals
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
      | { trendlines: EmotionTrendline[] | undefined; volatility: number | undefined }
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

    return new Response(
      JSON.stringify({ error: 'Failed to retrieve temporal emotion analysis' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
