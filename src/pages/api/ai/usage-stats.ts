import type { APIRoute } from 'astro'
import { requirePermission } from '../../../lib/access-control'
import { getAIUsageStats } from '../../../lib/ai/analytics'
import { handleApiError } from '../../../lib/ai/error-handling'
import {
  createAuditLog,
  AuditEventType,
  AuditEventStatus,
} from '../../../lib/audit'
import { getSession } from '../../../lib/auth/session'

// Local Session interface - getSession returns null in this codebase
interface Session {
  user?: {
    id: string
    email?: string
    role?: string
    name?: string
  }
  session?: {
    sessionId?: string
  }
  expires?: string
}

/**
 * API route for AI usage statistics
 */
export const GET: APIRoute = async ({ request, cookies, url }) => {
  let session: Session | null = null

  try {
    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing url' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    if (!cookies) {
      return new Response(JSON.stringify({ error: 'Missing cookies' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    // Verify session and permissions
    session = await getSession()
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    // Check if user has admin permission
    const checkPermission = requirePermission('read:admin')
    const permissionResponse = await checkPermission({
      cookies,
      redirect: () => new Response(null, { status: 401 }),
    })

    if (permissionResponse) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    // Get query parameters
    const period = url.searchParams.get('period') || 'daily'
    const allUsers = url.searchParams.get('allUsers') === 'true'
    const userId = allUsers ? undefined : session?.user?.id

    // Create audit log for the request
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.stats.request',
      session?.user?.id || 'anonymous',
      'ai',
      {
        period,
        allUsers,
        status: 'success',
      },
      AuditEventStatus.SUCCESS,
    )

    // Get usage statistics
    const stats = await getAIUsageStats({
      period: period as 'daily' | 'weekly' | 'monthly',
      userId,
    })

    // Create audit log for the response
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.stats.response',
      session?.user?.id || 'anonymous',
      'ai',
      {
        period,
        allUsers,
        statsCount: Array.isArray(stats) ? stats.length : 0,
        status: 'success',
      },
      AuditEventStatus.SUCCESS,
    )

    return new Response(JSON.stringify({ stats }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60', // Cache for 1 minute
      },
    })
  } catch (error: unknown) {
    console.error('Error in AI usage stats API:', error)

    // Create audit log for the error
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.stats.error',
      session?.user?.id || 'anonymous',
      'ai',
      {
        error: error instanceof Error ? error?.message : String(error),
        stack: error instanceof Error ? error?.stack : undefined,
        status: 'error',
      },
      AuditEventStatus.FAILURE,
    )

    // Use the standardized error handling
    return handleApiError(error)
  }
}
