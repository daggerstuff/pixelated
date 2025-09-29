<<<<<<< Updated upstream
=======
export * from './middleware'
// Re-export session functions
export { createSession, endSession, getSession } from './session'

import type { AstroCookies } from 'astro'
import type { User } from './index'

>>>>>>> Stashed changes
/**
 * Authentication Module - Main export for Phase 7 JWT Authentication Service
 * Provides complete authentication system with Better-Auth integration
 */

// JWT Service exports
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

export type { AuthenticatedRequest, ClientInfo as MiddlewareClientInfo } from './middleware'

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
    const { initializeBetterAuthDatabase } = await import('./better-auth-integration')
    await initializeBetterAuthDatabase()

    // Start token cleanup scheduler
    const { startTokenCleanupScheduler } = await import('./jwt-service')
    startTokenCleanupScheduler()

    console.log('✅ Authentication system initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize authentication system:', error)
    throw error
  }
}

/**
 * Create authentication API routes
 */
export class AuthService {
  private sessions = new Map<string, AuthSession>()
  private users = new Map<string, User>()
  private resetTokens = new Map<string, PasswordResetRequest>()

  constructor() {
    logger.info('AuthService initialized')
    this.initializeMockUsers()
  }

  /**
   * Authenticate user with email and password
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      logger.debug('Authenticating user', { email: credentials.email })

      // Find user by email
      const user = Array.from(this.users.values()).find(
        (u) => u.email === credentials.email,
      )

      if (!user) {
        return {
          success: false,
          error: 'Invalid email or password',
        }
      }

      // In production, verify password hash
      // For now, accept any password for demo users
      if (!this.verifyPassword(credentials.password, user)) {
        return {
          success: false,
          error: 'Invalid email or password',
        }
      }

      if (!user.verified) {
        return {
          success: false,
          error: 'Email verification required',
          requiresVerification: true,
        }
      }

      // Create session
      const session = this.createSession(user.id)

      // Update last login
      user.lastLoginAt = new Date()

      logger.info('User authenticated successfully', {
        userId: user.id,
        email: user.email,
      })

      return {
        success: true,
        user,
        session,
      }
    } catch (error: unknown) {
      logger.error('Authentication failed', { error, email: credentials.email })
      return {
        success: false,
        error: 'Authentication failed',
      }
    }
  }

  /**
   * Create a new user account
   */
  async createUser(userData: {
    email: string
    password: string
    name?: string
    role?: User['role']
  }): Promise<AuthResult> {
    try {
      logger.debug('Creating new user', { email: userData.email })

      // Check if user already exists
      const existingUser = Array.from(this.users.values()).find(
        (u) => u.email === userData.email,
      )
      if (existingUser) {
        return {
          success: false,
          error: 'User with this email already exists',
        }
      }

      // Create new user
      const user: User = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: userData.email,
        name: userData.name ?? '', // Ensure name is always a string
        role: userData.role || 'user',
        verified: false, // Requires email verification
        createdAt: new Date(),
      }

      this.users.set(user.id, user)

      logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
      })

      return {
        success: true,
        user,
        requiresVerification: true,
      }
    } catch (error: unknown) {
      logger.error('User creation failed', { error, email: userData.email })
      return {
        success: false,
        error: 'Failed to create user account',
      }
    }
  }

  /**
   * Verify user session
   */
  async verifySession(sessionId: string): Promise<AuthResult> {
    try {
      const session = this.sessions.get(sessionId)

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return {
          success: false,
          error: 'Invalid or expired session',
        }
      }

      const user = this.users.get(session.userId)
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        }
      }

      return {
        success: true,
        user,
        session,
      }
    } catch (error: unknown) {
      logger.error('Session verification failed', { error, sessionId })
      return {
        success: false,
        error: 'Session verification failed',
      }
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logout(sessionId: string): Promise<boolean> {
    try {
      const session = this.sessions.get(sessionId)
      if (session) {
        session.isActive = false
        logger.info('User logged out', { userId: session.userId, sessionId })
      }
      return true
    } catch (error: unknown) {
      logger.error('Logout failed', { error, sessionId })
      return false
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<boolean> {
    try {
      const user = Array.from(this.users.values()).find(
        (u) => u.email === email,
      )
      if (!user) {
        // Don't reveal if email exists
        return true
      }

      const token = this.generateResetToken()
      const resetRequest: PasswordResetRequest = {
        email,
        token,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        used: false,
      }

      this.resetTokens.set(token, resetRequest)

      logger.info('Password reset requested', { email, token })
      return true
    } catch (error: unknown) {
      logger.error('Password reset request failed', { error, email })
      return false
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const resetRequest = this.resetTokens.get(token)

      if (
        !resetRequest ||
        resetRequest.used ||
        resetRequest.expiresAt < new Date()
      ) {
        return false
      }

      const user = Array.from(this.users.values()).find(
        (u) => u.email === resetRequest.email,
      )
      if (!user) {
        return false
      }

      // In production, hash the new password
      // user.password = await hashPassword(newPassword)
      resetRequest.used = true

      logger.info('Password reset successfully', {
        userId: user.id,
        passwordLength: newPassword.length,
      })
      return true
    } catch (error: unknown) {
      logger.error('Password reset failed', { error, token })
      return false
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.users.get(userId) || null
  }

  private createSession(userId: string): AuthSession {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const session: AuthSession = {
      userId,
      sessionId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      isActive: true,
    }

    this.sessions.set(sessionId, session)
    return session
  }

  private verifyPassword(password: string, _user: User): boolean {
    // In production, use proper password hashing (bcrypt, argon2, etc.)
    // For demo purposes, accept any non-empty password
    // Would normally check: bcrypt.compare(password, user.hashedPassword)
    return password.length >= 6
  }

  private generateResetToken(): string {
    return `reset_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`
  }

  private initializeMockUsers() {
    // Create some demo users for testing
    const demoUsers: User[] = [
      {
        id: 'user_demo_admin',
        email: 'admin@pixelated.health',
        name: 'System Administrator',
        role: 'admin',
        verified: true,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'user_demo_therapist',
        email: 'therapist@pixelated.health',
        name: 'Dr. Sarah Johnson',
        role: 'therapist',
        verified: true,
        createdAt: new Date('2024-01-15'),
      },
      {
        id: 'user_demo_patient',
        email: 'patient@pixelated.health',
        name: 'John Doe',
        role: 'patient',
        verified: true,
        createdAt: new Date('2024-02-01'),
      },
    ]

    demoUsers.forEach((user) => {
      this.users.set(user.id, user)
    })

    logger.info('Demo users initialized', { count: demoUsers.length })
  }
}

// Default auth service instance
let authServiceInstance: AuthService | null = null

/**
 * Get the default auth service instance
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
<<<<<<< Updated upstream
=======
export { requirePageAuth as requireAuth } from './serverAuth'
>>>>>>> Stashed changes
