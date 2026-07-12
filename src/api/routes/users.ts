// Users Routes
import express, { Router, Request, Response } from 'express'
import { getPostgresPool } from '../../lib/database/connection'
import { authMiddleware, requireRoles } from '../middleware/auth'
import { rateLimiter, rateLimitByUser } from '../middleware/rate-limiter'
import rateLimit from 'express-rate-limit'
const postRateLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 })
function sanitize(input: string) {
  return input;
}
import { asyncHandler, NotFoundError, ForbiddenError, ValidationError, } from '../middleware/error-handler'
const router: Router = express.Router()
// All user routes require authentication
router.use(authMiddleware)
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
    // Validate and sanitize inputs
    const parsedLimit = typeof limit === 'string' || typeof limit === 'number' ? Number(limit) : NaN
    const parsedPage = typeof page === 'string' || typeof page === 'number' ? Number(page) : NaN
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 1000) {
      throw new ValidationError('Invalid limit', { limit: 'limit must be a positive integer up to 1000' })
    }
    if (!Number.isSafeInteger(parsedPage) || parsedPage <= 0) {
      throw new ValidationError('Invalid page', { page: 'page must be a positive integer' })
    }
    const limitRegex = /^\d+$/;
    const pageRegex = /^\d+$/;
    if (!limitRegex.test(limit as string)) {
      throw new ValidationError('Invalid limit', { limit: 'limit must be a positive integer up to 1000' })
    }
    if (!pageRegex.test(page as string)) {
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
// ... rest of the code remains the same ...