import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as auth0JwtService from '../../../apps/web/src/lib/auth/auth0-jwt-service'

const mockRedis = vi.hoisted(() => ({
  getFromCache: vi.fn(),
  setInCache: vi.fn(),
  removeFromCache: vi.fn(),
}))

const mockAuthClient = vi.hoisted(() => ({
  getProfile: vi.fn(),
  refreshToken: vi.fn(),
  oauth: {
    refreshTokenGrant: vi.fn(),
  },
}))

const mockUserInfoClient = vi.hoisted(() => ({
  getUserInfo: vi.fn(),
  getProfile: vi.fn(),
}))

const setMockUserInfoResponse = (payload: Record<string, unknown>) => {
  const response = { data: payload }
  mockUserInfoClient.getUserInfo.mockResolvedValue(response)
  mockUserInfoClient.getProfile.mockResolvedValue(response)
}

// Mock the auth0 module
vi.mock('auth0', () => {
  return {
    AuthenticationClient: vi.fn(function () {
      return mockAuthClient
    }),
    UserInfoClient: vi.fn(function () {
      return mockUserInfoClient
    }),
  }
})

// Mock redis functions
vi.mock('../../../apps/web/src/lib/redis', () => {
  return mockRedis
})

// Mock security logging
vi.mock('../../../apps/web/src/lib/security/index', () => {
  return {
    logSecurityEvent: vi.fn(),
    SecurityEventType: {
      TOKEN_VALIDATED: 'TOKEN_VALIDATED',
      TOKEN_VALIDATION_FAILED: 'TOKEN_VALIDATION_FAILED',
      TOKEN_REFRESHED: 'TOKEN_REFRESHED',
      TOKEN_REVOKED: 'TOKEN_REVOKED',
    },
  }
})

// Mock MCP integration
vi.mock('../../../apps/web/src/lib/mcp/phase6-integration', () => {
  return {
    updatePhase6AuthenticationProgress: vi.fn(),
  }
})

const createMockJwt = (payload: Record<string, unknown>): string => {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.${encode('sig')}`
}

const withStandardClaims = (
  overrides: Record<string, unknown>,
): Record<string, unknown> => ({
  iss: 'https://test-domain.auth0.com/',
  aud: 'test-audience',
  ...overrides,
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
    mockAuthClient.getProfile.mockReset()
    mockAuthClient.refreshToken.mockReset()
    mockAuthClient.oauth.refreshTokenGrant.mockReset()
    mockUserInfoClient.getUserInfo.mockReset()
    mockUserInfoClient.getProfile.mockReset()
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
      const mockPayload = withStandardClaims({
        'sub': 'auth0|123456',
        'exp': Math.floor(Date.now() / 1000) + 3600,
        'jti': 'token-id-123',
        'https://pixelated.empathy/app_metadata': { roles: ['admin'] },
        'https://pixelated.empathy/user_metadata': { role: 'admin' },
      })

      setMockUserInfoResponse(mockPayload)

      const token = createMockJwt(mockPayload)

      const result = await auth0JwtService.validateToken(token, 'access')

      expect(result).toEqual({
        valid: true,
        userId: 'auth0|123456',
        role: 'admin',
        tokenId: 'token-id-123',
        expiresAt: mockPayload.exp,
        payload: mockPayload,
      })

      expect(mockUserInfoClient.getUserInfo).toHaveBeenCalledWith(token)
    })

    it('should reject an expired token', async () => {
      const mockPayload = withStandardClaims({
        sub: 'auth0|123456',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        jti: 'token-id-123',
      })

      setMockUserInfoResponse(mockPayload)
      const token = createMockJwt(mockPayload)

      const result = await auth0JwtService.validateToken(token, 'access')

      expect(result).toEqual({
        valid: false,
        error: 'Token has expired',
      })
    })

    it('should reject refresh token validation', async () => {
      const result = await auth0JwtService.validateToken(
        'refresh-token',
        'refresh',
      )

      expect(result).toEqual({
        valid: false,
        error: 'Refresh token validation not supported with this method',
      })
    })

    it('should extract role from permissions when app_metadata is not available', async () => {
      const mockPayload = withStandardClaims({
        sub: 'auth0|123456',
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'token-id-123',
        permissions: ['therapist', 'patient'],
      })

      setMockUserInfoResponse(mockPayload)
      const token = createMockJwt(mockPayload)

      const result = await auth0JwtService.validateToken(token, 'access')

      expect(result.role).toBe('therapist') // First permission takes precedence
    })

    it('should default to guest role when no role information is available', async () => {
      const mockPayload = withStandardClaims({
        sub: 'auth0|123456',
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'token-id-123',
      })

      setMockUserInfoResponse(mockPayload)
      const token = createMockJwt(mockPayload)

      const result = await auth0JwtService.validateToken(token, 'access')

      expect(result.role).toBe('guest')
    })

    it('should handle validation errors gracefully', async () => {
      mockUserInfoClient.getUserInfo.mockRejectedValue(
        new Error('Invalid token signature'),
      )
      const token = createMockJwt({
        iss: 'https://test-domain.auth0.com/',
        aud: 'test-audience',
      })

      const result = await auth0JwtService.validateToken(token, 'access')

      expect(result).toEqual({
        valid: false,
        error: 'Invalid token signature',
      })
    })
  })

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }

      const mockUserResponse = {
        'sub': 'auth0|123456',
        'jti': 'new-token-id-456',
        'https://pixelated.empathy/app_metadata': { roles: ['user'] },
      }

      mockAuthClient.oauth.refreshTokenGrant.mockResolvedValue({
        data: mockTokenResponse,
      })
      setMockUserInfoResponse(mockUserResponse)

      const result = await auth0JwtService.refreshAccessToken(
        'old-refresh-token',
        {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
        },
      )

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: {
          id: 'auth0|123456',
          role: 'patient',
        },
      })

      expect(mockAuthClient.oauth.refreshTokenGrant).toHaveBeenCalledWith({
        refresh_token: 'old-refresh-token',
      })
    })

    it('should use existing refresh token when new one is not provided', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: undefined, // No new refresh token
        expires_in: 3600,
        token_type: 'Bearer',
      }

      const mockUserResponse = {
        'sub': 'auth0|123456',
        'jti': 'new-token-id-456',
        'https://pixelated.empathy/app_metadata': { roles: ['user'] },
      }

      mockAuthClient.oauth.refreshTokenGrant.mockResolvedValue({
        data: mockTokenResponse,
      })
      setMockUserInfoResponse(mockUserResponse)

      const result = await auth0JwtService.refreshAccessToken(
        'old-refresh-token',
        {},
      )

      expect(result.refreshToken).toBe('old-refresh-token')
    })

    it('should throw AuthenticationError for invalid refresh token', async () => {
      mockAuthClient.oauth.refreshTokenGrant.mockRejectedValue(
        new Error('Invalid refresh token'),
      )

      await expect(
        auth0JwtService.refreshAccessToken('invalid-refresh-token', {}),
      ).rejects.toThrow(auth0JwtService.AuthenticationError)
    })

    it('should retry transient UserInfo failures during refresh and succeed', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }

      const mockUserResponse = {
        'sub': 'auth0|123456',
        'jti': 'new-token-id-456',
        'https://pixelated.empathy/app_metadata': { roles: ['user'] },
      }

      mockAuthClient.oauth.refreshTokenGrant.mockResolvedValue({
        data: mockTokenResponse,
      })
      mockUserInfoClient.getUserInfo
        .mockRejectedValueOnce(new Error('transient provider timeout'))
        .mockResolvedValue({ data: mockUserResponse })

      const result = await auth0JwtService.refreshAccessToken(
        'old-refresh-token',
        {},
      )

      expect(result.accessToken).toBe('new-access-token')
      // Initial attempt + one retry
      expect(mockUserInfoClient.getUserInfo).toHaveBeenCalledTimes(2)
    })

    it('should throw AuthenticationError when UserInfo keeps failing during refresh', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }

      mockAuthClient.oauth.refreshTokenGrant.mockResolvedValue({
        data: mockTokenResponse,
      })
      mockUserInfoClient.getUserInfo.mockRejectedValue(
        new Error('provider unavailable'),
      )

      await expect(
        auth0JwtService.refreshAccessToken('old-refresh-token', {}),
      ).rejects.toThrow(auth0JwtService.AuthenticationError)

      // Initial attempt + one retry, then final failure surfaces
      expect(mockUserInfoClient.getUserInfo).toHaveBeenCalledTimes(2)
    })
  })

  describe('revokeToken', () => {
    it('should mark token as revoked in cache', async () => {
      mockRedis.setInCache.mockResolvedValue(undefined)

      await auth0JwtService.revokeToken('token-to-revoke', 'user_logout')

      expect(mockRedis.setInCache).toHaveBeenCalledTimes(1)
      const setInCacheCall = mockRedis.setInCache.mock.calls.at(0)
      expect(setInCacheCall?.[0]).toBe('revoked:token-to-revoke')

      const revokedPayloadJson = JSON.stringify(setInCacheCall?.[1])
      expect(revokedPayloadJson).toContain('"reason":"user_logout"')
      expect(revokedPayloadJson).toMatch(/"revokedAt":\d+/)

      expect(setInCacheCall?.[2]).toBe(24 * 60 * 60)
    })
  })

  describe('cleanupExpiredTokens', () => {
    it('should return cleanup statistics', async () => {
      const result = await auth0JwtService.cleanupExpiredTokens()

      expect(result.cleanedTokens).toBe(0)
      expect(typeof result.timestamp).toBe('number')
      expect(typeof result.nextCleanup).toBe('number')

      // Next cleanup should be in 1 hour
      expect(result.nextCleanup).toBe(result.timestamp + 60 * 60)
    })
  })

  describe('measureTokenOperation', () => {
    it('should measure successful operation duration', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success')
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      const result = await auth0JwtService.measureTokenOperation(
        mockOperation,
        'test-operation',
      )

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalled()
      expect(consoleWarnSpy).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('should log warning for slow operations', async () => {
      const mockOperation = vi.fn().mockImplementation(async () => {
        // Simulate a slow operation
        await new Promise((resolve) => setTimeout(resolve, 150))
        return 'slow-result'
      })

      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      const result = await auth0JwtService.measureTokenOperation(
        mockOperation,
        'slow-operation',
      )

      expect(result).toBe('slow-result')
      expect(consoleWarnSpy.mock.calls.flat().join(' ')).toContain(
        'Token operation slow-operation took',
      )

      consoleWarnSpy.mockRestore()
    })

    it('should handle operation errors', async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValue(new Error('Operation failed'))
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      await expect(
        auth0JwtService.measureTokenOperation(
          mockOperation,
          'failing-operation',
        ),
      ).rejects.toThrow('Operation failed')

      expect(consoleErrorSpy.mock.calls.flat().join(' ')).toContain(
        'Token operation failing-operation failed after',
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('AuthenticationError', () => {
    it('should create AuthenticationError with correct properties', () => {
      const error = new auth0JwtService.AuthenticationError(
        'Test error',
        'TEST_CODE',
      )

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
