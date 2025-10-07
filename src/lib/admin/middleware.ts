/**
 * Admin Middleware for Therapy Chat System
 *
 * Provides authentication and permission checks for admin routes.
 */

import type { BaseAPIContext } from '../auth/apiRouteTypes'
import type { AdminPermission } from './index'
import { AdminService } from './index'

// Extend APIContext.locals with our admin type
declare module 'astro' {
  interface Locals {
    admin?: {
      userId: string
      isAdmin: boolean
      hasPermission: boolean
    }
  }
}

/**
 * Verify that the request is from an authenticated admin user
 */
export async function verifyAdmin(
  context: BaseAPIContext,
  requiredPermission?: AdminPermission,
): Promise<{
  userId: string
  isAdmin: boolean
  hasPermission: boolean
} | null> {
  try {
    const { request, cookies } = context

    // Get token from Authorization header or cookie
    const authHeader = request.headers.get('Authorization')
    const token = authHeader
      ? authHeader.replace('Bearer ', '')
      : cookies.get('admin_token')?.value

    if (!token) {
      return null
    }

    // Verify admin token
    const adminService = AdminService.getInstance()
    const admin = await adminService.verifyAdminToken(token)

    if (!admin) {
      return null
    }

    // If a specific permission is required, check for it
    let hasPermission = true
    if (requiredPermission) {
      hasPermission = await adminService.hasPermission(
        admin.userId,
        requiredPermission,
      )
    }

    return {
      userId: admin.userId,
      isAdmin: true,
      hasPermission,
    }
  } catch {
    return null
  }
}

/**
 * Admin middleware factory
 * Returns a middleware function that checks for admin status and required permission
 */
export function adminGuard(requiredPermission?: AdminPermission) {
  return async (context: BaseAPIContext, next: () => Promise<Response>) => {
    const admin = await verifyAdmin(context, requiredPermission)

    if (!admin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (requiredPermission && !admin.hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Continue with the request
    // Apply the admin context to the request for use in the route handler
    context.locals.admin = admin

    return next()
  }
}
