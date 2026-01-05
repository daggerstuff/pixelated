/**
 * Auth0-based Admin Users API Endpoint
 * Handles user administration with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { getUserById, getAllUsers, updateUser } from '@/services/auth0.service'
import { createAuditLog } from '@/lib/audit'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

export const prerender = false

const logger = createBuildSafeLogger('auth0-admin-users-api')

/**
 * Get all users (admin only)
 */
export const GET: APIRoute = async ({ request }) => {
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

    // Check if user has admin permissions
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      // Create audit log for forbidden access
      await createAuditLog(
        'access_denied',
        'auth.admin.users.forbidden',
        user.id,
        'auth-admin-users',
        { action: 'get_users', reason: 'insufficient_permissions' }
      )

      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const params = new URL(request.url).searchParams

    // Parse pagination parameters
    const page = parseInt(params.get('page') || '1', 10)
    const limit = Math.min(parseInt(params.get('limit') || '20', 10), 100) // Cap limit to 100
    const offset = (page - 1) * limit

    // Parse filter parameters
    const role = params.get('role')
    const search = params.get('search')

    logger.info('Admin fetching users', {
      adminId: user.id,
      page,
      limit,
      role,
      search,
    })

    // Get all users from Auth0
    const allUsers = await getAllUsers()

    // Filter users based on parameters
    let filteredUsers = allUsers

    if (role) {
      filteredUsers = filteredUsers.filter(u => u.role === role)
    }

    if (search) {
      const searchTerm = search.toLowerCase()
      filteredUsers = filteredUsers.filter(u =>
        u.email.toLowerCase().includes(searchTerm) ||
        (u.fullName && u.fullName.toLowerCase().includes(searchTerm))
      )
    }

    // Apply pagination
    const paginatedUsers = filteredUsers.slice(offset, offset + limit)
    const count = filteredUsers.length

    // Create audit log
    await createAuditLog(
      'admin_user_list',
      'auth.admin.users.list',
      user.id,
      'auth-admin-users',
      { action: 'list_users', page, limit, role, search, count, offset }
    )

    return new Response(
      JSON.stringify({
        data: paginatedUsers.map(u => ({
          id: u.id,
          email: u.email,
          role: u.role,
          fullName: u.fullName,
          createdAt: u.createdAt,
          lastLogin: u.lastLogin,
        })),
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

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.admin.users.error',
      'anonymous',
      'auth-admin-users',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

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
}

/**
 * Update user (admin only)
 */
export const PATCH: APIRoute = async ({ request }) => {
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
    const admin = await getUserById(validation.userId!)

    if (!admin) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check if user has admin permissions
    if (admin.role !== 'admin' && admin.role !== 'superadmin') {
      // Create audit log for forbidden access
      await createAuditLog(
        'access_denied',
        'auth.admin.users.forbidden',
        admin.id,
        'auth-admin-users',
        { action: 'update_user', reason: 'insufficient_permissions' }
      )

      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

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

    // Update user in Auth0
    const updatedUser = await updateUser(userId, updates)

    // Create audit log
    await createAuditLog(
      'admin_user_update',
      'auth.admin.users.update',
      admin.id,
      'auth-admin-users',
      { action: 'update_user', userId, updates, updatedBy: admin.id }
    )

    return new Response(
      JSON.stringify({
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          fullName: updatedUser.fullName,
          updatedAt: updatedUser.updatedAt,
        },
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

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.admin.users.error',
      'anonymous',
      'auth-admin-users',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

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
}