// Authentication Middleware
// JWT verification and user context setup

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getPostgresPool, getRedisClient } from '../../lib/database/connection'

// Extend Express Request to include user context
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string
                email: string
                name: string
                role: string
                permissions: string[]
            }
            token?: string
        }
    }
}

interface JWTPayload {
    id: string
    email: string
    name: string
    role: string
    iat: number
    exp: number
}

export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization
        if (!authHeader) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing Authorization header'
            })
        }

        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader

        // Check blacklist (best-effort)
        try {
            const redis = getRedisClient()
            const blocked = await redis.exists(`blacklist:${token}`)
            if (blocked === 1) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Token revoked'
                })
            }
        } catch (error) {
            console.error('Blacklist check failed:', error)
        }

        // Verify token
        const secret = process.env.JWT_SECRET
        if (!secret) {
            console.error('JWT_SECRET not configured')
            return res.status(500).json({
                error: 'Server Error',
                message: 'Auth configuration incomplete'
            })
        }

        const decoded = jwt.verify(token, secret) as JWTPayload

        // Fetch user from database to get current permissions
        const pool = getPostgresPool()
        const userResult = await pool.query(
            `SELECT id, email, name, role, status FROM users WHERE id = $1`,
            [decoded.id]
        )

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found'
            })
        }

        const user = userResult.rows[0]

        if (user.status !== 'active') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User account is not active'
            })
        }

        // Fetch user permissions
        const permissionsResult = await pool.query(
            `SELECT DISTINCT permission_level FROM permissions 
       WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
            [decoded.id]
        )

        // Attach user to request
        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: permissionsResult.rows.map((r: any) => r.permission_level)
        }
        req.token = token

        next()
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                error: 'Token Expired',
                message: 'Please login again'
            })
        }

        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({
                error: 'Invalid Token',
                message: 'Token verification failed'
            })
        }

        console.error('Auth middleware error:', error)
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Authentication failed'
        })
    }
}

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Check if user has specific role
 */
export function requireRole(allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found in request'
            })
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
            })
        }

        next()
    }
}

/**
 * Check if user has specific permission
 */
export function requirePermission(permission: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found in request'
            })
        }

        if (!req.user.permissions.includes(permission)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `This action requires the following permission: ${permission}`
            })
        }

        next()
    }
}

/**
 * Check if user has any of the specified permissions
 */
export function requireAnyPermission(permissions: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found in request'
            })
        }

        const hasPermission = permissions.some((p) =>
            req.user!.permissions.includes(p)
        )

        if (!hasPermission) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `This action requires one of the following permissions: ${permissions.join(', ')}`
            })
        }

        next()
    }
}

// ============================================================================
// RATE LIMITING BY USER
// ============================================================================

export function rateLimitByUser(limit: number = 100, windowMs: number = 60000) {
    const store = new Map<string, { count: number; reset: number }>()

    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next()
        }

        const userId = req.user.id
        const now = Date.now()
        const userLimit = store.get(userId)

        if (!userLimit || userLimit.reset < now) {
            store.set(userId, { count: 1, reset: now + windowMs })
            return next()
        }

        if (userLimit.count >= limit) {
            return res.status(429).json({
                error: 'Too Many Requests',
                message: `Rate limit exceeded. Max ${limit} requests per ${windowMs / 1000} seconds`
            })
        }

        userLimit.count++
        next()
    }
}
