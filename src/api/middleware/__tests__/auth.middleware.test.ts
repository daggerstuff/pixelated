/**
 * @vitest-environment node
 */

import type { NextFunction } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuthenticateRequest = vi.hoisted(() => vi.fn())

// Mock Auth0 module
vi.mock('../../../lib/auth/auth0-middleware', () => ({
  authenticateRequest: mockAuthenticateRequest,
}))

import type { Response } from 'express'

import { authMiddleware, requirePermissions, requireRoles } from '../auth'
import {
  createMockAuthRequest,
  createMockAuthResponse,
  createMockAuthUser,
  type MockAuthRequest,
} from './auth-test-helpers'

describe('Authentication Middleware', () => {
  let mockRequest: MockAuthRequest
  let mockResponse: Response
  let mockNext: NextFunction
  let statusSpy: ReturnType<typeof vi.fn>
  let jsonSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    const responseMock = createMockAuthResponse()
    mockRequest = createMockAuthRequest()
    mockResponse = responseMock.response as unknown as Response
    statusSpy = responseMock.statusSpy
    jsonSpy = responseMock.jsonSpy

    mockNext = vi.fn()
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

      authMiddleware(mockRequest as unknown as Request, mockResponse, mockNext)

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

      authMiddleware(mockRequest as unknown as Request, mockResponse, mockNext)

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

      authMiddleware(mockRequest as unknown as Request, mockResponse, mockNext)

      await vi.waitFor(() => {
        expect(statusSpy).toHaveBeenCalledWith(401)
        expect(jsonSpy).toHaveBeenCalledWith({
          error: 'Auth service error',
          code: 'AUTH_ERROR',
        })
      })
    })
  })

  describe('requireRoles', () => {
    it('should call next when user has required role', () => {
      const middleware = requireRoles(['admin', 'moderator'])
      mockRequest.user = createMockAuthUser({
        roles: ['admin', 'user'],
        email: 'admin@example.com',
        emailVerified: true,
      })

      middleware(mockRequest as unknown as Request, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 401 when user has no roles', () => {
      const middleware = requireRoles(['admin'])
      mockRequest.user = undefined

      middleware(mockRequest as unknown as Request, mockResponse, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(401)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      })
    })

    it('should return 403 when user lacks required role', () => {
      const middleware = requireRoles(['admin'])
      mockRequest.user = createMockAuthUser({
        roles: ['user', 'editor'],
        email: 'user@example.com',
        emailVerified: true,
      })

      middleware(mockRequest as unknown as Request, mockResponse, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(403)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: ['admin'],
      })
    })
  })

  describe('requirePermissions', () => {
    it('should call next when user has required permission', () => {
      const middleware = requirePermissions(['documents:read'])
      mockRequest.user = createMockAuthUser({
        roles: ['user'],
        permissions: ['documents:read', 'documents:write'],
        email: 'user@example.com',
        emailVerified: true,
      })

      middleware(mockRequest as unknown as Request, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 401 when user has no permissions', () => {
      const middleware = requirePermissions(['documents:read'])
      mockRequest.user = undefined

      middleware(mockRequest as unknown as Request, mockResponse, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(401)
    })

    it('should return 403 when user lacks permission', () => {
      const middleware = requirePermissions(['admin:delete'])
      mockRequest.user = createMockAuthUser({
        roles: ['user'],
        permissions: ['documents:read'],
        email: 'user@example.com',
        emailVerified: true,
      })

      middleware(mockRequest as unknown as Request, mockResponse, mockNext)

      expect(statusSpy).toHaveBeenCalledWith(403)
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: ['admin:delete'],
      })
    })
  })
})
