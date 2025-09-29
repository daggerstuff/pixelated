/**
 * Authentication Middleware - Request authentication validation with Better-Auth integration
 * Provides role-based authorization and permission checking
 */

import type { Request, Response, NextFunction } from 'express'
import { validateToken } from './jwt-service'
import {
  getUserAuthentication,
  hasRequiredRole,
  hasPermission,
  type UserRole,
} from './better-auth-integration'
import { logSecurityEvent, SecurityEventType } from '../security'
// Note: updatePhase6AuthenticationProgress intentionally not imported here because
// it's not used by this middleware. Import it where needed by callers.

// Client info extraction
export interface ClientInfo {
  ip?: string
  userAgent?: string
  deviceId?: string
}

/**
 * Main authentication middleware function
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(req)

    if (!token) {
      return sendUnauthorizedResponse(res, 'No authentication token provided')
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return sendUnauthorizedResponse(res, 'Invalid authentication token')
    }

    // Check if user account is in good standing
    const userAuth = getUserAuthentication(validation.userId!)

    if (!userAuth || userAuth.authenticationStatus !== 'authenticated') {
      return sendUnauthorizedResponse(res, 'User account is not authenticated')
    }

    // Check for account lockout or suspension
    if (userAuth.authenticationStatus === 'account_locked') {
      return sendUnauthorizedResponse(res, 'Account is locked')
    }

    if (userAuth.authenticationStatus === 'suspended') {
      return sendUnauthorizedResponse(res, 'Account is suspended')
    }

    // Add user information to request context
    req.context = req.context || {}
    req.context.user = {
      id: validation.userId!,
      role: validation.role!,
      tokenId: validation.tokenId!,
      email: userAuth.email,
    }

    // Log successful authentication
    await logSecurityEvent(SecurityEventType.AUTHENTICATION_SUCCESS, validation.userId!, {
      endpoint: req.path,
      method: req.method,
      ipAddress: getClientIp(req),
    })

    // Proceed to next middleware
    next()
  } catch (error) {
    // Log authentication failure
    await logSecurityEvent(SecurityEventType.AUTHENTICATION_FAILURE, null, {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: req.path,
      method: req.method,
      ipAddress: getClientIp(req),
    })

    return sendUnauthorizedResponse(res, 'Authentication failed')
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(requiredRole: UserRole) {
  return async function(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = req.context?.user

    if (!user) {
      return sendUnauthorizedResponse(res, 'User context not found')
    }

    // Check role hierarchy
    if (!hasRequiredRole(user.role, requiredRole)) {
      await logSecurityEvent(SecurityEventType.PERMISSION_DENIED, user.id, {
        requiredRole: requiredRole,
        userRole: user.role,
        endpoint: req.path,
      })

      return sendForbiddenResponse(res, 'Insufficient permissions')
    }

    next()
  }
}

/**
 * Permission-based authorization middleware
 * Permission-based authorization middleware
 */
export function requirePermission(permission: string) {
  return async function(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = req.context?.user

    if (!user) {
      return sendUnauthorizedResponse(res, 'User context not found')
    }

    // Check if user has required permission
    if (!hasPermission(user.role, permission)) {
      await logSecurityEvent(SecurityEventType.PERMISSION_DENIED, user.id, {
        requiredPermission: permission,
        userRole: user.role,
        endpoint: req.path,
      })

      return sendForbiddenResponse(res, 'Permission denied')
    }

    next()
  }
}

/**
 * Multi-role authorization middleware (user must have at least one of the specified roles)
 */
export function requireAnyRole(allowedRoles: UserRole[]) {
  return async function(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = req.context?.user

    if (!user) {
      return sendUnauthorizedResponse(res, 'User context not found')
    }

    const hasAllowedRole = allowedRoles.some(role => hasRequiredRole(user.role, role))

    if (!hasAllowedRole) {
      await logSecurityEvent(SecurityEventType.PERMISSION_DENIED, user.id, {
        requiredRoles: allowedRoles,
        userRole: user.role,
        endpoint: req.path,
      })

      return sendForbiddenResponse(res, 'Insufficient permissions')
    }

    next()
  }
}

/**
 * Multi-permission authorization middleware (user must have at least one of the specified permissions)
 */
export function requireAnyPermission(permissions: string[]) {
  return async function(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = req.context?.user

    if (!user) {
      return sendUnauthorizedResponse(res, 'User context not found')
    }

    const hasAllowedPermission = permissions.some(permission => hasPermission(user.role, permission))

    if (!hasAllowedPermission) {
      await logSecurityEvent(SecurityEventType.PERMISSION_DENIED, user.id, {
        requiredPermissions: permissions,
        userRole: user.role,
        endpoint: req.path,
      })

      return sendForbiddenResponse(res, 'Permission denied')
    }

    next()
  }
}

/**
 * Admin-only middleware (convenience wrapper)
 */
export const requireAdmin = requireRole('admin')

/**
 * Therapist or higher middleware (convenience wrapper)
 */
export const requireTherapistOrHigher = requireRole('therapist')

/**
 * Authenticated user middleware (just checks if user is logged in)
 * Admin-only middleware (convenience wrapper)
 */
export const requireAdmin = requireRole('admin')

/**
 * Therapist or higher middleware (convenience wrapper)
 */
export const requireTherapistOrHigher = requireRole('therapist')

/**
 * Authenticated user middleware (just checks if user is logged in)
 */
export async function requireAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.context?.user) {
    return sendUnauthorizedResponse(res, 'Authentication required')
  }
  next()
}

/**
 * Optional authentication middleware (adds user context if available)
 */
export async function optionalAuthentication(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromRequest(req)

    if (token) {
      const validation = await validateToken(token, 'access')

      if (validation.valid && validation.userId) {
        const userAuth = getUserAuthentication(validation.userId)

        if (userAuth && userAuth.authenticationStatus === 'authenticated') {
          req.context = req.context || {}
          req.context.user = {
            id: validation.userId,
            role: validation.role!,
            tokenId: validation.tokenId!,
            email: userAuth.email,
          }
        }
      }
    }

    next()
  } catch (error) {
    // Log but don't block - this is optional authentication
    console.warn('Optional authentication failed:', error)
    next()
  }
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
  const tokenParam = req.query.token as string

  if (tokenParam) {
    return tokenParam
  }

  // Check cookie for fallback
  const tokenCookie = req.cookies?.auth_token

  if (tokenCookie) {
    return tokenCookie
  }

  return null
}

/**
 * Get client IP address
 */
export function getClientIp(req: Request): string {
  return req.ip ||
         req.headers['x-forwarded-for'] as string ||
         req.headers['x-real-ip'] as string ||
         'unknown'
}

/**
 * Get client info from request
 */
export function getClientInfo(req: Request): ClientInfo {
  return {
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'] as string,
    deviceId: req.headers['x-device-id'] as string,
  }
}

/**
 * Send unauthorized response (401)
 */
function sendUnauthorizedResponse(res: Response, message: string): void {
  res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: message,
    },
  })
}

/**
 * Send forbidden response (403)
 */
function sendForbiddenResponse(res: Response, message: string): void {
  res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: message,
    },
  })
}

/**
 * Rate limiting middleware for authentication endpoints
 */
export function createAuthRateLimit(options: {
  windowMs?: number
  max?: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
} = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 5, // limit each IP to 5 requests per windowMs
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options

  const requests = new Map<string, { count: number; resetTime: number }>()

  return async function(req: Request, res: Response, next: NextFunction): Promise<void> {
    const ip = getClientIp(req)
    const now = Date.now()

    let requestData = requests.get(ip)

    if (!requestData || now > requestData.resetTime) {
      requestData = { count: 0, resetTime: now + windowMs }
      requests.set(ip, requestData)
    }

    // Check if limit exceeded
    if (requestData.count >= max) {
      await logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, null, {
        ipAddress: ip,
        endpoint: req.path,
        limit: max,
        windowMs: windowMs,
      })

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          retryAfter: Math.ceil((requestData.resetTime - now) / 1000),
        },
      })
      })
    }

    // Increment counter
    requestData.count++

    // Store original send function
    const originalSend = res.send

    // Override send to track response status
    res.send = function(body: unknown): Response {
      const shouldSkip =
        (res.statusCode < 400 && skipSuccessfulRequests) ||
        (res.statusCode >= 400 && skipFailedRequests)

      if (shouldSkip) {
        requestData!.count--
      }

  // Forward the body to the original send implementation
  return originalSend.call(this, body as Parameters<typeof originalSend>[0])
    }

    next()
  }
}

/**
 * CSRF protection middleware
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  // Check for CSRF token
  const csrfToken = req.headers['x-csrf-token'] as string || req.body?._csrf

  if (!csrfToken) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token is required',
      },
    })
  }

  // Validate CSRF token (implement proper validation)
  // This is a simplified example - use proper CSRF token generation/validation

  next()
}

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // CSP header (adjust based on your needs)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none';"
  )

  next()
}

/**
 * Combined authentication middleware stack
 */
export function createAuthMiddlewareStack(options: {
  requireAuth?: boolean
  requiredRole?: UserRole
  requiredPermission?: string
  rateLimit?: boolean
  csrf?: boolean
  securityHeaders?: boolean
} = {}) {
  const {
    requireAuth = true,
    requiredRole,
    requiredPermission,
    rateLimit = true,
    csrf = true,
    securityHeaders = true,
  } = options

  const middlewares = []

  // Security headers first
  if (securityHeaders) {
    middlewares.push(securityHeaders)
  }

  // Rate limiting for auth endpoints
  if (rateLimit) {
    middlewares.push(createAuthRateLimit())
  }

  // CSRF protection
  if (csrf) {
    middlewares.push(csrfProtection)
  }

  // Authentication
  if (requireAuth) {
    middlewares.push(authenticateRequest)
  } else {
    middlewares.push(optionalAuthentication)
  }

  // Authorization
  if (requiredRole) {
    middlewares.push(requireRole(requiredRole))
  }

  if (requiredPermission) {
    middlewares.push(requirePermission(requiredPermission))
  }

  return middlewares
}

// Export types for better TypeScript support
export interface AuthenticatedRequest extends Request {
  context?: {
    user?: {
      id: string
      role: UserRole
      tokenId: string
      email: string
    }
  }
}
