// Users Routes
import express, { Router, Request, Response } from 'express'
import { getPostgresPool } from '../../lib/database/connection'
import { asyncHandler, NotFoundError, ForbiddenError, ValidationError } from '../middleware/error-handler'
import { authMiddleware, requireRole } from '../middleware/auth'

const router: Router = express.Router()

// All user routes require authentication
router.use(authMiddleware)

/**
 * GET /users
 * List all users (admin and managers only)
 */
router.get('/', requireRole(['admin', 'manager']), asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 50, role, status } = req.query

    const pool = getPostgresPool()
    let query = 'SELECT id, email, name, role, status, created_at FROM users WHERE 1=1'
    const params: any[] = []

    if (role) {
        query += ' AND role = $' + (params.length + 1)
        params.push(role)
    }

    if (status) {
        query += ' AND status = $' + (params.length + 1)
        params.push(status)
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2)
    params.push(limit, (parseInt(page as string) - 1) * parseInt(limit as string))

    const result = await pool.query(query, params)

    res.json({
        success: true,
        data: result.rows,
        pagination: { page, limit, total: result.rows.length }
    })
}))

/**
 * GET /users/:userId
 * Get user details
 */
router.get('/:userId', asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params
    const { user } = req as any

    // Users can view their own profile, admins can view anyone
    if (user.id !== userId && user.role !== 'admin') {
        throw new ForbiddenError('Cannot view other users profiles')
    }

    const pool = getPostgresPool()
    const result = await pool.query(
        `SELECT id, email, name, role, status, created_at, updated_at 
     FROM users WHERE id = $1`,
        [userId]
    )

    if (result.rows.length === 0) {
        throw new NotFoundError('user', userId)
    }

    res.json({
        success: true,
        data: result.rows[0]
    })
}))

/**
 * PUT /users/:userId
 * Update user details
 */
router.put('/:userId', asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params
    const { name, email, status, role } = req.body
    const { user } = req as any

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

    if (name) {
        updates.push(`name = $${paramIndex++}`)
        params.push(name)
    }

    if (email) {
        updates.push(`email = $${paramIndex++}`)
        params.push(email)
    }

    if (role && user.role === 'admin') {
        updates.push(`role = $${paramIndex++}`)
        params.push(role)
    }

    if (status && user.role === 'admin') {
        updates.push(`status = $${paramIndex++}`)
        params.push(status)
    }

    if (updates.length === 0) {
        throw new ValidationError('No valid fields to update', {})
    }

    updates.push(`updated_at = NOW()`)
    params.push(userId)

    const result = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
    )

    if (result.rows.length === 0) {
        throw new NotFoundError('user', userId)
    }

    res.json({
        success: true,
        data: result.rows[0]
    })
}))

/**
 * POST /users/:userId/permissions
 * Grant permission to user (admin only)
 */
router.post('/:userId/permissions', requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params
    const { permission } = req.body

    if (!permission) {
        throw new ValidationError('Permission required', { permission: true })
    }

    // TODO: Implement permission granting
    // TODO: Add to PostgreSQL permissions table with grant tracking

    res.json({
        success: true,
        message: 'Permission granted - coming soon'
    })
}))

/**
 * DELETE /users/:userId/permissions/:permissionId
 * Revoke permission from user (admin only)
 */
router.delete('/:userId/permissions/:permissionId', requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
    const { userId, permissionId } = req.params

    // TODO: Implement permission revocation
    // TODO: Update PostgreSQL permissions table

    res.json({
        success: true,
        message: 'Permission revoked - coming soon'
    })
}))

/**
 * DELETE /users/:userId
 * Deactivate user account (admin only)
 */
router.delete('/:userId', requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params

    const pool = getPostgresPool()
    const result = await pool.query(
        'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        ['inactive', userId]
    )

    if (result.rows.length === 0) {
        throw new NotFoundError('user', userId)
    }

    res.json({
        success: true,
        data: result.rows[0]
    })
}))

export default router
