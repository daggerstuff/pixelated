/**
 * Auth0 JWT Service - Handles Auth0 token validation and management
 * Replaces the previous custom JWT service with Auth0 integration
 */

import {
  AuthenticationClient,
  UserInfoClient,
  type AuthenticationClientOptions,
} from 'auth0'
import jwt, { type JwtPayload } from 'jsonwebtoken'

// Extend AuthenticationClient to include methods that may not be in the TypeScript definitions
interface ExtendedAuthenticationClient extends AuthenticationClient {
  oauth: AuthenticationClient['oauth'] & {
    passwordGrant: (params: any) => Promise<any>
    refreshTokenGrant: (params: any) => Promise<any>
    revokeRefreshToken: (params: any) => Promise<any>
  }
}

import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import { setInCache } from '../redis'
import { logSecurityEvent, SecurityEventType } from '../security/index'
import { auth0Config, isAuth0Configured } from './auth0-config'

// Initialize Auth0 authentication client
let auth0Authentication: ExtendedAuthenticationClient | null = null
let auth0UserInfo: UserInfoClient | null = null

/**
 * Initialize Auth0 authentication client
 */
function initializeAuth0Client() {
  if (!isAuth0Configured()) {
    console.warn('Auth0 configuration incomplete')
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  auth0Authentication ??=
    new AuthenticationClient({
      domain: auth0Config.domain,
      clientId: auth0Config.clientId,
      clientSecret: auth0Config.clientSecret,
    }) as ExtendedAuthenticationClient
  auth0UserInfo ??= new UserInfoClient({ domain: auth0Config.domain })
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

export interface IdTokenPayload {
  iss: string
  sub: string
  aud: string
  exp: number
  iat: number
  role: UserRole
  email: string
  name?: string
  picture?: string
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

type Auth0TokenClaims = JwtPayload & {
  'https://pixelated.empathy/app_metadata'?: {
    roles?: readonly unknown[]
  }
  'https://pixelated.empathy/user_metadata'?: {
    role?: unknown
  }
  permissions?: readonly unknown[]
}

function isAuth0TokenClaims(payload: unknown): payload is Auth0TokenClaims {
  return payload !== null && typeof payload === 'object'
}

function isUserRole(value: string | undefined | null): value is UserRole {
  return (
    value === 'admin' ||
    value === 'therapist' ||
    value === 'patient' ||
    value === 'researcher' ||
    value === 'guest'
  )
}

/**
 * Extract user role from Auth0 token payload
 * @param payload Auth0 token payload
 * @returns User role
 */
function extractRoleFromPayload(payload: Auth0TokenClaims): UserRole {
  // Try to get role from app_metadata first
  const appMetadataRoles = payload['https://pixelated.empathy/app_metadata']?.roles
  if (Array.isArray(appMetadataRoles) && appMetadataRoles.length > 0) {
    const appRole = appMetadataRoles[0]
    if (typeof appRole === 'string' && isUserRole(appRole)) {
      return appRole
    }
  }

  // Try user_metadata
  const userMetadataRole = payload['https://pixelated.empathy/user_metadata']?.role
  if (typeof userMetadataRole === 'string' && isUserRole(userMetadataRole)) {
    return userMetadataRole
  }

  // Try permissions
  if (payload.permissions?.includes('admin')) {
    return 'admin'
  }

  if (payload.permissions?.includes('therapist')) {
    return 'therapist'
  }

  if (payload.permissions?.includes('researcher')) {
    return 'researcher'
  }

  if (payload.permissions?.includes('patient')) {
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
      throw new AuthenticationError(
        'Auth0 authentication client not initialized',
      )
    }

    // Decode token to check standard claims (aud, iss) before expensive UserInfo call
    // @ts-ignore
    const decodedToken = jwt.decode(token, { complete: true }) as {
      payload: JwtPayload & { jti?: string; sid?: string }
      header: unknown
    } | null

    if (!decodedToken || !decodedToken.payload) {
      throw new AuthenticationError('Malformed token')
    }

    const { payload } = decodedToken

    // Validate Issuer
    const expectedIssuer = `https://${auth0Config.domain}/`
    if (typeof payload.iss !== 'string' || !payload.iss) {
      throw new AuthenticationError('Token missing issuer claim')
    }
    if (payload.iss !== expectedIssuer) {
      throw new AuthenticationError(`Invalid issuer: ${payload.iss}`)
    }

    // Validate Audience
    const expectedAudience = auth0Config.audience
    if (!expectedAudience || expectedAudience.trim() === '') {
      console.warn(
        'AUTH0_AUDIENCE not configured - audience validation skipped',
      )
    } else {
      const { aud } = payload
      if (typeof aud === 'string') {
        if (aud !== expectedAudience) {
          throw new AuthenticationError(`Invalid audience: ${aud}`)
        }
      } else if (Array.isArray(aud)) {
        if (!aud.includes(expectedAudience)) {
          throw new AuthenticationError(`Invalid audience: ${aud.join(',')}`)
        }
      } else {
        throw new AuthenticationError('Token missing audience claim')
      }
    }

    // Validate expiration locally first
    if (payload.exp && payload.exp < currentTimestamp()) {
      throw new AuthenticationError('Token has expired')
    }

    // Validate token type matches expected (access tokens only for now)
    // Check this before expensive UserInfo call to fail fast
    if (tokenType === 'refresh') {
      throw new AuthenticationError(
        'Refresh token validation not supported with this method',
      )
    }

    // Now verify with UserInfo (acts as online signature/revocation check)
    // Using auth0Authentication.getProfile instead of auth0UserInfo.getUserInfo
    const userInfo = await auth0UserInfo?.getUserInfo(token)
    if (!userInfo) {
      throw new AuthenticationError('Failed to get user info')
    }

    // Extract user information
    const tokenPayload = isAuth0TokenClaims(userInfo.data)
      ? userInfo.data
      : {}
    const userId =
      tokenPayload.sub || (typeof payload.sub === 'string' ? payload.sub : '')
    if (!userId) {
      throw new AuthenticationError('Token missing subject claim')
    }
    const role = extractRoleFromPayload(tokenPayload)
    const tokenId = typeof payload.jti === 'string' ? payload.jti : ''
    const sessionId = typeof payload.sid === 'string' ? payload.sid : undefined

    // Log successful validation
    logSecurityEvent(SecurityEventType.TOKEN_VALIDATED, null, {
      userId: userId,
      tokenId: tokenId,
      tokenType: tokenType,
      sessionId: sessionId,
    })

    // Filter out PHI/PII from userInfo before returning
    // Remove email, name, picture and other identifiable information
    const {
      email: _email,
      name: _name,
      picture: _picture,
      nickname: _nickname,
      given_name: _given_name,
      family_name: _family_name,
      ...filteredUserInfo
    } = userInfo.data
    const safePayload = { ...filteredUserInfo, ...payload }

    return {
      valid: true,
      userId: userId,
      role: role,
      tokenId: tokenId,
      expiresAt: payload.exp,
      payload: safePayload,
    }
  } catch (error: unknown) {
    // Log validation failure
    logSecurityEvent(SecurityEventType.TOKEN_VALIDATION_FAILED, null, {
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
  _clientInfo: ClientInfo,
): Promise<TokenPair> {
  try {
    if (!auth0Authentication) {
      throw new AuthenticationError(
        'Auth0 authentication client not initialized',
      )
    }

    // Exchange refresh token for new access token
    // @ts-ignore
    const tokenResponse = await auth0Authentication.oauth.refreshTokenGrant({
      refresh_token: refreshToken,
    })

    // Get user info from new access token
    const userResponse = await auth0UserInfo?.getUserInfo(
      tokenResponse.data.access_token,
    )
    if (!userResponse) {
      throw new AuthenticationError('Failed to get refreshed user info')
    }

    // Extract user information
    const userPayload = isAuth0TokenClaims(userResponse.data)
      ? userResponse.data
      : {}
    const userId = userPayload.sub || ''
    const role = extractRoleFromPayload(userPayload)

    // Log token refresh event
    logSecurityEvent(SecurityEventType.TOKEN_REFRESHED, null, {
      userId: userId,
      oldTokenId: 'unknown', // We don't have the old token ID
      newAccessTokenId: userPayload.jti ?? '',
      newRefreshTokenId: tokenResponse.data.refresh_token
        ? 'present'
        : 'not_provided',
    })

    // Update Phase 6 MCP server with refresh progress
    await updatePhase6AuthenticationProgress(userId, 'token_refreshed')

    return {
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token ?? refreshToken, // Use new refresh token if provided
      tokenType: 'Bearer',
      expiresIn: tokenResponse.data.expires_in,
      user: {
        id: userId,
        role: role,
      },
    }
  } catch {
    throw new AuthenticationError('Invalid refresh token')
  }
}

/**
 * Generate a token pair (Legacy support for logic that expects local generation)
 * Note: In Auth0-native flow, tokens are generated by Auth0 during sign-in/refresh.
 * This is provided to maintain interface compatibility.
 */
export async function generateTokenPair(
  _userId: string,
  _role: UserRole,
  _clientInfo: ClientInfo,
): Promise<TokenPair> {
  // This is a dummy implementation as tokens should come from Auth0
  // In a real migration, we might use the Management API to create a token or
  // simply rely on the signIn/refresh flow which already returns these.
  throw new Error(
    'Direct token generation not supported in Auth0-native mode. Use signIn or refresh instead.',
  )
}

/**
 * Generate an ID token
 */
export async function generateIdToken(
  _userId: string,
  _role: UserRole,
  _email: string,
): Promise<string> {
  throw new Error(
    'Direct ID token generation not supported in Auth0-native mode.',
  )
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
  logSecurityEvent(SecurityEventType.TOKEN_REVOKED, null, {
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

let cleanupInterval: NodeJS.Timeout | null = null

/**
 * Start the token cleanup scheduler
 */
export function startTokenCleanupScheduler(): void {
  if (cleanupInterval) return

  // Run cleanup every hour
  cleanupInterval = setInterval(
    async () => {
      try {
        const result = await cleanupExpiredTokens()
        console.log(
          `[Auth0-JWT] Cleanup completed: ${result.cleanedTokens} tokens removed`,
        )
      } catch (error: unknown) {
        console.error('[Auth0-JWT] Cleanup failed:', error)
      }
    },
    60 * 60 * 1000,
  )

  // Also run immediately
  cleanupExpiredTokens().catch((err) =>
    console.error('[Auth0-JWT] Initial cleanup failed:', err),
  )
}

/**
 * Stop the token cleanup scheduler
 */
export function stopTokenCleanupScheduler(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
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
  } catch (error: unknown) {
    const duration = performance.now() - start
    console.error(
      `Token operation ${operationName} failed after ${duration.toFixed(2)}ms:`,
      error,
    )
    throw error
  }
}
