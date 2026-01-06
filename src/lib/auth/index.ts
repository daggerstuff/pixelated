/**
 * Authentication Module - Main export for Phase 7 JWT Authentication Service
 * Provides complete authentication system with Better-Auth integration
 */

import type { AstroCookies } from 'astro'
import { authConfig } from '../../config/auth.config'
import { validateToken } from './jwt-service'
import { extractTokenFromRequest } from './auth0-middleware'
import { getSession } from './session'

// Re-export session for compatibility
export { getSession } from './session'

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
    token = context.get(authConfig.cookies.accessToken)?.value ||
      context.get('auth_token')?.value ||
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
      headers: { Location: '/auth/login' }
    })
  }

  if (role && user.role !== role) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/access-denied' } // Updated to use configured forbidden path if available
    })
  }

  return null
}


export type { SessionData } from './session'
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
} from './jwt-service'

export type {
  TokenPair,
  TokenValidationResult,
  ClientInfo,
  UserRole,
  TokenType,
} from './jwt-service'

// Better-Auth Integration exports
export {
  registerWithBetterAuth,
  authenticateWithBetterAuth,
  logoutFromBetterAuth,
  getUserAuthentication,
  getUserAuthenticationByBetterAuthId,
  updateUserAuthentication,
  validateJWTAndGetUser,
  hasRequiredRole,
  hasPermission,
  getBetterAuthInstance,
} from './better-auth-integration'

export type {
  UserAuthentication,
  AuthenticationResult,
  LoginCredentials,
  RegisterCredentials,
} from './better-auth-integration'

export { AuthenticationStatus } from './better-auth-integration'

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

export type {
  AuthenticatedRequest,
  ClientInfo as MiddlewareClientInfo,
} from './middleware'

// Utility functions
export * from './utils'

// Configuration
export { getAuthConfig } from './config'

// Integration with Phase 6 MCP Server
export { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'

/**
 * Initialize authentication system
 */
export async function initializeAuthSystem(): Promise<void> {
  try {
    // Initialize Better-Auth database connection
    const { initializeBetterAuthDatabase } = await import(
      './better-auth-integration'
    )
    await initializeBetterAuthDatabase()

    // Start token cleanup scheduler
    const { startTokenCleanupScheduler } = await import('./jwt-service')
    startTokenCleanupScheduler()

    console.log('✅ Authentication system initialized successfully')
  } catch (_error) {
    console.error('❌ Failed to initialize authentication system:', _error)
    throw _error
  }
}

/**
 * Create authentication API routes
 */
export async function createAuthRoutes() {
  // TODO: Implement when routes file is available
  throw new Error('Auth routes not implemented yet')
}

/**
 * Health check for authentication system
 */
export async function getAuthHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  details: {
    jwtService: boolean
    betterAuth: boolean
    redis: boolean
    database: boolean
  }
}> {
  try {
    const { checkRedisConnection } = await import('../redis')

    const [redisHealth] = await Promise.allSettled([checkRedisConnection()])

    const details = {
      jwtService: true, // JWT service is stateless
      betterAuth: true, // Better-Auth health would go here
      redis: redisHealth.status === 'fulfilled' && redisHealth.value,
      database: true, // Database health would be checked here
    }

    const allHealthy = Object.values(details).every((health) => health)

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      details,
    }
  } catch {
    return {
      status: 'unhealthy',
      details: {
        jwtService: false,
        betterAuth: false,
        redis: false,
        database: false,
      },
    }
  }
}

/**
 * Default export for convenience
 */
export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService()
  }
  return authServiceInstance
}

/**
 * Authenticate user
 */
export async function authenticate(
  credentials: AuthCredentials,
): Promise<AuthResult> {
  const authService = getAuthService()
  return authService.authenticate(credentials)
}

/**
 * Verify session
 */
export async function verifySession(sessionId: string): Promise<AuthResult> {
  const authService = getAuthService()
  return authService.verifySession(sessionId)
}

/**
 * Create new user
 */
export async function createUser(
  userData: Parameters<AuthService['createUser']>[0],
): Promise<AuthResult> {
  const authService = getAuthService()
  return authService.createUser(userData)
}

/**
 * Auth utility object for API routes
 */
export const auth = {
  verifySession,
  getCurrentUser,
  isAuthenticated,
  hasRole,
  authenticate,
  createUser,
}
export const requireAuth = requirePageAuth
