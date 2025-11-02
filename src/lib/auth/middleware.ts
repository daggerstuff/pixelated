/**
 * Authentication Middleware - Request authentication validation with Better-Auth integration
 * Provides role-based authorization and permission checking
 */

import type { Request } from 'express'
import { ROLE_DEFINITIONS, type UserRole } from './roles'

export interface ClientInfo {
  ip?: string
  userAgent?: string
  deviceId?: string
}

/**
 * Extract token from request headers or query parameters
 */
export function extractTokenFromRequest(req: Request): string | null {
  // Check Authorization header first
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7) // Remove 'Bearer ' prefix
  }

  // Check query parameters for WebSocket connections
  // Note: Request type doesn't have query property, access via URL
  try {
    const url = new URL(req.url)
    const tokenParam = url.searchParams.get('token')
    if (tokenParam) {
      return tokenParam
    }
  } catch {
    // URL parsing failed, try direct access if extended request
    const extendedReq = req as Request & { query?: { token?: string } }
    if (extendedReq.query?.token) {
      return extendedReq.query.token
    }
  }

  // Check cookie for fallback
  const extendedReq = req as Request & { cookies?: { auth_token?: string } }
  const tokenCookie = extendedReq.cookies?.auth_token

  if (tokenCookie) {
    return tokenCookie
  }

  return null
}

/**
 * Get client IP address
 */
export function getClientIp(req: Request): string {
  return (
    req.ip ||
    (req.headers['x-forwarded-for'] as string) ||
    (req.headers['x-real-ip'] as string) ||
    'unknown'
  )
}

/**
 * Verify admin access for protected routes
 */
export async function verifyAdmin(
  request: Request,
  context: { session?: unknown },
): Promise<Response | null> {
  try {
    // Check if session exists and has admin role
    const session = context.session as
      | { user?: { roles?: string[] } }
      | undefined
    if (!session || !session.user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Check if user has admin role
    const userRoles = session.user.roles || []
    if (!userRoles.includes('admin') && !userRoles.includes('superadmin')) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    // Admin access verified - return null to continue
    return null
  } catch (error) {
    console.error('Admin verification error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error during admin verification',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(
  request: Request,
  endpoint: string,
  limit: number,
  windowMinutes: number,
): Promise<{
  success: boolean
  request?: Request
  response?: Response
  error?: string
}> {
  // Basic implementation - in production this would use Redis
  return { success: true, request }
}

/**
 * CSRF protection middleware
 */
export async function csrfProtection(
  request: Request,
): Promise<{
  success: boolean
  request?: Request
  response?: Response
  error?: string
}> {
  // Allow GET requests without CSRF token
  if (request.method === 'GET') {
    return { success: true, request }
  }

  // For other methods, check for CSRF token
  const csrfToken =
    request.headers.get?.('X-CSRF-Token') ||
    (request.headers['x-csrf-token'] as string)

  if (!csrfToken) {
    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'CSRF token required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
      error: 'CSRF token required',
    }
  }

  // In production, validate the token against stored tokens
  return { success: true, request }
}

/**
 * Security headers middleware
 */
export async function securityHeaders(
  request: Request,
  response: Response,
): Promise<Response> {
  const headers = new Headers(response.headers)

  // Remove sensitive headers that leak server information
  headers.delete('X-Powered-By')
  headers.delete('Server')
  headers.delete('X-AspNet-Version')
  headers.delete('X-AspNetMvc-Version')

  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-XSS-Protection', '1; mode=block')
  headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains',
  )
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  )
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Authentication request interface
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
  }
  tokenId?: string
}

/**
 * Authenticate request middleware
 */
export async function authenticateRequest(
  request: Request,
): Promise<{
  success: boolean
  request?: AuthenticatedRequest
  response?: Response
  error?: string
}> {
  // Basic implementation - would integrate with JWT service
  const token = extractTokenFromRequest(request as any)

  if (!token) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: 'No authorization header' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
      error: 'No authorization header',
    }
  }

  // In production, validate token and get user
  return { success: true, request: request as AuthenticatedRequest }
}

/**
 * Require role middleware
 */
export async function requireRole(
  request: AuthenticatedRequest,
  roles: string[],
): Promise<{
  success: boolean
  request?: AuthenticatedRequest
  response?: Response
  error?: string
}> {
  if (!request.user) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
      error: 'User not authenticated',
    }
  }

  // Check direct role match first
  if (roles.includes(request.user.role)) {
    return { success: true, request }
  }

  // Check hierarchical role access
  const userRole = request.user.role as UserRole

  // Check if user's role has hierarchy level to access any of the required roles
  const hasAccess = roles.some((requiredRole) => {
    const requiredRoleDef = ROLE_DEFINITIONS[requiredRole as UserRole]
    if (!requiredRoleDef) return false

    // User's role hierarchy level must be >= required role's hierarchy level
    const userRoleDef = ROLE_DEFINITIONS[userRole]
    if (!userRoleDef) return false

    return userRoleDef.hierarchyLevel >= requiredRoleDef.hierarchyLevel
  })

  if (!hasAccess) {
    // Log authorization failure
    try {
      const { logSecurityEvent } = await import('../security')
      const { SecurityEventType } = await import('../security')
      logSecurityEvent(
        SecurityEventType.AUTHORIZATION_FAILED,
        request.user.id,
        `User ${request.user.id} with role ${request.user.role} attempted to access resource requiring roles: ${roles.join(', ')}`,
      )
    } catch {
      // Security module not available in test environment
    }

    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
      error: 'Insufficient permissions',
    }
  }

  return { success: true, request }
}
