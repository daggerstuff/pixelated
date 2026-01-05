/**
 * JWT Token Service - Core authentication logic with Better-Auth integration
 * Implements secure JWT token generation, validation, and management
 * HIPAA-compliant with enterprise-grade security features
 */

import jwt from 'jsonwebtoken'
import { randomUUID, createHmac } from 'crypto'
import type { RedisClientType } from 'redis'
import { getRedisClient } from '../redis'

import { getUserById } from './better-auth-integration'
import { Phase6IntegrationService } from './phase6-integration'
import { SecurityEventLogger } from './security-event-logger'
import { TokenRevocationService } from './token-revocation-service'
import { TokenCacheService } from './token-cache-service'
import { AuthenticationError, TokenValidationError } from './errors'

// Core interfaces
export interface TokenPair {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: {
    id: string
    role: UserRole
    email?: string
  }
}

export interface TokenValidationResult {
  valid: boolean
  userId?: string
  role?: UserRole
  tokenId?: string
  expiresAt?: number
  payload?: JWTPayload
  error?: string
}

export interface JWTPayload {
  sub: string // userId
  role: UserRole
  type: 'access' | 'refresh'
  jti: string // JWT ID for revocation tracking
  iat: number // issued at
  exp: number // expiration
  aud: string // audience
  iss: string // issuer
  client?: ClientInfo
  sessionId?: string
  complianceLevel: 'hipaa_plus_plus'
  ipHash?: string
  userAgentHash?: string
}

export interface ClientInfo {
  ipAddress: string
  userAgent: string
  deviceId?: string
  clientType: 'web' | 'mobile' | 'api'
}

export enum UserRole {
  USER = 'user',
  STAFF = 'staff',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
}

export interface TokenMetadata {
  userId: string
  role: UserRole
  type: TokenType
  expiresAt: number
  clientInfo: ClientInfo
  accessTokenId?: string // for refresh tokens
  isRevoked?: boolean
  revokedAt?: number
  revocationReason?: string
}

export interface JWTTokenServiceConfig {
  secretKey: string
  algorithm: 'HS256' | 'RS256'
  accessTokenExpiry: number // seconds
  refreshTokenExpiry: number // seconds
  issuer: string
  audience: string
  enableSessionBinding: boolean
  enableIPValidation: boolean
  enableUserAgentValidation: boolean
  enableReplayProtection: boolean
  keyRotationInterval: number // days
}

/**
 * Core JWT Token Service implementing secure token management
 */
export class JWTTokenService {
  private redis: RedisClientType
  private phase6: Phase6IntegrationService
  private securityLogger: SecurityEventLogger
  private revocationService: TokenRevocationService
  private cacheService: TokenCacheService
  private config: JWTTokenServiceConfig

  constructor(config: JWTTokenServiceConfig) {
    this.config = config
    this.redis = getRedisClient()
    this.phase6 = new Phase6IntegrationService()
    this.securityLogger = new SecurityEventLogger()
    this.revocationService = new TokenRevocationService()
    this.cacheService = new TokenCacheService()

    this.validateConfiguration()
  }

  /**
   * Generate access and refresh tokens for authenticated user
   */
  async generateTokenPair(
    userId: string,
    role: UserRole,
    clientInfo: ClientInfo,
  ): Promise<TokenPair> {
    try {
      // Validate input parameters
      if (!userId || !role || !clientInfo) {
        throw new AuthenticationError('Invalid token generation parameters')
      }

      // Validate user exists and is active
      const user = getUserById(userId)
      if (!user || user.authenticationStatus !== 'authenticated') {
        throw new AuthenticationError('User account is not active')
      }

      // Generate unique token identifiers
      const accessTokenId = randomUUID()
      const refreshTokenId = randomUUID()
      const sessionId = randomUUID()
      const now = Math.floor(Date.now() / 1000)

      // Create access token payload with security metadata
      const accessPayload: JWTPayload = {
        sub: userId,
        role,
        type: 'access',
        jti: accessTokenId,
        iat: now,
        exp: now + this.config.accessTokenExpiry,
        aud: this.config.audience,
        iss: this.config.issuer,
        client: clientInfo,
        sessionId,
        complianceLevel: 'hipaa_plus_plus',
        ...(this.config.enableIPValidation && {
          ipHash: this.hashClientIP(clientInfo.ipAddress),
        }),
        ...(this.config.enableUserAgentValidation && {
          userAgentHash: this.hashUserAgent(clientInfo.userAgent),
        }),
      }

      // Create refresh token payload
      const refreshPayload: JWTPayload = {
        sub: userId,
        type: 'refresh',
        jti: refreshTokenId,
        iat: now,
        exp: now + this.config.refreshTokenExpiry,
        aud: this.config.audience,
        iss: this.config.issuer,
        complianceLevel: 'hipaa_plus_plus',
        accessTokenId,
      }

      // Sign tokens with secret key
      const accessToken = jwt.sign(accessPayload, this.config.secretKey, {
        algorithm: this.config.algorithm,
      })

      const refreshToken = jwt.sign(refreshPayload, this.config.secretKey, {
        algorithm: this.config.algorithm,
      })

      // Store token metadata in Redis for validation and revocation
      await this.storeTokenMetadata(accessTokenId, {
        userId,
        role,
        type: 'access',
        expiresAt: accessPayload.exp,
        clientInfo,
      })

      await this.storeTokenMetadata(refreshTokenId, {
        userId,
        type: 'refresh',
        expiresAt: refreshPayload.exp,
        clientInfo,
        accessTokenId,
      })

      // Cache tokens for fast validation
      await this.cacheService.cacheToken(accessTokenId, accessPayload)
      await this.cacheService.cacheToken(refreshTokenId, refreshPayload)

      // Log authentication event for audit trail
      await this.securityLogger.logTokenGeneration(
        userId,
        accessTokenId,
        refreshTokenId,
        clientInfo,
      )

      // Update Phase 6 MCP server with authentication progress
      await this.phase6.trackAuthenticationProgress(userId, 'token_generated')

      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.config.accessTokenExpiry,
        user: {
          id: userId,
          role,
          email: user.email,
        },
      }
    } catch (error) {
      await this.securityLogger.logTokenGenerationFailure(userId, error)
      throw error instanceof AuthenticationError
        ? error
        : new AuthenticationError('Token generation failed')
    }
  }

  /**
   * Validate and decode JWT token with comprehensive security checks
   */
  async validateToken(
    token: string,
    tokenType: TokenType,
  ): Promise<TokenValidationResult> {
    try {
      // Verify token signature and decode
      const payload = jwt.verify(token, this.config.secretKey, {
        algorithms: [this.config.algorithm],
        audience: this.config.audience,
        issuer: this.config.issuer,
      }) as JWTPayload

      // Validate token type matches expected
      if (payload.type !== tokenType) {
        throw new TokenValidationError(
          `Invalid token type: expected ${tokenType}, got ${payload.type}`,
        )
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp < now) {
        throw new TokenValidationError('Token has expired')
      }

      // Check if token has been revoked
      if (await this.revocationService.isTokenRevoked(payload.jti)) {
        throw new TokenValidationError('Token has been revoked')
      }

      // Validate token metadata in Redis
      const tokenMetadata = await this.getTokenMetadata(payload.jti)
      if (!tokenMetadata) {
        throw new TokenValidationError('Token metadata not found')
      }

      // Additional security checks
      await this.validateTokenSecurity(payload, tokenMetadata)

      // Log successful validation
      await this.securityLogger.logTokenValidation(
        payload.sub,
        payload.jti,
        tokenType,
      )

      return {
        valid: true,
        userId: payload.sub,
        role: payload.role,
        tokenId: payload.jti,
        expiresAt: payload.exp,
        payload,
      }
    } catch (error) {
      // Log validation failure
      await this.securityLogger.logTokenValidationFailure(error, tokenType)

      if (error instanceof TokenValidationError) {
        throw error
      }

      return {
        valid: false,
        error:
          error instanceof Error ? error.message : 'Token validation failed',
      }
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    clientInfo: ClientInfo,
  ): Promise<TokenPair> {
    try {
      // Validate refresh token
      const validation = await this.validateToken(refreshToken, 'refresh')

      if (!validation.valid || !validation.userId || !validation.tokenId) {
        throw new AuthenticationError('Invalid refresh token')
      }

      // Get refresh token metadata
      const refreshMetadata = await this.getTokenMetadata(validation.tokenId)
      if (!refreshMetadata) {
        throw new AuthenticationError('Refresh token metadata not found')
      }

      // Revoke the refresh token (single use)
      await this.revocationService.revokeToken(
        validation.tokenId,
        'refresh_token_used',
      )

      // Revoke associated access token
      if (refreshMetadata.accessTokenId) {
        await this.revocationService.revokeToken(
          refreshMetadata.accessTokenId,
          'refresh_cycle',
        )
      }

      // Generate new token pair
      const newTokenPair = await this.generateTokenPair(
        validation.userId,
        validation.role,
        clientInfo,
      )

      // Log token refresh event
      await this.securityLogger.logTokenRefresh(
        validation.userId,
        validation.tokenId,
        newTokenPair,
      )

      // Update Phase 6 MCP server with refresh progress
      await this.phase6.trackAuthenticationProgress(
        validation.userId,
        'token_refreshed',
      )

      return newTokenPair
    } catch (error) {
      await this.securityLogger.logTokenRefreshFailure(error)
      throw error instanceof AuthenticationError
        ? error
        : new AuthenticationError('Token refresh failed')
    }
  }

  /**
   * Revoke token and clean up associated data
   */
  async revokeToken(tokenId: string, reason: string): Promise<void> {
    try {
      // Get token metadata before revocation
      const metadata = await this.getTokenMetadata(tokenId)
      if (!metadata) {
        throw new AuthenticationError('Token metadata not found')
      }

      // Revoke the token
      await this.revocationService.revokeToken(tokenId, reason)

      // Revoke related tokens if this is a refresh token
      if (metadata.type === 'refresh' && metadata.accessTokenId) {
        await this.revocationService.revokeToken(
          metadata.accessTokenId,
          'linked_revocation',
        )
      }

      // Log revocation event
      await this.securityLogger.logTokenRevocation(
        metadata.userId,
        tokenId,
        reason,
        metadata.type,
      )

      // Update Phase 6 MCP server with revocation progress
      await this.phase6.trackAuthenticationProgress(
        metadata.userId,
        'token_revoked',
      )

      // Clean up cached data
      await this.cacheService.invalidateToken(tokenId)
      if (metadata.accessTokenId) {
        await this.cacheService.invalidateToken(metadata.accessTokenId)
      }
    } catch (error) {
      await this.securityLogger.logTokenRevocationFailure(tokenId, error)
      throw error instanceof AuthenticationError
        ? error
        : new AuthenticationError('Token revocation failed')
    }
  }

  /**
   * Clean up expired and revoked tokens
   */
  async cleanupExpiredTokens(): Promise<CleanupResult> {
    try {
      const now = Math.floor(Date.now() / 1000)
      let cleanedCount = 0

      // Get all token metadata keys
      const tokenKeys = await this.redis.keys('token:metadata:*')

      for (const key of tokenKeys) {
        const metadata = await this.getTokenMetadataByKey(key)

        if (metadata && this.shouldCleanupToken(metadata, now)) {
          // Remove token metadata
          await this.redis.del(key)
          cleanedCount++

          // Clean up cached data
          await this.cacheService.invalidateToken(metadata.id)

          // Log cleanup event
          await this.securityLogger.logTokenCleanup(
            metadata.userId,
            metadata.id,
          )
        }
      }

      return {
        cleanedTokens: cleanedCount,
        timestamp: now,
        nextCleanup: this.calculateNextCleanupTime(),
      }
    } catch (error) {
      await this.securityLogger.logTokenCleanupFailure(error)
      throw new Error('Token cleanup failed', { cause: error })
    }
  }

  /**
   * Validate additional security constraints on token
   */
  private async validateTokenSecurity(
    payload: JWTPayload,
    metadata: TokenMetadata,
  ): Promise<void> {
    // Validate session context (IP/User-Agent hash matching)
    if (this.config.enableIPValidation && payload.ipHash) {
      const currentIPHash = this.hashClientIP(metadata.clientInfo.ipAddress)
      if (payload.ipHash !== currentIPHash) {
        await this.securityLogger.logSecurityEvent('ip_mismatch', payload.sub, {
          tokenId: payload.jti,
        })
        throw new TokenValidationError('IP address mismatch detected')
      }
    }

    if (this.config.enableUserAgentValidation && payload.userAgentHash) {
      const currentUAHash = this.hashUserAgent(metadata.clientInfo.userAgent)
      if (payload.userAgentHash !== currentUAHash) {
        await this.securityLogger.logSecurityEvent(
          'user_agent_mismatch',
          payload.sub,
          { tokenId: payload.jti },
        )
        throw new TokenValidationError('User-Agent mismatch detected')
      }
    }

    // Check for token replay attacks
    if (this.config.enableReplayProtection) {
      const isReplay = await this.detectReplayAttack(payload)
      if (isReplay) {
        await this.securityLogger.logSecurityEvent(
          'replay_attack_detected',
          payload.sub,
          { tokenId: payload.jti },
        )
        throw new TokenValidationError('Potential replay attack detected')
      }
    }
  }

  /**
   * Store token metadata in Redis for validation and revocation
   */
  private async storeTokenMetadata(
    tokenId: string,
    metadata: TokenMetadata,
  ): Promise<void> {
    const key = `token:metadata:${tokenId}`
    const ttl = metadata.expiresAt - Math.floor(Date.now() / 1000)

    if (ttl <= 0) {
      throw new Error('Cannot store expired token metadata')
    }

    await this.redis.setex(
      key,
      ttl,
      JSON.stringify({
        ...metadata,
        id: tokenId,
      }),
    )
  }

  /**
   * Retrieve token metadata from Redis
   */
  private async getTokenMetadata(
    tokenId: string,
  ): Promise<TokenMetadata | null> {
    const key = `token:metadata:${tokenId}`
    const data = await this.redis.get(key)

    if (!data) return null

    try {
      return JSON.parse(data) as TokenMetadata
    } catch {
      return null
    }
  }

  /**
   * Retrieve token metadata by Redis key
   */
  private async getTokenMetadataByKey(
    key: string,
  ): Promise<TokenMetadata | null> {
    const data = await this.redis.get(key)

    if (!data) return null

    try {
      return JSON.parse(data) as TokenMetadata
    } catch {
      return null
    }
  }

  /**
   * Check if token should be cleaned up
   */
  private shouldCleanupToken(
    metadata: TokenMetadata,
    currentTime: number,
  ): boolean {
    // Clean up expired tokens
    if (metadata.expiresAt < currentTime) {
      return true
    }

    // Clean up revoked tokens after grace period (1 hour)
    if (
      metadata.isRevoked &&
      metadata.revokedAt &&
      currentTime - metadata.revokedAt > 3600
    ) {
      return true
    }

    return false
  }

  /**
   * Calculate next cleanup time
   */
  private calculateNextCleanupTime(): number {
    // Run cleanup every 6 hours
    return Math.floor(Date.now() / 1000) + 6 * 3600
  }

  /**
   * Detect potential replay attacks
   */
  private async detectReplayAttack(payload: JWTPayload): Promise<boolean> {
    // Check if this token has been used recently
    const recentUseKey = `token:recent_use:${payload.jti}`
    const recentUse = await this.redis.get(recentUseKey)

    if (recentUse) {
      return true
    }

    // Mark token as recently used (5 minute window)
    await this.redis.setex(recentUseKey, 300, '1')
    return false
  }

  /**
   * Hash client IP address for security validation
   */
  private hashClientIP(ipAddress: string): string {
    // Use HMAC with secret key to create consistent hash
    return createHmac('sha256', this.config.secretKey)
      .update(ipAddress)
      .digest('hex')
      .substring(0, 16) // Use first 16 characters
  }

  /**
   * Hash user agent for security validation
   */
  private hashUserAgent(userAgent: string): string {
    // Use HMAC with secret key to create consistent hash
    return createHmac('sha256', this.config.secretKey)
      .update(userAgent)
      .digest('hex')
      .substring(0, 16) // Use first 16 characters
  }

  /**
   * Validate configuration parameters
   */
  private validateConfiguration(): void {
    if (!this.config.secretKey || this.config.secretKey.length < 32) {
      throw new Error(
        'JWT secret key must be at least 256 bits (32 characters)',
      )
    }

    if (!['HS256', 'RS256'].includes(this.config.algorithm)) {
      throw new Error('Unsupported JWT algorithm. Use HS256 or RS256')
    }

    if (
      this.config.accessTokenExpiry <= 0 ||
      this.config.refreshTokenExpiry <= 0
    ) {
      throw new Error('Token expiry times must be positive')
    }

    if (this.config.accessTokenExpiry >= this.config.refreshTokenExpiry) {
      throw new Error('Access token must expire before refresh token')
    }
  }
}

// Cleanup result interface
export interface CleanupResult {
  cleanedTokens: number
  timestamp: number
  nextCleanup: number
}
