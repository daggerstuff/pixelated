/**
 * Auth0-based Risk Correlations API Endpoint
 * Handles risk factor correlation analysis with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { getUserById } from '@/services/auth0.service'
import { createPatternRecognitionService } from '@/lib/ai/services/PatternRecognitionFactory'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { createAuditLog } from '@/lib/audit'
import type { EmotionAnalysis } from '@/lib/ai/emotions/types'

// Define the ExtendedEmotionAnalysis interface that includes sessionId
interface ExtendedEmotionAnalysis extends EmotionAnalysis {
  sessionId: string
  analysisId: string
  clientId: string
}

// Get logger instance
const logger = createBuildSafeLogger('auth0-api-pattern-risk')

/**
 * API endpoint for retrieving risk factor correlations
 *
 * This API endpoint allows clients to retrieve risk factor correlations for a specific
 * client based on emotion analyses. It uses the PatternRecognitionService with real FHE
 * capabilities to analyze correlations securely.
 */
export const POST: APIRoute = async ({ request }) => {
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

    // Parse request body
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error: unknown) {
      logger.warn('Failed to parse request body', { error })

      // Create audit log for the error
      await createAuditLog(
        'system_error',
        'auth.pattern.risk.correlations.error',
        user.id,
        'auth-pattern-risk',
        {
          error: 'Failed to parse request body',
          details: error instanceof Error ? error.message : String(error),
        }
      )

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
      } catch (error: unknown) {
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
      // Create audit log for forbidden access
      await createAuditLog(
        'access_denied',
        'auth.pattern.risk.correlations.forbidden',
        user.id,
        'auth-pattern-risk',
        {
          action: 'analyze_risk_correlations',
          clientId,
          reason: 'no_access_to_client'
        }
      )

      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have access to this client',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Create audit log
    await createAuditLog(
      'risk_correlations_analysis',
      'auth.pattern.risk.correlations.access',
      user.id,
      'auth-pattern-risk',
      {
        action: 'analyze_risk_correlations',
        clientId,
        analysesCount: validAnalyses.length
      }
    )

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
  } catch (error: unknown) {
    // Log the error
    logger.error('Error processing risk correlation request', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.pattern.risk.correlations.error',
      'anonymous',
      'auth-pattern-risk',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    // Return an error response
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message:
          error instanceof Error
            ? String(error)
            : 'An unexpected error occurred',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}