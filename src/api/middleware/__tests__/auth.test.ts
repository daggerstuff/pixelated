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

type MockAuthRequest = Pick<
  Request,
  'protocol' | 'get' | 'originalUrl' | 'method' | 'headers'
> & {
  user?: {
    id: string
    email: string
    roles: string[]
    emailVerified: boolean
  }
  statusCode?: number
}

type MockAuthResponse = Pick<Response, 'status' | 'json'>

describe('Authentication Middleware', () => {
  let mockRequest: Request
  let mockResponse: MockAuthResponse
  let mockNext: NextFunction
  const statusSpy = vi.fn().mockReturnThis()
  const jsonSpy = vi.fn()

  beforeEach(() => {
    mockRequest = {
      protocol: 'http',
      get: (header: string): string | string[] | undefined => {
        const headers: Record<string, string> = {
          host: 'localhost:3000',
          authorization: 'Bearer test-token',
        }
        return headers[header] || undefined
      },
      originalUrl: '/api/users',
      method: 'GET',
      headers: {
        authorization: 'Bearer test-token',
      },
    } as MockAuthRequest
    statusSpy.mockClear()
    jsonSpy.mockClear()
    mockResponse = {
      status: statusSpy,
      json: jsonSpy,
    } satisfies MockAuthResponse
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

      await authMiddleware(mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockRequest.user).toEqual({
        sub: 'user123',
        email: 'test@example.com',
        roles: ['user'],
        emailVerified: false,
      })
    })

    it('should return 401 when authentication fails', async () => {
      mockAuthenticateRequest.mockResolvedValue({
        success: false,
        error: 'Invalid token',
      })

      await authMiddleware(mockRequest, mockResponse, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(401)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'UNAUTHORIZED',
      })
    })

    it('should handle authentication error gracefully', async () => {
      mockAuthenticateRequest.mockRejectedValue(new Error('Auth service error'))

      await authMiddleware(mockRequest, mockResponse, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(401)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Auth service error',
        code: 'AUTH_ERROR',
      })
    })

    it('should handle missing authorization header', async () => {
      mockRequest.headers = {}
      mockAuthenticateRequest.mockResolvedValue({
        success: false,
        error: 'No authorization header',
      })

      await authMiddleware(mockRequest, mockResponse, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(401)
    })
  })

  describe('requireRoles', () => {
    it('should call next when user has required role', async () => {
      const middleware = requireRoles(['admin', 'moderator'])
      mockRequest.user = { id: 'user-123', roles: ['admin', 'user'] }

      middleware(mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 401 when user has no roles', async () => {
      const middleware = requireRoles(['admin'])
      mockRequest.user = undefined

      middleware(mockRequest, mockResponse, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(401)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      })
    })

    it('should return 403 when user lacks required role', async () => {
      const middleware = requireRoles(['admin'])
      mockRequest.user = { id: 'user-123', roles: ['user', 'editor'] }

      middleware(mockRequest, mockResponse, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(403)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: ['admin'],
      })
    })

    it('should accept any of multiple allowed roles', async () => {
      const middleware = requireRoles(['admin', 'moderator', 'editor'])
      mockRequest.user = { id: 'user-123', roles: ['editor', 'user'] }

      middleware(mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('requirePermissions', () => {
    it('should call next when user has required permission', async () => {
      const middleware = requirePermissions(['documents:read'])
      mockRequest.user = {
        id: 'user-123',
        permissions: ['documents:read', 'documents:write'],
      }

      middleware(mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 401 when user has no permissions', async () => {
      const middleware = requirePermissions(['documents:read'])
      mockRequest.user = undefined

      middleware(mockRequest, mockResponse, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(401)
    })

    it('should return 403 when user lacks permission', async () => {
      const middleware = requirePermissions(['admin:delete'])
      mockRequest.user = { id: 'user-123', permissions: ['documents:read'] }

      middleware(mockRequest, mockResponse, mockNext)

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
      mockRequest.user = { id: 'user-123', permissions: ['documents:read'] }

      middleware(mockRequest, mockResponse, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(403)
    })
  })
})
