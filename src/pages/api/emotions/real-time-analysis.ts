import type { APIRoute, APIContext } from 'astro'
import { MultidimensionalEmotionMapper } from '../../../lib/ai/emotions/MultidimensionalEmotionMapper'
import { createBuildSafeLogger } from '../../../lib/logging/build-safe-logger'
import { trackApiRequest, trackApiError } from '@/lib/sentry/api-metrics'
import { emotionMetrics } from '@/lib/sentry/utils'

const logger = createBuildSafeLogger('emotion-analysis-api')
const emotionMapper = new MultidimensionalEmotionMapper()

interface EmotionAnalysisRequest {
  text: string
  sessionId?: string
  includeHistory?: boolean
  analysisDepth?: 'basic' | 'detailed' | 'comprehensive'
}

interface EmotionAnalysisResponse {
  success: boolean
  analysis: {
    primary: string
    secondary: string[]
    confidence: number
    valence: number
    arousal: number
    dominance: number
    dimensions: Record<string, number>
    metadata: {
      processingTime: number
      timestamp: number
      sessionId?: string
    }
  }
  error?: string
}

export const POST: APIRoute = async ({ request, cookies }: APIContext) => {
  const startTime = Date.now()
  const endpoint = '/api/emotions/real-time-analysis'

  try {
    // Authenticate request
    const sessionCookie = cookies.get('session')
    if (!sessionCookie) {
      trackApiRequest(endpoint, 'POST', 401, Date.now() - startTime)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const body = (await request.json()) as EmotionAnalysisRequest
    const {
      text,
      sessionId,
      includeHistory = false,
      analysisDepth = 'detailed',
    } = body

    // Validate input
    if (!text || text.trim().length === 0) {
      trackApiRequest(endpoint, 'POST', 400, Date.now() - startTime)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Text input is required for emotion analysis',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Perform emotion analysis
    const analysisStartTime = Date.now()
    const emotionResult = await emotionMapper.analyzeText(text, {
      depth: analysisDepth,
      includeHistory,
      sessionId,
    })
    const analysisDurationMs = Date.now() - analysisStartTime

    // Format response according to API specification
    const response: EmotionAnalysisResponse = {
      success: true,
      analysis: {
        primary: emotionResult.primary,
        secondary: emotionResult.secondary || [],
        confidence: emotionResult.confidence,
        valence: emotionResult.dimensions.valence,
        arousal: emotionResult.dimensions.arousal,
        dominance: emotionResult.dimensions.dominance,
        dimensions: emotionResult.dimensions,
        metadata: {
          processingTime: Date.now() - startTime,
          timestamp: Date.now(),
          sessionId: sessionId || emotionResult.sessionId,
        },
      },
    }

    const totalDurationMs = Date.now() - startTime

    // Track metrics
    trackApiRequest(endpoint, 'POST', 200, totalDurationMs)
    emotionMetrics.analysisPerformed({
      model: 'multidimensional-emotion-mapper',
      sessionType: sessionId ? 'session' : 'standalone',
      success: true,
    })
    emotionMetrics.analysisLatency(analysisDurationMs, 'multidimensional-emotion-mapper')

    logger.info('Emotion analysis completed successfully', {
      sessionId,
      textLength: text.length,
      primaryEmotion: emotionResult.primary,
      confidence: emotionResult.confidence,
      processingTime: totalDurationMs,
    })

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Processing-Time': (Date.now() - startTime).toString(),
      },
    })
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError'

    // Track error metrics
    trackApiError(endpoint, errorType, 'POST')
    emotionMetrics.analysisPerformed({
      model: 'multidimensional-emotion-mapper',
      sessionType: 'unknown',
      success: false,
    })

    logger.error('Emotion analysis error:', {
      message: error instanceof Error ? String(error) : String(error),
      processingTime: durationMs,
    })

    const errorResponse: EmotionAnalysisResponse = {
      success: false,
      analysis: {
        primary: 'unknown',
        secondary: [],
        confidence: 0,
        valence: 0,
        arousal: 0,
        dominance: 0,
        dimensions: {},
        metadata: {
          processingTime: Date.now() - startTime,
          timestamp: Date.now(),
        },
      },
      error: 'Failed to analyze emotions',
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
