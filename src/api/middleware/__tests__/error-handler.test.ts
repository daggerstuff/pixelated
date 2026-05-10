import { NextFunction } from 'express'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from '../error-handler'

type ErrorRequest = Parameters<typeof errorHandler>[1]
type ErrorResponse = Parameters<typeof errorHandler>[2]
type MockError = Error & {
  code?: string | number
  keyValue?: Record<string, unknown>
  routine?: string
}

function createMockRequest(): ErrorRequest {
  return {
    method: 'GET',
    url: '/test-route',
    path: '/test-route',
  } as ErrorRequest
}

function createMockResponse(): ErrorResponse {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as ErrorResponse
}

function createDatabaseError(
  message: string,
  details: Partial<MockError> = {},
): MockError {
  return Object.assign(new Error(message), details)
}

describe('error-handler middleware', () => {
  let req: ErrorRequest
  let res: ErrorResponse
  let next: NextFunction

  beforeEach(() => {
    req = createMockRequest()
    res = createMockResponse()
    next = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.NODE_ENV = 'test'
  })

  describe('errorHandler', () => {
    it('should handle standard Error with 500 status', () => {
      const error = new Error('Standard error message')
      errorHandler(error, req, res, next)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal Server Error',
          }),
        }),
      )
    })

    it('should handle custom AppError', () => {
      const error = new AppError(400, 'Bad request', 'BAD_REQUEST')
      errorHandler(error, req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'BAD_REQUEST',
            message: 'Bad request',
          }),
        }),
      )
    })

    it('should handle ValidationError with fields details', () => {
      const error = new ValidationError('Invalid input', {
        email: 'Invalid email format',
      })
      errorHandler(error, req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: {
              fields: { email: 'Invalid email format' },
            },
          }),
        }),
      )
    })

    it('should handle MongoDB ValidationError', () => {
      const error = Object.assign(new Error('Mongoose validation error'), {
        name: 'ValidationError',
      })
      errorHandler(error, req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Validation Error',
          }),
        }),
      )
    })

    it('should handle MongoDB duplicate key error (code 11000)', () => {
      const error = createDatabaseError('Mongo server error', {
        name: 'MongoServerError',
        code: 11000,
        keyValue: { email: 'test@example.com' },
      })
      errorHandler(error, req, res, next)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'DUPLICATE_KEY',
            message: 'Duplicate key error',
            details: {
              field: 'email',
              value: 'test@example.com',
            },
          }),
        }),
      )
    })

    it('should handle PostgreSQL error', () => {
      const error = createDatabaseError('Postgres error', {
        code: '23505',
        routine: 'pg_routine',
      })
      errorHandler(error, req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: '23505',
            message: 'Database error',
          }),
        }),
      )
    })

    it('should handle JsonWebTokenError', () => {
      const error = new Error('JWT error')
      error.name = 'JsonWebTokenError'
      errorHandler(error, req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INVALID_TOKEN',
            message: 'Invalid token',
          }),
        }),
      )
    })

    it('should handle TokenExpiredError', () => {
      const error = new Error('Token expired error')
      error.name = 'TokenExpiredError'
      errorHandler(error, req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'TOKEN_EXPIRED',
            message: 'Token expired',
          }),
        }),
      )
    })

    it('should include stack trace and request info in development mode', () => {
      process.env.NODE_ENV = 'development'
      const error = new Error('Test error')
      errorHandler(error, req, res, next)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            stack: expect.any(String),
          }),
          request: expect.objectContaining({
            method: 'GET',
            url: '/test-route',
            timestamp: expect.any(String),
          }),
        }),
      )
    })
  })

  describe('custom error classes', () => {
    it('NotFoundError formats message correctly with identifier', () => {
      const err = new NotFoundError('User', '123')
      expect(err.statusCode).toBe(404)
      expect(err.message).toBe('User with id "123" not found')
      expect(err.code).toBe('NOT_FOUND')
    })

    it('NotFoundError formats message correctly without identifier', () => {
      const err = new NotFoundError('User')
      expect(err.statusCode).toBe(404)
      expect(err.message).toBe('User not found')
      expect(err.code).toBe('NOT_FOUND')
    })

    it('UnauthorizedError uses default message if none provided', () => {
      const err = new UnauthorizedError()
      expect(err.statusCode).toBe(401)
      expect(err.message).toBe('Unauthorized')
    })

    it('ForbiddenError uses default message if none provided', () => {
      const err = new ForbiddenError()
      expect(err.statusCode).toBe(403)
      expect(err.message).toBe('Forbidden')
    })

    it('ConflictError formats correctly', () => {
      const err = new ConflictError('Resource already exists')
      expect(err.statusCode).toBe(409)
      expect(err.message).toBe('Resource already exists')
      expect(err.code).toBe('CONFLICT')
    })
  })

  describe('notFoundHandler', () => {
    it('should generate NotFoundError and call errorHandler', () => {
      notFoundHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Route GET /test-route not found',
          }),
        }),
      )
    })
  })

  describe('asyncHandler', () => {
    it('should catch errors and pass them to next', async () => {
      const error = new Error('Async error')
      const failingAsyncFn = async () => {
        throw error
      }

      const wrappedFn = asyncHandler(failingAsyncFn)
      wrappedFn(req, res, next)
      await new Promise((resolve) => process.nextTick(resolve))

      expect(next).toHaveBeenCalledWith(error)
    })

    it('should call next on success if wrapped function returns correctly', async () => {
      const successAsyncFn = async () => {
        return 'success'
      }

      const wrappedFn = asyncHandler(successAsyncFn)
      wrappedFn(req, res, next)
      await new Promise((resolve) => process.nextTick(resolve))

      expect(next).not.toHaveBeenCalled()
    })
  })
})
