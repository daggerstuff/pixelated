export const prerender = false

import type { APIRoute, APIContext } from 'astro'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { protectRoute } from '../../../lib/auth/serverAuth'

const logger = createBuildSafeLogger('real-time-analysis-api')
const METRICS_API_KEY = process.env['METRICS_API_KEY'] || ''

// Placeholder AI Service until proper implementation
interface EmotionAnalysisResult {
  emotions: {
    primary: string
    secondary: string[]
    intensity: number
    confidence: number
  }
  sentiment: {
    polarity: number
    subjectivity: number
  }
  riskFactors: string[]
  recommendations: string[]
}

class PlaceholderAIService {
  async analyzeEmotionsRealTime(
    _text: string,
    _options: { userId: string; context: unknown },
  ): Promise<EmotionAnalysisResult> {
    // Placeholder implementation
    await new Promise((resolve) => setTimeout(resolve, 100)) // Simulate processing

    return {
      emotions: {
        primary: 'neutral',
        secondary: ['calm'],
        intensity: 0.5,
        confidence: 0.8,
      },
      sentiment: {
        polarity: 0.0,
        subjectivity: 0.5,
      },
      riskFactors: [],
      recommendations: ['Continue monitoring emotional state'],
    }
  }

  getEmotionEngine() {
    return {
      getCacheMetrics: () => ({
        hitRate: 0.85,
        size: 1000,
        maxSize: 10000,
      }),
      getDynamicProcessingStatus: () => ({
        isProcessing: false,
        queueLength: 0,
        averageProcessingTime: 150,
      }),
    }
  }
}

function getAIService(): PlaceholderAIService {
  return new PlaceholderAIService()
}

/**
 * Handler for real-time emotion analysis API requests
 *
 * @example
 * POST /api/emotions/real-time-analysis
 * {
 *   "text": "I'm feeling excited about this new feature!",
 *   "userId": "user-123" // Optional
 * }
 */
const handler: APIRoute = async ({ request }: APIContext) => {
  // Only allow POST method
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Get or create the AI service
    const aiService = getAIService()

    // Extract request data
    const body = await request.json()
    const { text, userId, context } = body

    // Validate input
    if (!text || typeof text !== 'string') {
      logger.warn('Invalid input: missing or non-string text', {
        userId,
        context,
      })
      return new Response(
        JSON.stringify({
          error: 'Text is required',
          code: 'ERR_TEXT_REQUIRED',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    if (text.length > 5000) {
      logger.warn('Input text too long', { userId, length: text.length })
      return new Response(
        JSON.stringify({
          error: 'Text exceeds maximum length of 5000 characters',
          code: 'ERR_TEXT_TOO_LONG',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Log the request (without the full text for privacy)
    logger.info('Processing real-time emotion analysis request', {
      textLength: text.length,
      userId: userId || 'anonymous',
      hasContext: !!context,
    })

    // Process the request with optimized real-time emotion analysis
    const result = await aiService.analyzeEmotionsRealTime(text, {
      userId: userId || 'anonymous',
      context: context || {},
    })

    // Return the analysis result
    return new Response(
      JSON.stringify({
        success: true,
        analysis: result,
        processingTimeMs:
          Date.now() -
          (parseInt(request.headers.get('x-request-start') || '0', 10) ||
            Date.now()),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    logger.error('Error processing real-time emotion analysis', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      userId: (await request.json().catch(() => ({}))).userId || 'anonymous',
    })

    let code = 'ERR_UNKNOWN'
    let message = 'Failed to process emotion analysis'

    if (error instanceof Error) {
      if (error.message.includes('prompt injection')) {
        code = 'ERR_PROMPT_INJECTION'
        message = 'Unsafe input detected: possible prompt injection'
      } else if (error.message.includes('maximum allowed length')) {
        code = 'ERR_TEXT_TOO_LONG'
        message = error.message
      } else if (error.message.includes('required API credentials')) {
        code = 'ERR_API_CREDENTIALS'
        message = 'Server misconfiguration: missing API credentials'
      }
    }

    return new Response(
      JSON.stringify({
        error: message,
        code,
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

// Apply authentication protection
export const POST = protectRoute({ requiredRole: 'user' })(handler)

/**
 * GET /api/emotions/real-time-analysis/metrics
 * Returns cache and processing metrics for observability.
 * Requires x-api-key header matching METRICS_API_KEY.
 */
export const GET: APIRoute = async ({ request }: APIContext) => {
  if (request.headers.get('x-api-key') !== METRICS_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Forbidden', code: 'ERR_FORBIDDEN' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  try {
    const aiService = getAIService()
    const engine = aiService.getEmotionEngine()
    const cacheMetrics = engine.getCacheMetrics()
    const processingStatus = engine.getDynamicProcessingStatus()

    return new Response(
      JSON.stringify({
        cache: cacheMetrics,
        processing: processingStatus,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    logger.error('Error fetching metrics', { error })
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch metrics',
        code: 'ERR_METRICS',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
