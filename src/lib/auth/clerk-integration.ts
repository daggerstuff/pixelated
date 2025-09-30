/**
 * Clerk Integration Service - Bridge between JWT and Clerk authentication
 * Integrates with existing Clerk infrastructure for seamless authentication
 */

import { clerkClient } from '@clerk/astro/server'
import { generateTokenPair, validateToken, AuthenticationError } from './jwt-service'
import { logSecurityEvent, SecurityEventType } from '../security'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import type { UserRole, ClientInfo, TokenPair } from './jwt-service'

// User authentication interface
export interface UserAuthentication {
  id: string
  clerkUserId: string
  email: string
  role: UserRole
  authenticationStatus: AuthenticationStatus
  lastLoginAt?: number
  loginAttempts: number
  accountLockedUntil?: number | null
  createdAt: number
  updatedAt: number
}

export enum AuthenticationStatus {
  UNAUTHENTICATED = 'unauthenticated',
  AUTHENTICATED = 'authenticated',
  ACCOUNT_LOCKED = 'account_locked',
  SUSPENDED = 'suspended',
}

export interface AuthenticationResult {
  success: boolean
  user?: UserAuthentication
  tokens?: TokenPair
  message: string
  error?: string
}

// Mock database for user authentication records
// In production, this would be a proper database table
const userAuthStore = new Map<string, UserAuthentication>()

/**
 * Map Clerk role to local role
 */
function mapClerkRoleToLocalRole(clerkRole: string): UserRole {
  const roleMapping: Record<string, UserRole> = {
    'admin': 'admin',
    'therapist': 'therapist',
    'patient': 'patient',
    'researcher': 'researcher',
    'guest': 'guest',
  }
  
  return roleMapping[clerkRole] || 'guest'
}

/**
 * Sync user data from Clerk to local authentication system
 */
export async function syncUserFromClerk(clerkUserId: string): Promise<UserAuthentication> {
  try {
    // Fetch user data from Clerk
    const clerkUser = await clerkClient.users.getUser(clerkUserId)
    
    if (!clerkUser) {
      throw new AuthenticationError('Clerk user not found')
    }

    // Get primary email address
    const primaryEmail = clerkUser.emailAddresses.find(email => email.id === clerkUser.primaryEmailAddressId)
    const email = primaryEmail?.emailAddress || ''
    
    // Determine role from Clerk metadata or default to 'guest'
    const clerkRole = clerkUser.publicMetadata?.role as string || 'guest'
    const localRole = mapClerkRoleToLocalRole(clerkRole)

    // Check if user already exists in local system
    const existingUser = Array.from(userAuthStore.values()).find(
      user => user.clerkUserId === clerkUserId
    )

    if (existingUser) {
      // Update existing user data
      const updatedUser: UserAuthentication = {
        ...existingUser,
        email: email,
        role: localRole,
        updatedAt: Date.now(),
      }
      
      userAuthStore.set(existingUser.id, updatedUser)
      return updatedUser
    } else {
      // Create new user authentication record
      const newUserAuth: UserAuthentication = {
        id: generateUserId(),
        clerkUserId: clerkUserId,
        email: email,
        role: localRole,
        authenticationStatus: AuthenticationStatus.UNAUTHENTICATED,
        loginAttempts: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      userAuthStore.set(newUserAuth.id, newUserAuth)

      // Log new user creation
      await logSecurityEvent(SecurityEventType.USER_CREATED, newUserAuth.id, {
        clerkUserId: clerkUserId,
        email: email,
        role: newUserAuth.role,
      })

      // Update Phase 6 MCP server with user creation
      await updatePhase6AuthenticationProgress(newUserAuth.id, 'user_created')

      return newUserAuth
    }
  } catch (error) {
    console.error('Error syncing user from Clerk:', error)
    throw new AuthenticationError('Failed to sync user from Clerk')
  }
}

/**
 * Generate unique user ID
 */
function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Validate Clerk session and create JWT tokens
 */
export async function authenticateWithClerk(
  clerkSessionToken: string,
  clientInfo: ClientInfo
): Promise<AuthenticationResult> {
  try {
    // Validate Clerk session token
    const clerkSession = await clerkClient.sessions.verifySession(clerkSessionToken)
    
    if (!clerkSession || !clerkSession.userId) {
      throw new AuthenticationError('Invalid Clerk session')
    }

    // Sync user data from Clerk
    const userAuth = await syncUserFromClerk(clerkSession.userId)

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
      clientInfo
    )

    // Log successful authentication
    await logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, userAuth.id, {
      clerkSessionId: clerkSession.id,
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
    await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, null, {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientInfo: clientInfo,
    })

    // Update Phase 6 MCP server with authentication failure
    await updatePhase6AuthenticationProgress(null, 'login_failure')

    return {
      success: false,
      message: 'Authentication failed',
      error: error instanceof Error ? error.message : 'Unknown authentication error',
    }
  }
}

/**
 * Get user authentication by Clerk user ID
 */
export function getUserAuthenticationByClerkId(clerkUserId: string): UserAuthentication | null {
  return Array.from(userAuthStore.values()).find(
    user => user.clerkUserId === clerkUserId
  ) || null
}

/**
 * Get user authentication by local user ID
 */
export function getUserAuthentication(userId: string): UserAuthentication | null {
  return userAuthStore.get(userId) || null
}

/**
 * Update user authentication record
 */
export function updateUserAuthentication(
  userId: string,
  updates: Partial<UserAuthentication>
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
 * Handle Clerk webhook events
 */
export async function handleClerkWebhook(
  eventType: string,
  eventData: Record<string, unknown>
): Promise<void> {
  try {
    switch (eventType) {
      case 'user.created':
        await handleClerkUserCreated(eventData)
        break
        
      case 'user.updated':
        await handleClerkUserUpdated(eventData)
        break
        
      case 'user.deleted':
        await handleClerkUserDeleted(eventData)
        break
        
      case 'session.created':
        await handleClerkSessionCreated(eventData)
        break
        
      case 'session.ended':
        await handleClerkSessionEnded(eventData)
        break
        
      default:
        await logSecurityEvent(SecurityEventType.UNHANDLED_WEBHOOK, null, {
          eventType: eventType,
          eventData: eventData,
        })
    }
  } catch (error) {
    console.error(`Error handling Clerk webhook ${eventType}:`, error)
    throw new AuthenticationError(`Failed to handle webhook: ${eventType}`)
  }
}

/**
 * Handle Clerk user created webhook
 */
async function handleClerkUserCreated(eventData: Record<string, unknown>): Promise<void> {
  const clerkUserId = eventData.data?.id as string
  if (!clerkUserId) return

  try {
    await syncUserFromClerk(clerkUserId)
    
    await logSecurityEvent(SecurityEventType.USER_CREATED, null, {
      clerkUserId: clerkUserId,
      source: 'webhook',
    })
  } catch (error) {
    console.error('Error handling Clerk user created webhook:', error)
  }
}

/**
 * Handle Clerk user updated webhook
 */
async function handleClerkUserUpdated(eventData: Record<string, unknown>): Promise<void> {
  const clerkUserId = eventData.data?.id as string
  if (!clerkUserId) return

  try {
    const userAuth = await syncUserFromClerk(clerkUserId)
    
    await logSecurityEvent(SecurityEventType.USER_UPDATED, userAuth.id, {
      clerkUserId: clerkUserId,
      source: 'webhook',
    })
  } catch (error) {
    console.error('Error handling Clerk user updated webhook:', error)
  }
}

/**
 * Handle Clerk user deleted webhook
 */
async function handleClerkUserDeleted(eventData: Record<string, unknown>): Promise<void> {
  const clerkUserId = eventData.data?.id as string
  if (!clerkUserId) return

  try {
    const userAuth = getUserAuthenticationByClerkId(clerkUserId)
    if (userAuth) {
      // Remove user from local store
      userAuthStore.delete(userAuth.id)
      
      // Revoke all user tokens
      // This would be implemented with a proper token revocation system
      
      await logSecurityEvent(SecurityEventType.USER_DELETED, userAuth.id, {
        clerkUserId: clerkUserId,
        source: 'webhook',
      })
    }
  } catch (error) {
    console.error('Error handling Clerk user deleted webhook:', error)
  }
}

/**
 * Handle Clerk session created webhook
 */
async function handleClerkSessionCreated(eventData: Record<string, unknown>): Promise<void> {
  const sessionId = eventData.data?.id as string
  const userId = eventData.data?.user_id as string
  
  if (!sessionId || !userId) return

  await logSecurityEvent(SecurityEventType.SESSION_CREATED, null, {
    sessionId: sessionId,
    clerkUserId: userId,
    source: 'webhook',
  })
}

/**
 * Handle Clerk session ended webhook
 */
async function handleClerkSessionEnded(eventData: Record<string, unknown>): Promise<void> {
  const sessionId = eventData.data?.id as string
  const userId = eventData.data?.user_id as string
  
  if (!sessionId || !userId) return

  await logSecurityEvent(SecurityEventType.SESSION_ENDED, null, {
    sessionId: sessionId,
    clerkUserId: userId,
    source: 'webhook',
  })
}

/**
 * Validate JWT token and return user authentication
 */
export async function validateJWTAndGetUser(
  token: string,
  tokenType: 'access' | 'refresh' = 'access'
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
export function hasRequiredRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    'admin': 100,
    'therapist': 80,
    'researcher': 60,
    'patient': 40,
    'guest': 20,
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

/**
 * Check if user has specific permission
 */
export function hasPermission(userRole: UserRole, permission: string): boolean {
  // Define role-based permissions
  const permissions: Record<UserRole, string[]> = {
    'admin': ['*'], // All permissions
    'therapist': ['read:patients', 'write:notes', 'read:analytics'],
    'researcher': ['read:analytics', 'read:research_data'],
    'patient': ['read:own_data', 'write:own_notes'],
    'guest': ['read:public_content'],
  }

  const userPermissions = permissions[userRole] || []
  return userPermissions.includes('*') || userPermissions.includes(permission)
}