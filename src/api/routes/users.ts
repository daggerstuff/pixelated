// Users Routes
import express, { Router, Request, Response } from 'express'
import { getPostgresPool } from '../../lib/database/connection'
import { authMiddleware, requireRoles } from '../middleware/auth'
import { rateLimiter, rateLimitByUser } from '../middleware/rate-limiter'
import rateLimit from 'express-rate-limit'
import { asyncHandler, NotFoundError, ForbiddenError, ValidationError, } from '../middleware/error-handler'

const router: Router = express.Router()

// All user routes require authentication
router.use(authMiddleware)

const parsePositiveInteger = (value: unknown): number | undefined => {
  const n = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN
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
    let query = 'SELECT id, email, name, role, status, created_at FROM users WHERE 1=1'
    const params: any[] = []
    const parsedLimit = parsePositiveInteger(limit)
    const parsedPage = parsePositiveInteger(page)

    if (!parsedLimit || parsedLimit > 1000) {
      throw new ValidationError('Invalid limit', { limit: 'limit must be a positive integer up to 1000' })
    }
    if (!parsedPage) {
      throw new ValidationError('Invalid page', { page: 'page must be a positive integer' })
    }
    if (role) {
      if (typeof role !== 'string' || !['admin', 'manager', 'user'].includes(role)) {
        throw new ValidationError('Invalid role', { role: 'Invalid role' })
      }
      query += ' AND role = $' + (params.length + 1)
      params.push(role)
    }
    if (status) {
      if (typeof status !== 'string' || !['active', 'inactive'].includes(status)) {
        throw new ValidationError('Invalid status', { status: 'Invalid status' })
      }
      query += ' AND status = $' + (params.length + 1)
      params.push(status)
    }
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2)
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

// ... (rest of the code remains the same)