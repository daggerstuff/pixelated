import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as auth0JwtService from '../../../src/lib/auth/auth0-jwt-service'

// Mock the auth0 module
vi.mock('auth0', () => {
  return {
    AuthenticationClient: vi.fn().mockImplementation(() => {
      return {
        getProfile: vi.fn(),
        refreshToken: vi.fn()
      }
    })
  }
})

// Mock redis functions
vi.mock('../../../src/lib/redis', () => {
  return {
    getFromCache: vi.fn(),
    setInCache: vi.fn(),
    removeFromCache: vi.fn()
  }
})

// Mock security logging
vi.mock('../../../src/lib/security/index', () => {
  return {
    logSecurityEvent: vi.fn(),
    SecurityEventType: {
      TOKEN_VALIDATED: 'TOKEN_VALIDATED',
      TOKEN_VALIDATION_FAILED: 'TOKEN_VALIDATION_FAILED',
      TOKEN_REFRESHED: 'TOKEN_REFRESHED',
      TOKEN_REVOKED: 'TOKEN_REVOKED'
    }
  }
})

// Mock MCP integration
vi.mock('../../../src/lib/mcp/phase6-integration', () => {
  return {
    updatePhase6AuthenticationProgress: vi.fn()
  }
})

describe('Auth0 JWT Service', () => {
  beforeEach(() => {
    // Set environment variables
    process.env.AUTH0_DOMAIN = 'test-domain.auth0.com'
    process.env.AUTH0_CLIENT_ID = 'test-client-id'
    process.env.AUTH0_CLIENT_SECRET = 'test-client-secret'
    process.env.AUTH0_AUDIENCE = 'test-audience'

    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up environment variables
    delete process.env.AUTH0_DOMAIN
    delete process.env.AUTH0_CLIENT_ID
    delete process.env.AUTH0_CLIENT_SECRET
    delete process.env.AUTH0_AUDIENCE
  })

  describe('validateToken', () => {
    it('should validate a valid access token', async () => {
      const mockPayload = {
        sub: 'auth0|123456',
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'token-id-123',
        'https://pixelated.empathy/app_metadata': { roles: ['admin'] },
        'https://pixelated.empathy/user_metadata': { role: 'admin' }
      }

      const auth0Module = require('auth0')
      const mockAuthClient = auth0Module.AuthenticationClient.mock.results[0].value
      mockAuthClient.getProfile.mockResolvedValue(mockPayload)

      const result = await auth0JwtService.validateToken('valid-token', 'access')

      expect(result).toEqual({
        valid: true,
        userId: 'auth0|123456',
        role: 'admin',
        tokenId: 'token-id-123',
        expiresAt: mockPayload.exp,
        payload: mockPayload
      })

      expect(mockAuthClient.getProfile).toHaveBeenCalledWith('valid-token')
    })

    it('should reject an expired token', async () => {
      const mockPayload = {
        sub: 'auth0|123456',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        jti: 'token-id-123'
      }

      const auth0Module = require('auth0')
      const mockAuthClient = auth0Module.AuthenticationClient.mock.results[0].value
      mockAuthClient.getProfile.mockResolvedValue(mockPayload)

      const result = await auth0JwtService.validateToken('expired-token', 'access')

      expect(result).toEqual({
        valid: false,
        error: 'Token has expired'
      })
    })

    it('should reject refresh token validation', async () => {
      const result = await auth0JwtService.validateToken('refresh-token', 'refresh')

      expect(result).toEqual({
        valid: false,
        error: 'Refresh token validation not supported with this method'
      })
    })

    it('should extract role from permissions when app_metadata is not available', async () => {
      const mockPayload = {
        sub: 'auth0|123456',
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'token-id-123',
        permissions: ['therapist', 'patient']
      }

      const auth0Module = require('auth0')
      const mockAuthClient = auth0Module.AuthenticationClient.mock.results[0].value
      mockAuthClient.getProfile.mockResolvedValue(mockPayload)

      const result = await auth0JwtService.validateToken('valid-token', 'access')

      expect(result.role).toBe('therapist') // First permission takes precedence
    })

    it('should default to guest role when no role information is available', async () => {
      const mockPayload = {
        sub: 'auth0|123456',
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'token-id-123'
      }

      const auth0Module = require('auth0')
      const mockAuthClient = auth0Module.AuthenticationClient.mock.results[0].value
      mockAuthClient.getProfile.mockResolvedValue(mockPayload)

      const result = await auth0JwtService.validateToken('valid-token', 'access')

      expect(result.role).toBe('guest')
    })

    it('should handle validation errors gracefully', async () => {
      const auth0Module = require('auth0')
      const mockAuthClient = auth0Module.AuthenticationClient.mock.results[0].value
      mockAuthClient.getProfile.mockRejectedValue(new Error('Invalid token signature'))

      const result = await auth0JwtService.validateToken('invalid-token', 'access')

      expect(result).toEqual({
        valid: false,
        error: 'Invalid token signature'
      })
    })
  })

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      }

      const mockUserResponse = {
        sub: 'auth0|123456',
        jti: 'new-token-id-456',
        'https://pixelated.empathy/app_metadata': { roles: ['user'] }
      }

      const auth0Module = require('auth0')
      const mockAuthClient = auth0Module.AuthenticationClient.mock.results[0].value
      mockAuthClient.refreshToken.mockResolvedValue(mockTokenResponse)
      mockAuthClient.getProfile.mockResolvedValue(mockUserResponse)

      const result = await auth0JwtService.refreshAccessToken('old-refresh-token', {
        ip: '127.0.0.1',
        userAgent: 'test-agent'
      })

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: {
          id: 'auth0|123456',
          role: 'user'
        }
      })

      expect(mockAuthClient.refreshToken).toHaveBeenCalledWith({
        refresh_token: 'old-refresh-token'
      })
    })

    it('should use existing refresh token when new one is not provided', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: undefined, // No new refresh token
        expires_in: 3600,
        token_type: 'Bearer'
      }

      const mockUserResponse = {
        sub: 'auth0|123456',
        jti: 'new-token-id-456',
        'https://pixelated.empathy/app_metadata': { roles: ['user'] }
      }

      const auth0Module = require('auth0')
      const mockAuthClient = auth0Module.AuthenticationClient.mock.results[0].value
      mockAuthClient.refreshToken.mockResolvedValue(mockTokenResponse)
      mockAuthClient.getProfile.mockResolvedValue(mockUserResponse)

      const result = await auth0JwtService.refreshAccessToken('old-refresh-token', {})

      expect(result.refreshToken).toBe('old-refresh-token')
    })

    it('should throw AuthenticationError for invalid refresh token', async () => {
      const auth0Module = require('auth0')
      const mockAuthClient = auth0Module.AuthenticationClient.mock.results[0].value
      mockAuthClient.refreshToken.mockRejectedValue(new Error('Invalid refresh token'))

      await expect(auth0JwtService.refreshAccessToken('invalid-refresh-token', {}))
        .rejects.toThrow(auth0JwtService.AuthenticationError)
    })
  })

  describe('revokeToken', () => {
    it('should mark token as revoked in cache', async () => {
      const redisModule = require('../../../src/lib/redis')
      redisModule.setInCache.mockResolvedValue(undefined)

      await auth0JwtService.revokeToken('token-to-revoke', 'user_logout')

      expect(redisModule.setInCache).toHaveBeenCalledWith(
        'revoked:token-to-revoke',
        { reason: 'user_logout', revokedAt: expect.any(Number) },
        24 * 60 * 60
      )
    })
  })

  describe('cleanupExpiredTokens', () => {
    it('should return cleanup statistics', async () => {
      const result = await auth0JwtService.cleanupExpiredTokens()

      expect(result).toEqual({
        cleanedTokens: 0,
        timestamp: expect.any(Number),
        nextCleanup: expect.any(Number)
      })

      // Next cleanup should be in 1 hour
      expect(result.nextCleanup).toBe(result.timestamp + 60 * 60)
    })
  })

  describe('measureTokenOperation', () => {
    it('should measure successful operation duration', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await auth0JwtService.measureTokenOperation(mockOperation, 'test-operation')

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalled()
      expect(consoleWarnSpy).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('should log warning for slow operations', async () => {
      const mockOperation = vi.fn().mockImplementation(async () => {
        // Simulate a slow operation
        await new Promise(resolve => setTimeout(resolve, 150))
        return 'slow-result'
      })

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await auth0JwtService.measureTokenOperation(mockOperation, 'slow-operation')

      expect(result).toBe('slow-result')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token operation slow-operation took'),
        expect.stringContaining('ms')
      )

      consoleWarnSpy.mockRestore()
    })

    it('should handle operation errors', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(auth0JwtService.measureTokenOperation(mockOperation, 'failing-operation'))
        .rejects.toThrow('Operation failed')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token operation failing-operation failed after'),
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('AuthenticationError', () => {
    it('should create AuthenticationError with correct properties', () => {
      const error = new auth0JwtService.AuthenticationError('Test error', 'TEST_CODE')

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('AuthenticationError')
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_CODE')
    })

    it('should create AuthenticationError without code', () => {
      const error = new auth0JwtService.AuthenticationError('Test error')

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('AuthenticationError')
      expect(error.message).toBe('Test error')
      expect(error.code).toBeUndefined()
    })
  })
})