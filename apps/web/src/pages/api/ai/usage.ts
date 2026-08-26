import type { APIRoute } from 'astro'

import { getAIUsageStats } from '@/lib/ai/analytics'
import { handleApiError } from '@/lib/ai/error-handling'
import { createAuditLog, AuditEventType, AuditEventStatus } from '@/lib/audit'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import { getSession } from '../../../lib/auth/session'
import { RateLimiter } from '../../../lib/middleware/rate-limit'
import { validateQueryParams } from '../../../lib/validation/index'
import { UsageStatsRequestSchema } from '../../../lib/validation/schemas'

// Initialize logger
const logger = createBuildSafeLogger('default')

// Initialize rate limiter
const rateLimiter = new RateLimiter(30)

/**
 * API route for AI usage statistics
 * Secured by authentication and input validation
 * Rate limited to prevent abuse
 */
export const GET: APIRoute = async ({ request }) => {
  interface UserSession {
    user?: {
      id?: string
      role?: string
    }
  }
  let session: UserSession | null = null
  let userId = 'anonymous'

  try {
    // Verify session
    session = await getSession(request)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    // Apply rate limiting based on user role
    const currentUserId = session.user.id
    const role = session.user.role ?? 'user'
    if (!currentUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    userId = currentUserId
    const { allowed, limit, remaining, reset } = rateLimiter.check(
      `${userId}:/api/ai/usage`,
      role,
      {
        admin: 60,
        therapist: 40,
        user: 20,
        anonymous: 5,
      },
      60 * 1000,
    )

    if (!allowed) {
      logger.warn('Rate limit exceeded for AI usage stats', {
        userId,
        role,
      })

      return new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        },
      )
    }

    // Check if user has admin access for all users data
    const isAdmin = role === 'admin'

    // Validate query parameters
    let params: {
      period?: string
      allUsers?: string
      startDate?: string
      endDate?: string
    } = {}

    try {
      const url = new URL(request.url)
      const queryParams: Record<string, string> = {}
      url.searchParams.forEach((value, key) => {
        queryParams[key] = value
      })
      params = validateQueryParams(UsageStatsRequestSchema, queryParams) as unknown as typeof params
    } catch (err: unknown) {
      const error = err as { message?: string; errors?: Record<string, string>; details?: Record<string, string>; status?: number }
      // Create audit log for validation error
      await createAuditLog(
        AuditEventType.AI_OPERATION,
        'ai.usage.validation_error',
        userId,
        'ai_usage',
        {
          error: error.message ?? 'Validation failed',
          details: JSON.stringify(error.errors ?? error.details ?? {}),
          status: 'error',
        },
        AuditEventStatus.FAILURE,
      )

      return new Response(JSON.stringify({ error: error.message ?? 'Validation failed', details: error.errors ?? error.details ?? {} }), {
        status: error.status ?? 400,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    // Only allow admins to view all users' data
    if (params.allUsers && !isAdmin) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to view all users data',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Create audit log for the request
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.usage.request',
      userId,
      'ai_usage',
      {
        period: params.period,
        allUsers: params.allUsers,
        startDate: params.startDate,
        endDate: params.endDate,
        status: 'success',
      },
      AuditEventStatus.SUCCESS,
    )

    // Get usage statistics
    const statsOptions: {
      period: string
      startDate?: Date
      endDate?: Date
      userId?: string
    } = {
      period: params.period as string,
    }

    if (params.startDate) {
      statsOptions.startDate = new Date(params.startDate)
    }

    if (params.endDate) {
      statsOptions.endDate = new Date(params.endDate)
    }

    if (!params.allUsers) {
      statsOptions.userId = userId
    }

    const stats = await getAIUsageStats(statsOptions)

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60',
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(reset),
      },
    })
  } catch (error: unknown) {
    console.error('Error in AI usage API:', error)

    // Create audit log for the error
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.usage.error',
      userId ?? 'anonymous',
      'ai_usage',
      {
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined,
        status: 'error',
      },
      AuditEventStatus.FAILURE,
    )

    // Use standardized error handling
    return handleApiError(error)
  }
}
