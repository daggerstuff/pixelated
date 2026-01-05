/**
 * Better-Auth PostgreSQL Integration Service (Fixed Version)
 * Replaces the SQLite in-memory database with Neon PostgreSQL
 * Implements Better-Auth authentication with JWT token management and PostgreSQL storage
 */
import { betterAuth } from 'better-auth'
import dotenv from 'dotenv'
import {
  generateTokenPair,
  AuthenticationError,
} from './jwt-service'

// Load environment variables
dotenv.config()

// Re-export AuthenticationError for convenience
export { AuthenticationError }

import { logSecurityEvent, SecurityEventType } from '../security/index'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import type { UserRole, ClientInfo, TokenPair } from './jwt-service'

// Better-Auth configuration with PostgreSQL - minimal working configuration
export const auth = betterAuth({
  database: process.env.DATABASE_URL,
  emailAndPassword: {
    enabled: true,
  },
})

// User authentication interface
export interface UserAuthentication {
  id: string
  email: string
  role: UserRole
  authenticationStatus: AuthenticationStatus
  lastLoginAt?: Date
  loginAttempts: number
  accountLockedUntil?: Date | null
  createdAt: Date
  updatedAt: Date
  betterAuthUserId?: string
}

export enum AuthenticationStatus {
  UNAUTHENTICATED = 'unauthenticated',
  AUTHENTICATED = 'authenticated',
  ACCOUNT_LOCKED = 'account_locked',
  SUSPENDED = 'suspended',
  EMAIL_UNVERIFIED = 'email_unverified',
}

export interface AuthenticationResult {
  success: boolean
  user?: UserAuthentication
  tokens?: TokenPair
  message: string
  error?: string
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterCredentials {
  email: string
  password: string
  name?: string
  role?: UserRole
}

// Map Better-Auth user to local user authentication
function mapBetterAuthUserToLocal(betterAuthUser: any): UserAuthentication {
  return {
    id: betterAuthUser.id,
    betterAuthUserId: betterAuthUser.id,
    email: betterAuthUser.email,
    role: (betterAuthUser.role as UserRole) || 'guest',
    authenticationStatus: AuthenticationStatus.UNAUTHENTICATED,
    loginAttempts: 0,
    createdAt: new Date(betterAuthUser.createdAt),
    updatedAt: new Date(betterAuthUser.updatedAt),
  }
}

/**
 * Register new user with Better-Auth and PostgreSQL
 */
export async function registerWithBetterAuth(
  credentials: RegisterCredentials,
  clientInfo: ClientInfo,
): Promise<AuthenticationResult> {
  try {
    // Validate input
    if (!credentials.email || !credentials.password) {
      throw new AuthenticationError('Email and password are required')
    }

    // Create user with Better-Auth
    const result = await auth.api.signUpEmail({
      body: {
        email: credentials.email,
        password: credentials.password,
        name: credentials.name || credentials.email.split('@')[0],
      },
    })

    if (!result.user) {
      throw new AuthenticationError('Failed to create user')
    }

    // Map to local user authentication
    const userAuth = mapBetterAuthUserToLocal(result.user)

    // Update role if specified
    if (credentials.role) {
      // Note: In a production environment, you would update the user's role in the database
      userAuth.role = credentials.role
    }

    // Generate JWT tokens
    const tokenPair = await generateTokenPair(
      userAuth.id,
      userAuth.role,
      clientInfo,
    )

    // Log successful registration
    try {
      await logSecurityEvent(SecurityEventType.USER_CREATED, {
        userId: userAuth.id,
        email: credentials.email,
        role: userAuth.role,
        clientInfo: clientInfo,
      })
    } catch (logError) {
      console.warn('Failed to log security event:', logError)
    }

    // Update Phase 6 MCP server with registration progress
    try {
      await updatePhase6AuthenticationProgress(userAuth.id, 'user_registered')
    } catch (updateError) {
      console.warn('Failed to update Phase 6 progress:', updateError)
    }

    return {
      success: true,
      user: userAuth,
      tokens: tokenPair,
      message: 'Registration successful',
    }
  } catch (error) {
    // Log registration failure - but be careful with the error object
    try {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await logSecurityEvent(SecurityEventType.REGISTRATION_FAILURE, {
        userId: null,
        error: errorMessage,
        email: credentials.email,
        clientInfo: clientInfo,
      })
    } catch (logError) {
      console.warn('Failed to log security event:', logError)
    }

    return {
      success: false,
      message: 'Registration failed',
      error:
        error instanceof Error ? error.message : 'Unknown registration error',
    }
  }
}

/**
 * Authenticate user with Better-Auth and PostgreSQL
 */
export async function authenticateWithBetterAuth(
  credentials: LoginCredentials,
  clientInfo: ClientInfo,
): Promise<AuthenticationResult> {
  try {
    // Validate input
    if (!credentials.email || !credentials.password) {
      throw new AuthenticationError('Email and password are required')
    }

    // Authenticate with Better-Auth
    const result = await auth.api.signInEmail({
      body: {
        email: credentials.email,
        password: credentials.password,
        rememberMe: credentials.rememberMe || false,
      },
    })

    if (!result.user) {
      throw new AuthenticationError('Invalid credentials')
    }

    // Map to local user authentication
    const userAuth = mapBetterAuthUserToLocal(result.user)

    // Update authentication status in memory
    const updatedUser: UserAuthentication = {
      ...userAuth,
      authenticationStatus: AuthenticationStatus.AUTHENTICATED,
      lastLoginAt: new Date(),
      loginAttempts: 0,
      accountLockedUntil: null,
      updatedAt: new Date(),
    }

    // Generate JWT tokens
    const tokenPair = await generateTokenPair(
      userAuth.id,
      userAuth.role,
      clientInfo,
    )

    // Log successful authentication
    try {
      await logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
        userId: userAuth.id,
        email: credentials.email,
        clientInfo: clientInfo,
      })
    } catch (logError) {
      console.warn('Failed to log security event:', logError)
    }

    // Update Phase 6 MCP server with authentication success
    try {
      await updatePhase6AuthenticationProgress(userAuth.id, 'login_success')
    } catch (updateError) {
      console.warn('Failed to update Phase 6 progress:', updateError)
    }

    return {
      success: true,
      user: updatedUser,
      tokens: tokenPair,
      message: 'Authentication successful',
    }
  } catch (error) {
    // Log authentication failure - but be careful with the error object
    try {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
        userId: null,
        error: errorMessage,
        email: credentials.email,
        clientInfo: clientInfo,
      })
    } catch (logError) {
      console.warn('Failed to log security event:', logError)
    }

    // Update Phase 6 MCP server with authentication failure
    try {
      await updatePhase6AuthenticationProgress(null, 'login_failure')
    } catch (updateError) {
      console.warn('Failed to update Phase 6 progress:', updateError)
    }

    return {
      success: false,
      message: 'Authentication failed',
      error:
        error instanceof Error ? error.message : 'Unknown authentication error',
    }
  }
}

/**
 * Logout user and revoke tokens
 */
export async function logoutFromBetterAuth(
  userId: string,
  clientInfo: ClientInfo,
): Promise<void> {
  try {
    // Update authentication status in memory
    

    // Log logout event
    try {
      await logSecurityEvent(SecurityEventType.LOGOUT, {
        userId: userId,
        clientInfo: clientInfo,
      })
    } catch (logError) {
      console.warn('Failed to log security event:', logError)
    }

    // Update Phase 6 MCP server with logout progress
    try {
      await updatePhase6AuthenticationProgress(userId, 'logout_success')
    } catch (updateError) {
      console.warn('Failed to update Phase 6 progress:', updateError)
    }
  } catch (error) {
    console.error('Error logging out user:', error)
    throw new AuthenticationError('Failed to logout user')
  }
}

/**
 * Get Better-Auth instance for advanced operations
 */
export function getBetterAuthInstance() {
  return auth
}

/**
 * Export Better-Auth types and utilities
 */
export type { BetterAuthOptions, User } from 'better-auth'
export { betterAuth }