// Authentication Routes
import express, { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getPostgresPool, getRedisClient } from '../../lib/database/connection'
import { UnauthorizedError, ValidationError } from '../middleware/error-handler'
import { asyncHandler } from '../middleware/error-handler'

const router: Router = express.Router()

const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRY || '24h' // Default to 24 hours per original PR requirements
const REFRESH_TOKEN_TTL_SECONDS = parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS || '1209600', 10) // 14 days

function assertJwtSecret(): string {
    const secret = process.env.JWT_SECRET
    if (!secret) {
        throw new Error('JWT_SECRET must be configured')
    }
    return secret
}

async function hashPassword(password: string) {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10)
    return bcrypt.hash(password, saltRounds)
}

async function verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash)
}

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function signAccessToken(user: { id: string; email: string; name: string; role: string }) {
    const secret = assertJwtSecret()
    return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, secret, {
        expiresIn: ACCESS_TOKEN_TTL
    })
}

async function issueRefreshToken(payload: { id: string; email: string; role: string }) {
    const token = crypto.randomBytes(48).toString('base64url')
    try {
        const redis = getRedisClient()
        await redis.set(`refresh:${token}`, JSON.stringify(payload), 'EX', REFRESH_TOKEN_TTL_SECONDS)
    } catch (error) {
        console.error('Failed to persist refresh token to Redis:', error)
        throw new Error('Token persistence failed')
    }
    return token
}

async function revokeRefreshToken(token: string) {
    try {
        const redis = getRedisClient()
        await redis.del(`refresh:${token}`)
    } catch (error) {
        console.error('Failed to revoke refresh token:', error)
    }
}

async function isAccessTokenBlacklisted(token: string) {
    try {
        const redis = getRedisClient()
        const isBlocked = await redis.exists(`blacklist:${token}`)
        return isBlocked === 1
    } catch (error) {
        console.error('Blacklist check failed:', error)
        return false
    }
}

async function blacklistAccessToken(token: string) {
    try {
        const redis = getRedisClient()
        const decoded = jwt.decode(token) as jwt.JwtPayload | null
        if (!decoded?.exp) {
            return
        }
        const ttlSeconds = decoded.exp - Math.floor(Date.now() / 1000)
        if (ttlSeconds > 0) {
            await redis.set(`blacklist:${token}`, '1', 'EX', ttlSeconds)
        }
    } catch (error) {
        console.error('Failed to blacklist access token:', error)
    }
}

/**
 * POST /auth/login
 * Login user and return JWT token
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body

    if (!email || !password) {
        throw new ValidationError('Email and password required', { email: !email, password: !password })
    }

    const pool = getPostgresPool()
    const result = await pool.query(
        `SELECT id, email, name, role, status, password_hash
     FROM users WHERE email = $1`,
        [email]
    )

    if (result.rows.length === 0) {
        throw new UnauthorizedError('Invalid email or password')
    }

    const user = result.rows[0]

    const passwordMatch = await verifyPassword(password, user.password_hash)
    if (!passwordMatch) {
        throw new UnauthorizedError('Invalid email or password')
    }

    if (user.status !== 'active') {
        throw new UnauthorizedError('Account is not active')
    }

    const accessToken = signAccessToken(user)
    const refreshToken = await issueRefreshToken({ id: user.id, email: user.email, role: user.role })

    res.json({
        success: true,
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        }
    })
}))

/**
 * POST /auth/register
 * Register new user
 */
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body

    if (!email || !password || !name) {
        throw new ValidationError('Email, password, and name required', {
            email: !email,
            password: !password,
            name: !name
        })
    }

    if (!isValidEmail(email)) {
        throw new ValidationError('Invalid email format', { email: true })
    }

    if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters', { password: true })
    }

    const pool = getPostgresPool()

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
        throw new ValidationError('Email already in use', { email: true })
    }

    const passwordHash = await hashPassword(password)

    let result
    try {
        result = await pool.query(
            `INSERT INTO users (email, password_hash, name, role, status)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, email, name, role, status`,
            [email, passwordHash, name, 'user', 'active']
        )
    } catch (error: any) {
        if (error?.code === '23505') {
            throw new ValidationError('Email already in use', { email: true })
        }
        console.error('User registration failed:', error)
        throw error
    }

    const user = result.rows[0]

    const accessToken = signAccessToken(user)
    const refreshToken = await issueRefreshToken({ id: user.id, email: user.email, role: user.role })

    res.status(201).json({
        success: true,
        accessToken,
        refreshToken,
        user
    })
}))

/**
 * POST /auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body

    if (!refreshToken) {
        throw new ValidationError('refreshToken required', { refreshToken: true })
    }

    let stored
    try {
        const redis = getRedisClient()
        const raw = await redis.get(`refresh:${refreshToken}`)
        if (!raw) {
            throw new UnauthorizedError('Invalid refresh token')
        }
        stored = JSON.parse(raw)
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            throw error
        }
        console.error('Refresh token validation failed:', error)
        throw new UnauthorizedError('Invalid refresh token')
    }

    const pool = getPostgresPool()
    const userResult = await pool.query(
        `SELECT id, email, name, role, status FROM users WHERE id = $1`,
        [stored.id]
    )

    if (userResult.rows.length === 0 || userResult.rows[0].status !== 'active') {
        throw new UnauthorizedError('Account is not active')
    }

    const user = userResult.rows[0]

    const accessToken = signAccessToken(user)
    await revokeRefreshToken(refreshToken)
    const newRefreshToken = await issueRefreshToken({ id: user.id, email: user.email, role: user.role })

    res.json({
        success: true,
        accessToken,
        refreshToken: newRefreshToken
    })
}))

/**
 * POST /auth/logout
 * Logout user (invalidate token)
 */
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization
    const { refreshToken } = req.body

    if (authHeader) {
        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader
        const blacklisted = await isAccessTokenBlacklisted(token)
        if (!blacklisted) {
            await blacklistAccessToken(token)
        }
    }

    if (refreshToken) {
        await revokeRefreshToken(refreshToken)
    }

    res.json({
        success: true,
        message: 'Logout successful'
    })
}))

export default router
