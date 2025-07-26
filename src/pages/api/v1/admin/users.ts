import { protectRoute } from '../../../../lib/auth/serverAuth'
import { supabase } from '../../../../lib/supabase'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { createResourceAuditLog } from '../../../../lib/audit'
import type { AuthAPIContext } from '../../../../lib/auth/apiRouteTypes'

export const prerender = false

const logger = createBuildSafeLogger('admin-users-api')

/**
 * Get all users (admin only)
 */
export const GET = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ locals, request }: AuthAPIContext) => {
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

    // Start building query
    let query = supabase
      .from('profiles')
      .select(
        'id, full_name, avatar_url, role, last_login, created_at, updated_at, status, metadata',
        { count: 'exact' },
      )

    // Apply filters if provided
    if (role) {
      query = query.eq('role', role)
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    // Apply pagination
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    // Execute query
    const { data: users, error, count } = await query

    if (error) {
      logger.error(`Error fetching users:`, error)
      return new Response(
        JSON.stringify({
          error: 'Failed to retrieve users',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Log the admin action
    await createResourceAuditLog(
      'admin_list_users',
      admin.id,
      { id: 'all', type: 'users' },
      {
        filters: { role, search },
        pagination: { page, limit },
        userCount: count || 0,
      },
    )

    // Return users with metadata
    return new Response(
      JSON.stringify({
        users,
        metadata: {
          page,
          limit,
          totalCount: count || 0,
          totalPages: count ? Math.ceil(count / limit) : 0,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    logger.error('Unexpected error in users API:', { error })
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})

/**
 * Update a user (admin only)
 */
export const PUT = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ locals, request }: AuthAPIContext) => {
  try {
    const admin = locals.user
    const data = await request.json()

    // Validate required inputs
    const { userId, updates } = data

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!updates || Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'No updates provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Security check: prevent role escalation to super_admin
    if (updates.role === 'super_admin' && admin.role !== 'super_admin') {
      logger.warn(
        `Admin ${admin.id} attempted to escalate user ${userId} to super_admin`,
      )

      await createResourceAuditLog(
        'admin_action_blocked',
        admin.id,
        { id: userId, type: 'user' },
        {
          reason: 'role_escalation_attempt',
          attemptedRole: 'super_admin',
          adminRole: admin.role,
        },
      )

      return new Response(
        JSON.stringify({ error: 'Insufficient permissions for this action' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Process updates - convert client-friendly names to database column names
    const dbUpdates: Record<string, unknown> = {}

    if (updates.fullName !== undefined) {
      dbUpdates.full_name = updates.fullName
    }
    if (updates.role !== undefined) {
      dbUpdates.role = updates.role
    }
    if (updates.status !== undefined) {
      dbUpdates.status = updates.status
    }
    if (updates.metadata !== undefined) {
      dbUpdates.metadata = updates.metadata
    }

    // Update user in database
    const { data: updatedUser, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', userId)
      .select(
        'id, full_name, avatar_url, role, last_login, created_at, updated_at, status, metadata',
      )
      .single()

    if (error) {
      logger.error(`Error updating user ${userId}:`, error)
      return new Response(
        JSON.stringify({
          error: 'Failed to update user',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Log the admin action
    await createResourceAuditLog(
      'admin_update_user',
      admin.id,
      { id: userId, type: 'user' },
      {
        updates: dbUpdates,
      },
    )

    // Return updated user
    return new Response(
      JSON.stringify({
        user: updatedUser,
        message: 'User updated successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    logger.error('Unexpected error in users API:', { error })
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})
