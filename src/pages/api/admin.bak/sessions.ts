export const prerender = false
import { AdminPermission, AdminService } from '../../../lib/admin'
import { adminGuard } from '../../../lib/admin/middleware'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

// Initialize logger
const logger = createBuildSafeLogger('default')

import type { APIContext } from "astro";

/**
 * API endpoint for fetching therapy sessions (admin only)
 * GET /api/admin/sessions
 */
export const GET = async (context: APIContext) => {
  // Apply admin middleware to check for admin status and required permission
  const next = () => new Promise<Response>((resolve) => resolve(new Response(null, { status: 200 })));
  const middlewareResponse = await adminGuard(AdminPermission.MANAGE_SESSIONS)(
    context,
    next
  )
  if (middlewareResponse.status !== 200) {
    return middlewareResponse
  }

  try {
    // Get admin user ID from middleware context
    const { userId } = context.locals.admin

    // Parse query parameters for pagination and filtering
    const url = new URL(context.request.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '10', 10)
    const offset = Number.parseInt(url.searchParams.get('offset') || '0', 10)
    const therapistId = url.searchParams.get('therapistId') || undefined
    const clientId = url.searchParams.get('clientId') || undefined
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

    // Get admin service
    const adminService = AdminService.getInstance()

    // Get sessions with pagination and filtering
    const sessionsResult = await adminService.getSessions({
      limit,
      offset,
      therapistId,
      clientId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    })

    // Log access for audi
    logger.info(`Admin user ${userId} accessed sessions list`)

    // Return sessions with pagination info
    return new Response(
      JSON.stringify({
        success: true,
        sessions: sessionsResult.sessions,
        pagination: {
          total: sessionsResult?.total ?? 0,
          limit,
          offset,
          hasMore: offset + limit < sessionsResult.total,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch {
    logger.error('Error fetching sessions')
    return new Response(JSON.stringify({ error: 'Failed to fetch sessions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * API endpoint for managing a specific session (admin only)
 * POST /api/admin/sessions
 */
export const POST = async (context: APIContext) => {
  // Apply admin middleware to check for admin status and required permission
  const next = () => new Promise<Response>((resolve) => resolve(new Response(null, { status: 200 })));
  const middlewareResponse = await adminGuard(AdminPermission.MANAGE_SESSIONS)(
    context,
    next
  )
  if (middlewareResponse.status !== 200) {
    return middlewareResponse
  }

  try {
    // Get admin user ID from middleware context
    const { userId: adminId } = context.locals.admin

    // Parse the request body
    const requestData = await context.request.json()
    const { sessionId, action } = requestData

    if (!sessionId || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get admin service
    const adminService = AdminService.getInstance()

    // Perform the requested action on the session
    let result
    switch (action) {
      case 'lock':
        result = await adminService.lockSession(sessionId)
        break
      case 'unlock':
        result = await adminService.unlockSession(sessionId)
        break
      case 'archive':
        result = await adminService.archiveSession(sessionId)
        break
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
    }

    // Log action for audi
    logger.info(
      `Admin user ${adminId} performed action "${action}" on session ${sessionId}`,
    )

    // Return result
    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    logger.error('Error managing session')
    return new Response(JSON.stringify({ error: 'Failed to manage session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
