import type { NextFunction, Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuthenticateRequest = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/auth/auth0-middleware', () => ({
  authenticateRequest: mockAuthenticateRequest,
}))

vi.mock('../../../lib/auth/user-identity', () => ({
  resolveIdentity: vi.fn().mockResolvedValue({
    internalId: 'user123',
    email: 'test@example.com',
    role: 'user',
    emailVerified: false,
  }),
}))

import { authMiddleware, requirePermissions, requireRoles } from '../auth'
import {
  createMockAuthRequest,
  createMockAuthResponse,
  createMockAuthUser,
  type MockAuthRequest,
  type MockAuthResponse,
} from './auth-test-helpers'

describe('Authentication Middleware', () => {
  let mockRequest: MockAuthRequest
  let mockResponse: MockAuthResponse
  let mockNext: NextFunction
  let statusSpy: ReturnType<typeof vi.fn>
  let jsonSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const responseMock = createMockAuthResponse()

    mockRequest = createMockAuthRequest()
    mockResponse = responseMock.response
    statusSpy = responseMock.statusSpy
    jsonSpy = responseMock.jsonSpy
    mockNext = vi.fn()

    vi.clearAllMocks()
  })

  describe('authMiddleware', () => {
    it('should call next when authentication succeeds', async () => {
      mockAuthenticateRequest.mockResolvedValue({
        success: true,
        request: {
          user: {
            sub: 'user123',
            email: 'test@example.com',
            roles: ['user'],
          },
        },
      })

      authMiddleware(mockRequest as unknown as Request, mockResponse as unknown as Response, mockNext)

      await vi.waitFor(() => {
        expect(mockNext).toHaveBeenCalled()
        expect(mockRequest.user).toEqual({
          sub: 'user123',
          email: 'test@example.com',
          roles: ['user'],
          emailVerified: false,
        })
      })
    })

    it('should return 401 when authentication fails', async () => {
      mockAuthenticateRequest.mockResolvedValue({
        success: false,
        error: 'Invalid token',
      })

      authMiddleware(mockRequest as unknown as Request, mockResponse as unknown as Response, mockNext)

      await vi.waitFor(() => {
        expect(statusSpy).toHaveBeenCalledWith(401)
        expect(jsonSpy).toHaveBeenCalledWith({
          error: 'Invalid token',
          code: 'UNAUTHORIZED',
        })
      })
    })

    it('should handle authentication error gracefully', async () => {
      mockAuthenticateRequest.mockRejectedValue(new Error('Auth service error'))

      authMiddleware(mockRequest as unknown as Request, mockResponse as unknown as Response, mockNext)

      await vi.waitFor(() => {
        expect(statusSpy).toHaveBeenCalledWith(401)
        expect(jsonSpy).toHaveBeenCalledWith({
          error: 'Auth service error',
          code: 'AUTH_ERROR',
        })
      })
    })

    it('should handle missing authorization header', async () => {
      mockRequest.headers = {}
      mockAuthenticateRequest.mockResolvedValue({
        success: false,
        error: 'No authorization header',
      })

      authMiddleware(mockRequest as unknown as Request, mockResponse as unknown as Response, mockNext)

      await vi.waitFor(() => {
        expect(statusSpy).toHaveBeenCalledWith(401)
      })
    })
  })

  describe('requireRoles', () => {
    it('should call next when user has required role', async () => {
      const middleware = requireRoles(['admin', 'moderator'])
      mockRequest.user = createMockAuthUser({
        roles: ['admin', 'user'],
        email: 'user@example.com',
        emailVerified: true,
      })

      middleware(mockRequest as any, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 401 when user has no roles', async () => {
      const middleware = requireRoles(['admin'])
      mockRequest.user = undefined

      middleware(mockRequest as any, mockResponse as Response, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(401)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      })
    })

    it('should return 403 when user lacks required role', async () => {
      const middleware = requireRoles(['admin'])
      mockRequest.user = createMockAuthUser({
        roles: ['user', 'editor'],
        email: 'user@example.com',
        emailVerified: true,
      })

      middleware(mockRequest as any, mockResponse as Response, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(403)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: ['admin'],
      })
    })

    it('should accept any of multiple allowed roles', async () => {
      const middleware = requireRoles(['admin', 'moderator', 'editor'])
      mockRequest.user = createMockAuthUser({
        roles: ['editor', 'user'],
        email: 'user@example.com',
        emailVerified: true,
      })

      middleware(mockRequest as any, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('requirePermissions', () => {
    it('should call next when user has required permission', async () => {
      const middleware = requirePermissions(['documents:read'])
      mockRequest.user = createMockAuthUser({
        roles: ['user'],
        permissions: ['documents:read', 'documents:write'],
        emailVerified: true,
      })

      middleware(mockRequest as any, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 401 when user has no permissions', async () => {
      const middleware = requirePermissions(['documents:read'])
      mockRequest.user = undefined

      middleware(mockRequest as any, mockResponse as Response, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(401)
    })

    it('should return 403 when user lacks permission', async () => {
      const middleware = requirePermissions(['admin:delete'])
      mockRequest.user = createMockAuthUser({
        roles: ['user'],
        permissions: ['documents:read'],
        emailVerified: true,
      })

      middleware(mockRequest as any, mockResponse as Response, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(403)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: ['admin:delete'],
      })
    })

    it('should require all permissions when multiple specified', async () => {
      const middleware = requirePermissions([
        'documents:read',
        'documents:write',
      ])
      mockRequest.user = createMockAuthUser({
        roles: ['user'],
        permissions: ['documents:read'],
        emailVerified: true,
      })

      middleware(mockRequest as any, mockResponse as Response, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(403)
    })
  })
})
