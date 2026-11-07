// Logging Middleware
// Request logging and activity tracking

import { NextFunction, Request, Response } from 'express'

import { getPostgresPool } from '../../lib/db/connection'

type LoggedRequest = Request & {
  requestId?: string
  startTime?: number
}

/**
 * Request logger middleware
 * Logs all incoming requests
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now()
  const requestId = createRequestId()

  // Store metadata on request object
  ;(req as LoggedRequest).requestId = requestId
  ;(req as LoggedRequest).startTime = startTime

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime

    // Audit log for user actions
    if (req.user && shouldAuditLog(req as LoggedRequest)) {
      void logAuditEvent(req as LoggedRequest, res, requestId, duration)
    }
  })

  next()
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

async function logAuditEvent(
  req: Request,
  res: Response,
  _requestId: string,
  _duration: number,
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
        req.user?.id ?? null,
        action,
        getResourceType(req),
        getResourceId(req),
        changes,
        req.ip,
        req.headers['user-agent'],
        res.statusCode >= 400 ? 'error' : 'success',
      ],
    )
  } catch (error: unknown) {
    // error handled by caller — audit logging failures shouldn't break the app
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

  return 'unknown'
}

function getResourceId(req: Request): string | undefined {
  const parts = req.path.split('/').filter(Boolean)

  if (parts.length === 0) return undefined

  // Only return a resource ID if path follows resource/id pattern
  // /api/users/123 → '123', but /api/users → undefined (need 3+ segments with api prefix)
  if (parts[0] === 'api') {
    if (parts.length >= 3) {
      const lastPart = parts[parts.length - 1]
      if (lastPart && !lastPart.includes('?')) {
        return lastPart
      }
    }
  } else if (parts.length >= 2) {
    // /users/456 → '456', but /users → undefined
    const lastPart = parts[parts.length - 1]
    if (lastPart && !lastPart.includes('?')) {
      return lastPart
    }
  }

  // Try to extract from query params
  const id = (req.query['id'] as string) || (req.query['documentId'] as string)
  return id || undefined
}

function extractChanges(req: Request): string | null {
  if (!req.body) return null

  // Don't log sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key']
  const changes = new Map<string, unknown>()

  for (const [key, value] of Object.entries(req.body)) {
    if (!sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
      changes.set(key, value)
    }
  }

  return changes.size > 0 ? JSON.stringify(Object.fromEntries(changes)) : null
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

/**
 * Generate a unique request ID
 */
function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}
