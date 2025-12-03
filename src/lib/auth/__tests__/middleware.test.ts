/**
 * Authentication Middleware Tests
 * Comprehensive test suite for authentication middleware stack
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  authenticateRequest,
  requireRole,
  rateLimitMiddleware,
  csrfProtection,
  securityHeaders,
  type AuthenticatedRequest,
  type UserRole,
} from '../middleware'
import { validateToken } from '../jwt-service'
import { getUserById } from '../better-auth-integration'
import { logSecurityEvent } from '../../security'
import { updatePhase6AuthenticationProgress } from '../../mcp/phase6-integration'

// Mock dependencies
vi.mock('../jwt-service', () => ({
  validateToken: vi.fn(),
}))

vi.mock('../better-auth-integration', () => ({
  getUserById: vi.fn(),
  validateUserRole: vi.fn(),
}))

vi.mock('../../security', () => ({
  logSecurityEvent: vi.fn(),
  SecurityEventType: {
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

describe('Authentication Middleware', () => {
  let mockRequest: Request
  let _mockResponse: Response

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock request
    mockRequest = new Request('https://example.com/api/test', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer valid-token',
        'X-CSRF-Token': 'valid-csrf-token',
        'User-Agent': 'Mozilla/5.0',
        'X-Forwarded-For': '127.0.0.1',
      },
    })

    // Create mock response
    _mockResponse = new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('authenticateRequest', () => {
    it('should authenticate valid token and attach user to request', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'admin' as UserRole,
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
      }

      vi.mocked(validateToken).mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'admin',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      vi.mocked(getUserById).mockResolvedValue(mockUser)

      const result = await authenticateRequest(mockRequest)

      expect(result.success).toBe(true)
      expect(result.request).toBeDefined()
      expect((result.request as AuthenticatedRequest).user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      })
      expect((result.request as AuthenticatedRequest).tokenId).toBe('token123')
    })

    it('should reject request without authorization header', async () => {
      const requestWithoutAuth = new Request('https://example.com/api/test')

      const result = await authenticateRequest(requestWithoutAuth)

      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(401)
      expect(result.error).toContain('No authorization header')
    })

    it('should reject request with invalid token format', async () => {
      const requestWithInvalidToken = new Request(
        'https://example.com/api/test',
        {
          headers: {
            Authorization: 'InvalidFormat token',
          },
        },
      )

      const result = await authenticateRequest(requestWithInvalidToken)

      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(401)
      expect(result.error).toContain('Invalid authorization header format')
    })

    it('should reject expired tokens', async () => {
      vi.mocked(validateToken).mockResolvedValue({
        valid: false,
        error: 'Token has expired',
      })

      const result = await authenticateRequest(mockRequest)

      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(401)
      expect(result.error).toContain('Token has expired')
    })

    it('should reject revoked tokens', async () => {
      vi.mocked(validateToken).mockResolvedValue({
        valid: false,
        error: 'Token has been revoked',
      })

      const result = await authenticateRequest(mockRequest)

      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(401)
      expect(result.error).toContain('Token has been revoked')
    })

    it('should reject tokens for inactive users', async () => {
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
        isActive: false, // Inactive user
      })

      const result = await authenticateRequest(mockRequest)

      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(401)
      expect(result.error).toContain('User account is inactive')
    })

    it('should handle user not found', async () => {
      vi.mocked(validateToken).mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'admin',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      vi.mocked(getUserById).mockResolvedValue(null)

      const result = await authenticateRequest(mockRequest)

      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(401)
      expect(result.error).toContain('User not found')
    })

    it('should log authentication success', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
      }

      vi.mocked(validateToken).mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'admin',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      vi.mocked(getUserById).mockResolvedValue(mockUser)

      await authenticateRequest(mockRequest)

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'AUTHENTICATION_SUCCESS',
        'user123',
        expect.objectContaining({
          tokenId: 'token123',
          endpoint: '/api/test',
        }),
      )
    })

    it('should log authentication failures', async () => {
      vi.mocked(validateToken).mockResolvedValue({
        valid: false,
        error: 'Invalid token signature',
      })

      await authenticateRequest(mockRequest)

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'AUTHENTICATION_FAILED',
        null,
        expect.objectContaining({
          error: 'Invalid token signature',
          endpoint: '/api/test',
        }),
      )
    })

    it('should update Phase 6 MCP server on success', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
      }

      vi.mocked(validateToken).mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'admin',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      vi.mocked(getUserById).mockResolvedValue(mockUser)

      await authenticateRequest(mockRequest)

      expect(updatePhase6AuthenticationProgress).toHaveBeenCalledWith(
        'user123',
        'authentication_success',
      )
    })
  })

  describe('requireRole', () => {
    it('should allow access for users with required role', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'admin' as UserRole,
      }

      const authenticatedRequest = {
        ...mockRequest,
        user: mockUser,
        tokenId: 'token123',
      } as AuthenticatedRequest

      const result = await requireRole(authenticatedRequest, [
        'admin',
        'therapist',
      ])

      expect(result.success).toBe(true)
      expect(result.request).toBe(authenticatedRequest)
    })

    it('should reject users without required role', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'patient' as UserRole,
      }

      const authenticatedRequest = {
        ...mockRequest,
        user: mockUser,
        tokenId: 'token123',
      } as AuthenticatedRequest

      const result = await requireRole(authenticatedRequest, [
        'admin',
        'therapist',
      ])

      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(403)
      expect(result.error).toContain('Insufficient permissions')
    })

    it('should handle hierarchical roles correctly', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'admin' as UserRole,
      }

      const authenticatedRequest = {
        ...mockRequest,
        user: mockUser,
        tokenId: 'token123',
      } as AuthenticatedRequest

      // Admin should have access to patient-level resources
      const result = await requireRole(authenticatedRequest, ['patient'])

      expect(result.success).toBe(true)
    })

    it('should log authorization failures', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'patient' as UserRole,
      }

      const authenticatedRequest = {
        ...mockRequest,
        user: mockUser,
        tokenId: 'token123',
      } as AuthenticatedRequest

      await requireRole(authenticatedRequest, ['admin'])

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'AUTHORIZATION_FAILED',
        'user123',
        expect.objectContaining({
          requiredRoles: ['admin'],
          userRole: 'patient',
        }),
      )
    })

    it('should reject request without user', async () => {
      const result = await requireRole(mockRequest as AuthenticatedRequest, [
        'admin',
      ])

      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(401)
      expect(result.error).toContain('User not authenticated')
    })
  })

  describe('rateLimitMiddleware', () => {
    it('should allow requests within rate limit', async () => {
      const { getFromCache, setInCache } = await import('../../redis')

      // Mock no previous requests
      vi.mocked(getFromCache).mockResolvedValue(null)
      vi.mocked(setInCache).mockImplementation(async (_key, _data, _ttl) => {
        return true
      })

      const result = await rateLimitMiddleware(mockRequest, 'login', 5, 60)

      expect(result.success).toBe(true)
      expect(result.request).toBe(mockRequest)
    })

    it('should block requests exceeding rate limit', async () => {
      const { getFromCache } = await import('../../redis')

      // Mock 5 previous requests (at limit)
      vi.mocked(getFromCache).mockResolvedValue({
        count: 5,
        resetTime: Date.now() + 60000,
      })

      const result = await rateLimitMiddleware(mockRequest, 'login', 5, 60)

      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(429)
      expect(result.error).toContain('Rate limit exceeded')
    })

    it('should reset counter after time window', async () => {
      const { getFromCache, setInCache } = await import('../../redis')

      // Mock expired rate limit data
      vi.mocked(getFromCache).mockResolvedValue({
        count: 5,
        resetTime: Date.now() - 1000, // Expired
      })

      vi.mocked(setInCache).mockImplementation(async (_key, _data, _ttl) => {
        return true
      })

      const result = await rateLimitMiddleware(mockRequest, 'login', 5, 60)

      expect(result.success).toBe(true)
      expect(setInCache).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit:'),
        expect.objectContaining({
          count: 1,
        }),
        3600,
      )
    })

    it('should use different rate limits for different endpoints', async () => {
      const { getFromCache, setInCache } = await import('../../redis')

      vi.mocked(getFromCache).mockResolvedValue(null)
      vi.mocked(setInCache).mockImplementation(async (_key, _data, _ttl) => {
        return true
      })

      // Login endpoint - 5 requests per hour
      await rateLimitMiddleware(mockRequest, 'login', 5, 60)

      // API endpoint - 100 requests per hour
      await rateLimitMiddleware(mockRequest, 'api', 100, 60)

      expect(setInCache).toHaveBeenCalledTimes(2)
      expect(setInCache).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit:login:'),
        expect.any(Object),
        3600,
      )
      expect(setInCache).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit:api:'),
        expect.any(Object),
        3600,
      )
    })

    it('should log rate limit violations', async () => {
      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockResolvedValue({
        count: 10,
        resetTime: Date.now() + 60000,
      })

      await rateLimitMiddleware(mockRequest, 'login', 5, 60)

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'RATE_LIMIT_EXCEEDED',
        null,
        expect.objectContaining({
          endpoint: 'login',
          currentCount: 10,
          limit: 5,
        }),
      )
    })

    it('should identify clients by IP address', async () => {
      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockImplementation(async (key) => {
        // Verify IP is used in rate limit key
        expect(key).toContain('127.0.0.1')
        return null
      })

      await rateLimitMiddleware(mockRequest, 'login', 5, 60)
    })

    it('should handle requests without IP headers', async () => {
      const requestWithoutIP = new Request('https://example.com/api/test', {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      })

      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockImplementation(async (key) => {
        // Should use some identifier even without IP
        expect(key).toBeDefined()
        return null
      })

      await rateLimitMiddleware(requestWithoutIP, 'login', 5, 60)
    })
  })

  describe('csrfProtection', () => {
    it('should allow GET requests without CSRF token', async () => {
      const getRequest = new Request('https://example.com/api/test', {
        method: 'GET',
      })

      const result = await csrfProtection(getRequest)

      expect(result.success).toBe(true)
      expect(result.request).toBe(getRequest)
    })

    it('should allow POST requests with valid CSRF token', async () => {
      const postRequest = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'valid-csrf-token',
        },
      })

      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockImplementation(async (key) => {
        if (key.startsWith('csrf:')) {
          return { token: 'valid-csrf-token', expiresAt: Date.now() + 3600000 }
        }
        return null
      })

      const result = await csrfProtection(postRequest)

      expect(result.success).toBe(true)
      expect(result.request).toBe(postRequest)
    })

    it('should reject POST requests without CSRF token', async () => {
      const postRequest = new Request('https://example.com/api/test', {
        method: 'POST',
      })

      const result = await csrfProtection(postRequest)

      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(403)
      expect(result.error).toContain('CSRF token required')
    })

    it('should reject POST requests with invalid CSRF token', async () => {
      const postRequest = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'invalid-token',
        },
      })

      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockImplementation(async (key) => {
        if (key.startsWith('csrf:')) {
          return { token: 'different-token', expiresAt: Date.now() + 3600000 }
        }
        return null
      })

      const result = await csrfProtection(postRequest)

      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(403)
      expect(result.error).toContain('Invalid CSRF token')
    })

    it('should reject expired CSRF tokens', async () => {
      const postRequest = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'expired-token',
        },
      })

      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockImplementation(async (key) => {
        if (key.startsWith('csrf:')) {
          return { token: 'expired-token', expiresAt: Date.now() - 1000 } // Expired
        }
        return null
      })

      const result = await csrfProtection(postRequest)

      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(403)
      expect(result.error).toContain('CSRF token has expired')
    })

    it('should log CSRF violations', async () => {
      const postRequest = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'invalid-token',
        },
      })

      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockImplementation(async (key) => {
        if (key.startsWith('csrf:')) {
          return { token: 'different-token', expiresAt: Date.now() + 3600000 }
        }
        return null
      })

      await csrfProtection(postRequest)

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'CSRF_VIOLATION',
        null,
        expect.objectContaining({
          reason: 'invalid_token',
          endpoint: '/api/test',
        }),
      )
    })

    it('should handle other HTTP methods that require CSRF protection', async () => {
      const methods = ['PUT', 'PATCH', 'DELETE']

      for (const method of methods) {
        vi.clearAllMocks()

        const request = new Request('https://example.com/api/test', {
          method,
          headers: {
            'X-CSRF-Token': 'valid-token',
          },
        })

        const { getFromCache } = await import('../../redis')

        vi.mocked(getFromCache).mockImplementation(async (key) => {
          if (key.startsWith('csrf:')) {
            return { token: 'valid-token', expiresAt: Date.now() + 3600000 }
          }
          return null
        })

        const result = await csrfProtection(request)

        expect(result.success).toBe(true)
      }
    })
  })

  describe('securityHeaders', () => {
    it('should add security headers to response', async () => {
      const response = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await securityHeaders(mockRequest, response)

      expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(result.headers.get('X-Frame-Options')).toBe('DENY')
      expect(result.headers.get('X-XSS-Protection')).toBe('1; mode=block')
      expect(result.headers.get('Strict-Transport-Security')).toBe(
        'max-age=31536000; includeSubDomains',
      )
      expect(result.headers.get('Referrer-Policy')).toBe(
        'strict-origin-when-cross-origin',
      )
    })

    it('should add Content-Security-Policy header', async () => {
      const response = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await securityHeaders(mockRequest, response)

      const csp = result.headers.get('Content-Security-Policy')
      expect(csp).toBeDefined()
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("script-src 'self' 'unsafe-inline'")
      expect(csp).toContain("style-src 'self' 'unsafe-inline'")
    })

    it('should add HIPAA-compliant headers for healthcare data', async () => {
      const response = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await securityHeaders(mockRequest, response)

      expect(result.headers.get('Cache-Control')).toBe(
        'no-store, no-cache, must-revalidate, private',
      )
      expect(result.headers.get('Pragma')).toBe('no-cache')
      expect(result.headers.get('Expires')).toBe('0')
    })

    it('should remove sensitive headers', async () => {
      const response = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
      response.headers.set('X-Powered-By', 'Express')
      response.headers.set('Server', 'Apache')

      const result = await securityHeaders(mockRequest, response)

      expect(result.headers.get('X-Powered-By')).toBeNull()
      expect(result.headers.get('Server')).toBeNull()
    })

    it('should handle requests without existing response headers', async () => {
      const response = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await securityHeaders(mockRequest, response)

      expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(result.status).toBe(200)
    })

    it('should add CORS headers for API requests', async () => {
      const apiRequest = new Request('https://example.com/api/test', {
        headers: {
          Origin: 'https://app.example.com',
        },
      })

      const response = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await securityHeaders(apiRequest, response)

      expect(result.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://app.example.com',
      )
      expect(result.headers.get('Access-Control-Allow-Credentials')).toBe(
        'true',
      )
      expect(result.headers.get('Access-Control-Allow-Methods')).toContain(
        'GET',
      )
      expect(result.headers.get('Access-Control-Allow-Methods')).toContain(
        'POST',
      )
    })

    it('should handle preflight OPTIONS requests', async () => {
      const optionsRequest = new Request('https://example.com/api/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://app.example.com',
          'Access-Control-Request-Method': 'POST',
        },
      })

      const response = new Response(null, { status: 204 })

      const result = await securityHeaders(optionsRequest, response)

      expect(result.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://app.example.com',
      )
      expect(result.headers.get('Access-Control-Allow-Methods')).toContain(
        'POST',
      )
      expect(result.headers.get('Access-Control-Max-Age')).toBe('86400')
    })
  })

  describe('Performance Requirements', () => {
    it('should meet sub-10ms authentication target', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
      }

      vi.mocked(validateToken).mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'admin',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      vi.mocked(getUserById).mockResolvedValue(mockUser)

      const start = performance.now()

      await authenticateRequest(mockRequest)

      const duration = performance.now() - start
      expect(duration).toBeLessThan(10)
    })

    it('should meet sub-5ms rate limiting target', async () => {
      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockResolvedValue(null)

      const start = performance.now()

      await rateLimitMiddleware(mockRequest, 'api', 100, 60)

      const duration = performance.now() - start
      expect(duration).toBeLessThan(5)
    })
  })

  describe('Security Requirements', () => {
    it('should prevent timing attacks in authentication', async () => {
      // Test with valid token but no user
      vi.mocked(validateToken).mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'admin',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      vi.mocked(getUserById).mockResolvedValue(null)

      const start1 = performance.now()
      await authenticateRequest(mockRequest)
      const duration1 = performance.now() - start1

      // Test with invalid token
      vi.mocked(validateToken).mockResolvedValue({
        valid: false,
        error: 'Invalid token',
      })

      const start2 = performance.now()
      await authenticateRequest(mockRequest)
      const duration2 = performance.now() - start2

      // Both should take similar time
      expect(Math.abs(duration1 - duration2)).toBeLessThan(5)
    })

    it('should sanitize client information in logs', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
      }

      vi.mocked(validateToken).mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'admin',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      vi.mocked(getUserById).mockResolvedValue(mockUser)

      await authenticateRequest(mockRequest)

      const loggedData = vi.mocked(logSecurityEvent).mock.calls[0][2]

      // Should not log full user agent or IP
      expect(JSON.stringify(loggedData)).not.toContain('Mozilla/5.0')
      expect(JSON.stringify(loggedData)).not.toContain('127.0.0.1')
    })

    it('should enforce strict CSP policies', async () => {
      const response = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await securityHeaders(mockRequest, response)

      const csp = result.headers.get('Content-Security-Policy')

      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("base-uri 'self'")
      expect(csp).toContain("form-action 'self'")
    })

    it('should prevent clickjacking attacks', async () => {
      const response = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await securityHeaders(mockRequest, response)

      expect(result.headers.get('X-Frame-Options')).toBe('DENY')
      expect(result.headers.get('Content-Security-Policy')).toContain(
        "frame-ancestors 'none'",
      )
    })

    it('should prevent MIME type sniffing', async () => {
      const response = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await securityHeaders(mockRequest, response)

      expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff')
    })

    it('should enforce HTTPS', async () => {
      const response = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await securityHeaders(mockRequest, response)

      const hsts = result.headers.get('Strict-Transport-Security')
      expect(hsts).toContain('max-age=31536000')
      expect(hsts).toContain('includeSubDomains')
    })
  })

  describe('HIPAA Compliance', () => {
    it('should not log sensitive health information', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'patient',
        medicalRecordNumber: 'MRN123456',
        isActive: true,
      }

      vi.mocked(validateToken).mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'patient',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      vi.mocked(getUserById).mockResolvedValue(mockUser)

      await authenticateRequest(mockRequest)

      const loggedData = vi.mocked(logSecurityEvent).mock.calls[0][2]

      // Should not log medical record numbers or health data
      expect(JSON.stringify(loggedData)).not.toContain('MRN123456')
      expect(JSON.stringify(loggedData)).not.toContain('medical')
    })

    it('should enforce strict cache control for health data', async () => {
      const response = new Response({
        patient: { name: 'John Doe', condition: 'Anxiety' },
      })

      const result = await securityHeaders(mockRequest, response)

      expect(result.headers.get('Cache-Control')).toBe(
        'no-store, no-cache, must-revalidate, private',
      )
      expect(result.headers.get('Pragma')).toBe('no-cache')
    })

    it('should mask IP addresses in audit logs', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'patient',
        isActive: true,
      }

      vi.mocked(validateToken).mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'patient',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      vi.mocked(getUserById).mockResolvedValue(mockUser)

      await authenticateRequest(mockRequest)

      const loggedData = vi.mocked(logSecurityEvent).mock.calls[0][2]

      // IP should be masked or not included
      if (loggedData.clientInfo) {
        expect(loggedData.clientInfo.ip).toBeUndefined()
      }
    })

    it('should handle data retention for authentication logs', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'patient',
        isActive: true,
      }

      vi.mocked(validateToken).mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'patient',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      vi.mocked(getUserById).mockResolvedValue(mockUser)

      await authenticateRequest(mockRequest)

      // Verify audit logs are created with proper retention
      expect(logSecurityEvent).toHaveBeenCalledWith(
        'AUTHENTICATION_SUCCESS',
        'user123',
        expect.objectContaining({
          timestamp: expect.any(Number),
          retention: expect.any(Number),
        }),
      )
    })
  })

  describe('Integration with Phase 6 MCP Server', () => {
    it('should track authentication progress', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
      }

      vi.mocked(validateToken).mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'admin',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      vi.mocked(getUserById).mockResolvedValue(mockUser)

      await authenticateRequest(mockRequest)

      expect(updatePhase6AuthenticationProgress).toHaveBeenCalledWith(
        'user123',
        'authentication_success',
      )
    })

    it('should track authorization failures', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'patient',
      }

      const authenticatedRequest = {
        ...mockRequest,
        user: mockUser,
        tokenId: 'token123',
      } as AuthenticatedRequest

      await requireRole(authenticatedRequest, ['admin'])

      expect(updatePhase6AuthenticationProgress).toHaveBeenCalledWith(
        'user123',
        'authorization_failed',
      )
    })

    it('should track rate limiting events', async () => {
      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockResolvedValue({
        count: 10,
        resetTime: Date.now() + 60000,
      })

      await rateLimitMiddleware(mockRequest, 'login', 5, 60)

      expect(updatePhase6AuthenticationProgress).toHaveBeenCalledWith(
        null,
        'rate_limit_exceeded',
      )
    })

    it('should track CSRF violations', async () => {
      const postRequest = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'invalid-token',
        },
      })

      const { getFromCache } = await import('../../redis')

      vi.mocked(getFromCache).mockImplementation(async (key) => {
        if (key.startsWith('csrf:')) {
          return { token: 'different-token', expiresAt: Date.now() + 3600000 }
        }
        return null
      })

      await csrfProtection(postRequest)

      expect(updatePhase6AuthenticationProgress).toHaveBeenCalledWith(
        null,
        'csrf_violation',
      )
    })
  })
})
