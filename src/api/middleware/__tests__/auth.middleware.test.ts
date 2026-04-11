/**
 * @vitest-environment node
 */

import type { NextFunction, Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Auth0 module
vi.mock('../../../lib/auth/auth0-middleware', () => ({
  authenticateRequest: vi.fn(),
}))

import { authenticateRequest } from '../../../lib/auth/auth0-middleware'
import { authMiddleware, requirePermissions, requireRoles } from '../auth'

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    vi.clearAllMocks()

    const getHeader: Request['get'] = ((header: string) => {
      const normalizedHeader = header.toLowerCase()
      const headers: Record<string, string> = {
        host: 'localhost:3000',
        authorization: 'Bearer test-token',
      }
      return headers[normalizedHeader] ?? undefined
    }) as Request['get']

    mockRequest = {
      protocol: 'http',
      get: getHeader,
      originalUrl: '/api/users',
      method: 'GET',
      headers: {
        authorization: 'Bearer test-token',
      },
    }

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }

    mockNext = vi.fn()
  })

  describe('authMiddleware', () => {
    it('should call next when authentication succeeds', async () => {
      ;(authenticateRequest as any).mockResolvedValue({
        success: true,
        request: {
          user: {
            sub: 'user123',
            email: 'test@example.com',
            roles: ['user'],
          },
        },
      })

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      )

      expect(mockNext).toHaveBeenCalled()
      expect((mockRequest as any).user).toEqual({
        sub: 'user123',
        email: 'test@example.com',
        roles: ['user'],
        emailVerified: false,
      })
    })

    it('should return 401 when authentication fails', async () => {
      ;(authenticateRequest as any).mockResolvedValue({
        success: false,
        error: 'Invalid token',
      })

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      )

      expect(mockResponse?.status).toHaveBeenCalledWith(401)
      expect(mockResponse?.json).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'UNAUTHORIZED',
      })
    })

    it('should handle authentication error gracefully', async () => {
      ;(authenticateRequest as any).mockRejectedValue(
        new Error('Auth service error'),
      )

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      )

      expect(mockResponse?.status).toHaveBeenCalledWith(401)
      expect(mockResponse?.json).toHaveBeenCalledWith({
        error: 'Auth service error',
        code: 'AUTH_ERROR',
      })
    })
  })

  describe('requireRoles', () => {
    it('should call next when user has required role', () => {
      const middleware = requireRoles(['admin', 'moderator'])
      ;(mockRequest as any).user = { roles: ['admin', 'user'] }

      middleware(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 401 when user has no roles', () => {
      const middleware = requireRoles(['admin'])
      ;(mockRequest as any).user = undefined

      middleware(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse?.status).toHaveBeenCalledWith(401)
      expect(mockResponse?.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      })
    })

    it('should return 403 when user lacks required role', () => {
      const middleware = requireRoles(['admin'])
      ;(mockRequest as any).user = { roles: ['user', 'editor'] }

      middleware(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse?.status).toHaveBeenCalledWith(403)
      expect(mockResponse?.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: ['admin'],
      })
    })
  })

  describe('requirePermissions', () => {
    it('should call next when user has required permission', () => {
      const middleware = requirePermissions(['documents:read'])
      ;(mockRequest as any).user = {
        permissions: ['documents:read', 'documents:write'],
      }

      middleware(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 401 when user has no permissions', () => {
      const middleware = requirePermissions(['documents:read'])
      ;(mockRequest as any).user = undefined

      middleware(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse?.status).toHaveBeenCalledWith(401)
    })

    it('should return 403 when user lacks permission', () => {
      const middleware = requirePermissions(['admin:delete'])
      ;(mockRequest as any).user = { permissions: ['documents:read'] }

      middleware(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse?.status).toHaveBeenCalledWith(403)
      expect(mockResponse?.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: ['admin:delete'],
      })
    })
  })
})
