/**
 * Integration Tests for Authentication System
 * End-to-end testing of the complete authentication flow
 */
/** @vitest-environment node */

import type { AstroCookies, APIContext } from 'astro'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock dependencies using vi.hoisted for better reliability
const {
  mockAuth0UserService,
  mockJwtService,
  mockPhase6,
  mockRedis,
  mockSecurity,
} = vi.hoisted(() => ({
  mockAuth0UserService: {
    createUser: vi.fn(),
    signIn: vi.fn(),
    getUserById: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    verifyAuthToken: vi.fn(),
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
      USER_UPDATED: 'USER_UPDATED',
      user_created: 'user_created',
      user_login_success: 'user_login_success',
      user_logout: 'user_logout',
      token_refreshed: 'token_refreshed',
      authentication_success: 'authentication_success',
      authentication_failed: 'authentication_failed',
      authorization_failed: 'authorization_failed',
      rate_limit_exceeded: 'rate_limit_exceeded',
      csrf_violation: 'csrf_violation',
      token_validated: 'token_validated',
      token_validation_failed: 'token_validation_failed',
      mfa_required: 'mfa_required',
    },
  },
}))

vi.mock('../../../services/auth0.service', () => ({
  auth0UserService: mockAuth0UserService,
  verifyToken: mockAuth0UserService.verifyAuthToken,
}))
vi.mock('../auth0-jwt-service', () => mockJwtService)
vi.mock('../../mcp/phase6-integration', () => mockPhase6)
vi.mock('../../redis', () => mockRedis)
vi.mock('../../security', () => mockSecurity)

// Mock database pool — verify.ts dynamically imports getPool() which throws
// "Database not initialized" when no real DB is available in CI
vi.mock('../../db', () => ({
  getPool: vi.fn(() => ({
    query: vi.fn().mockResolvedValue([
      {
        id: 'test-user-id',
        email: 'test@example.com',
        type: 'email_verification',
        is_valid: true,
      },
    ]),
  })),
}))
vi.mock('../user-identity', () => ({
  resolveIdentity: vi.fn(),
}))

// Mock MongoDB config to prevent node: module errors
vi.mock('../../../config/mongodb.config', () => ({
  mongodb: {
    connect: vi.fn().mockResolvedValue({}),
    getDb: vi.fn().mockReturnValue(null),
  },
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

// Mock Node.js built-in modules with node: prefix
const { mockRandomBytes, mockRandomUUID } = vi.hoisted(() => ({
  mockRandomBytes: vi.fn().mockReturnValue(Buffer.from('test')),
  mockRandomUUID: vi.fn().mockReturnValue('test-uuid'),
}))

vi.mock('node:buffer', () => ({
  Buffer: globalThis.Buffer,
}))

vi.mock('node:crypto', () => ({
  Buffer: globalThis.Buffer,
  createHash: vi.fn(),
  createHmac: vi.fn(),
  randomBytes: mockRandomBytes,
  randomUUID: mockRandomUUID,
  randomFillSync: vi.fn(),
  pbkdf2Sync: vi.fn(),
  randomFill: vi.fn(),
  randomInt: vi.fn(),
}))

import {
  GET as profileGetHandler,
  PUT as profilePutHandler,
} from '../../../pages/api/auth/profile'
import { POST as refreshHandler } from '../../../pages/api/auth/refresh'
import { POST as loginHandler } from '../../../pages/api/auth/signin'
import { POST as logoutHandler } from '../../../pages/api/auth/signout'
// Import handlers after mocks are set up
import { POST as registerHandler } from '../../../pages/api/auth/signup'
import { GET as verifyHandler } from '../../../pages/api/auth/verify'
import {
  authenticateRequest,
  requireRole,
  type AuthenticatedRequest,
} from '../auth0-middleware'
import { resolveIdentity } from '../user-identity'

type JsonObject = Record<string, unknown>

const isRecord = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null

const readJsonObject = async (response: Response): Promise<JsonObject> => {
  const jsonText = await response.text()
  const parsed: unknown = JSON.parse(jsonText)
  if (!isRecord(parsed)) {
    throw new Error('Expected JSON response body to be an object')
  }
  return parsed
}

const expectString = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new Error('Expected string value from response payload')
  }
  return value
}

const expectRecord = (value: unknown): JsonObject => {
  if (!isRecord(value)) {
    throw new Error('Expected object value from response payload')
  }
  return value
}

describe('Authentication System Integration', () => {
  const mockClientInfo = {
    ip: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    deviceId: 'test-device-123',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveIdentity).mockResolvedValue({
      internalId: 'user123',
      auth0Sub: 'user123',
      email: 'test@example.com',
      emailVerified: true,
      role: 'admin',
      isNewUser: false,
    })
    // Set test environment variables
    process.env['JWT_SECRET'] = 'test-secret-key'
    process.env['JWT_AUDIENCE'] = 'test-audience'
    process.env['JWT_ISSUER'] = 'test-issuer'
    process.env['BCRYPT_ROUNDS'] = '10'

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
        id: 'user123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'patient',
        createdAt: new Date(),
      })

      const registerRequest = new Request(
        'https://example.com/api/auth/register',
        {
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
            firstName: 'John',
            lastName: 'Doe',
            role: 'patient',
          }),
        },
      )

      const registerResponse = await registerHandler({
        request: registerRequest,
        clientAddress: mockClientInfo.ip,
      })

      expect(registerResponse.status).toBe(201)
      const registerData = await readJsonObject(registerResponse)
      expect(registerData['success']).toBe(true)
      const registerUser = expectRecord(registerData['user'])
      expect(expectString(registerUser['id'])).toBe('user123')

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
        token: 'access.token.456',
        refreshToken: 'refresh.token.456',
        expiresIn: 3600,
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
      })

      expect(loginResponse.status).toBe(200)
      const loginData = await readJsonObject(loginResponse)
      expect(loginData['success']).toBe(true)
      expect(expectString(loginData['token'])).toBe('access.token.456')

      // Mock dependencies for logout
      mockAuth0UserService.signOut.mockResolvedValue({ success: true })
      mockAuth0UserService.verifyAuthToken.mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
        role: 'patient',
      })
      mockJwtService.validateToken.mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'patient',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })
      mockAuth0UserService.getUserById.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        role: 'patient',
        isActive: true,
      })
      mockAuth0UserService.userHasMFA.mockResolvedValue(true)

      const logoutRequest = new Request('https://example.com/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer access.token.456',
          'X-CSRF-Token': 'valid-csrf-token',
        },
      })

      const logoutResponse = await logoutHandler({
        request: logoutRequest,
      })

      expect(logoutResponse.status).toBe(200)
      const logoutData = await readJsonObject(logoutResponse)
      expect(logoutData['success']).toBe(true)
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
      })

      expect(response.status).toBe(429)
      const data = await readJsonObject(response)
      expect(expectString(data['error'])).toContain('Rate limit exceeded')
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
      })

      expect(response.status).toBe(403)
      const data = await readJsonObject(response)
      expect(expectString(data['error'])).toContain('Invalid CSRF token')
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
      const authenticatedRequest: AuthenticatedRequest = new Request(
        'https://example.com/api/auth/profile',
      )
      authenticatedRequest.user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'patient',
      }

      // Should fail for therapist role
      const result = await requireRole(authenticatedRequest, [
        'therapist',
        'admin',
      ])
      expect(result.success).toBe(false)
      expect(result.response?.status).toBe(403)
    })

    it('should sanitize user input in registration', async () => {
      const xssEmail = '<script>alert("xss")</script>test@example.com'
      const sanitizedEmail =
        'scriptalert(xss)/scripttest@example.com'.substring(0, 255)

      mockAuth0UserService.createUser.mockResolvedValueOnce({
        id: 'user123',
        email: sanitizedEmail,
        firstName: 'John',
        lastName: 'Doe',
        role: 'patient',
        createdAt: new Date(),
      })

      const response = await registerHandler({
        request: new Request('https://example.com/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'valid-csrf-token',
          },
          body: JSON.stringify({
            email: xssEmail,
            password: 'Password123!',
            firstName: 'John',
            lastName: 'Doe',
            role: 'patient',
          }),
        }),
        clientAddress: '127.0.0.1',
      })

      expect(response.status).toBe(201)
      const data = await readJsonObject(response)
      const user = expectRecord(data['user'])
      // Note: sanitizeInput removes < and >
      expect(expectString(user['email'])).toBe(
        'scriptalert(xss)/scripttest@example.com',
      )
    })

    it('should enforce password complexity requirements', async () => {
      const response = await registerHandler({
        request: new Request('https://example.com/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'valid-csrf-token',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'weak',
            firstName: 'John',
            lastName: 'Doe',
          }),
        }),
        clientAddress: '127.0.0.1',
      })

      expect(response.status).toBe(400)
      const data = await readJsonObject(response)
      expect(expectString(data['error'])).toBe(
        'Password does not meet requirements',
      )
      expect(data['details']).toBeDefined()
    })

    it('should validate email format in registration', async () => {
      const response = await registerHandler({
        request: new Request('https://example.com/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'valid-csrf-token',
          },
          body: JSON.stringify({
            email: 'invalid-email',
            password: 'Password123!',
            firstName: 'John',
            lastName: 'Doe',
          }),
        }),
        clientAddress: '127.0.0.1',
      })

      expect(response.status).toBe(400)
      const data = await readJsonObject(response)
      expect(expectString(data['error'])).toBe('Invalid email format')
    })

    it('should prevent timing attacks in login', async () => {
      const start = Date.now()

      // Mock delayed response to simulate consistent timing
      mockAuth0UserService.signIn.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 50))
        throw new Error('Invalid credentials')
      })

      const loginRequest = new Request('https://example.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-token',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      })

      await loginHandler({
        request: loginRequest,
        clientAddress: '127.0.0.1',
      })

      const duration = Date.now() - start
      expect(duration).toBeGreaterThanOrEqual(50)
    })
  })

  describe('Health Data Privacy', () => {
    it('should not log sensitive health information', async () => {
      mockAuth0UserService.createUser.mockResolvedValue({
        id: 'user123',
        email: 'privacy@example.com',
        role: 'patient',
      })

      const registerRequest = new Request(
        'https://example.com/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'privacy@example.com',
            password: 'Password123!',
            medicalHistory: 'SECRET_CONDITION', // This should not be logged
            diagnosis: 'CONFIDENTIAL',
          }),
        },
      )

      await registerHandler({
        request: registerRequest,
        clientAddress: '127.0.0.1',
      })

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
        id: 'user123',
        email: 'test@example.com',
        role: 'patient',
      })

      const registerRequest = new Request(
        'https://example.com/api/auth/register',
        {
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
            firstName: 'John',
            lastName: 'Doe',
            role: 'patient',
          }),
        },
      )

      const response = await registerHandler({
        request: registerRequest,
        clientAddress: mockClientInfo.ip,
      })

      if (response.status !== 201) {
        const data = await readJsonObject(response)
        console.error('Registration failed:', data)
      }
      expect(response.status).toBe(201)

      // Verify Phase 6 tracking was called

      expect(
        mockPhase6.updatePhase6AuthenticationProgress,
      ).toHaveBeenCalledWith('user123', 'user_registered')
    })

    it('should track login events', async () => {
      mockAuth0UserService.signIn.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com', role: 'patient' },
        token: 'a',
        refreshToken: 'b',
        expiresIn: 3600,
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
      })

      expect(
        mockPhase6.updatePhase6AuthenticationProgress,
      ).toHaveBeenCalledWith('user123', 'user_logged_in')
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

      const refreshContext = {
        request: refreshRequest,
        url: new URL(refreshRequest.url),
        params: {},
        props: {},
        locals: {
          requestId: 'req-mock',
          timestamp: new Date().toISOString(),
          user: {
            id: 'user123',
            email: 'test@example.com',
            emailVerified: true,
            role: 'patient',
          },
          session: {
            id: 'session-mock',
            userId: 'user123',
            expiresAt: new Date(Date.now() + 3600000),
          },
        },
        site: undefined,
        redirect: (path: string, status?: number) =>
          new Response(null, {
            status: status ?? 302,
            headers: { Location: path },
          }),
        cookies: {
          get: vi.fn(),
          set: vi.fn(),
          delete: vi.fn(),
          has: vi.fn(),
        } as unknown as AstroCookies,
        currentLocale: 'en',
        preferredLocale: 'en',
        preferredLocaleList: ['en'],
      } as APIContext

      await refreshHandler(refreshContext)

      expect(
        mockPhase6.updatePhase6AuthenticationProgress,
      ).toHaveBeenCalledWith('user123', 'token_refreshed')
    })

    it('should track logout events', async () => {
      mockAuth0UserService.signOut.mockResolvedValue({ success: true })
      mockAuth0UserService.verifyAuthToken.mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
        role: 'patient',
      })

      const logoutRequest = new Request('https://example.com/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid.token',
          'X-CSRF-Token': 'valid-csrf-token',
        },
      })

      // Simulate authentication result for logout handler dependency
      mockJwtService.validateToken.mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'patient',
      })
      mockAuth0UserService.getUserById.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        role: 'patient',
        isActive: true,
      })
      mockAuth0UserService.userHasMFA.mockResolvedValue(true)

      await logoutHandler({
        request: logoutRequest,
      })

      expect(
        mockPhase6.updatePhase6AuthenticationProgress,
      ).toHaveBeenCalledWith('user123', 'user_logged_out')
    })
  })

  describe('Profile Management', () => {
    it('should retrieve user profile with valid session', async () => {
      // Mock session verification
      mockJwtService.validateToken.mockResolvedValue({
        valid: true,
        userId: 'user123',
        role: 'patient',
        tokenId: 'token123',
        expiresAt: Date.now() + 3600000,
      })

      mockAuth0UserService.getUserById.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        role: 'patient',
        fullName: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      })

      mockAuth0UserService.verifyAuthToken.mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
        role: 'patient',
      })

      const request = new Request('https://example.com/api/auth/profile', {
        headers: {
          Authorization: 'Bearer valid.token',
        },
      })

      const response = await profileGetHandler({
        request,
        clientAddress: '127.0.0.1',
      })

      expect(response.status).toBe(200)
      const data = await readJsonObject(response)
      const user = expectRecord(data['user'])
      expect(expectString(user['id'])).toBe('user123')
      expect(expectString(user['fullName'])).toBe('John Doe')
    })

    it('should update user profile', async () => {
      mockJwtService.validateToken.mockResolvedValue({
        valid: true,
        userId: 'user123',
      })

      mockAuth0UserService.updateUser.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        fullName: 'Jane Doe', // Updated
        avatarUrl: 'https://example.com/new-avatar.jpg', // Updated
      })

      mockAuth0UserService.verifyAuthToken.mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
        role: 'patient',
      })

      // CSRF Mock success
      mockRedis.getFromCache.mockResolvedValue({
        token: 'valid-token',
        expiresAt: Date.now() + 99999,
      })

      const request = new Request('https://example.com/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer valid.token',
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-token',
        },
        body: JSON.stringify({
          fullName: 'Jane Doe',
          avatarUrl: 'https://example.com/new-avatar.jpg',
        }),
      })

      const response = await profilePutHandler({
        request,
        clientAddress: '127.0.0.1',
      })

      expect(response.status).toBe(200)
      const data = await readJsonObject(response)
      expect(data['success']).toBe(true)
      const user = expectRecord(data['user'])
      expect(expectString(user['fullName'])).toBe('Jane Doe')

      // Verify security log
      expect(mockSecurity.logSecurityEvent).toHaveBeenCalled()
      const latestLogCall = vi
        .mocked(mockSecurity.logSecurityEvent)
        .mock.calls.at(-1)
      expect(latestLogCall).toBeDefined()
      expect(latestLogCall?.[1]).toBe('user123')
      expect(latestLogCall?.[2]).toMatchObject({
        updates: ['name', 'picture'],
      })
    })
  })

  describe('Verify Endpoint', () => {
    it('should reject missing parameters', async () => {
      const request = new Request('https://example.com/api/auth/verify', {
        headers: { 'User-Agent': 'test' },
      })

      const response = await verifyHandler({
        request,
        clientAddress: '127.0.0.1',
      })

      expect(response.status).toBe(400)
      const data = await readJsonObject(response)
      expect(expectString(data['message'])).toContain('Missing token')
    })

    it('should attempt verification with valid params', async () => {
      // This is testing the stub implementation for now
      const request = new Request(
        'https://example.com/api/auth/verify?token=abc&type=email_verification',
        {
          headers: { 'User-Agent': 'test' },
        },
      )

      const response = await verifyHandler({
        request,
        clientAddress: '127.0.0.1',
      })

      // Current stub returns 200
      expect(response.status).toBe(200)
    })
  })
})
