import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import { createResourceAuditLog, AuditEventType } from '../../../../lib/audit'
import { protectRoute } from '../../../../lib/auth/serverAuth'
import { query, initializeDatabase } from '../../../../lib/db'

export const prerender = false
const logger = createBuildSafeLogger('admin-users-api')

/** Get all users (admin only) */
export const GET = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ locals, request }) => {
  try {
    initializeDatabase()
    // Initialize database pool before queries
    const admin = locals.user
    const params = new URL(request.url).searchParams
    // Parse pagination parameters
    const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
    const limit = Math.min(parseInt(params.get('limit') ?? '20', 10), 100)
    // Cap limit to 100
    // Validate pagination parameters
    if (!Number.isFinite(page) || page <= 0) {
      return new Response(
        JSON.stringify({
          error: 'Invalid page parameter',
          message: 'Page must be a positive integer',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
    if (!Number.isFinite(limit) || limit <= 0) {
      return new Response(
        JSON.stringify({
          error: 'Invalid limit parameter',
          message: 'Limit must be a positive integer',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
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
    // Sanitize and validate input parameters before they reach the query.
    const allowedRoles = [
      'admin',
      'manager',
      'user',
      'patient',
      'therapist',
      'staff',
    ]
    const sanitizedRole =
      role && typeof role === 'string' && allowedRoles.includes(role)
        ? role
        : null
    const sanitizedSearch =
      search && typeof search === 'string' ? search.slice(0, 100) : null
    // Construct WHERE clauses
    const whereConditions: string[] = []
    const queryParams: unknown[] = []
    let paramIndex = 1
    if (sanitizedRole) {
      whereConditions.push(`role = $${paramIndex}`)
      queryParams.push(sanitizedRole)
      paramIndex++
    }
    if (sanitizedSearch) {
      whereConditions.push(
        `(email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`,
      )
      queryParams.push(`%${sanitizedSearch}%`)
      paramIndex++
    }
    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    // Fetch total count
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`
    const countResult = await query(countQuery, queryParams)
    const count = parseInt(countResult.rows[0]?.['total'] ?? '0', 10)
    // Fetch users
    const limitIndex = queryParams.length + 1
    const offsetIndex = queryParams.length + 2
    const usersQuery = ` SELECT id, email, role, created_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${limitIndex} OFFSET $${offsetIndex} `
    const usersResult = await query(usersQuery, [...queryParams, limit, offset])
    const data: Array<{
      id: string
      email: string
      role: string
      createdAt: string
    }> = usersResult.rows.map((row) => ({
      id: row['id'],
      email: row['email'],
      role: row['role'],
      createdAt:
        row['created_at'] instanceof Date
          ? row['created_at'].toISOString()
          : String(row['created_at']),
    }))
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
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    logger.error('Error fetching users:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch users',
        message: 'An error occurred while fetching users',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

/** Update user (admin only) */
export const PATCH = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ locals, request }) => {
  try {
    initializeDatabase()
    // Initialize database pool before queries
    const admin = locals.user
    const body = await request.json()
    const { userId, updates } = body
    if (
      !userId ||
      !updates ||
      typeof updates !== 'object' ||
      Object.keys(updates).length === 0
    ) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          message:
            'userId and updates are required, and updates must not be empty',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
    logger.info('Admin updating user', { adminId: admin.id, userId, updates })
    // Define an allowlist of permitted column names
    const allowedColumns = ['email', 'first_name', 'last_name', 'role']
    // Initialize an empty array to store the allowed updates
    const sanitizedUpdates: { [key: string]: string } = {}
    // Iterate over the allowed columns and check if the key exists in the updates object
    allowedColumns.forEach((column) => {
      if (column in updates) {
        sanitizedUpdates[column] = updates[column]
      }
    })
    // Check if any updates were sanitized
    if (Object.keys(sanitizedUpdates).length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No valid updates provided',
          message:
            'Only the following columns can be updated: ' +
            allowedColumns.join(', '),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
    // Update user in database
    if (Object.keys(sanitizedUpdates).length > 0) {
      const updateQuery = `UPDATE users SET ${Object.keys(sanitizedUpdates)
        .map(
          (key) =>
            `${key} = $${Object.keys(sanitizedUpdates).indexOf(key) + 1}`,
        )
        .join(', ')} WHERE id = $${Object.keys(sanitizedUpdates).length + 1}`
      const updateResult = await query(updateQuery, [
        ...Object.values(sanitizedUpdates),
        userId,
      ])
      // Check if update was successful
      if ((updateResult.rowCount ?? 0) === 0) {
        return new Response(
          JSON.stringify({
            error: 'User not found',
            message: 'The user you are trying to update does not exist',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        )
      }
      createResourceAuditLog(
        AuditEventType.MODIFY,
        admin.id,
        { id: userId, type: 'user' },
        { updates: sanitizedUpdates, updatedBy: admin.id },
      ).catch((err) => logger.error('Failed to create audit log:', err))
      return new Response(
        JSON.stringify({
          data: { id: userId, ...sanitizedUpdates },
          message: 'User updated successfully',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    } else {
      return new Response(
        JSON.stringify({
          error: 'No updates provided',
          message: 'No updates were provided to update the user',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  } catch (error: unknown) {
    logger.error('Error updating user:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to update user',
        message: 'An error occurred while updating the user',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
