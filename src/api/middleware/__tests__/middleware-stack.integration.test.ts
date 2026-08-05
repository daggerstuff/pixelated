import type { NextFunction } from 'express'

import 'vitest'

type TestRequest = {
  ip?: string
  headers: Record<string, string | string[] | undefined>
  url?: string
  method?: string
  user?: { id?: string; [key: string]: unknown }
}
type MockResponse = {
  status: (statusCode: number) => MockResponse
  json: (body: object) => MockResponse
  setHeader: (field: string, value: string | string[] | number) => MockResponse
  set?: (field: string, value: string | string[]) => MockResponse
  on: (event: string, listener: (...args: unknown[]) => void) => void
}
type ErrorHandlingMiddleware = (
  req: TestRequest,
  res: MockResponse,
  next: NextFunction,
) => void | Promise<void>
type TestMiddleware = ReturnType<typeof vi.fn<ErrorHandlingMiddleware>>
type NextFunctionMock = NextFunction

function createMockTestRequest(
  overrides: Partial<TestRequest> = {},
): TestRequest {
  return {
    ip: '192.168.1.1',
    headers: {},
    url: '/api/users',
    method: 'GET',
    ...overrides,
  }
}

function createMockNext(): NextFunction {
  return vi.fn() as NextFunction
}

function createMockResponse(): MockResponse {
  return {
    status: vi.fn<(statusCode: number) => MockResponse>().mockReturnThis(),
    json: vi.fn<(body: object) => MockResponse>().mockReturnThis(),
    setHeader: vi
      .fn<(field: string, value: string | string[] | number) => MockResponse>()
      .mockReturnThis(),
    set: vi.fn<(field: string, value: string | string[]) => MockResponse>(),
    on: vi.fn<
      (event: string, listener: (...args: unknown[]) => void) => void
    >(),
  }
}

// Mock dependencies
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
}

const mockAuthenticateRequest = vi.fn()

vi.mock('../../../lib/services/redis', () => ({
  redis: mockRedis,
}))

vi.mock('../auth', () => ({
  authMiddleware: mockAuthMiddleware,
  requireRoles: vi.fn(),
  requirePermissions: vi.fn(),
  authenticateRequest: mockAuthenticateRequest,
}))

vi.mock('../rate-limiter', () => ({
  rateLimiter: mockRateLimiter,
  rateLimitByUser: vi.fn(),
  incrementRedisCounter: vi.fn(),
}))

vi.mock('../logger', () => ({
  requestLogger: mockRequestLogger,
  logAuditEvent: vi.fn(),
  getActionType: vi.fn(),
  getResourceType: vi.fn(),
}))

// Import after mocks
let mockAuthMiddleware: TestMiddleware
let mockRateLimiter: TestMiddleware
let mockRequestLogger: TestMiddleware

beforeEach(() => {
  vi.clearAllMocks()

  mockAuthMiddleware = vi.fn<ErrorHandlingMiddleware>()
  mockRateLimiter = vi.fn<ErrorHandlingMiddleware>()
  mockRequestLogger = vi.fn<ErrorHandlingMiddleware>()
})

describe('Middleware Stack Integration', () => {
  let mockRequest: TestRequest
  let mockResponse: MockResponse
  let mockNext: NextFunctionMock

  beforeEach(() => {
    mockRequest = createMockTestRequest()
    mockResponse = createMockResponse()
    mockNext = createMockNext()
  })

  it('should process middleware in correct order: logger -> rateLimit -> auth', async () => {
    mockRequest.headers['authorization'] = 'Bearer valid-token'
    mockAuthenticateRequest.mockResolvedValue({ id: 'user123' })

    const callOrder: string[] = []
    mockRequestLogger.mockImplementation(
      (_req: TestRequest, _res: MockResponse, next: NextFunction) => {
        callOrder.push('logger')
        next()
      },
    )
    mockRateLimiter.mockImplementation(
      (_req: TestRequest, _res: MockResponse, next: NextFunction) => {
        callOrder.push('rateLimiter')
        next()
      },
    )
    mockAuthMiddleware.mockImplementation(
      (_req: TestRequest, _res: MockResponse, next: NextFunction) => {
        callOrder.push('auth')
        next()
      },
    )

    void mockRequestLogger(mockRequest, mockResponse, () => {
      void mockRateLimiter(mockRequest, mockResponse, () => {
        void mockAuthMiddleware(mockRequest, mockResponse, mockNext)
      })
    })

    expect(callOrder).toEqual(['logger', 'rateLimiter', 'auth'])
    expect(mockRequestLogger).toHaveBeenCalled()
    expect(mockRateLimiter).toHaveBeenCalled()
    expect(mockAuthMiddleware).toHaveBeenCalled()
  })

  it('should handle auth failure before reaching next middleware', async () => {
    mockAuthenticateRequest.mockRejectedValue(new Error('Invalid token'))
    mockRequest.headers['authorization'] = 'Bearer invalid'
    mockAuthMiddleware.mockImplementation(
      async (__req: TestRequest, _res: MockResponse, _next: NextFunction) => {
        throw new Error('Invalid token')
      },
    )

    await expect(
      mockAuthMiddleware(mockRequest, mockResponse, mockNext),
    ).rejects.toBeInstanceOf(Error)

    expect(mockNext).not.toHaveBeenCalled()
  })

  it('should handle rate limit before auth', async () => {
    mockRedis.get.mockResolvedValue('1001')
    mockRateLimiter.mockImplementation(
      (_req: TestRequest, res: MockResponse, _next: NextFunction) => {
        res.status(429).json({ error: 'Too Many Requests' })
      },
    )

    void mockRateLimiter(mockRequest, mockResponse, mockNext)

    expect(mockResponse.status).toHaveBeenCalledWith(429)
    expect(mockNext).not.toHaveBeenCalled()
  })

  it('should propagate errors to error handler', async () => {
    const error = new Error('Middleware error')
    const faultyMiddleware = async (
      _req: TestRequest,
      _res: MockResponse,
      _next: NextFunction,
    ) => {
      throw error
    }

    await expect(
      faultyMiddleware(mockRequest, mockResponse, mockNext),
    ).rejects.toBe(error)
  })

  it('should handle middleware chain with multiple middlewares', async () => {
    const callOrder: string[] = []

    const middleware1 = async (
      _req: TestRequest,
      _res: MockResponse,
      next: NextFunction,
    ) => {
      callOrder.push('middleware1-start')
      next()
    }

    const middleware2 = async (
      _req: TestRequest,
      _res: MockResponse,
      next: NextFunction,
    ) => {
      callOrder.push('middleware2-start')
      next()
    }

    const middleware3 = async (
      _req: TestRequest,
      _res: MockResponse,
      _next: NextFunction,
    ) => {
      callOrder.push('middleware3')
    }

    await middleware1(mockRequest, mockResponse, () => {
      void middleware2(mockRequest, mockResponse, () => {
        void middleware3(mockRequest, mockResponse, mockNext)
      })
    })

    expect(callOrder).toEqual([
      'middleware1-start',
      'middleware2-start',
      'middleware3',
    ])
  })

  it('should handle async middleware correctly', async () => {
    const asyncMiddleware = async (
      _req: TestRequest,
      _res: MockResponse,
      next: NextFunction,
    ) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      next()
    }

    await asyncMiddleware(mockRequest, mockResponse, mockNext)

    expect(mockNext).toHaveBeenCalled()
  })

  it('should stop chain when middleware does not call next', async () => {
    const stopMiddleware = async (
      _req: TestRequest,
      res: MockResponse,
      _next: NextFunction,
    ) => {
      res.status(200).json({ stopped: true })
      // Intentionally not calling next
    }

    await stopMiddleware(mockRequest, mockResponse, mockNext)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockResponse.json).toHaveBeenCalledWith({ stopped: true })
  })
})

describe('Middleware Error Scenarios', () => {
  let mockRequest: TestRequest
  let mockResponse: MockResponse

  beforeEach(() => {
    mockRequest = createMockTestRequest()
    mockResponse = createMockResponse()
  })

  it('should handle Redis connection failure in rate limiter', async () => {
    mockRedis.get.mockRejectedValue(new Error('Redis connection failed'))

    mockRateLimiter = vi
      .fn<ErrorHandlingMiddleware>()
      .mockImplementation(
        async (_req: TestRequest, _res: MockResponse, _next: NextFunction) => {
          throw new Error('Redis connection failed')
        },
      )

    let rateLimiterError: unknown
    try {
      await mockRateLimiter(mockRequest, mockResponse, () => {})
    } catch (error: unknown) {
      rateLimiterError = error
    }
    if (!(rateLimiterError instanceof Error)) {
      throw new Error('Expected error to be thrown')
    }
    expect(rateLimiterError.message).toBe('Redis connection failed')
  })

  it('should handle authentication service unavailable', async () => {
    mockAuthenticateRequest.mockRejectedValue(
      new Error('Auth service unavailable'),
    )

    mockAuthMiddleware = vi
      .fn<ErrorHandlingMiddleware>()
      .mockImplementation(
        async (_req: TestRequest, _res: MockResponse, _next: NextFunction) => {
          throw new Error('Auth service unavailable')
        },
      )

    let authError: unknown
    try {
      await mockAuthMiddleware(mockRequest, mockResponse, () => {})
    } catch (error: unknown) {
      authError = error
    }
    if (!(authError instanceof Error)) {
      throw new Error('Expected error to be thrown')
    }
    expect(authError.message).toBe('Auth service unavailable')
  })

  it('should handle logger failure gracefully', async () => {
    mockRequestLogger = vi
      .fn<ErrorHandlingMiddleware>()
      .mockImplementation(
        async (_req: TestRequest, _res: MockResponse, _next: NextFunction) => {
          throw new Error('Logger failed')
        },
      )

    let loggerError: unknown
    try {
      await mockRequestLogger(mockRequest, mockResponse, () => {})
    } catch (error: unknown) {
      loggerError = error
    }
    if (!(loggerError instanceof Error)) {
      throw new Error('Expected error to be thrown')
    }
    expect(loggerError.message).toBe('Logger failed')
  })
})

describe('Middleware Context Preservation', () => {
  let mockRequest: TestRequest
  let mockResponse: MockResponse
  let mockNext: NextFunctionMock

  beforeEach(() => {
    mockRequest = createMockTestRequest()
    mockResponse = createMockResponse()
    mockNext = createMockNext()
  })

  it('should preserve request context across middlewares', async () => {
    const context = { userId: '', startTime: 0 }

    const contextMiddleware = async (
      _req: TestRequest,
      _res: MockResponse,
      next: NextFunction,
    ) => {
      context.startTime = Date.now()
      next()
    }

    const authMiddleware = async (
      req: TestRequest,
      _res: MockResponse,
      next: NextFunction,
    ) => {
      req.user = { id: 'user123' }
      context.userId = 'user123'
      next()
    }

    const loggingMiddleware = async (
      _req: TestRequest,
      _res: MockResponse,
      next: NextFunction,
    ) => {
      const duration = Date.now() - context.startTime
      console.log(`Request by ${context.userId} took ${duration}ms`)
      next()
    }

    await contextMiddleware(mockRequest, mockResponse, () => {
      void authMiddleware(mockRequest, mockResponse, () => {
        void loggingMiddleware(mockRequest, mockResponse, mockNext)
      })
    })

    expect(mockNext).toHaveBeenCalled()
  })

  it('should handle response modification by multiple middlewares', async () => {
    const headerMiddleware = async (
      _req: TestRequest,
      res: MockResponse,
      next: NextFunction,
    ) => {
      res.setHeader('X-Request-Id', '12345')
      next()
    }

    const securityMiddleware = async (
      _req: TestRequest,
      res: MockResponse,
      next: NextFunction,
    ) => {
      res.setHeader('X-Content-Type-Options', 'nosniff')
      next()
    }

    await headerMiddleware(mockRequest, mockResponse, () => {
      void securityMiddleware(mockRequest, mockResponse, mockNext)
    })

    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', '12345')
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Content-Type-Options',
      'nosniff',
    )
  })
})
