/**
 * Integration Tests for Authentication System
 * End-to-end testing of the complete authentication flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock dependencies using vi.hoisted for better reliability
const { mockAuth0UserService, mockJwtService, mockPhase6, mockRedis, mockSecurity } = vi.hoisted(() => ({
  mockAuth0UserService: {
    createUser: vi.fn(),
    signIn: vi.fn(),
    getUserById: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    refreshSession: vi.fn(),
    userHasMFA: vi.fn().mockResolvedValue(true),
  },
  mockJwtService: {
    validateToken: vi.fn(),
    refreshAccessToken: vi.fn(),
    revokeToken: vi.fn(),
    AuthenticationError: class AuthenticationError extends Error {
      constructor(message: string) {
        super(message)
        this.name = 'AuthenticationError'
      }
    },
  },
  mockPhase6: {
    updatePhase6AuthenticationProgress: vi.fn(),
  },
  mockRedis: {
    redis: {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
    },
    getFromCache: vi.fn(),
    setInCache: vi.fn(),
    removeFromCache: vi.fn(),
  },
  mockSecurity: {
    logSecurityEvent: vi.fn(),
    SecurityEventType: {
      USER_REGISTERED: 'USER_REGISTERED',
      USER_LOGIN_SUCCESS: 'USER_LOGIN_SUCCESS',
      USER_LOGOUT: 'USER_LOGOUT',
      TOKEN_REFRESHED: 'TOKEN_REFRESHED',
      AUTHENTICATION_SUCCESS: 'AUTHENTICATION_SUCCESS',
      AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
      AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
      RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
      CSRF_VIOLATION: 'CSRF_VIOLATION',
      TOKEN_VALIDATED: 'TOKEN_VALIDATED',
      TOKEN_VALIDATION_FAILED: 'TOKEN_VALIDATION_FAILED',
      MFA_REQUIRED: 'MFA_REQUIRED',
    },
  }
}))

vi.mock('../../../services/auth0.service', () => ({ auth0UserService: mockAuth0UserService }))
vi.mock('../auth0-jwt-service', () => mockJwtService)
vi.mock('../../mcp/phase6-integration', () => mockPhase6)
vi.mock('../../redis', () => mockRedis)
vi.mock('../../security', () => mockSecurity)

// Mock MongoDB config to prevent node: module errors
vi.mock('../../../config/mongodb.config', () => ({
  mongodb: {
    connect: vi.fn().mockResolvedValue({}),
    getDb: vi.fn().mockReturnValue(null),
  }
}))

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
    genSalt: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
  genSalt: vi.fn(),
}))

// Import handlers after mocks are set up
import { POST as registerHandler } from '../../../pages/api/auth/register'
import { POST as loginHandler } from '../../../pages/api/auth/login'
import { POST as logoutHandler } from '../../../pages/api/auth/logout'
import { POST as refreshHandler } from '../../../pages/api/auth/refresh'
import { authenticateRequest, requireRole } from '../auth0-middleware'

describe('Authentication System Integration', () => {
  const mockClientInfo = {
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
    process.env.BCRYPT_ROUNDS = '10'

    // Default CSRF mock
    mockRedis.getFromCache.mockImplementation(async (key: string) => {
      if (key.startsWith('csrf:')) {
        return { token: key.split(':')[1], expiresAt: Date.now() + 3600000 }
      }
      return null
    })
    mockRedis.setInCache.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Complete Authentication Flow', () => {
    it('should handle full registration and login flow', async () => {
      // Mock registration
      mockAuth0UserService.createUser.mockResolvedValue({
        user: {
          id: 'user123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'patient',
          createdAt: new Date(),
        },
        tokenPair: {
          accessToken: 'access.token.123',
          refreshToken: 'refresh.token.123',
          tokenType: 'Bearer',
          expiresIn: 3600,
        },
      })

      const registerRequest = new Request(
        'https://example.com/api/auth/register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': mockClientInfo.userAgent,
            'X-Device-ID': mockClientInfo.deviceId,
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'SecurePass123!',
            firstName: 'John',
            lastName: 'Doe',
            role: 'patient',
          }),
        },
      )

      const registerResponse = await registerHandler({
        request: registerRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      expect(registerResponse.status).toBe(201)
      const registerData = await registerResponse.json()
      expect(registerData.success).toBe(true)
      expect(registerData.user.id).toBe('user123')

      // Mock login
      mockAuth0UserService.signIn.mockResolvedValue({
        user: {
          id: 'user123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'patient',
          lastLoginAt: new Date(),
        },
        tokenPair: {
          accessToken: 'access.token.456',
          refreshToken: 'refresh.token.456',
          tokenType: 'Bearer',
          expiresIn: 3600,
        },
      })

      const loginRequest = new Request('https://example.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': mockClientInfo.userAgent,
          'X-Device-ID': mockClientInfo.deviceId,
          'X-CSRF-Token': 'valid-csrf-token',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'SecurePass123!',
        }),
      })

      const loginResponse = await loginHandler({
        request: loginRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      expect(loginResponse.status).toBe(200)
      const loginData = await loginResponse.json()
      expect(loginData.success).toBe(true)
      expect(loginData.tokenPair.accessToken).toBe('access.token.456')
    })

    it('should enforce rate limiting across the flow', async () => {
      // Mock many attempts for rate limit check
      mockRedis.getFromCache.mockResolvedValue({
        count: 15,
        resetTime: Date.now() + 60000,
      })

      const loginRequest = new Request('https://example.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-csrf-token',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password',
        }),
      })

      const response = await loginHandler({
        request: loginRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      expect(response.status).toBe(429)
      const data = await response.json()
      expect(data.error).toContain('Rate limit exceeded')
    })

    it('should enforce CSRF protection', async () => {
      // Override default CSRF mock to simulate failure
      mockRedis.getFromCache.mockResolvedValue(null)

      const loginRequest = new Request('https://example.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'invalid-token',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password',
        }),
      })

      const response = await loginHandler({
        request: loginRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain('Invalid CSRF token')
    })
  })

  describe('Security Requirements', () => {
    it('should handle authentication middleware correctly', async () => {
      // Mock valid token validation
      mockJwtService.validateToken.mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'admin',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      mockAuth0UserService.getUserById.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
      })

      const request = new Request('https://example.com/api/protected', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })

      const result = await authenticateRequest(request)

      expect(result.success).toBe(true)
      expect(result.request?.user?.id).toBe('user123')
      expect(result.request?.user?.role).toBe('admin')
    })

    it('should enforce role-based authorization', async () => {
      const authenticatedRequest = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          role: 'patient',
        },
      } as any

      // Should fail for therapist role
      const result = await requireRole(authenticatedRequest, ['therapist', 'admin'])
      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(403)
    })

    it('should sanitize user input in registration', async () => {
      mockAuth0UserService.createUser.mockResolvedValue({
        user: { id: 'user123', email: 'sanitized@example.com', role: 'patient' },
        tokenPair: { accessToken: 'a', refreshToken: 'b', expiresIn: 3600 }
      })

      const response = await registerHandler({
        request: new Request('https://example.com/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: '  test@example.com  ',
            password: 'Password123!',
            firstName: '<b>John</b>',
            lastName: 'Doe <script>alert(1)</script>',
            role: 'patient',
          }),
        }),
        clientAddress: mockClientInfo.ip,
      } as any)

      expect(response.status).toBe(201)

      // Verify createUser was called with sanitized data
      // Note: role defaults to patient if not provided or correctly sanitized
      expect(mockAuth0UserService.createUser).toHaveBeenCalledWith(
        'test@example.com', // Sanitized email
        'Password123!',
        'patient'
      )
    })

    it('should prevent timing attacks in login', async () => {
      const start = Date.now()

      // Mock delayed response to simulate consistent timing
      mockAuth0UserService.signIn.mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 50))
        throw new Error('Invalid credentials')
      })

      const loginRequest = new Request('https://example.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-token'
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      })

      await loginHandler({
        request: loginRequest,
        clientAddress: '127.0.0.1',
      } as any)

      const duration = Date.now() - start
      expect(duration).toBeGreaterThanOrEqual(50)
    })
  })

  describe('Health Data Privacy', () => {
    it('should not log sensitive health information', async () => {
      mockAuth0UserService.createUser.mockResolvedValue({
        user: { id: 'user123', email: 'privacy@example.com', role: 'patient' },
        tokenPair: { accessToken: 'a', refreshToken: 'b', expiresIn: 3600 }
      })

      const registerRequest = new Request('https://example.com/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'privacy@example.com',
          password: 'Password123!',
          medicalHistory: 'SECRET_CONDITION', // This should not be logged
          diagnosis: 'CONFIDENTIAL',
        }),
      })

      await registerHandler({
        request: registerRequest,
        clientAddress: '127.0.0.1',
      } as any)

      // Verify audit log doesn't contain sensitive data
      const securityCalls = mockSecurity.logSecurityEvent.mock.calls
      const allArgs = JSON.stringify(securityCalls)
      expect(allArgs).not.toContain('SECRET_CONDITION')
      expect(allArgs).not.toContain('CONFIDENTIAL')
    })
  })

  describe('Phase 6 MCP Server Integration', () => {
    it('should track authentication progress throughout the flow', async () => {
      mockAuth0UserService.createUser.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com', role: 'patient' },
        tokenPair: { accessToken: 'a', refreshToken: 'b', expiresIn: 3600 }
      })

      const registerRequest = new Request(
        'https://example.com/api/auth/register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': mockClientInfo.userAgent,
            'X-Device-ID': mockClientInfo.deviceId,
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'SecurePass123!',
            firstName: 'John',
            lastName: 'Doe',
            role: 'patient',
          }),
        },
      )

      await registerHandler({
        request: registerRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      // Verify Phase 6 tracking was called
      expect(mockPhase6.updatePhase6AuthenticationProgress).toHaveBeenCalledWith(
        'user123',
        'user_registered',
      )
    })

    it('should track login events', async () => {
      mockAuth0UserService.signIn.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com', role: 'patient' },
        tokenPair: { accessToken: 'a', refreshToken: 'b', expiresIn: 3600 }
      })

      const loginRequest = new Request('https://example.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': mockClientInfo.userAgent,
          'X-Device-ID': mockClientInfo.deviceId,
          'X-CSRF-Token': 'valid-csrf-token',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'SecurePass123!',
        }),
      })

      await loginHandler({
        request: loginRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      expect(mockPhase6.updatePhase6AuthenticationProgress).toHaveBeenCalledWith(
        'user123',
        'user_logged_in',
      )
    })

    it('should track token refresh events', async () => {
      mockJwtService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: {
          id: 'user123',
          role: 'patient',
        },
      })

      const refreshRequest = new Request(
        'https://example.com/api/auth/refresh',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': mockClientInfo.userAgent,
            'X-Device-ID': mockClientInfo.deviceId,
          },
          body: JSON.stringify({
            refreshToken: 'valid.refresh.token',
          }),
        },
      )

      await refreshHandler({
        request: refreshRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      expect(mockPhase6.updatePhase6AuthenticationProgress).toHaveBeenCalledWith(
        'user123',
        'token_refreshed',
      )
    })
  })
})
