/**
 * Auth0 JWT Service - Handles Auth0 token validation and management
 * Replaces the previous custom JWT service with Auth0 integration
 */

import {
  AuthenticationClient,
  UserInfoClient,
} from 'auth0'

interface JwtPayload {
  iss?: string
  sub?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  iat?: number
  jti?: string
  sid?: string
}


import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import { setInCache } from '../redis'
import { logSecurityEvent, SecurityEventType } from '../security/index'
import { auth0Config, isAuth0Configured } from './auth0-config'

// Initialize Auth0 authentication client
let auth0Authentication: AuthenticationClient | null = null
let auth0UserInfo: UserInfoClient | null = null

/**
 * Initialize Auth0 authentication client
 */
function initializeAuth0Client() {
  if (!isAuth0Configured()) {
    console.warn('Auth0 configuration incomplete')
    return
  }

  auth0Authentication ??= new AuthenticationClient({
    domain: auth0Config.domain,
    clientId: auth0Config.clientId,
    clientSecret: auth0Config.clientSecret,
  })
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
  payload?: Record<string, unknown>
  error?: string
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
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

type Auth0TokenResponse = {
  access_token?: unknown
  refresh_token?: unknown
  expires_in?: unknown
  id_token?: unknown
  token_type?: unknown
}

function toAuth0TokenResponse(value: unknown): Auth0TokenResponse | null {
  if (!isRecord(value)) {
    return null
  }

  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token,
    expires_in: value.expires_in,
    id_token: value.id_token,
    token_type: value.token_type,
  }
}

function toStringRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
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
    roles?: readonly string[]
  }
  'https://pixelated.empathy/user_metadata'?: {
    role?: string
  }
  permissions?: readonly string[]
}

function isAuth0TokenClaims(payload: unknown): payload is Auth0TokenClaims {
  if (!isRecord(payload)) {
    return false
  }
  const tokenClaims = payload

  if (tokenClaims.iss !== undefined && typeof tokenClaims.iss !== 'string') {
    return false
  }

  if (tokenClaims.sub !== undefined && typeof tokenClaims.sub !== 'string') {
    return false
  }

  if (
    tokenClaims.aud !== undefined &&
    typeof tokenClaims.aud !== 'string' &&
    !Array.isArray(tokenClaims.aud)
  ) {
    return false
  }

  return true
}

function decodeJwtPayloadSegment(segment: string): unknown {
  const sanitizedSegment = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padding = sanitizedSegment.length % 4
  const paddedSegment =
    padding === 0
      ? sanitizedSegment
      : `${sanitizedSegment}${'='.repeat(4 - padding)}`

  try {
    const payloadJson =
      typeof globalThis.atob === 'function'
        ? globalThis.atob(paddedSegment)
        : Buffer.from(paddedSegment, 'base64').toString('utf8')
    const parsedPayload: unknown = JSON.parse(payloadJson)
    return typeof parsedPayload === 'object' &&
      parsedPayload !== null &&
      !Array.isArray(parsedPayload)
      ? parsedPayload
      : null
  } catch {
    return null
  }
}

function decodeAuth0JwtPayload(token: string): Auth0TokenClaims | null {
  const tokenParts = token.split('.')
  if (tokenParts.length < 2) {
    return null
  }

  const payload = decodeJwtPayloadSegment(tokenParts[1])
  if (!isAuth0TokenClaims(payload)) {
    return null
  }

  return payload
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
  if (Array.isArray(appMetadataRoles)) {
    for (const appRole of appMetadataRoles) {
      if (typeof appRole === 'string' && isUserRole(appRole)) {
        return appRole
      }
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
    const payload = decodeAuth0JwtPayload(token)

    if (!payload) {
      throw new AuthenticationError('Malformed token')
    }

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
    const userInfoData = toStringRecord(userInfo.data)
  const tokenPayload: Auth0TokenClaims = isAuth0TokenClaims(userInfoData)
    ? userInfoData
    : payload
  const userId =
    typeof tokenPayload.sub === 'string'
      ? tokenPayload.sub
      : typeof payload.sub === 'string'
        ? payload.sub
        : ''
  if (userId.length === 0) {
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
    } = userInfoData
    const safePayload: Record<string, unknown> = {
      ...filteredUserInfo,
      ...payload,
    }

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
    const tokenResponse = await auth0Authentication.oauth.refreshTokenGrant({
      refresh_token: refreshToken,
    })
    const tokenResponseData = toAuth0TokenResponse(tokenResponse.data)
    const accessToken =
      typeof tokenResponseData?.access_token === 'string'
        ? tokenResponseData.access_token
        : undefined
    if (!accessToken) {
      throw new AuthenticationError('Invalid token response')
    }

    // Get user info from new access token
    const userResponse = await auth0UserInfo?.getUserInfo(
      accessToken,
    )
    if (!userResponse) {
      throw new AuthenticationError('Failed to get refreshed user info')
    }

    // Extract user information
    const userResponseData = toStringRecord(userResponse.data)
    if (!isAuth0TokenClaims(userResponseData)) {
      throw new AuthenticationError('Invalid user payload')
    }
    const userPayload = userResponseData
    const userId =
      typeof userPayload.sub === 'string'
        ? userPayload.sub
        : ''
    const accessTokenId =
      typeof userPayload.jti === 'string' ? userPayload.jti : undefined
    const role = extractRoleFromPayload(userPayload)

    // Log token refresh event
    logSecurityEvent(SecurityEventType.TOKEN_REFRESHED, null, {
      userId: userId,
      oldTokenId: 'unknown', // We don't have the old token ID
      newAccessTokenId: accessTokenId ?? '',
      newRefreshTokenId: tokenResponseData?.refresh_token
        ? 'present'
        : 'not_provided',
    })

    // Update Phase 6 MCP server with refresh progress
    await updatePhase6AuthenticationProgress(userId, 'token_refreshed')

    return {
      accessToken,
      refreshToken:
        typeof tokenResponseData?.refresh_token === 'string'
          ? tokenResponseData.refresh_token
          : refreshToken, // Use new refresh token if provided
      tokenType: 'Bearer',
      expiresIn:
        typeof tokenResponseData?.expires_in === 'number'
          ? tokenResponseData.expires_in
          : 3600,
      user: { id: userId, role: role },
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
