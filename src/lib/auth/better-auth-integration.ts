/**
 * Better-Auth Integration Service - Complete replacement for Clerk authentication
 * Implements Better-Auth authentication with JWT token management and user management
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import Database from 'better-sqlite3'
import {
  generateTokenPair,
  validateToken,
  AuthenticationError,
} from './jwt-service'

// Re-export AuthenticationError for convenience
export { AuthenticationError }
import { logSecurityEvent, SecurityEventType } from '../security/index'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import type { UserRole, ClientInfo, TokenPair } from './jwt-service'

const db = new Database(':memory:')

const auth = betterAuth({
  database: drizzleAdapter(db),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
  },
  user: {
    modelName: 'users',
    fields: {
      role: {
        type: 'string',
        defaultValue: 'guest',
      },
      createdAt: {
        type: 'number',
        defaultValue: Date.now(),
      },
      updatedAt: {
        type: 'number',
        defaultValue: Date.now(),
      },
    },
  },
  session: {
    modelName: 'sessions',
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  rateLimit: {
    window: 10,
    max: 10,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
})

// User authentication interface
export interface UserAuthentication {
  id: string
  email: string
  role: UserRole
  authenticationStatus: AuthenticationStatus
  lastLoginAt?: number
  loginAttempts: number
  accountLockedUntil?: number | null
  createdAt: number
  updatedAt: number
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

// Mock database for user authentication records
// In production, this would be a proper database table
const userAuthStore = new Map<string, UserAuthentication>()

/**
 * Better-Auth user shape used for mapping
 */
interface BetterAuthUserShape {
  id: string
  email: string
  role?: string
}

/**
 * Map Better-Auth user to local user authentication
 */
function mapBetterAuthUserToLocal(betterAuthUser: BetterAuthUserShape): UserAuthentication {
  const existingUser = Array.from(userAuthStore.values()).find(
    (user) => user.betterAuthUserId === betterAuthUser.id,
  )

  if (existingUser) {
    return {
      ...existingUser,
      email: betterAuthUser.email,
      updatedAt: Date.now(),
    }
  }

  // Create new user authentication record
  const newUserAuth: UserAuthentication = {
    id: generateUserId(),
    betterAuthUserId: betterAuthUser.id,
    email: betterAuthUser.email,
    role: (betterAuthUser.role as UserRole) || 'guest',
    authenticationStatus: AuthenticationStatus.UNAUTHENTICATED,
    loginAttempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  userAuthStore.set(newUserAuth.id, newUserAuth)
  return newUserAuth
}

/**
 * Generate unique user ID
 */
function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Register new user with Better-Auth
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
      userAuth.role = credentials.role
      userAuthStore.set(userAuth.id, userAuth)
    }

    // Generate JWT tokens
    const tokenPair = await generateTokenPair(
      userAuth.id,
      userAuth.role,
      clientInfo,
    )

    // Log successful registration
    await logSecurityEvent(SecurityEventType.USER_CREATED, {
      userId: userAuth.id,
      email: credentials.email,
      role: userAuth.role,
      clientInfo: clientInfo,
    })

    // Update Phase 6 MCP server with registration progress
    await updatePhase6AuthenticationProgress(userAuth.id, 'user_registered')

    return {
      success: true,
      user: userAuth,
      tokens: tokenPair,
      message: 'Registration successful',
    }
  } catch (error) {
    // Log registration failure
    await logSecurityEvent(SecurityEventType.REGISTRATION_FAILURE, {
      userId: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      email: credentials.email,
      clientInfo: clientInfo,
    })

    return {
      success: false,
      message: 'Registration failed',
      error:
        error instanceof Error ? error.message : 'Unknown registration error',
    }
  }
}

/**
 * Authenticate user with Better-Auth
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

    // Check if account is locked
    if (userAuth.authenticationStatus === AuthenticationStatus.ACCOUNT_LOCKED) {
      if (
        userAuth.accountLockedUntil &&
        userAuth.accountLockedUntil > Date.now()
      ) {
        throw new AuthenticationError('Account is locked')
      } else {
        // Unlock account if lock period has expired
        userAuth.authenticationStatus = AuthenticationStatus.UNAUTHENTICATED
        userAuth.accountLockedUntil = null
      }
    }

    // Update authentication status
    const updatedUser: UserAuthentication = {
      ...userAuth,
      authenticationStatus: AuthenticationStatus.AUTHENTICATED,
      lastLoginAt: Date.now(),
      loginAttempts: 0,
      accountLockedUntil: null,
      updatedAt: Date.now(),
    }

    userAuthStore.set(userAuth.id, updatedUser)

    // Generate JWT tokens
    const tokenPair = await generateTokenPair(
      userAuth.id,
      userAuth.role,
      clientInfo,
    )

    // Log successful authentication
    await logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
      userId: userAuth.id,
      email: credentials.email,
      clientInfo: clientInfo,
    })

    // Update Phase 6 MCP server with authentication success
    await updatePhase6AuthenticationProgress(userAuth.id, 'login_success')

    return {
      success: true,
      user: updatedUser,
      tokens: tokenPair,
      message: 'Authentication successful',
    }
  } catch (error) {
    // Log authentication failure
    await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
      userId: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      email: credentials.email,
      clientInfo: clientInfo,
    })

    // Update failed login attempts
    const userAuth = Array.from(userAuthStore.values()).find(
      (user) => user.email === credentials.email,
    )

    if (userAuth) {
      userAuth.loginAttempts += 1

      // Lock account after 5 failed attempts
      if (userAuth.loginAttempts >= 5) {
        userAuth.authenticationStatus = AuthenticationStatus.ACCOUNT_LOCKED
        userAuth.accountLockedUntil = Date.now() + 15 * 60 * 1000 // 15 minutes
      }

      userAuthStore.set(userAuth.id, userAuth)
    }

    // Update Phase 6 MCP server with authentication failure
    await updatePhase6AuthenticationProgress(null, 'login_failure')

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
    const userAuth = userAuthStore.get(userId)

    if (!userAuth) {
      throw new AuthenticationError('User not found')
    }

    // Update authentication status
    userAuth.authenticationStatus = AuthenticationStatus.UNAUTHENTICATED
    userAuth.updatedAt = Date.now()
    userAuthStore.set(userId, userAuth)

    // Revoke all user tokens (implement token revocation)
    // This would integrate with the JWT token revocation system

    // Log logout event
    await logSecurityEvent(SecurityEventType.LOGOUT, {
      userId: userId,
      clientInfo: clientInfo,
    })

    // Update Phase 6 MCP server with logout progress
    await updatePhase6AuthenticationProgress(userId, 'logout_success')
  } catch (error) {
    console.error('Error logging out user:', error)
    throw new AuthenticationError('Failed to logout user')
  }
}

/**
 * Get user authentication by Better-Auth user ID
 */
export function getUserAuthenticationByBetterAuthId(
  betterAuthUserId: string,
): UserAuthentication | null {
  return (
    Array.from(userAuthStore.values()).find(
      (user) => user.betterAuthUserId === betterAuthUserId,
    ) || null
  )
}

/**
 * Get user authentication by local user ID
 */
export function getUserAuthentication(
  userId: string,
): UserAuthentication | null {
  return userAuthStore.get(userId) || null
}

/**
 * Update user authentication record
 */
export function updateUserAuthentication(
  userId: string,
  updates: Partial<UserAuthentication>,
): UserAuthentication {
  const user = userAuthStore.get(userId)

  if (!user) {
    throw new AuthenticationError('User not found')
  }

  const updatedUser: UserAuthentication = {
    ...user,
    ...updates,
    updatedAt: Date.now(),
  }

  userAuthStore.set(userId, updatedUser)
  return updatedUser
}

/**
 * Validate JWT token and return user authentication
 */
export async function validateJWTAndGetUser(
  token: string,
  tokenType: 'access' | 'refresh' = 'access',
): Promise<UserAuthentication | null> {
  try {
    const validation = await validateToken(token, tokenType)

    if (!validation.valid || !validation.userId) {
      return null
    }

    return getUserAuthentication(validation.userId)
  } catch (error) {
    console.error('Error validating JWT and getting user:', error)
    return null
  }
}

/**
 * Check if user has required role
 */
export function hasRequiredRole(
  userRole: UserRole,
  requiredRole: UserRole,
): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    admin: 100,
    therapist: 80,
    researcher: 60,
    patient: 40,
    guest: 20,
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

/**
 * Check if user has specific permission
 */
export function hasPermission(userRole: UserRole, permission: string): boolean {
  // Define role-based permissions
  const permissions: Record<UserRole, string[]> = {
    admin: ['*'], // All permissions
    therapist: ['read:patients', 'write:notes', 'read:analytics'],
    researcher: ['read:analytics', 'read:research_data'],
    patient: ['read:own_data', 'write:own_notes'],
    guest: ['read:public_content'],
  }

  const userPermissions = permissions[userRole] || []
  return userPermissions.includes('*') || userPermissions.includes(permission)
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
export { betterAuth, drizzleAdapter }

/**
 * Legacy wrapper functions for backward compatibility with tests
 * These map to the actual better-auth integration functions
 */

/**
 * Register a new user (wrapper for registerWithBetterAuth)
 */
export async function registerUser(
  userData: RegisterCredentials,
  clientInfo: ClientInfo,
): Promise<AuthenticationResult> {
  return registerWithBetterAuth(userData, clientInfo)
}

/**
 * Login user (wrapper for authenticateWithBetterAuth)
 */
export async function loginUser(
  email: string,
  password: string,
  clientInfo: ClientInfo,
): Promise<AuthenticationResult> {
  return authenticateWithBetterAuth({ email, password }, clientInfo)
}

/**
 * Logout user (wrapper for logoutFromBetterAuth)
 */
export async function logoutUser(
  userId: string,
  sessionId: string,
  clientInfo: ClientInfo,
): Promise<void> {
  return logoutFromBetterAuth(userId, clientInfo)
}

/**
 * Get user by ID (wrapper for getUserAuthentication)
 */
export function getUserById(userId: string): UserAuthentication | null {
  return getUserAuthentication(userId)
}

/**
 * Update user profile (wrapper for updateUserAuthentication)
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserAuthentication, 'email'>> & Record<string, unknown>,
): Promise<UserAuthentication> {
  return updateUserAuthentication(userId, updates as Partial<UserAuthentication>)
}

/**
 * Change user password (stub - needs implementation)
 */
export async function changePassword(
  _userId: string,
  _currentPassword: string,
  _newPassword: string,
  _clientInfo: ClientInfo,
): Promise<void> {
  // TODO: Implement password change functionality
  throw new AuthenticationError('Password change not implemented yet')
}

/**
 * Validate user role (wrapper for hasRequiredRole)
 */
export function validateUserRole(
  userId: string,
  requiredRoles: UserRole[],
): boolean {
  const user = getUserAuthentication(userId)
  if (!user) {
    return false
  }
  return requiredRoles.some((role) => hasRequiredRole(user.role, role))
}
