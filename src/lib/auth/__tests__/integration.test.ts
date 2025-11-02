/**
 * Integration Tests for Authentication System
 * End-to-end testing of the complete authentication flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { POST as registerHandler } from '../../../pages/api/auth/register'
import { POST as loginHandler } from '../../../pages/api/auth/login'
import { POST as logoutHandler } from '../../../pages/api/auth/logout'
import { POST as refreshHandler } from '../../../pages/api/auth/refresh'
import { authenticateRequest, requireRole } from '../middleware'

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
    USER_REGISTERED: 'USER_REGISTERED',
    USER_LOGIN_SUCCESS: 'USER_LOGIN_SUCCESS',
    USER_LOGOUT: 'USER_LOGOUT',
    TOKEN_REFRESHED: 'TOKEN_REFRESHED',
    AUTHENTICATION_SUCCESS: 'AUTHENTICATION_SUCCESS',
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
    AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    CSRF_VIOLATION: 'CSRF_VIOLATION',
  },
}))

vi.mock('../../mcp/phase6-integration', () => ({
  updatePhase6AuthenticationProgress: vi.fn(),
}))

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
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Complete Authentication Flow', () => {
    it('should handle full registration and login flow', async () => {
      const { setInCache, getFromCache } = await import('../../redis')

      // Mock Redis operations for registration
      vi.mocked(setInCache).mockImplementation(async (_key, _data) => {
        return true
      })

      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key.startsWith('user:email:')) {
          return null // No existing user
        }
        return null
      })

      // Step 1: Register new user
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
      expect(registerData.user).toBeDefined()
      expect(registerData.tokenPair).toBeDefined()

      const { user } = registerData

      // Step 2: Login with registered user
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

      // Mock user lookup for login
      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key === 'user:email:test@example.com') {
          return { id: user.id, email: user.email }
        }
        if (_key === `user:${user.id}`) {
          return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: true,
            password: 'hashedPassword123',
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        }
        return null
      })

      const loginResponse = await loginHandler({
        request: loginRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      expect(loginResponse.status).toBe(200)
      const loginData = await loginResponse.json()
      expect(loginData.success).toBe(true)
      expect(loginData.user).toBeDefined()
      expect(loginData.tokenPair).toBeDefined()

      // Step 3: Refresh token
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
            refreshToken: loginData.tokenPair.refreshToken,
          }),
        },
      )

      const refreshResponse = await refreshHandler({
        request: refreshRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      expect(refreshResponse.status).toBe(200)
      const refreshData = await refreshResponse.json()
      expect(refreshData.success).toBe(true)
      expect(refreshData.tokenPair).toBeDefined()
      expect(refreshData.tokenPair.accessToken).not.toBe(
        loginData.tokenPair.accessToken,
      )

      // Step 4: Logout
      const logoutRequest = new Request('https://example.com/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshData.tokenPair.accessToken}`,
          'User-Agent': mockClientInfo.userAgent,
          'X-Device-ID': mockClientInfo.deviceId,
          'X-Session-ID': 'test-session-123',
        },
      })

      const logoutResponse = await logoutHandler({
        request: logoutRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      expect(logoutResponse.status).toBe(200)
      const logoutData = await logoutResponse.json()
      expect(logoutData.success).toBe(true)
    })

    it('should enforce rate limiting across the flow', async () => {
      const { getFromCache, setInCache: _setInCache } = await import(
        '../../redis'
      )

      // Mock rate limit exceeded
      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key.startsWith('rate_limit:')) {
          return {
            count: 15, // Exceeds limit of 10
            resetTime: Date.now() + 60000,
          }
        }
        return null
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

      const response = await loginHandler({
        request: loginRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      expect(response.status).toBe(429)
      const data = await response.json()
      expect(data.error).toContain('Rate limit exceeded')
    })

    it('should enforce CSRF protection', async () => {
      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key.startsWith('csrf:')) {
          return { token: 'valid-csrf-token', expiresAt: Date.now() + 3600000 }
        }
        return null
      })

      // Test with invalid CSRF token
      const loginRequest = new Request('https://example.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': mockClientInfo.userAgent,
          'X-Device-ID': mockClientInfo.deviceId,
          'X-CSRF-Token': 'invalid-csrf-token',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'SecurePass123!',
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

    it('should handle authentication middleware correctly', async () => {
      const { validateToken, getUserById } = await import('../jwt-service')
      const { getFromCache: _getFromCache } = await import('../../redis')

      // Mock valid token validation
      vi.mocked(validateToken).mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'admin',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      vi.mocked(getUserById).mockResolvedValue({
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
      expect(result.request).toBeDefined()
      expect((result.request as any).user).toBeDefined()
      expect((result.request as any).user.id).toBe('user123')
    })

    it('should enforce role-based authorization', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'patient',
      }

      const authenticatedRequest = {
        ...new Request('https://example.com/api/admin'),
        user: mockUser,
        tokenId: 'token123',
      } as any

      const result = await requireRole(authenticatedRequest, [
        'admin',
        'therapist',
      ])

      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(403)
      expect(result.error).toContain('Insufficient permissions')
    })
  })

  describe('Security Requirements', () => {
    it('should sanitize user input in registration', async () => {
      const { setInCache, getFromCache } = await import('../../redis')

      vi.mocked(setInCache).mockImplementation(async (_key, _data) => {
        if (_key.startsWith('user:')) {
          // Verify malicious content is sanitized
          const userData = _data as any
          expect(userData.firstName).not.toContain('<script>')
          expect(userData.firstName).toContain('<script>')
        }
        return true
      })

      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key.startsWith('user:email:')) {
          return null // No existing user
        }
        return null
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
            firstName: '<script>alert("XSS")</script>',
            lastName: 'Doe',
            role: 'patient',
          }),
        },
      )

      const response = await registerHandler({
        request: registerRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      expect(response.status).toBe(201)
    })

    it('should enforce password complexity requirements', async () => {
      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key.startsWith('user:email:')) {
          return null // No existing user
        }
        return null
      })

      const weakPasswords = [
        '123456',
        'password',
        'PASSWORD',
        'Password',
        'Pass123',
      ]

      for (const weakPassword of weakPasswords) {
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
              password: weakPassword,
              firstName: 'John',
              lastName: 'Doe',
              role: 'patient',
            }),
          },
        )

        const response = await registerHandler({
          request: registerRequest,
          clientAddress: mockClientInfo.ip,
        } as any)

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toContain(
          'Password does not meet complexity requirements',
        )
      }
    })

    it('should prevent timing attacks in login', async () => {
      const { getFromCache } = await import('../../redis')

      // Test with non-existent user
      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key.startsWith('user:email:')) {
          return null // User not found
        }
        return null
      })

      const start1 = performance.now()
      const request1 = new Request('https://example.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': mockClientInfo.userAgent,
          'X-Device-ID': mockClientInfo.deviceId,
          'X-CSRF-Token': 'valid-csrf-token',
        },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      })

      await loginHandler({
        request: request1,
        clientAddress: mockClientInfo.ip,
      } as any)
      const duration1 = performance.now() - start1

      // Test with existing user but wrong password
      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key === 'user:email:test@example.com') {
          return { id: 'user123', email: 'test@example.com' }
        }
        if (_key === 'user:user123') {
          return {
            id: 'user123',
            email: 'test@example.com',
            password: 'hashedPassword123',
            isActive: true,
          }
        }
        return null
      })

      const bcrypt = await import('bcryptjs')
      vi.mocked(bcrypt.compare).mockResolvedValue(false)

      const start2 = performance.now()
      const request2 = new Request('https://example.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': mockClientInfo.userAgent,
          'X-Device-ID': mockClientInfo.deviceId,
          'X-CSRF-Token': 'valid-csrf-token',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      })

      await loginHandler({
        request: request2,
        clientAddress: mockClientInfo.ip,
      } as any)
      const duration2 = performance.now() - start2

      // Both operations should take similar time
      expect(Math.abs(duration1 - duration2)).toBeLessThan(50)
    })
  })

  describe('Performance Requirements', () => {
    it('should meet sub-100ms registration target', async () => {
      const { setInCache, getFromCache } = await import('../../redis')

      vi.mocked(setInCache).mockImplementation(async (_key, _data) => {
        return true
      })

      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key.startsWith('user:email:')) {
          return null // No existing user
        }
        return null
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

      const start = performance.now()

      await registerHandler({
        request: registerRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      const duration = performance.now() - start
      expect(duration).toBeLessThan(100)
    })

    it('should meet sub-50ms login target', async () => {
      const { getFromCache } = await import('../../redis')
      const bcrypt = await import('bcryptjs')

      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key === 'user:email:test@example.com') {
          return { id: 'user123', email: 'test@example.com' }
        }
        if (_key === 'user:user123') {
          return {
            id: 'user123',
            email: 'test@example.com',
            password: 'hashedPassword123',
            isActive: true,
          }
        }
        return null
      })

      vi.mocked(bcrypt.compare).mockResolvedValue(true as any)

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

      const start = performance.now()

      await loginHandler({
        request: loginRequest,
        clientAddress: mockClientInfo.ip,
      } as any)

      const duration = performance.now() - start
      expect(duration).toBeLessThan(50)
    })
  })

  describe('HIPAA Compliance', () => {
    it('should not log sensitive health information', async () => {
      const { logSecurityEvent } = await import('../../security')
      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key === 'user:email:test@example.com') {
          return {
            id: 'user123',
            email: 'test@example.com',
            medicalRecordNumber: 'MRN123456',
            diagnosis: 'Anxiety Disorder',
          }
        }
        if (_key === 'user:user123') {
          return {
            id: 'user123',
            email: 'test@example.com',
            password: 'hashedPassword123',
            isActive: true,
            medicalRecordNumber: 'MRN123456',
            diagnosis: 'Anxiety Disorder',
          }
        }
        return null
      })

      const bcrypt = await import('bcryptjs')
      vi.mocked(bcrypt.compare).mockResolvedValue(true as any)

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

      const loggedData = vi.mocked(logSecurityEvent).mock.calls[0][2]

      // Should not log medical information
      expect(JSON.stringify(loggedData)).not.toContain('MRN123456')
      expect(JSON.stringify(loggedData)).not.toContain('Anxiety Disorder')
    })

    it('should mask IP addresses in audit logs', async () => {
      const { logSecurityEvent } = await import('../../security')
      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key === 'user:email:test@example.com') {
          return { id: 'user123', email: 'test@example.com' }
        }
        if (_key === 'user:user123') {
          return {
            id: 'user123',
            email: 'test@example.com',
            password: 'hashedPassword123',
            isActive: true,
          }
        }
        return null
      })

      const bcrypt = await import('bcryptjs')
      vi.mocked(bcrypt.compare).mockResolvedValue(true as any)

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

      const loggedData = vi.mocked(logSecurityEvent).mock.calls[0][2]

      // IP should be masked or not included
      if (loggedData.clientInfo) {
        expect(loggedData.clientInfo.ip).toBeUndefined()
      }
    })

    it('should enforce data retention policies', async () => {
      const { setInCache } = await import('../../redis')

      vi.mocked(setInCache).mockImplementation(async (_key, _data, ttl) => {
        if (_key.startsWith('user:')) {
          // Verify TTL is set for user data
          expect(ttl).toBeDefined()
          expect(ttl).toBeGreaterThan(0)
          expect(ttl).toBeLessThanOrEqual(31536000) // Max 1 year retention
        }
        return true
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
    })
  })

  describe('Phase 6 MCP Server Integration', () => {
    it('should track authentication progress throughout the flow', async () => {
      const { updatePhase6AuthenticationProgress } = await import(
        '../../mcp/phase6-integration'
      )
      const { setInCache, getFromCache } = await import('../../redis')

      vi.mocked(setInCache).mockImplementation(async (_key, _data) => {
        return true
      })

      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key.startsWith('user:email:')) {
          return null // No existing user
        }
        return null
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
      expect(updatePhase6AuthenticationProgress).toHaveBeenCalledWith(
        expect.any(String),
        'user_registered',
      )
    })

    it('should track login events', async () => {
      const { updatePhase6AuthenticationProgress } = await import(
        '../../mcp/phase6-integration'
      )
      const { getFromCache } = await import('../../redis')
      const bcrypt = await import('bcryptjs')

      vi.mocked(getFromCache).mockImplementation(async (_key) => {
        if (_key === 'user:email:test@example.com') {
          return { id: 'user123', email: 'test@example.com' }
        }
        if (_key === 'user:user123') {
          return {
            id: 'user123',
            email: 'test@example.com',
            password: 'hashedPassword123',
            isActive: true,
          }
        }
        return null
      })

      vi.mocked(bcrypt.compare).mockResolvedValue(true as any)

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

      expect(updatePhase6AuthenticationProgress).toHaveBeenCalledWith(
        'user123',
        'user_logged_in',
      )
    })

    it('should track token refresh events', async () => {
      const { updatePhase6AuthenticationProgress } = await import(
        '../../mcp/phase6-integration'
      )

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

      expect(updatePhase6AuthenticationProgress).toHaveBeenCalledWith(
        null,
        'token_refreshed',
      )
    })
  })
})
