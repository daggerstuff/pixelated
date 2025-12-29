/**
 * JWT Token Service - Core authentication logic for Phase 7
 * Implements secure JWT token generation, validation, and management
 * with integration to existing authentication infrastructure (Better-Auth) and Phase 6 MCP server tracking
 */

import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'
import { redis, getFromCache, setInCache, removeFromCache } from '../redis'
import { logSecurityEvent, SecurityEventType } from '../security/index'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'

// Configuration
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  audience: process.env.JWT_AUDIENCE || 'pixelated-empathy',
  issuer: process.env.JWT_ISSUER || 'pixelated-auth-service',
  accessTokenExpiry: 24 * 60 * 60, // 24 hours
  refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days
  algorithm: 'HS256' as const,
}

// --- Security hardening: require explicit secret in production ---
// Prevent accidental use of a predictable fallback secret in production environments.
// This avoids reliance on insecure randomness or predictable secrets.
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.JWT_SECRET ||
    process.env.JWT_SECRET === 'fallback-secret-change-in-production')
) {
  // Fail fast so deployments are not started with an insecure secret.
  // Operators should provide a strong secret via environment variables or a secret store.
  throw new Error('JWT_SECRET must be set to a strong secret in production')
}

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
  payload?: JwtPayload
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

// JWT payload shape (partial) used by this service
export interface JwtPayload {
  sub?: string
  role?: UserRole
  jti?: string
  type?: TokenType
  exp?: number
  client?: ClientInfo
  accessTokenId?: string
  [key: string]: unknown
}

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
 * Generate secure random hex string
 * Uses Node's crypto.randomBytes (cryptographically secure).
 * Replaces any use of Math.random for security-sensitive identifiers.
 */
function secureRandomHex(bytes = 32): string {
  // 32 bytes => 64 hex characters (256 bits of entropy)
  return randomBytes(bytes).toString('hex')
}

/**
 * Generate secure random token identifier
 */
function generateSecureToken(): string {
  // Use secureRandomHex to avoid accidental insecure randomness (e.g., Math.random)
  return secureRandomHex(32)
}

/**
 * Get current timestamp in seconds
 */
function currentTimestamp(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * Store token metadata in Redis for validation and revocation
 */
async function storeTokenMetadata(
  tokenId: string,
  metadata: {
    userId: string
    role: UserRole
    type: TokenType
    expiresAt: number
    clientInfo?: ClientInfo
    accessTokenId?: string
  },
): Promise<void> {
  const key = `token:${tokenId}`
  await setInCache(key, metadata, metadata.expiresAt - currentTimestamp())
}

/**
 * Get token metadata from Redis
 */
async function getTokenMetadata(
  tokenId: string,
): Promise<TokenMetadata | null> {
  const key = `token:${tokenId}`
  return (await getFromCache(key)) as TokenMetadata | null
}

/**
 * Check if token has been revoked
 */
async function isTokenRevoked(tokenId: string): Promise<boolean> {
  const revokedKey = `revoked:${tokenId}`
  const revoked = await getFromCache(revokedKey)
  return revoked !== null
}

/**
 * Mark token as revoked
 */
async function markTokenRevoked(
  tokenId: string,
  reason: string,
): Promise<void> {
  const revokedKey = `revoked:${tokenId}`
  const metadata = await getTokenMetadata(tokenId)

  if (metadata) {
    await setInCache(
      revokedKey,
      { reason, revokedAt: currentTimestamp() },
      24 * 60 * 60,
    ) // 24 hours
    await removeFromCache(`token:${tokenId}`)
  }
}

/**
 * Validate token security checks
 */
function validateTokenSecurity(
  payload: JwtPayload,
  metadata: TokenMetadata | null,
): void {
  // Check for token binding (prevent session hijacking)
  if (
    payload.client?.deviceId &&
    metadata?.clientInfo?.deviceId &&
    payload.client.deviceId !== metadata.clientInfo.deviceId
  ) {
    throw new AuthenticationError(
      'Token device binding mismatch',
      'DEVICE_MISMATCH',
    )
  }
}

/**
 * Extract token ID from JWT token
 */
function extractTokenId(token: string): string {
  try {
    const decoded = jwt.decode(token) as JwtPayload | null
    return typeof decoded?.jti === 'string' ? decoded.jti : ''
  } catch {
    return ''
  }
}

/**
 * Generate access and refresh tokens for user
 */
export async function generateTokenPair(
  userId: string,
  role: UserRole,
  clientInfo: ClientInfo,
): Promise<TokenPair> {
  // Validate input parameters
  if (!userId || !role || !clientInfo) {
    throw new AuthenticationError('Invalid token generation parameters')
  }

  // Generate unique token identifiers
  const accessTokenId = generateSecureToken()
  const refreshTokenId = generateSecureToken()

  // Create access token payload
  const accessPayload = {
    sub: userId,
    role: role,
    type: 'access',
    jti: accessTokenId,
    iat: currentTimestamp(),
    exp: currentTimestamp() + JWT_CONFIG.accessTokenExpiry,
    aud: JWT_CONFIG.audience,
    iss: JWT_CONFIG.issuer,
    client: clientInfo,
  }

  // Create refresh token payload
  const refreshPayload = {
    sub: userId,
    type: 'refresh',
    jti: refreshTokenId,
    iat: currentTimestamp(),
    exp: currentTimestamp() + JWT_CONFIG.refreshTokenExpiry,
    aud: JWT_CONFIG.audience,
    iss: JWT_CONFIG.issuer,
    accessTokenId: accessTokenId,
  }

  // Sign tokens with secret key
  const accessToken = jwt.sign(accessPayload, JWT_CONFIG.secret, {
    algorithm: JWT_CONFIG.algorithm,
  })

  const refreshToken = jwt.sign(refreshPayload, JWT_CONFIG.secret, {
    algorithm: JWT_CONFIG.algorithm,
  })

  // Store token metadata in Redis for validation and revocation
  await storeTokenMetadata(accessTokenId, {
    userId: userId,
    role: role,
    type: 'access',
    expiresAt: accessPayload.exp,
    clientInfo: clientInfo,
  })

  await storeTokenMetadata(refreshTokenId, {
    userId: userId,
    type: 'refresh',
    expiresAt: refreshPayload.exp,
    accessTokenId: accessTokenId,
  })

  // Log authentication event for audit trail
  await logSecurityEvent(SecurityEventType.TOKEN_CREATED, {
    userId: userId,
    accessTokenId: accessTokenId,
    refreshTokenId: refreshTokenId,
    clientInfo: clientInfo,
  })

  // Update Phase 6 MCP server with authentication progress
  await updatePhase6AuthenticationProgress(userId, 'token_generated')

  return {
    accessToken: accessToken,
    refreshToken: refreshToken,
    tokenType: 'Bearer',
    expiresIn: JWT_CONFIG.accessTokenExpiry,
    user: {
      id: userId,
      role: role,
    },
  }
}

/**
 * Validate and decode JWT token
 */
export async function validateToken(
  token: string,
  tokenType: TokenType,
): Promise<TokenValidationResult> {
  try {
    // Verify token signature and decode
    const payload = jwt.verify(token, JWT_CONFIG.secret, {
      audience: JWT_CONFIG.audience,
      issuer: JWT_CONFIG.issuer,
    }) as JwtPayload

    // Validate token type matches expected
    if (payload.type !== tokenType) {
      throw new AuthenticationError(
        `Invalid token type: expected ${tokenType}, got ${payload.type}`,
      )
    }

    // Check if token is expired
    if (payload.exp < currentTimestamp()) {
      throw new AuthenticationError('Token has expired')
    }

    // Check if token has been revoked
    if (await isTokenRevoked(payload.jti)) {
      throw new AuthenticationError('Token has been revoked')
    }

    // Validate token metadata in Redis
    const tokenMetadata = await getTokenMetadata(payload.jti || '')
    if (!tokenMetadata) {
      throw new AuthenticationError('Token metadata not found')
    }

    // Additional security checks
    validateTokenSecurity(payload, tokenMetadata)

    // Log successful validation
    await logSecurityEvent(SecurityEventType.TOKEN_VALIDATED, {
      userId: payload.sub,
      tokenId: payload.jti,
      tokenType: tokenType,
    })

    return {
      valid: true,
      userId: payload.sub,
      role: payload.role,
      tokenId: payload.jti,
      expiresAt: payload.exp,
      payload: payload,
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
  // Validate refresh token
  const validation = await validateToken(refreshToken, 'refresh')

  if (!validation.valid) {
    throw new AuthenticationError('Invalid refresh token')
  }

  // Get refresh token metadata
  const refreshMetadata = await getTokenMetadata(validation.tokenId!)

  // Revoke the refresh token (single use)
  await revokeToken(validation.tokenId!, 'refresh_token_used')

  // Revoke associated access token
  if (refreshMetadata?.accessTokenId) {
    await revokeToken(refreshMetadata.accessTokenId, 'refresh_cycle')
  }

  // Generate new token pair
  const newTokenPair = await generateTokenPair(
    validation.userId!,
    validation.role!,
    clientInfo,
  )

  // Log token refresh event
  await logSecurityEvent(SecurityEventType.TOKEN_REFRESHED, {
    userId: validation.userId!,
    oldTokenId: validation.tokenId!,
    newAccessTokenId: extractTokenId(newTokenPair.accessToken),
    newRefreshTokenId: extractTokenId(newTokenPair.refreshToken),
  })

  // Update Phase 6 MCP server with refresh progress
  await updatePhase6AuthenticationProgress(
    validation.userId!,
    'token_refreshed',
  )

  return newTokenPair
}

/**
 * Revoke token and clean up
 */
export async function revokeToken(
  tokenId: string,
  reason: string,
): Promise<void> {
  // Mark token as revoked in Redis
  await markTokenRevoked(tokenId, reason)

  // Get token metadata for additional cleanup
  const metadata = await getTokenMetadata(tokenId)

  if (metadata) {
    // Revoke related tokens if this is a refresh token
    if (metadata.accessTokenId) {
      await markTokenRevoked(metadata.accessTokenId, 'linked_revocation')
    }

    // Log revocation event
    await logSecurityEvent(SecurityEventType.TOKEN_REVOKED, {
      userId: metadata.userId,
      tokenId: tokenId,
      reason: reason,
      tokenType: metadata.type,
    })

    // Update Phase 6 MCP server with revocation progress
    await updatePhase6AuthenticationProgress(metadata.userId, 'token_revoked')
  }
}

/**
 * Clean up expired and revoked tokens
 */
export async function cleanupExpiredTokens(): Promise<{
  cleanedTokens: number
  timestamp: number
  nextCleanup: number
}> {
  const currentTime = currentTimestamp()
  let cleanedCount = 0

  // Get all token metadata keys (simplified implementation)
  const tokenKeys = await redis.keys('token:*')

  for (const key of tokenKeys) {
    const metadata = await getFromCache(key)

    if (metadata && metadata.expiresAt < currentTime) {
      // Remove token metadata
      await removeFromCache(key)
      cleanedCount++

      // Log cleanup event
      await logSecurityEvent(SecurityEventType.TOKEN_CLEANED_UP, {
        userId: metadata.userId,
        tokenId: metadata.id || key.replace('token:', ''),
        reason: 'expired_cleanup',
      })
    }
  }

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
