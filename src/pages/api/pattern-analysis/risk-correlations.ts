import type { APIRoute } from 'astro'
import { createPatternRecognitionService } from '@/lib/ai/services/PatternRecognitionFactory'
import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
import { protectRoute } from '@/lib/auth/serverAuth'
import type { EmotionAnalysis } from '@/lib/ai/emotions/types'

// Define the ExtendedEmotionAnalysis interface that includes sessionId
interface ExtendedEmotionAnalysis extends EmotionAnalysis {
  sessionId: string
  analysisId: string
  clientId: string
}

// Get logger instance
const logger = createBuildSafeLogger('api-pattern-risk')

/**
 * API endpoint for retrieving risk factor correlations
 *
 * This API endpoint allows clients to retrieve risk factor correlations for a specific
 * client based on emotion analyses. It uses the PatternRecognitionService with real FHE
 * capabilities to analyze correlations securely.
 */
export const POST = protectRoute({})(async ({ request, locals }) => {
  try {
    const { user } = locals

    // Authentication is now handled by protectRoute middleware

    // Parse request body
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error) {
      logger.warn('Failed to parse request body', { error })
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Extract data from request
    const { clientId, analyses } = requestBody

    // Validate required parameters
    if (!clientId) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Client ID is required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (!analyses || !Array.isArray(analyses) || analyses.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Valid emotion analyses are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Validate each analysis
    const validAnalyses: ExtendedEmotionAnalysis[] = []
    for (const analysis of analyses) {
      if (
        !analysis.analysisId ||
        !analysis.sessionId ||
        !analysis.clientId ||
        !analysis.timestamp
      ) {
        logger.warn('Invalid analysis provided', { analysis })
        continue
      }

      // Format dates properly
      try {
        validAnalyses.push({
          ...analysis,
          timestamp: new Date(analysis.timestamp),
        } as ExtendedEmotionAnalysis)
      } catch (error) {
        logger.warn('Invalid date format in analysis', { analysis, error })
      }
    }

    if (validAnalyses.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'At least one valid emotion analysis is required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Check authorization to access the client data
    const isTherapist = user.role === 'therapist'
    const isAdmin = user.role === 'admin'

    if (!isAdmin && isTherapist && user.id !== clientId) {
      // Therapists can only access their own clients
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have access to this client',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    logger.info('Processing risk correlation request', {
      clientId,
      analysesCount: validAnalyses.length,
      user: user.id,
    })

    // Create the pattern recognition service
    const patternService = await createPatternRecognitionService()

    // Analyze risk factor correlations
    const correlations = await patternService.analyzeRiskFactorCorrelations(
      clientId,
      validAnalyses,
    )

    logger.info('Successfully retrieved risk correlations', {
      clientId,
      correlationCount: correlations.length,
    })

    // Return the results
    return new Response(
      JSON.stringify({
        clientId,
        analyses: validAnalyses.map((a) => a.analysisId),
        correlations,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    // Log the error
    logger.error('Error processing risk correlation request', { error })

    // Return an error response
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
