/**
 * Authentication Middleware - Request authentication validation with Better-Auth integration
 * Provides role-based authorization and permission checking
 */

import type { Request as ExpressRequest } from 'express'
import { validateToken } from './jwt-service'
import { getUserById } from './better-auth-integration'
import { logSecurityEvent } from '../security'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'

export interface ClientInfo {
  ip?: string
  userAgent?: string
  deviceId?: string
}

/**
 * Extract token from request headers or query parameters
 * Supports both Express Request and native Request objects
 * @throws {Error} When authorization header format is invalid
 */
export function extractTokenFromRequest(req: Request | ExpressRequest): string | null {
  try {
    // Handle native Request object (from Fetch API)
    if (req instanceof Request) {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')

      if (authHeader) {
        if (!authHeader.startsWith('Bearer ')) {
          throw new Error('Invalid authorization header format')
        }
        return authHeader.substring(7) // Remove 'Bearer ' prefix
      }

      // Check query parameters from URL
      const url = new URL(req.url)
      const tokenParam = url.searchParams.get('token')

      if (tokenParam) {
        return tokenParam
      }

      return null
    }

    // Handle Express Request object
    // Check Authorization header first
    const authHeader = req.headers?.authorization

    if (authHeader) {
      if (!authHeader.startsWith('Bearer ')) {
        throw new Error('Invalid authorization header format')
      }
      return authHeader.substring(7) // Remove 'Bearer ' prefix
    }

    // Check query parameters for WebSocket connections
    const tokenParam = req.query?.token as string

    if (tokenParam) {
      return tokenParam
    }

    // Check cookie for fallback
    const tokenCookie = req.cookies?.auth_token

    if (tokenCookie) {
      return tokenCookie
    }

    return null
  } catch (error) {
    // Handle cases where req.query or req.headers might be undefined
    if (error instanceof Error && error.message.includes('Cannot read properties of undefined')) {
      return null
    }
    throw error
  }
}

/**
 * Get client IP address
 */
export function getClientIp(req: Request | ExpressRequest): string {
  // Handle native Request object
  if (req instanceof Request) {
    return req.headers.get('x-forwarded-for') ||
           req.headers.get('x-real-ip') ||
           'unknown'
  }

  // Handle Express Request object
  return req.ip ||
         req.headers['x-forwarded-for'] as string ||
         req.headers['x-real-ip'] as string ||
         'unknown'
}



/**
 * Verify admin access for protected routes
 */
export async function verifyAdmin(
  request: Request,
  context: { session?: unknown }
): Promise<Response | null> {
  try {
    // Check if session exists and has admin role
    const session = context.session as { user?: { roles?: string[] } } | undefined
    if (!session || !session.user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Check if user has admin role
    const userRoles = session.user.roles || []
    if (!userRoles.includes('admin') && !userRoles.includes('superadmin')) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Admin access verified - return null to continue
    return null
  } catch (error) {
    console.error('Admin verification error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error during admin verification' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
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
  windowMinutes: number
): Promise<{ success: boolean; request?: Request; response?: Response; error?: string }> {
  try {
    const { getFromCache, setInCache } = await import('../redis')
    
    // Get client IP for rate limiting
    const clientIp = getClientIp(request)
    const rateLimitKey = `rate_limit:${endpoint}:${clientIp}`
    
    // Get current rate limit data
    const currentData = await getFromCache<{
      count: number
      resetTime: number
    }>(rateLimitKey)
    
    const now = Date.now()
    const windowMs = windowMinutes * 60 * 1000
    const resetTime = now + windowMs
    
    // If no data or window expired, start fresh
    if (!currentData || currentData.resetTime <= now) {
      await setInCache(rateLimitKey, {
        count: 1,
        resetTime: resetTime
      }, windowMinutes * 60)
      return { success: true, request }
    }
    
    // Check if limit exceeded
    if (currentData.count >= limit) {
      // Log rate limit violation
      await logSecurityEvent('RATE_LIMIT_EXCEEDED', null, {
        endpoint,
        currentCount: currentData.count,
        limit: limit,
        clientIp: clientIp !== 'unknown' ? clientIp : undefined
      })
      
      // Update Phase 6 MCP server
      await updatePhase6AuthenticationProgress(null, 'rate_limit_exceeded')
      
      return {
        success: false,
        response: new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((currentData.resetTime - now) / 1000)
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((currentData.resetTime - now) / 1000).toString()
          }
        }),
        error: 'Rate limit exceeded'
      }
    }
    
    // Increment counter
    await setInCache(rateLimitKey, {
      count: currentData.count + 1,
      resetTime: currentData.resetTime
    }, Math.ceil((currentData.resetTime - now) / 1000))
    
    return { success: true, request }
  } catch (error) {
    console.error('Rate limiting error:', error)
    // Fail open - allow request if rate limiting fails
    return { success: true, request }
  }
}

/**
 * CSRF protection middleware
 */
export async function csrfProtection(
  request: Request
): Promise<{ success: boolean; request?: Request; response?: Response; error?: string }> {
  // Allow GET requests without CSRF token
  if (request.method === 'GET') {
    return { success: true, request }
  }

  // For other methods, check for CSRF token
  const csrfToken = request.headers.get?.('X-CSRF-Token') ||
                   request.headers['x-csrf-token'] as string

  if (!csrfToken) {
    // Log CSRF violation
    const url = new URL(request.url)
    await logSecurityEvent('CSRF_VIOLATION', null, {
      reason: 'missing_token',
      endpoint: url.pathname
    })
    
    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(null, 'csrf_violation')
    
    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'CSRF token required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }),
      error: 'CSRF token required'
    }
  }

  try {
    const { getFromCache } = await import('../redis')
    
    // Get client IP for CSRF token lookup
    const clientIp = getClientIp(request)
    const csrfKey = `csrf:${clientIp}`
    
    // Get stored CSRF token
    const storedToken = await getFromCache<{ token: string; expiresAt: number }>(csrfKey)
    
    if (!storedToken) {
      // Log CSRF violation
      const url = new URL(request.url)
      await logSecurityEvent('CSRF_VIOLATION', null, {
        reason: 'no_stored_token',
        endpoint: url.pathname
      })
      
      // Update Phase 6 MCP server
      await updatePhase6AuthenticationProgress(null, 'csrf_violation')
      
      return {
        success: false,
        response: new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }),
        error: 'Invalid CSRF token'
      }
    }
    
    // Check if token matches
    if (storedToken.token !== csrfToken) {
      // Log CSRF violation
      const url = new URL(request.url)
      await logSecurityEvent('CSRF_VIOLATION', null, {
        reason: 'invalid_token',
        endpoint: url.pathname
      })
      
      // Update Phase 6 MCP server
      await updatePhase6AuthenticationProgress(null, 'csrf_violation')
      
      return {
        success: false,
        response: new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }),
        error: 'Invalid CSRF token'
      }
    }
    
    // Check if token has expired
    if (storedToken.expiresAt <= Date.now()) {
      // Log CSRF violation
      const url = new URL(request.url)
      await logSecurityEvent('CSRF_VIOLATION', null, {
        reason: 'expired_token',
        endpoint: url.pathname
      })
      
      // Update Phase 6 MCP server
      await updatePhase6AuthenticationProgress(null, 'csrf_violation')
      
      return {
        success: false,
        response: new Response(JSON.stringify({ error: 'CSRF token has expired' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }),
        error: 'CSRF token has expired'
      }
    }
    
    return { success: true, request }
  } catch (error) {
    console.error('CSRF validation error:', error)
    // Fail open - allow request if CSRF validation fails
    return { success: true, request }
  }
}

/**
 * Security headers middleware
 */
export async function securityHeaders(
  request: Request,
  response: Response
): Promise<Response> {
  const headers = new Headers(response.headers)

  // Remove sensitive headers
  headers.delete('X-Powered-By')
  headers.delete('Server')

  // Security headers
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-XSS-Protection', '1; mode=block')
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Enhanced CSP with frame-ancestors and object-src
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ')
  headers.set('Content-Security-Policy', csp)

  // HIPAA-compliant cache control
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')

  // CORS headers for API requests
  const origin = request.headers.get('Origin')
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token')
  }

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Max-Age', '86400')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
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
  request: Request
): Promise<{ success: boolean; request?: AuthenticatedRequest; response?: Response; error?: string }> {
  let token: string | null

  try {
    token = extractTokenFromRequest(request)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid authorization header format'
    const url = new URL(request.url)

    await logSecurityEvent('AUTHENTICATION_FAILED', null, {
      error: errorMessage,
      endpoint: url.pathname,
      reason: errorMessage,
    })

    return {
      success: false,
      response: new Response(JSON.stringify({ error: errorMessage }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }),
      error: errorMessage
    }
  }

  if (!token) {
    const url = new URL(request.url)

    await logSecurityEvent('AUTHENTICATION_FAILED', null, {
      reason: 'No authorization header',
      endpoint: url.pathname,
    })
    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }),
      error: 'No authorization header'
    }
  }

  // Validate token
  const validation = await validateToken(token)
  const url = new URL(request.url)

  if (!validation.valid) {
    let errorMessage = 'Invalid token'
    if (validation.error?.includes('expired')) {
      errorMessage = 'Token has expired'
    } else if (validation.error?.includes('revoked')) {
      errorMessage = 'Token has been revoked'
    } else if (validation.error?.includes('format')) {
      errorMessage = 'Invalid authorization header format'
    }

    await logSecurityEvent('AUTHENTICATION_FAILED', null, {
      error: validation.error || errorMessage,
      endpoint: url.pathname,
      reason: errorMessage,
    })

    return {
      success: false,
      response: new Response(JSON.stringify({ error: errorMessage }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }),
      error: errorMessage
    }
  }

  // Get user by ID
  const user = await getUserById(validation.userId)

  if (!user) {
    await logSecurityEvent('AUTHENTICATION_FAILED', validation.userId, {
      reason: 'User not found',
      endpoint: url.pathname,
    })
    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }),
      error: 'User not found'
    }
  }

  // Check if user is active (check both 'active' and 'isActive' fields)
  const isInactive = ('active' in user && user.active === false) ||
                     ('isActive' in user && user.isActive === false)

  if (isInactive) {
    await logSecurityEvent('AUTHENTICATION_FAILED', validation.userId, {
      reason: 'User account is inactive',
      endpoint: url.pathname,
    })
    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'User account is inactive' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }),
      error: 'User account is inactive'
    }
  }

  // Log successful authentication (sanitize for HIPAA compliance)
  await logSecurityEvent('AUTHENTICATION_SUCCESS', user.id, {
    role: user.role,
    tokenId: validation.tokenId,
    endpoint: url.pathname,
    timestamp: Date.now(),
    retention: 90 * 24 * 60 * 60 * 1000, // 90 days for HIPAA compliance
    // Don't log raw IP for HIPAA compliance
  })

  // Update Phase 6 authentication progress
  await updatePhase6AuthenticationProgress(user.id, 'authentication_success')

  // Create authenticated request by extending the request object
  const authenticatedRequest = request as AuthenticatedRequest
  authenticatedRequest.user = user
  authenticatedRequest.tokenId = validation.tokenId

  return { success: true, request: authenticatedRequest }
}

/**
 * Role hierarchy for authorization
 * Higher roles have access to lower role resources
 */
const ROLE_HIERARCHY: Record<string, number> = {
  admin: 100,
  therapist: 80,
  researcher: 60,
  patient: 40,
  guest: 20,
}

/**
 * Check if user role has access based on hierarchy
 */
function hasRoleAccess(userRole: string, requiredRoles: string[]): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] || 0

  // Check if any of the required roles is at or below the user's level
  return requiredRoles.some(role => {
    const requiredLevel = ROLE_HIERARCHY[role] || 0
    return userLevel >= requiredLevel
  })
}

/**
 * Require role middleware
 */
export async function requireRole(
  request: AuthenticatedRequest,
  roles: string[]
): Promise<{ success: boolean; request?: AuthenticatedRequest; response?: Response; error?: string }> {
  if (!request.user) {
    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'User not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }),
      error: 'User not authenticated'
    }
  }

  // Check role access using hierarchy
  if (!hasRoleAccess(request.user.role, roles)) {
    let endpoint = '/unknown'
    try {
      const url = new URL(request.url)
      endpoint = url.pathname
    } catch {
      // Ignore URL parsing errors for mock requests
    }

    await logSecurityEvent('AUTHORIZATION_FAILED', request.user.id, {
      requiredRoles: roles,
      userRole: request.user.role,
      endpoint,
    })

    await updatePhase6AuthenticationProgress(request.user.id, 'authorization_failed')

    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }),
      error: 'Insufficient permissions'
    }
  }

  return { success: true, request }
}
