// Users Routes
import express, { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'

import { getPostgresPool } from '../../lib/db/connection'
import { authMiddleware, requireRoles } from '../middleware/auth'
import {
  asyncHandler,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../middleware/error-handler'
import { rateLimiter, rateLimitByUser } from '../middleware/rate-limiter'

const router: Router = express.Router()

// All user routes require authentication
router.use(authMiddleware)

const parsePositiveInteger = (value: unknown): number | undefined => {
  const n =
    typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN
  return Number.isSafeInteger(n) && n > 0 ? n : undefined
}

/**
 * GET /users
 * List all users (admin and managers only)
 */
router.get(
  '/',
  requireRoles(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 50, role, status } = req.query
    const pool = getPostgresPool()
    let query =
      'SELECT id, email, name, role, status, created_at FROM users WHERE 1=1'
    const params: any[] = []
    const parsedLimit = parsePositiveInteger(limit)
    const parsedPage = parsePositiveInteger(page)

    if (!parsedLimit || parsedLimit > 1000) {
      throw new ValidationError('Invalid limit', {
        limit: 'limit must be a positive integer up to 1000',
      })
    }
    if (!parsedPage) {
      throw new ValidationError('Invalid page', {
        page: 'page must be a positive integer',
      })
    }
    if (role) {
      if (
        typeof role !== 'string' ||
        !['admin', 'manager', 'user'].includes(role)
      ) {
        throw new ValidationError('Invalid role', { role: 'Invalid role' })
      }
      query += ' AND role = $' + (params.length + 1)
      params.push(role)
    }
    if (status) {
      if (
        typeof status !== 'string' ||
        !['active', 'inactive'].includes(status)
      ) {
        throw new ValidationError('Invalid status', {
          status: 'Invalid status',
        })
      }
      query += ' AND status = $' + (params.length + 1)
      params.push(status)
    }
    query +=
      ' ORDER BY created_at DESC LIMIT $' +
      (params.length + 1) +
      ' OFFSET $' +
      (params.length + 2)
    params.push(parsedLimit, (parsedPage - 1) * parsedLimit)
    const result = await pool.query(query, params)
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: result.rows.length,
      },
    })
  }),
)

/**
 * GET /users/:userId
 * Get user details
 */
router.get(
  '/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params['userId'] as string
    const { user } = req as { user?: { id?: string; role?: string } }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(userId)) {
      throw new ValidationError('Invalid ID format', {
        error: 'userId must be a valid UUID',
      })
    }

    // Users can view their own profile, admins can view anyone
    if (user.id !== userId && user.role !== 'admin') {
      throw new ForbiddenError('Cannot view other users profiles')
    }

    const pool = getPostgresPool()
    const result = await pool.query(
      `SELECT id, email, name, role, status, created_at, updated_at FROM users WHERE id = $1`,
      [userId],
    )
    if (result.rows.length === 0) {
      throw new NotFoundError('user', userId)
    }
    res.json({
      success: true,
      data: result.rows[0],
    })
  }),
)

/**
 * PUT /users/:userId
 * Update user details
 */
router.put(
  '/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params['userId'] as string
    const { name, email, status, role } = req.body
    const { user } = req as { user?: { id?: string; role?: string } }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(userId)) {
      throw new ValidationError('Invalid ID format', {
        error: 'userId must be a valid UUID',
      })
    }

    // Users can update themselves, admins can update anyone
    if (user.id !== userId && user.role !== 'admin') {
      throw new ForbiddenError('Cannot update other users')
    }

    // Only admins can change role or status
    if ((role || status) && user.role !== 'admin') {
      throw new ForbiddenError('Only admins can change role or status')
    }

    const pool = getPostgresPool()
    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Validate and sanitize inputs
    if (name) {
      if (typeof name !== 'string' || name.length > 255) {
        throw new ValidationError('Invalid name', { name: 'Invalid name' })
      }
      updates.push(`name = $${paramIndex++}`)
      params.push(name)
    }
    if (email) {
      if (
        typeof email !== 'string' ||
        !email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
      ) {
        throw new ValidationError('Invalid email', { email: 'Invalid email' })
      }
      updates.push(`email = $${paramIndex++}`)
      params.push(email)
    }
    if (role && user.role === 'admin') {
      if (
        typeof role !== 'string' ||
        !['admin', 'manager', 'user'].includes(role)
      ) {
        throw new ValidationError('Invalid role', { role: 'Invalid role' })
      }
      updates.push(`role = $${paramIndex++}`)
      params.push(role)
    }
    if (status && user.role === 'admin') {
      if (
        typeof status !== 'string' ||
        !['active', 'inactive'].includes(status)
      ) {
        throw new ValidationError('Invalid status', {
          status: 'Invalid status',
        })
      }
      updates.push(`status = $${paramIndex++}`)
      params.push(status)
    }
    if (updates.length === 0) {
      throw new ValidationError('No valid fields to update', {
        fields: 'No valid fields to update',
      })
    }
    updates.push(`updated_at = NOW()`)
    params.push(userId)

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    )
    if (result.rows.length === 0) {
      throw new NotFoundError('user', userId)
    }
    res.json({
      success: true,
      data: result.rows[0],
    })
  }),
)

/**
 * POST /users/:userId/permissions
 * Grant permission to user (admin only)
 */
router.post(
  '/:userId/permissions',
  rateLimiter,
  rateLimitByUser(20, 60000),
  requireRoles(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const rawUserId = String(req.params['userId'] || '').replace(
      /[^0-9a-fA-F-]/g,
      '',
    )
    const rawPermission = String(req.body.permission ?? '').replace(
      /[^a-zA-Z0-9_:/.-]/g,
      '',
    )

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(rawUserId)) {
      throw new ValidationError('Invalid ID format', {
        error: 'userId must be a valid UUID',
      })
    }
    if (!rawPermission) {
      throw new ValidationError('Permission required', {
        permission: 'Permission is required',
      })
    }

    const pool = getPostgresPool()
    const result = await pool.query(
      'INSERT INTO permissions (user_id, name) VALUES ($1, $2) RETURNING id, user_id, name',
      [rawUserId, rawPermission],
    )
    res.json({
      success: true,
      message: 'Permission granted successfully',
      permission: result.rows[0],
    })
  }),
)

/**
 * DELETE /users/:userId/permissions/:permissionId
 * Revoke permission from user (admin only)
 */
router.delete(
  '/:userId/permissions/:permissionId',
  rateLimiter,
  rateLimitByUser(20, 60000),
  requireRoles(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const rawUserId = String(req.params['userId'] || '').replace(
      /[^0-9a-fA-F-]/g,
      '',
    )
    const rawPermissionId = String(req.params['permissionId'] || '').replace(
      /[^0-9a-fA-F-]/g,
      '',
    )

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(rawUserId) || !uuidRegex.test(rawPermissionId)) {
      throw new ValidationError('Invalid ID format', {
        error: 'Both userId and permissionId must be valid UUIDs',
      })
    }

    const userId = rawUserId
    const permissionId = rawPermissionId
    const pool = getPostgresPool()
    const result = await pool.query(
      'DELETE FROM permissions WHERE id = $1 AND user_id = $2 RETURNING id, user_id, resource_type, resource_id, permission_level',
      [permissionId, userId],
    )
    if ((result.rowCount ?? 0) === 0) {
      throw new NotFoundError('Permission')
    }
    const permission = result.rows[0]
    res.json({
      success: true,
      message: 'Permission revoked successfully',
      permission,
    })
  }),
)

/**
 * DELETE /users/:userId
 * Deactivate user account (admin only)
 */
router.delete(
  '/:userId',
  rateLimiter,
  rateLimitByUser(10, 60000),
  requireRoles(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const rawUserId = String(req.params['userId'] || '').replace(
      /[^0-9a-fA-F-]/g,
      '',
    )

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(rawUserId)) {
      throw new ValidationError('Invalid ID format', {
        error: 'userId must be a valid UUID',
      })
    }

    const userId = rawUserId
    const pool = getPostgresPool()
    const result = await pool.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      ['inactive', userId],
    )
    if (result.rows.length === 0) {
      throw new NotFoundError('user', userId)
    }
    res.json({
      success: true,
      data: result.rows[0],
    })
  }),
)

export default router
