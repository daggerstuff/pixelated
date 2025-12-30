/**
 * Auth0 JWT Service - Handles Auth0 token validation and management
 * Replaces the previous custom JWT service with Auth0 integration
 */

import { AuthenticationClient } from 'auth0'
import { getFromCache, setInCache, removeFromCache } from '../redis'
import { logSecurityEvent, SecurityEventType } from '../security/index'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'

// Auth0 Configuration
const AUTH0_CONFIG = {
  domain: process.env.AUTH0_DOMAIN || '',
  clientId: process.env.AUTH0_CLIENT_ID || '',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
  audience: process.env.AUTH0_AUDIENCE || '',
}

// Initialize Auth0 authentication client
let auth0Authentication: AuthenticationClient | null = null

/**
 * Initialize Auth0 authentication client
 */
function initializeAuth0Client() {
  if (!AUTH0_CONFIG.domain || !AUTH0_CONFIG.clientId || !AUTH0_CONFIG.clientSecret) {
    throw new Error('Auth0 configuration is incomplete. Please check environment variables.')
  }

  if (!auth0Authentication) {
    auth0Authentication = new AuthenticationClient({
      domain: AUTH0_CONFIG.domain,
      clientId: AUTH0_CONFIG.clientId,
      clientSecret: AUTH0_CONFIG.clientSecret
    })
  }
}

// Initialize the client
initializeAuth0Client()

// Types
export interface TokenPair {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: {
    id: string
    role: UserRole
  }
}

export interface TokenValidationResult {
  valid: boolean
  userId?: string
  role?: UserRole
  tokenId?: string
  expiresAt?: number
  payload?: any
  error?: string
}

export interface ClientInfo {
  ip?: string
  userAgent?: string
  deviceId?: string
}

export type UserRole =
  | 'admin'
  | 'therapist'
  | 'patient'
  | 'researcher'
  | 'guest'

export type TokenType = 'access' | 'refresh'

// Token metadata stored in cache
export interface TokenMetadata {
  userId?: string
  role?: UserRole
  type?: TokenType
  expiresAt?: number
  clientInfo?: ClientInfo
  accessTokenId?: string
  id?: string
}

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

/**
 * Get current timestamp in seconds
 */
function currentTimestamp(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * Extract user role from Auth0 token payload
 * @param payload Auth0 token payload
 * @returns User role
 */
function extractRoleFromPayload(payload: any): UserRole {
  // Try to get role from app_metadata first
  if (payload['https://pixelated.empathy/app_metadata']?.roles?.length > 0) {
    return payload['https://pixelated.empathy/app_metadata'].roles[0] as UserRole
  }

  // Try user_metadata
  if (payload['https://pixelated.empathy/user_metadata']?.role) {
    return payload['https://pixelated.empathy/user_metadata'].role as UserRole
  }

  // Try permissions
  if (payload.permissions?.includes('admin')) {
    return 'admin'
  } else if (payload.permissions?.includes('therapist')) {
    return 'therapist'
  } else if (payload.permissions?.includes('researcher')) {
    return 'researcher'
  } else if (payload.permissions?.includes('patient')) {
    return 'patient'
  }

  // Default to guest role
  return 'guest'
}

/**
 * Validate and decode Auth0 JWT token
 */
export async function validateToken(
  token: string,
  tokenType: TokenType,
): Promise<TokenValidationResult> {
  try {
    if (!auth0Authentication) {
      throw new AuthenticationError('Auth0 authentication client not initialized')
    }

    // Decode token to get payload (this doesn't validate the signature yet)
    const decoded = await auth0Authentication.getProfile(token)

    // Validate token type matches expected (access tokens only for now)
    if (tokenType === 'refresh') {
      throw new AuthenticationError('Refresh token validation not supported with this method')
    }

    // Check if token has expired
    const exp = decoded.exp
    if (exp && exp < currentTimestamp()) {
      throw new AuthenticationError('Token has expired')
    }

    // Extract user information
    const userId = decoded.sub || ''
    const role = extractRoleFromPayload(decoded)
    const tokenId = decoded.jti || ''

    // Log successful validation
    await logSecurityEvent(SecurityEventType.TOKEN_VALIDATED, {
      userId: userId,
      tokenId: tokenId,
      tokenType: tokenType,
    })

    return {
      valid: true,
      userId: userId,
      role: role,
      tokenId: tokenId,
      expiresAt: exp,
      payload: decoded,
    }
  } catch (error) {
    // Log validation failure
    await logSecurityEvent(SecurityEventType.TOKEN_VALIDATION_FAILED, {
      userId: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      tokenType: tokenType,
    })

    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Token validation failed',
    }
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientInfo: ClientInfo,
): Promise<TokenPair> {
  try {
    if (!auth0Authentication) {
      throw new AuthenticationError('Auth0 authentication client not initialized')
    }

    // Exchange refresh token for new access token
    const tokenResponse = await auth0Authentication.refreshToken({
      refresh_token: refreshToken
    })

    // Get user info from new access token
    const userResponse = await auth0Authentication.getProfile(tokenResponse.access_token)

    // Extract user information
    const userId = userResponse.sub || ''
    const role = extractRoleFromPayload(userResponse)

    // Log token refresh event
    await logSecurityEvent(SecurityEventType.TOKEN_REFRESHED, {
      userId: userId,
      oldTokenId: 'unknown', // We don't have the old token ID
      newAccessTokenId: userResponse.jti || '',
      newRefreshTokenId: tokenResponse.refresh_token ? 'present' : 'not_provided',
    })

    // Update Phase 6 MCP server with refresh progress
    await updatePhase6AuthenticationProgress(userId, 'token_refreshed')

    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || refreshToken, // Use new refresh token if provided
      tokenType: 'Bearer',
      expiresIn: tokenResponse.expires_in,
      user: {
        id: userId,
        role: role,
      },
    }
  } catch (error) {
    throw new AuthenticationError('Invalid refresh token')
  }
}

/**
 * Revoke token and clean up
 */
export async function revokeToken(
  tokenId: string,
  reason: string,
): Promise<void> {
  // For Auth0, we don't have direct token revocation API
  // Instead, we'll mark it as revoked in our cache for tracking

  const revokedKey = `revoked:${tokenId}`
  await setInCache(
    revokedKey,
    { reason, revokedAt: currentTimestamp() },
    24 * 60 * 60, // 24 hours
  )

  // Log revocation event
  await logSecurityEvent(SecurityEventType.TOKEN_REVOKED, {
    userId: null, // We don't have user ID here
    tokenId: tokenId,
    reason: reason,
    tokenType: 'unknown',
  })
}

/**
 * Clean up expired and revoked tokens
 */
export async function cleanupExpiredTokens(): Promise<{
  cleanedTokens: number
  timestamp: number
  nextCleanup: number
}> {
  // For Auth0 tokens, we don't manage the tokens directly
  // This is mainly for cleaning up our local cache entries

  const currentTime = currentTimestamp()
  let cleanedCount = 0

  // Get all revoked token keys (simplified implementation)
  // Note: This would need to be adapted to work with the actual Redis implementation
  // For now, we'll just return dummy values

  return {
    cleanedTokens: cleanedCount,
    timestamp: currentTime,
    nextCleanup: currentTime + 60 * 60, // Next cleanup in 1 hour
  }
}

/**
 * Performance monitoring wrapper for token operations
 */
export async function measureTokenOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
): Promise<T> {
  const start = performance.now()

  try {
    const result = await operation()
    const duration = performance.now() - start

    // Log performance metrics
    if (duration > 100) {
      console.warn(
        `Token operation ${operationName} took ${duration.toFixed(2)}ms`,
      )
    }

    return result
  } catch (error) {
    const duration = performance.now() - start
    console.error(
      `Token operation ${operationName} failed after ${duration.toFixed(2)}ms:`,
      error,
    )
    throw error
  }
}