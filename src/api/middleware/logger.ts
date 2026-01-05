// Logging Middleware
// Request logging and activity tracking

import { Request, Response, NextFunction } from 'express'
import { getPostgresPool } from '../../lib/database/connection'

/**
 * Request logger middleware
 * Logs all incoming requests
 */
export function requestLogger(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const startTime = Date.now()
    const requestId = generateRequestId()

        // Store metadata on request object
        (req as any).requestId = requestId
            (req as any).startTime = startTime

    // Log on response finish
    res.on('finish', () => {
        const duration = Date.now() - startTime
        const level = res.statusCode >= 400 ? 'error' : 'info'

        console.log(
            `[${requestId}] ${level.toUpperCase()} - ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
        )

        // Audit log for user actions
        if (req.user && shouldAuditLog(req)) {
            logAuditEvent(req, res, requestId, duration)
        }
    })

    next()
}

// ============================================================================
// RATE LIMITING MIDDLEWARE
// ============================================================================

const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX = 100 // requests per window

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || 'unknown'
    const now = Date.now()

    let record = requestCounts.get(ip)

    if (!record || record.resetTime < now) {
        record = { count: 1, resetTime: now + RATE_LIMIT_WINDOW }
        requestCounts.set(ip, record)
        return next()
    }

    record.count++

    if (record.count > RATE_LIMIT_MAX) {
        return res.status(429).json({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Max ${RATE_LIMIT_MAX} requests per ${RATE_LIMIT_WINDOW / 1000} seconds`
        })
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX)
    res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_MAX - record.count)
    res.setHeader('X-RateLimit-Reset', record.resetTime)

    next()
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

async function logAuditEvent(
    req: Request,
    res: Response,
    _requestId: string,
    _duration: number
) {
    try {
        const pool = getPostgresPool()

        // Determine action type from request
        const action = getActionType(req)

        // Only log mutations and specific read operations
        if (!action) return

        const changes = extractChanges(req)

        await pool.query(
            `INSERT INTO audit_logs
       (user_id, action, resource_type, resource_id, changes, ip_address, user_agent, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
                req.user?.id || null,
                action,
                getResourceType(req),
                getResourceId(req),
                changes,
                req.ip,
                req.headers['user-agent'],
                res.statusCode >= 400 ? 'error' : 'success'
            ]
        )
    } catch (error) {
        console.error('Failed to log audit event:', error)
        // Don't throw - audit logging failures shouldn't break the app
    }
}

function getActionType(req: Request): string | null {
    const method = req.method.toUpperCase()

    if (method === 'POST') return 'create'
    if (method === 'PUT' || method === 'PATCH') return 'update'
    if (method === 'DELETE') return 'delete'
    if (method === 'GET' && req.path.includes('/export')) return 'export'
    if (method === 'GET' && req.path.includes('/download')) return 'download'

    return null
}

function getResourceType(req: Request): string {
    const path = req.path.toLowerCase()

    if (path.includes('/documents')) return 'document'
    if (path.includes('/projects')) return 'project'
    if (path.includes('/strategic-plans')) return 'strategic_plan'
    if (path.includes('/market-research')) return 'market_research'
    if (path.includes('/sales-opportunities')) return 'sales_opportunity'

    return 'unknown'
}

function getResourceId(req: Request): string | null {
    const parts = req.path.split('/')
    const lastPart = parts[parts.length - 1]

    // Check if last part looks like an ID
    if (lastPart && lastPart !== '' && !lastPart.includes('?')) {
        return lastPart
    }

    // Try to extract from query params
    const id = (req.query.id as string) || (req.query.documentId as string)
    return id || null
}

function extractChanges(req: Request): string | null {
    if (!req.body) return null

    // Don't log sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key']
    const changes: Record<string, any> = {}

    for (const [key, value] of Object.entries(req.body)) {
        if (!sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
            changes[key] = value
        }
    }

    return Object.keys(changes).length > 0 ? JSON.stringify(changes) : null
}

function shouldAuditLog(req: Request): boolean {
    // Only audit:
    // - Mutations (POST, PUT, DELETE, PATCH)
    // - Exports and downloads
    // - Approval actions

    return (
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ||
        req.path.includes('/export') ||
        req.path.includes('/download') ||
        req.path.includes('/approve')
    )
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function getRequestId(req: Request): string {
    return (req as any).requestId || 'unknown'
}
