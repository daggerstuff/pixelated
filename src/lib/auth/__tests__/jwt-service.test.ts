/**
 * JWT Service Tests
 * Comprehensive test suite for JWT token generation, validation, and management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import {
  generateTokenPair,
  validateToken,
  refreshAccessToken,
  revokeToken,
  cleanupExpiredTokens,
  AuthenticationError,
  type ClientInfo,
} from '../jwt-service'

// Mock dependencies
vi.mock('../../redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  },
  getFromCache: vi.fn(),
  setInCache: vi.fn(),
  removeFromCache: vi.fn(),
}))

vi.mock('../../security', () => ({
  logSecurityEvent: vi.fn(),
  SecurityEventType: {
    TOKEN_CREATED: 'TOKEN_CREATED',
    TOKEN_VALIDATED: 'TOKEN_VALIDATED',
    TOKEN_VALIDATION_FAILED: 'TOKEN_VALIDATION_FAILED',
    TOKEN_REFRESHED: 'TOKEN_REFRESHED',
    TOKEN_REVOKED: 'TOKEN_REVOKED',
    TOKEN_CLEANED_UP: 'TOKEN_CLEANED_UP',
  },
}))

vi.mock('../../mcp/phase6-integration', () => ({
  updatePhase6AuthenticationProgress: vi.fn(),
}))

describe('JWT Service', () => {
  const mockClientInfo: ClientInfo = {
    ip: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    deviceId: 'test-device-123',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Set test environment variables
    process.env.JWT_SECRET = 'test-secret-key'
    process.env.JWT_AUDIENCE = 'test-audience'
    process.env.JWT_ISSUER = 'test-issuer'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('generateTokenPair', () => {
    it('should generate valid token pair with correct structure', async () => {
      const result = await generateTokenPair('user123', 'admin', mockClientInfo)

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result).toHaveProperty('tokenType', 'Bearer')
      expect(result).toHaveProperty('expiresIn', 86400) // 24 hours
      expect(result).toHaveProperty('user')
      expect(result.user).toHaveProperty('id', 'user123')
      expect(result.user).toHaveProperty('role', 'admin')

      // Verify tokens are valid JWTs
      expect(() => jwt.decode(result.accessToken)).not.toThrow()
      expect(() => jwt.decode(result.refreshToken)).not.toThrow()
    })

    it('should throw error for invalid parameters', async () => {
      await expect(
        generateTokenPair('', 'admin', mockClientInfo),
      ).rejects.toThrow(AuthenticationError)

      await expect(
        generateTokenPair('user123', '' as any, mockClientInfo),
      ).rejects.toThrow(AuthenticationError)

      await expect(
        generateTokenPair('user123', 'admin', {} as any),
      ).rejects.toThrow(AuthenticationError)
    })

    it('should store token metadata in Redis', async () => {
      const { setInCache } = await import('../../redis')

      await generateTokenPair('user123', 'admin', mockClientInfo)

      expect(setInCache).toHaveBeenCalledTimes(2) // Once for access token, once for refresh token
      expect(setInCache).toHaveBeenCalledWith(
        expect.stringMatching(/^token:/),
        expect.objectContaining({
          userId: 'user123',
          role: 'admin',
          type: 'access',
        }),
        expect.any(Number),
      )
    })

    it('should log security event', async () => {
      const { logSecurityEvent } = await import('../../security')

      await generateTokenPair('user123', 'admin', mockClientInfo)

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'TOKEN_CREATED',
        'user123',
        expect.objectContaining({
          clientInfo: mockClientInfo,
        }),
      )
    })

    it('should update Phase 6 MCP server', async () => {
      const { updatePhase6AuthenticationProgress } = await import(
        '../../mcp/phase6-integration'
      )

      await generateTokenPair('user123', 'admin', mockClientInfo)

      expect(updatePhase6AuthenticationProgress).toHaveBeenCalledWith(
        'user123',
        'token_generated',
      )
    })
  })

  describe('validateToken', () => {
    it('should validate valid token and return user info', async () => {
      const { setInCache } = await import('../../redis')

      // Generate a token first
      const tokenPair = await generateTokenPair(
        'user123',
        'admin',
        mockClientInfo,
      )

      // Mock Redis to return valid metadata
      vi.mocked(setInCache).mockImplementation(async (key, _data) => {
        if (key.startsWith('token:')) {
          // Simulate storing in Redis
          return true
        }
        return true
      })

      const result = await validateToken(tokenPair.accessToken, 'access')

      expect(result.valid).toBe(true)
      expect(result.userId).toBe('user123')
      expect(result.role).toBe('admin')
      expect(result.tokenId).toBeDefined()
      expect(result.expiresAt).toBeDefined()
    })

    it('should reject expired tokens', async () => {
      // Create an expired token
      const expiredPayload = {
        sub: 'user123',
        role: 'admin',
        type: 'access',
        jti: 'test-token-id',
        iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        exp: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
        aud: 'test-audience',
        iss: 'test-issuer',
      }

      const expiredToken = jwt.sign(expiredPayload, process.env.JWT_SECRET!, {
        algorithm: 'HS256',
      })

      const result = await validateToken(expiredToken, 'access')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('expired')
    })

    it('should reject tampered tokens', async () => {
      const tokenPair = await generateTokenPair(
        'user123',
        'admin',
        mockClientInfo,
      )

      // Tamper with the token
      const tamperedToken = tokenPair.accessToken.slice(0, -10) + 'tampered123'

      const result = await validateToken(tamperedToken, 'access')

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject revoked tokens', async () => {
      const { getFromCache } = await import('../../redis')

      const tokenPair = await generateTokenPair(
        'user123',
        'admin',
        mockClientInfo,
      )

      // Mock revoked token
      vi.mocked(getFromCache).mockImplementation(async (key) => {
        if (key.startsWith('revoked:')) {
          return { reason: 'user_logout', revokedAt: Date.now() }
        }
        return null
      })

      const result = await validateToken(tokenPair.accessToken, 'access')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('revoked')
    })

    it('should reject tokens with wrong type', async () => {
      const tokenPair = await generateTokenPair(
        'user123',
        'admin',
        mockClientInfo,
      )

      // Try to validate access token as refresh token
      const result = await validateToken(tokenPair.accessToken, 'refresh')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid token type')
    })

    it('should log validation failure', async () => {
      const { logSecurityEvent } = await import('../../security')

      const invalidToken = 'invalid.jwt.token'
      await validateToken(invalidToken, 'access')

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'TOKEN_VALIDATION_FAILED',
        null,
        expect.objectContaining({
          error: expect.any(String),
          tokenType: 'access',
        }),
      )
    })
  })

  describe('refreshAccessToken', () => {
    it('should generate new token pair with valid refresh token', async () => {
      const { setInCache } = await import('../../redis')

      const originalTokenPair = await generateTokenPair(
        'user123',
        'admin',
        mockClientInfo,
      )

      // Mock Redis responses for refresh flow
      vi.mocked(setInCache).mockImplementation(async (key, _data) => {
        if (key.startsWith('token:')) {
          return true
        }
        return true
      })

      const newTokenPair = await refreshAccessToken(
        originalTokenPair.refreshToken,
        mockClientInfo,
      )

      expect(newTokenPair).toHaveProperty('accessToken')
      expect(newTokenPair).toHaveProperty('refreshToken')
      expect(newTokenPair.accessToken).not.toBe(originalTokenPair.accessToken)
      expect(newTokenPair.refreshToken).not.toBe(originalTokenPair.refreshToken)
    })

    it('should revoke old tokens after refresh', async () => {
      const { setInCache, removeFromCache } = await import('../../redis')

      const originalTokenPair = await generateTokenPair(
        'user123',
        'admin',
        mockClientInfo,
      )

      // Mock Redis responses
      vi.mocked(setInCache).mockImplementation(async (key, _data) => {
        if (key.startsWith('token:')) {
          return true
        }
        return true
      })

      vi.mocked(removeFromCache).mockImplementation(async (_key) => {
        return true
      })

      await refreshAccessToken(originalTokenPair.refreshToken, mockClientPair)

      // Verify old tokens are revoked
      expect(setInCache).toHaveBeenCalledWith(
        expect.stringMatching(/^revoked:/),
        expect.objectContaining({
          reason: expect.stringContaining('refresh_token_used'),
        }),
        expect.any(Number),
      )
    })

    it('should throw error for invalid refresh token', async () => {
      await expect(
        refreshAccessToken('invalid.token.here', mockClientInfo),
      ).rejects.toThrow(AuthenticationError)
    })
  })

  describe('revokeToken', () => {
    it('should revoke token and clean up metadata', async () => {
      const { setInCache, removeFromCache } = await import('../../redis')

      const tokenPair = await generateTokenPair(
        'user123',
        'admin',
        mockClientInfo,
      )
      const decoded = jwt.decode(tokenPair.accessToken) as any

      // Mock Redis responses
      vi.mocked(setInCache).mockImplementation(async (_key, _data) => {
        return true
      })

      vi.mocked(removeFromCache).mockImplementation(async (_key) => {
        return true
      })

      await revokeToken(decoded.jti, 'user_logout')

      expect(setInCache).toHaveBeenCalledWith(
        `revoked:${decoded.jti}`,
        expect.objectContaining({
          reason: 'user_logout',
        }),
        expect.any(Number),
      )

      expect(removeFromCache).toHaveBeenCalledWith(`token:${decoded.jti}`)
    })

    it('should log revocation event', async () => {
      const { logSecurityEvent } = await import('../../security')

      const tokenPair = await generateTokenPair(
        'user123',
        'admin',
        mockClientInfo,
      )
      const decoded = jwt.decode(tokenPair.accessToken) as any

      await revokeToken(decoded.jti, 'security_breach')

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'TOKEN_REVOKED',
        'user123',
        expect.objectContaining({
          tokenId: decoded.jti,
          reason: 'security_breach',
        }),
      )
    })
  })

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired tokens', async () => {
      const { getFromCache, removeFromCache, redis } = await import(
        '../../redis'
      )

      // Mock Redis keys
      vi.mocked(redis.keys).mockResolvedValue([
        'token:123',
        'token:456',
        'token:789',
      ])

      // Mock token metadata - some expired, some not
      vi.mocked(getFromCache).mockImplementation(async (key) => {
        if (key === 'token:123') {
          return {
            userId: 'user123',
            expiresAt: Math.floor(Date.now() / 1000) - 3600,
          } // expired
        }
        if (key === 'token:456') {
          return {
            userId: 'user456',
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
          } // not expired
        }
        if (key === 'token:789') {
          return {
            userId: 'user789',
            expiresAt: Math.floor(Date.now() / 1000) - 7200,
          } // expired
        }
        return null
      })

      vi.mocked(removeFromCache).mockImplementation(async (_key) => {
        return true
      })

      const result = await cleanupExpiredTokens()

      expect(result.cleanedTokens).toBe(2) // Should clean up 2 expired tokens
      expect(result.timestamp).toBeDefined()
      expect(result.nextCleanup).toBeDefined()

      expect(removeFromCache).toHaveBeenCalledWith('token:123')
      expect(removeFromCache).toHaveBeenCalledWith('token:789')
      expect(removeFromCache).not.toHaveBeenCalledWith('token:456')
    })

    it('should log cleanup events', async () => {
      const { logSecurityEvent } = await import('../../security')
      const { redis } = await import('../../redis')

      vi.mocked(redis.keys).mockResolvedValue(['token:123'])
      vi.mocked(getFromCache).mockResolvedValue({
        userId: 'user123',
        expiresAt: Math.floor(Date.now() / 1000) - 3600,
      })

      await cleanupExpiredTokens()

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'TOKEN_CLEANED_UP',
        'user123',
        expect.objectContaining({
          reason: 'expired_cleanup',
        }),
      )
    })
  })

  describe('measureTokenOperation', () => {
    it('should measure operation performance', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success')

      const result = await measureTokenOperation(
        mockOperation,
        'test_operation',
      )

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalled()
    })

    it('should log slow operations', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      const slowOperation = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150)) // 150ms delay
        return 'slow_result'
      })

      await measureTokenOperation(slowOperation, 'slow_operation')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('slow_operation took'),
      )

      consoleSpy.mockRestore()
    })

    it('should log operation failures', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

      const failingOperation = vi
        .fn()
        .mockRejectedValue(new Error('Operation failed'))

      await expect(
        measureTokenOperation(failingOperation, 'failing_operation'),
      ).rejects.toThrow('Operation failed')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('failing_operation failed after'),
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Performance Requirements', () => {
    it('should meet sub-100ms token generation target', async () => {
      const start = performance.now()

      await generateTokenPair('user123', 'admin', mockClientInfo)

      const duration = performance.now() - start
      expect(duration).toBeLessThan(100)
    })

    it('should meet sub-50ms token validation target', async () => {
      const tokenPair = await generateTokenPair(
        'user123',
        'admin',
        mockClientInfo,
      )

      const start = performance.now()

      await validateToken(tokenPair.accessToken, 'access')

      const duration = performance.now() - start
      expect(duration).toBeLessThan(50)
    })
  })

  describe('Security Requirements', () => {
    it('should reject tokens with invalid signatures', async () => {
      const invalidToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwicm9sZSI6ImFkbWluIiwidHlwZSI6ImFjY2VzcyIsImp0aSI6InRlc3QtaWQtMTIzIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDA5MDB9.INVALID_SIGNATURE'

      const result = await validateToken(invalidToken, 'access')

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should validate token device binding', async () => {
      const { setInCache } = await import('../../redis')

      const tokenPair = await generateTokenPair(
        'user123',
        'admin',
        mockClientInfo,
      )

      // Mock different device ID in metadata
      vi.mocked(setInCache).mockImplementation(async (key, _data) => {
        if (key.startsWith('token:')) {
          // Store metadata with different device ID

          return true
        }
        return true
      })

      const result = await validateToken(tokenPair.accessToken, 'access')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('device binding mismatch')
    })

    it('should enforce token expiration', async () => {
      const expiredPayload = {
        sub: 'user123',
        role: 'admin',
        type: 'access',
        jti: 'test-token-id',
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) - 1800,
        aud: 'test-audience',
        iss: 'test-issuer',
      }

      const expiredToken = jwt.sign(expiredPayload, process.env.JWT_SECRET!, {
        algorithm: 'HS256',
      })

      const result = await validateToken(expiredToken, 'access')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('expired')
    })
  })

  describe('HIPAA Compliance', () => {
    it('should not log sensitive user data in security events', async () => {
      const { logSecurityEvent } = await import('../../security')

      await generateTokenPair('user123', 'admin', mockClientInfo)

      const loggedData = vi.mocked(logSecurityEvent).mock.calls[0][2]

      // Should not contain sensitive data like passwords or full tokens
      expect(JSON.stringify(loggedData)).not.toContain('password')
      expect(JSON.stringify(loggedData)).not.toContain(mockClientInfo.userAgent)
    })

    it('should mask IP addresses in logs when required', async () => {
      const { logSecurityEvent } = await import('../../security')

      await generateTokenPair('user123', 'admin', mockClientInfo)

      const loggedData = vi.mocked(logSecurityEvent).mock.calls[0][2]

      // IP should be masked or not included in logs
      if (loggedData.clientInfo) {
        expect(loggedData.clientInfo.ip).toBeUndefined()
      }
    })
  })
})
