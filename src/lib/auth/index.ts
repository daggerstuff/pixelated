/**
 * Authentication Module - Main export for Phase 7 JWT Authentication Service
 * Provides complete authentication system with Auth0 integration
 */

import type { AstroCookies } from 'astro'
import { authConfig } from '../../config/auth.config'
import { validateToken } from './auth0-jwt-service'
import { extractTokenFromRequest } from './auth0-middleware'
import { getSession } from './session'

// Re-export session for compatibility
export { getSession } from './session'
export type { SessionData } from './session'

/**
 * Get the current user from the request or cookies
 */
export async function getCurrentUser(
  context: Request | AstroCookies
): Promise<{ id: string; role: string } | null> {
  let token: string | null = null

  if ('headers' in context) {
    // It's a Request object
    token = extractTokenFromRequest(context as Request)
  } else {
    // It's AstroCookies
    // Check for Auth0 token first, then fallback to configured name
    token = (context as AstroCookies).get(authConfig.cookies.accessToken)?.value ||
      (context as AstroCookies).get('auth_token')?.value ||
      null
  }

  if (!token) {
    return null
  }

  try {
    const result = await validateToken(token, 'access')
    if (result.valid && result.userId) {
      return { id: result.userId, role: result.role || 'guest' }
    }
  } catch {
    // Token validation failed
  }

  return null
}

/**
 * Check if the current user has the specified role
 */
export async function hasRole(
  context: AstroCookies | Request,
  role: string,
): Promise<boolean> {
  const user = await getCurrentUser(context)
  if (!user) {
    return false
  }
  return user.role === role
}

/**
 * Check if the current user is authenticated
 */
export async function isAuthenticated(context: AstroCookies | Request): Promise<boolean> {
  const user = await getCurrentUser(context)
  return !!user
}

/**
 * Legacy compatibility: requirePageAuth
 */
export async function requirePageAuth(
  context: { request: Request },
  role?: string,
): Promise<Response | null> {
  const user = await getCurrentUser(context.request)

  if (!user) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login' }
    })
  }

  if (role && user.role !== role) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/access-denied' }
    })
  }

  return null
}

// Export authentication types and middleware
export * from './types'

// Export server-side auth functionality
export {
  generateTokenPair,
  validateToken,
  refreshAccessToken,
  revokeToken,
  cleanupExpiredTokens,
  measureTokenOperation,
  AuthenticationError,
} from './auth0-jwt-service'

export type {
  TokenPair,
  TokenValidationResult,
  ClientInfo,
  UserRole,
  TokenType,
} from './auth0-jwt-service'

// Auth0/Legacy Bridge exports removed

// Middleware exports
export {
  authenticateRequest,
  requireRole,
  requirePermission,
  requireAnyRole,
  requireAnyPermission,
  requireAdmin,
  requireTherapistOrHigher,
  requireAuthenticated,
  optionalAuthentication,
  extractTokenFromRequest,
  getClientIp,
  getClientInfo,
  createAuthRateLimit,
  csrfProtection,
  securityHeaders,
  createAuthMiddlewareStack,
} from './auth0-middleware'

/**
 * Initialize authentication system
 */
export async function initializeAuthSystem(): Promise<void> {
  try {
    // Start token cleanup scheduler
    const { startTokenCleanupScheduler } = await import('./auth0-jwt-service')
    startTokenCleanupScheduler()

    console.log('✅ Authentication system initialized successfully (Auth0-native)')
  } catch (_error) {
    console.error('❌ Failed to initialize authentication system:', _error)
    throw _error
  }
}

/**
 * Auth utility object for API routes
 */
export const auth = {
  getCurrentUser,
  isAuthenticated,
  hasRole,
}

export const requireAuth = requirePageAuth
