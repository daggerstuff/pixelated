/**
 * Auth0 Authentication Middleware
 * Provides request authentication validation with Auth0 integration
 */

import { ROLE_DEFINITIONS, type UserRole } from './auth0-rbac-service'
import { validateToken } from './auth0-jwt-service'
import { auth0AdaptiveMFAService } from './auth0-adaptive-mfa-service'
import { auth0UserService } from '../../services/auth0.service'

export interface ClientInfo {
  ip?: string
  userAgent?: string
  deviceId?: string
}

/**
 * Extract token from request headers or query parameters
 * Works with Web API Request type
 */
export function extractTokenFromRequest(req: Request): string | null {
  // Check Authorization header first (Web API Request uses headers.get())
  const authHeader =
    req.headers.get?.('Authorization') ||
    (req.headers as any).authorization ||
    (req.headers as any).Authorization

  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7) // Remove 'Bearer ' prefix
  }

  // Check query parameters for WebSocket connections
  try {
    const url = new URL(req.url)
    const tokenParam = url.searchParams.get('token')
    if (tokenParam) {
      return tokenParam
    }
  } catch {
    // URL parsing failed
  }

  // Check cookie for fallback
  const cookieHeader = req.headers.get?.('cookie') || (req.headers as any).cookie
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c: string) => c.trim())
    for (const cookie of cookies) {
      const [name, value] = cookie.split('=')
      if (name === 'auth_token' || name === 'auth-token') {
        return decodeURIComponent(value)
      }
    }
  }

  return null
}

/**
 * Get client IP address
 * Works with Web API Request type
 */
export function getClientIp(req: Request): string {
  const xForwardedFor =
    req.headers.get?.('x-forwarded-for') ||
    req.headers.get?.('X-Forwarded-For') ||
    (req.headers as any)['x-forwarded-for'] ||
    (req.headers as any)['X-Forwarded-For']

  const xRealIp =
    req.headers.get?.('x-real-ip') ||
    req.headers.get?.('X-Real-Ip') ||
    (req.headers as any)['x-real-ip'] ||
    (req.headers as any)['X-Real-Ip']

  return (
    (req as any).ip ||
    (typeof xForwardedFor === 'string' ? xForwardedFor.split(',')[0].trim() : null) ||
    (typeof xRealIp === 'string' ? xRealIp : null) ||
    'unknown'
  )
}

/**
 * Get client information from request
 */
export function getClientInfo(req: Request): { ip: string; userAgent: string } {
  const ip = getClientIp(req)

  const userAgent =
    req.headers.get?.('user-agent') ||
    req.headers.get?.('User-Agent') ||
    (req.headers as any)['user-agent'] ||
    (req.headers as any)['User-Agent'] ||
    'unknown'

  return { ip, userAgent }
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
  const clientIp = getClientIp(request)
  const rateLimitKey = `rate_limit:${endpoint}:${clientIp}`
  const windowSeconds = windowMinutes * 60

  const { getFromCache, setInCache } = await import('../redis')

  // Get current rate limit data
  const rateLimitData = await getFromCache(rateLimitKey)

  const now = Date.now()
  let currentCount = 0
  let resetTime = now + windowSeconds * 1000

  if (rateLimitData) {
    // Check if window has expired
    if (rateLimitData.resetTime && rateLimitData.resetTime > now) {
      currentCount = rateLimitData.count || 0
      resetTime = rateLimitData.resetTime
    } else {
      // Window expired, reset counter
      currentCount = 0
      resetTime = now + windowSeconds * 1000
    }
  }

  // Check if limit exceeded
  if (currentCount >= limit) {
    const { logSecurityEvent, SecurityEventType } = await import('../security')
    await logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, null, {
      endpoint,
      currentCount,
      limit,
      resetTime,
    })

    // Update Phase 6 MCP server
    try {
      const { updatePhase6AuthenticationProgress } = await import(
        '../mcp/phase6-integration'
      )
      await updatePhase6AuthenticationProgress(null, 'rate_limit_exceeded')
    } catch {
      // Phase 6 integration not available in test environment
    }

    return {
      success: false,
      response: new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((resetTime - now) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((resetTime - now) / 1000).toString(),
          },
        },
      ),
      error: 'Rate limit exceeded',
    }
  }

  // Increment counter
  currentCount++

  // Store updated rate limit data
  await setInCache(
    rateLimitKey,
    {
      count: currentCount,
      resetTime,
    },
    windowSeconds,
  )

  return { success: true, request }
}

/**
 * CSRF protection middleware
 */
export async function csrfProtection(request: Request): Promise<{
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
    request.headers.get?.('x-csrf-token') ||
    (request.headers as any)['X-CSRF-Token'] ||
    (request.headers as any)['x-csrf-token']

  if (!csrfToken) {
    const { logSecurityEvent, SecurityEventType } = await import('../security')
    await logSecurityEvent(SecurityEventType.CSRF_VIOLATION, null, {
      reason: 'missing_token',
      endpoint: new URL(request.url).pathname,
    })

    // Update Phase 6 MCP server
    try {
      const { updatePhase6AuthenticationProgress } = await import(
        '../mcp/phase6-integration'
      )
      await updatePhase6AuthenticationProgress(null, 'csrf_violation')
    } catch {
      // Phase 6 integration not available in test environment
    }

    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'CSRF token required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
      error: 'CSRF token required',
    }
  }

  // Validate the token against stored tokens
  const { getFromCache } = await import('../redis')
  const tokenKey = `csrf:${csrfToken}`
  const storedToken = await getFromCache(tokenKey)

  if (!storedToken) {
    const { logSecurityEvent, SecurityEventType } = await import('../security')
    await logSecurityEvent(SecurityEventType.CSRF_VIOLATION, null, {
      reason: 'invalid_token',
      endpoint: new URL(request.url).pathname,
    })

    // Update Phase 6 MCP server
    try {
      const { updatePhase6AuthenticationProgress } = await import(
        '../mcp/phase6-integration'
      )
      await updatePhase6AuthenticationProgress(null, 'csrf_violation')
    } catch {
      // Phase 6 integration not available in test environment
    }

    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
      error: 'Invalid CSRF token',
    }
  }

  // Check if token matches stored token
  if (storedToken.token && storedToken.token !== csrfToken) {
    const { logSecurityEvent, SecurityEventType } = await import('../security')
    await logSecurityEvent(SecurityEventType.CSRF_VIOLATION, null, {
      reason: 'invalid_token',
      endpoint: new URL(request.url).pathname,
    })

    // Update Phase 6 MCP server
    try {
      const { updatePhase6AuthenticationProgress } = await import(
        '../mcp/phase6-integration'
      )
      await updatePhase6AuthenticationProgress(null, 'csrf_violation')
    } catch {
      // Phase 6 integration not available in test environment
    }

    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
      error: 'Invalid CSRF token',
    }
  }

  // Check if token has expired
  if (storedToken.expiresAt && storedToken.expiresAt < Date.now()) {
    const { logSecurityEvent, SecurityEventType } = await import('../security')
    await logSecurityEvent(SecurityEventType.CSRF_VIOLATION, null, {
      reason: 'expired_token',
      endpoint: new URL(request.url).pathname,
    })

    // Update Phase 6 MCP server
    try {
      const { updatePhase6AuthenticationProgress } = await import(
        '../mcp/phase6-integration'
      )
      await updatePhase6AuthenticationProgress(null, 'csrf_violation')
    } catch {
      // Phase 6 integration not available in test environment
    }

    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: 'CSRF token has expired' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
      error: 'CSRF token has expired',
    }
  }

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
    "default-src 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; base-uri 'self'; form-action 'self'",
  )
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  headers.delete('X-Powered-By')
  headers.delete('Server')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')

  // Add CORS headers for API requests
  const origin =
    request.headers.get?.('Origin') ||
    request.headers.get?.('origin') ||
    (request.headers as any).Origin ||
    (request.headers as any).origin

  const allowedOrigins = [
    'https://app.example.com',
    process.env.ALLOWED_ORIGIN || 'http://localhost:4321',
  ]

  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS',
    )
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-CSRF-Token',
    )
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Access-Control-Max-Age', '86400')
    headers.set('Vary', 'Origin')
  }

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers,
    })
  }

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
  sessionId?: string
}

/**
 * Authenticate request middleware using Auth0
 */
export async function authenticateRequest(request: Request): Promise<{
  success: boolean
  request?: AuthenticatedRequest
  response?: Response
  error?: string
}> {
  // Extract authorization header - use comprehensive extraction
  const authHeader =
    request.headers.get?.('Authorization') ||
    request.headers.get?.('authorization') ||
    (request.headers as any)?.Authorization ||
    (request.headers as any)?.authorization ||
    (request.headers as any)?.get?.('Authorization')

  if (!authHeader) {
    const { logSecurityEvent, SecurityEventType } = await import('../security')
    await logSecurityEvent(SecurityEventType.AUTHENTICATION_FAILED, null, {
      error: 'No authorization header',
      endpoint: new URL(request.url).pathname,
    })

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

  // Check authorization header format
  if (!authHeader.startsWith('Bearer ')) {
    const { logSecurityEvent, SecurityEventType } = await import('../security')
    await logSecurityEvent(SecurityEventType.AUTHENTICATION_FAILED, null, {
      error: 'Invalid authorization header format',
      endpoint: new URL(request.url).pathname,
    })

    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: 'Invalid authorization header format' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
      error: 'Invalid authorization header format',
    }
  }

  // Extract token
  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  // Validate token using Auth0
  const validation = await validateToken(token, 'access')

  if (!validation.valid) {
    const { logSecurityEvent, SecurityEventType } = await import('../security')
    await logSecurityEvent(SecurityEventType.AUTHENTICATION_FAILED, null, {
      error: validation.error || 'Invalid token',
      endpoint: new URL(request.url).pathname,
    })

    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: validation.error || 'Invalid token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
      error: validation.error || 'Invalid token',
    }
  }

  // Get user information from Auth0
  const user = await auth0UserService.getUserById(validation.userId!)

  if (!user) {
    const { logSecurityEvent, SecurityEventType } = await import('../security')
    await logSecurityEvent(SecurityEventType.AUTHENTICATION_FAILED, null, {
      error: 'User not found',
      endpoint: new URL(request.url).pathname,
    })

    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
      error: 'User not found',
    }
  }

  // Check if user has MFA enabled
  const hasMFA = await auth0UserService.userHasMFA(user.id)

  // Device/Session Binding Check
  const sid = validation.payload?.sid;
  if (sid) {
    const { getFromCache, setInCache } = await import('../redis');
    const bindingKey = `session_binding:${user.id}:${sid}`;
    const clientInfo = getClientInfo(request);
    const storedBinding = await getFromCache(bindingKey);

    if (storedBinding) {
      // Verify IP binding (allow some flexibility if needed, but strict for now)
      if (storedBinding.ip !== clientInfo.ip) {
        const { logSecurityEvent, SecurityEventType } = await import('../security');
        await logSecurityEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, user.id, {
          reason: 'ip_mismatch',
          storedIp: storedBinding.ip,
          currentIp: clientInfo.ip,
          endpoint: new URL(request.url).pathname
        });

        // We could block here, but for now we'll just log and maybe require MFA
        // If we wanted to block:
        // return { success: false, response: ..., error: 'Session IP mismatch' }
      }
    } else {
      // Trust On First Use (TOFU) - Bind session to this IP
      await setInCache(bindingKey, {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        boundAt: Date.now()
      }, 24 * 60 * 60); // 24 hours
    }
  }

  // If user doesn't have MFA enabled, check if adaptive MFA requires it
  if (!hasMFA) {
    try {
      // Get client information for risk assessment (already fetched above if sid exists, but reliable here)
      const clientInfo = getClientInfo(request);

      // Create login context for risk assessment
      const loginContext = {
        userId: user.id,
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        timestamp: new Date(),
        location: {
          // In a real implementation, we would get geolocation from IP
          // For now, we'll simulate based on IP
          country: clientInfo.ip.startsWith('192.168.') || clientInfo.ip.startsWith('10.') || clientInfo.ip.startsWith('172.')
            ? 'LOCAL'
            : 'US' // Default to US for external IPs
        }
      }

      // Check if adaptive MFA requires MFA for this login
      const requiresMFA = await auth0AdaptiveMFAService.shouldRequireMFA(loginContext)

      if (requiresMFA) {
        // Log that MFA is required
        const { logSecurityEvent, SecurityEventType } = await import('../security')
        await logSecurityEvent(SecurityEventType.MFA_REQUIRED, user.id, {
          reason: 'adaptive_mfa_triggered',
          riskFactors: 'calculated_by_adaptive_service',
          endpoint: new URL(request.url).pathname,
        })

        // Return response indicating MFA is required
        return {
          success: false,
          response: new Response(
            JSON.stringify({
              error: 'MFA required',
              message: 'Multi-factor authentication is required for this login attempt',
              code: 'MFA_REQUIRED'
            }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
          error: 'MFA required',
        }
      }
    } catch (error) {
      console.warn('Failed to perform adaptive MFA check:', error)
      // Continue with authentication if adaptive MFA check fails
    }
  }

  // Log successful authentication
  const { logSecurityEvent, SecurityEventType } = await import('../security')
  await logSecurityEvent(SecurityEventType.AUTHENTICATION_SUCCESS, user.id, {
    tokenId: validation.tokenId,
    endpoint: new URL(request.url).pathname,
    timestamp: Date.now(),
    retention: 31536000000, // 1 year in milliseconds
  })

  // Update Phase 6 MCP server
  try {
    const { updatePhase6AuthenticationProgress } = await import(
      '../mcp/phase6-integration'
    )
    await updatePhase6AuthenticationProgress(user.id, 'authentication_success')
  } catch {
    // Phase 6 integration not available in test environment
  }

  // Attach user to request
  const authenticatedRequest = request as AuthenticatedRequest
  authenticatedRequest.user = {
    id: user.id,
    email: user.email,
    role: user.role,
  }
  authenticatedRequest.tokenId = validation.tokenId
  authenticatedRequest.sessionId = sid

  return { success: true, request: authenticatedRequest }
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
      const { logSecurityEvent, SecurityEventType } = await import('../security')
      await logSecurityEvent(SecurityEventType.AUTHORIZATION_FAILED, request.user.id, {
        requiredRoles: roles,
        userRole: request.user.role,
      })
    } catch {
      // Security module not available in test environment
    }

    // Update Phase 6 MCP server
    try {
      const { updatePhase6AuthenticationProgress } = await import(
        '../mcp/phase6-integration'
      )
      await updatePhase6AuthenticationProgress(
        request.user.id,
        'authorization_failed',
      )
    } catch {
      // Phase 6 integration not available in test environment
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