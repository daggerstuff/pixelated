/**
 * Better-Auth PostgreSQL Integration Service
 * Replaces the SQLite in-memory database with Neon PostgreSQL using Drizzle ORM
 * Implements Better-Auth authentication with JWT token management and PostgreSQL storage
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import dotenv from 'dotenv'
import {
  generateTokenPair,
  validateToken,
  AuthenticationError,
} from './jwt-service'

// Load environment variables
dotenv.config()

// Re-export AuthenticationError for convenience
export { AuthenticationError }

import { logSecurityEvent, SecurityEventType } from '../security/index'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import type { UserRole, ClientInfo, TokenPair } from './jwt-service'

// Create PostgreSQL connection pool using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // For Neon, you might want to set this to true in production
  }
})

// Import the schema
import { users, authSessions, authAccounts } from './minimal-schema'

// Create Drizzle ORM instance with schema
const db = drizzle(pool, { schema: { users, authSessions, authAccounts } })

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ PostgreSQL connection failed:', err)
  } else {
    console.log('✅ PostgreSQL connected successfully')
  }
})

// Better-Auth configuration with Drizzle adapter
const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'postgres', // Specify the database provider
    schema: {
      users: users,
      auth_sessions: authSessions,
      auth_accounts: authAccounts,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
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
        type: 'date',
        defaultValue: new Date(),
      },
      updatedAt: {
        type: 'date',
        defaultValue: new Date(),
        updateFn: () => new Date(),
      },
    },
  },
  session: {
    modelName: 'auth_sessions',
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
      // Update user role in database
      await db.execute(
        `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`,
        [credentials.role, result.user.id]
      )
      userAuth.role = credentials.role
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

    // Update authentication status in database
    await db.execute(
      `UPDATE users SET
        last_login_at = NOW(),
        login_attempts = 0,
        account_locked_until = NULL,
        updated_at = NOW()
      WHERE id = $1`,
      [result.user.id]
    )

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

    // Update failed login attempts in database
    const userResult = await db.execute(
      'SELECT id, login_attempts FROM users WHERE email = $1',
      [credentials.email]
    )

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0]
      const newAttempts = user.login_attempts + 1

      // Lock account after 5 failed attempts
      if (newAttempts >= 5) {
        await db.execute(
          `UPDATE users SET
            login_attempts = $1,
            authentication_status = $2,
            account_locked_until = NOW() + INTERVAL '15 minutes'
          WHERE id = $3`,
          [newAttempts, AuthenticationStatus.ACCOUNT_LOCKED, user.id]
        )
      } else {
        await db.execute(
          'UPDATE users SET login_attempts = $1 WHERE id = $2',
          [newAttempts, user.id]
        )
      }
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
    // Update authentication status in database
    await db.execute(
      `UPDATE users SET
        authentication_status = $1,
        updated_at = NOW()
      WHERE id = $2`,
      [AuthenticationStatus.UNAUTHENTICATED, userId]
    )

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