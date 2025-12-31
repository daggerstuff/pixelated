/**
 * Auth0-based Sessions API Endpoint
 * Handles therapy session operations with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { getUserById } from '@/services/auth0.service'
import { AIRepository } from '@/lib/db/ai/repository'
import type { TherapySession } from '@/lib/ai/interfaces/therapy'
import { createAuditLog } from '@/lib/audit'

export const prerender = false

const logger = createBuildSafeLogger('auth0-sessions-api')

// HTTP status codes
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
}

// Error messages
const ERROR_MESSAGES = {
  AUTHENTICATION_REQUIRED: 'Authentication required',
  INVALID_START_DATE: 'Invalid startDate format',
  INVALID_END_DATE: 'Invalid endDate format',
  INVALID_LIMIT: 'Invalid limit parameter',
  CLIENT_ACCESS_DENIED: 'Access denied for this client',
  INTERNAL_ERROR: 'Internal server error',
  USER_NOT_FOUND: 'User not found',
}

/**
 * API route to retrieve therapy sessions
 * GET /api/auth/auth0-sessions
 *
 * Query parameters:
 * - clientId: Filter sessions by client ID
 * - status: Filter sessions by status (e.g., 'completed', 'scheduled')
 * - startDate: Filter sessions starting on or after this date (ISO string)
 * - endDate: Filter sessions ending on or before this date (ISO string)
 * - limit: Maximum number of sessions to return (default: 50)
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.AUTHENTICATION_REQUIRED }),
        {
          status: HTTP_STATUS.UNAUTHORIZED,
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
          status: HTTP_STATUS.UNAUTHORIZED,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user from Auth0
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: ERROR_MESSAGES.USER_NOT_FOUND }), {
        status: HTTP_STATUS.UNAUTHORIZED,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId')
    const status = url.searchParams.get('status')
    const startDateParam = url.searchParams.get('startDate')
    const endDateParam = url.searchParams.get('endDate')
    const limitParam = url.searchParams.get('limit')

    // Parse and validate dates if provided
    let startDate: Date | undefined
    let endDate: Date | undefined

    if (startDateParam) {
      startDate = new Date(startDateParam)
      if (isNaN(startDate.getTime())) {
        return new Response(
          JSON.stringify({ error: ERROR_MESSAGES.INVALID_START_DATE }),
          {
            status: HTTP_STATUS.BAD_REQUEST,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    }

    if (endDateParam) {
      endDate = new Date(endDateParam)
      if (isNaN(endDate.getTime())) {
        return new Response(
          JSON.stringify({ error: ERROR_MESSAGES.INVALID_END_DATE }),
          {
            status: HTTP_STATUS.BAD_REQUEST,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Parse limit
    const limit = limitParam ? parseInt(limitParam, 10) : 50
    if (isNaN(limit) || limit <= 0) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.INVALID_LIMIT }),
        {
          status: HTTP_STATUS.BAD_REQUEST,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Initialize repository
    const repository = new AIRepository()

    // Build query filter
    const filter: {
      clientId?: string
      therapistId?: string
      startDate?: Date
      endDate?: Date
      status?: string
    } = {}

    if (clientId) {
      filter.clientId = clientId

      // Verify user has access to this client's data
      if (user.role !== 'admin' && user.id !== clientId) {
        // Check if user is the therapist for this client
        const isTherapist = await repository.isTherapistForClient(
          user.id,
          clientId,
        )
        if (!isTherapist) {
          // Create audit log for forbidden access
          await createAuditLog(
            'access_denied',
            'auth.sessions.forbidden',
            user.id,
            'auth-sessions',
            { action: 'get_sessions', clientId, reason: 'no_access_to_client' }
          )

          return new Response(
            JSON.stringify({ error: ERROR_MESSAGES.CLIENT_ACCESS_DENIED }),
            {
              status: HTTP_STATUS.FORBIDDEN,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }
      }
    } else if (user.role !== 'admin') {
      // If no client specified and not admin, default to sessions where user is therapist
      filter.therapistId = user.id
    }

    // Add other filters
    if (status) {
      filter.status = status
    }
    if (startDate) {
      filter.startDate = startDate
    }
    if (endDate) {
      filter.endDate = endDate
    }

    // Get sessions
    const sessions: TherapySession[] = await repository.getSessions(filter)

    // Apply limit
    const limitedSessions = sessions.slice(0, limit)

    // Create audit log
    await createAuditLog(
      'sessions_access',
      'auth.sessions.access',
      user.id,
      'auth-sessions',
      { action: 'get_sessions', count: limitedSessions.length, filter }
    )

    logger.info('Returning sessions', {
      userId: user.id,
      filter,
      count: limitedSessions.length,
    })

    return new Response(JSON.stringify(limitedSessions), {
      status: HTTP_STATUS.OK,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    logger.error('Error processing sessions request', {
      error: error instanceof Error ? String(error) : 'Unknown error',
    })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.sessions.error',
      'anonymous',
      'auth-sessions',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        message: error instanceof Error ? String(error) : 'Unknown error',
      }),
      {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}