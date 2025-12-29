// import type { APIRoute } from 'astro'
import { createPatternRecognitionService } from '@/lib/ai/services/PatternRecognitionFactory'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { getCurrentUser } from '@/lib/auth'
import type { TherapySession } from '@/lib/ai/AIService'

// Get logger instance
const logger = createBuildSafeLogger('api-pattern-cross-session')

/**
 * API endpoint for retrieving cross-session patterns
 *
 * This API endpoint allows clients to retrieve patterns that appear across multiple
 * therapy sessions for a specific client. It uses the PatternRecognitionService with
 * real FHE capabilities to analyze patterns securely.
 */
export const POST = async ({ request, cookies }) => {
  try {
    // Authenticate request
    const user = await getCurrentUser(cookies)
    if (!user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'You must be authenticated to access this endpoint',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse request body
    let requestBody
    try {
      requestBody = await request.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Extract data from request
    const { clientId, sessions } = requestBody

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

    if (!sessions || !Array.isArray(sessions) || sessions.length < 2) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'At least two valid sessions are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Validate each session
    const validSessions: TherapySession[] = []
    for (const session of sessions) {
      if (
        !session.sessionId ||
        !session.clientId ||
        !session.startTime ||
        !session.endTime
      ) {
        logger.warn('Invalid session provided', { session })
        continue
      }

      // Format dates properly
      try {
        validSessions.push({
          ...session,
          startTime: new Date(session.startTime),
          endTime: new Date(session.endTime),
        })
      } catch (error: unknown) {
        logger.warn('Invalid date format in session', { session, error })
      }
    }

    if (validSessions.length < 2) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'At least two valid sessions are required',
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

    logger.info('Processing cross-session pattern request', {
      clientId,
      sessionCount: validSessions.length,
      user: user.id,
    })

    // Create the pattern recognition service
    const patternService = await createPatternRecognitionService()

    // Detect cross-session patterns
    const patterns = await patternService.detectCrossSessionPatterns(
      clientId,
      validSessions,
    )

    logger.info('Successfully retrieved cross-session patterns', {
      clientId,
      patternCount: patterns.length,
    })

    // Return the results
    return new Response(
      JSON.stringify({
        clientId,
        sessions: validSessions.map((s) => s.sessionId),
        patterns,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    // Log the error
    logger.error('Error processing cross-session pattern request', { error })

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
