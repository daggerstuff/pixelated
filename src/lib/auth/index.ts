/**
 * Authentication Module - Main export for Phase 7 JWT Authentication Service
 * Provides complete authentication system with Better-Auth integration
 */

import type { AstroCookies } from 'astro'
import { getCurrentUser } from '../auth'

/**
 * Check if the current user has the specified role
 */
export async function hasRole(
  cookies: AstroCookies,
  role: string,
): Promise<boolean> {
  const user = await getCurrentUser(cookies)
  if (!user) {
    return false
  }
  return user.role === role
}

/**
 * Check if the current user is authenticated
 */
export async function isAuthenticated(cookies: AstroCookies): Promise<boolean> {
  const user = await getCurrentUser(cookies)
  return !!user
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
} from './middleware'

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
  } catch (_error) {
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
export { requirePageAuth as requireAuth } from './serverAuth'
