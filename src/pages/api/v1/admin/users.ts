
import { protectRoute } from '../../../../lib/auth/serverAuth'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { createResourceAuditLog, AuditEventType } from '../../../../lib/audit'

export const prerender = false

const logger = createBuildSafeLogger('admin-users-api')

/**
 * Get all users (admin only)
 */
export const GET = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ locals, request }) => {
  try {
    const admin = locals.user
    const params = new URL(request.url).searchParams

    // Parse pagination parameters
    const page = parseInt(params.get('page') || '1', 10)
    const limit = Math.min(parseInt(params.get('limit') || '20', 10), 100) // Cap limit to 100
    const offset = (page - 1) * limit

    // Parse filter parameters
    const role = params.get('role')
    const search = params.get('search')

    logger.info('Admin fetching users', {
      adminId: admin.id,
      page,
      limit,
      role,
      search,
    })

    // TODO: Replace with actual database implementation
    // For now, return empty result to prevent build errors
    const data: Array<{ id: string; email: string; role: string; createdAt: string }> = []
    const count = 0

    await createResourceAuditLog(
      AuditEventType.SYSTEM,
      admin.id,
      { id: 'users', type: 'admin' },
      { page, limit, role, search, count, offset },
    )

    return new Response(
      JSON.stringify({
        data,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil((count || 0) / limit),
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Error fetching users:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch users',
        message: 'An error occurred while fetching users',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
})

/**
 * Update user (admin only)
 */
export const PATCH = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ locals, request }) => {
  try {
    const admin = locals.user
    const body = await request.json()
    const { userId, updates } = body

    if (!userId || !updates) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          message: 'userId and updates are required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    logger.info('Admin updating user', { adminId: admin.id, userId, updates })

    // TODO: Replace with actual database implementation
    // For now, return success to prevent build errors
    const updatedUser = { id: userId, ...updates }

    await createResourceAuditLog(
      AuditEventType.MODIFY,
      admin.id,
      { id: userId, type: 'user' },
      { updates, updatedBy: admin.id },
    )

    return new Response(
      JSON.stringify({
        data: updatedUser,
        message: 'User updated successfully',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Error updating user:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to update user',
        message: 'An error occurred while updating the user',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
})
