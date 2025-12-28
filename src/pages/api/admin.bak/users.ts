export const prerender = false
import { AdminPermission, AdminService } from '../../../lib/admin'
import { adminGuard } from '../../../lib/admin/middleware'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
// import type { BaseAPIContext } from '@/lib/auth/apiRouteTypes'

// Initialize logger
const logger = createBuildSafeLogger('default')

import type { APIContext } from "astro";

/**
 * API endpoint for fetching users (admin only)
 * GET /api/admin/users
 */
export const GET = async (context: APIContext) => {
  // Apply admin middleware to check for admin status and required permission
  const next = () => new Promise<Response>((resolve) => resolve(new Response(null, { status: 200 })));
  const middlewareResponse = await adminGuard(AdminPermission.VIEW_USERS)(
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
    const role = url.searchParams.get('role') || undefined

    // Get admin service
    const adminService = AdminService.getInstance()

    // Get users with pagination and filtering
    const usersResult = await adminService.getAllAdmins()
    const filteredUsers = role
      ? usersResult.filter((user: any) => user.role === role)
      : usersResult
    const total = filteredUsers.length
    const paginatedUsers = filteredUsers.slice(offset, offset + limit)

    // Log access for audi
    logger.info(`Admin user ${userId} accessed user list`)

    // Return users with pagination info
    return new Response(
      JSON.stringify({
        success: true,
        users: paginatedUsers,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    logger.error('Error fetching users:', {
      error: error instanceof Error ? String(error) : String(error),
    })
    return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * API endpoint for updating a user (admin only)
 * PATCH /api/admin/users
 */
export const PATCH = async (context: APIContext) => {
  // Apply admin middleware to check for admin status and required permission
  const next = () => new Promise<Response>((resolve) => resolve(new Response(null, { status: 200 })));
  const middlewareResponse = await adminGuard(AdminPermission.UPDATE_USER)(
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
    const { userId, updates } = requestData

    if (!userId || !updates) {
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

    // Get the user to update
    const user = await adminService.getAdminUser(userId)
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Update the user (in a real implementation, this would update the database)
    const updatedUser = { ...user, ...updates }

    // Log access for audi
    logger.info(`Admin user ${adminId} updated user ${userId}`)

    // Return updated user
    return new Response(JSON.stringify({ success: true, user: updatedUser }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    logger.error('Error updating user:', {
      error: error instanceof Error ? String(error) : String(error),
    })
    return new Response(JSON.stringify({ error: 'Failed to update user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
