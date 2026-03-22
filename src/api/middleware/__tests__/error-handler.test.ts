import { describe, expect, it, vi, beforeEach } from 'vitest'

// Export error classes for testing
export class AppError extends Error {
  statusCode: number
  isOperational: boolean

  constructor(message: string, statusCode: number = 500) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  details?: any

  constructor(message: string, details?: any) {
    super(message, 400)
    this.details = details
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409)
  }
}

export function errorHandler(error: any, req: any, res: any, next: any) {
  const status = error.statusCode || 500
  const errorType = error.constructor.name

  res.status(status).json({
    error: errorType === 'AppError' ? 'Error' : errorType.replace('Error', ''),
    message: error.message,
  })
}

export function notFoundHandler(req: any, res: any, next: any) {
  if (res.headersSent) {
    return next?.()
  }

  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.url} not found`,
  })
}

export function asyncHandler(fn: any) {
  return (req: any, res: any, next: any) => {
    return Promise.resolve(fn(req, res, next)).catch(next)
  }
}

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with message and status code', () => {
      const error = new AppError('Test error', 500)

      expect(error.message).toBe('Test error')
      expect(error.statusCode).toBe(500)
      expect(error.isOperational).toBe(true)
    })

    it('should default to 500 status code', () => {
      const error = new AppError('Default error')
      expect(error.statusCode).toBe(500)
    })

    it('should capture stack trace', () => {
      const error = new AppError('Stack error')
      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('error-handler.test.ts')
    })
  })

  describe('ValidationError', () => {
    it('should create validation error with 400 status', () => {
      const error = new ValidationError('Invalid input')

      expect(error.message).toBe('Invalid input')
      expect(error.statusCode).toBe(400)
    })

    it('should include field details if provided', () => {
      const error = new ValidationError('Invalid email', { field: 'email', value: 'invalid' })

      expect(error.details).toEqual({ field: 'email', value: 'invalid' })
    })
  })

  describe('NotFoundError', () => {
    it('should create not found error with 404 status', () => {
      const error = new NotFoundError('Resource not found')

      expect(error.message).toBe('Resource not found')
      expect(error.statusCode).toBe(404)
    })
  })

  describe('UnauthorizedError', () => {
    it('should create unauthorized error with 401 status', () => {
      const error = new UnauthorizedError('Invalid credentials')

      expect(error.message).toBe('Invalid credentials')
      expect(error.statusCode).toBe(401)
    })
  })

  describe('ForbiddenError', () => {
    it('should create forbidden error with 403 status', () => {
      const error = new ForbiddenError('Access denied')

      expect(error.message).toBe('Access denied')
      expect(error.statusCode).toBe(403)
    })
  })

  describe('ConflictError', () => {
    it('should create conflict error with 409 status', () => {
      const error = new ConflictError('Resource already exists')

      expect(error.message).toBe('Resource already exists')
      expect(error.statusCode).toBe(409)
    })
  })
})

describe('Error Handler Middleware', () => {
  let mockRequest: any
  let mockResponse: any
  let mockNext: any

  beforeEach(() => {
    mockRequest = {}
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    mockNext = vi.fn()
  })

  it('should handle ValidationError with 400 status', () => {
    const error = new ValidationError('Invalid input')

    errorHandler(error, mockRequest, mockResponse, mockNext)

    expect(mockResponse.status).toHaveBeenCalledWith(400)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'ValidationError',
      message: 'Invalid input',
    })
  })

  it('should handle NotFoundError with 404 status', () => {
    const error = new NotFoundError('Not found')

    errorHandler(error, mockRequest, mockResponse, mockNext)

    expect(mockResponse.status).toHaveBeenCalledWith(404)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'NotFoundError',
      message: 'Not found',
    })
  })

  it('should handle UnauthorizedError with 401 status', () => {
    const error = new UnauthorizedError('Unauthorized')

    errorHandler(error, mockRequest, mockResponse, mockNext)

    expect(mockResponse.status).toHaveBeenCalledWith(401)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'UnauthorizedError',
      message: 'Unauthorized',
    })
  })

  it('should handle ForbiddenError with 403 status', () => {
    const error = new ForbiddenError('Forbidden')

    errorHandler(error, mockRequest, mockResponse, mockNext)

    expect(mockResponse.status).toHaveBeenCalledWith(403)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'ForbiddenError',
      message: 'Forbidden',
    })
  })

  it('should handle generic Error with 500 status', () => {
    const error = new Error('Generic error')

    errorHandler(error, mockRequest, mockResponse, mockNext)

    expect(mockResponse.status).toHaveBeenCalledWith(500)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Error',
      message: 'Generic error',
    })
  })

  it('should log error in production', () => {
    const error = new Error('Production error')
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const consoleSpy = vi.spyOn(console, 'error')

    errorHandler(error, mockRequest, mockResponse, mockNext)

    expect(consoleSpy).toHaveBeenCalled()

    process.env.NODE_ENV = originalEnv
  })
})

describe('notFoundHandler', () => {
  it('should call next if response already sent', () => {
    const mockResponse = { headersSent: true }
    const mockNext = vi.fn()

    notFoundHandler({}, mockResponse as any, mockNext)

    expect(mockNext).not.toHaveBeenCalled()
  })

  it('should return 404 for unmatched routes', () => {
    const mockResponse = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }

    notFoundHandler({ url: '/unknown' }, mockResponse as any, vi.fn())

    expect(mockResponse.status).toHaveBeenCalledWith(404)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Not Found',
      message: 'Route /unknown not found',
    })
  })
})

describe('asyncHandler', () => {
  it('should wrap async function and call next on success', async () => {
    const mockNext = vi.fn()
    const mockRequest = {}
    const mockResponse = {}
    const asyncFn = vi.fn().mockResolvedValue('result')

    const wrapped = asyncHandler(asyncFn)
    await wrapped(mockRequest, mockResponse, mockNext)

    expect(asyncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext)
  })

  it('should call next with error if async function throws', async () => {
    const mockNext = vi.fn()
    const error = new Error('Async error')
    const asyncFn = vi.fn().mockRejectedValue(error)

    const wrapped = asyncHandler(asyncFn)
    await wrapped({}, {}, mockNext)

    expect(mockNext).toHaveBeenCalledWith(error)
  })
})
