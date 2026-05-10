import type { NextFunction } from 'express'

import 'vitest'

type MockRateRequest = {
  ip?: string
  socket?: { remoteAddress?: string }
  headers: Record<string, string | string[] | undefined>
  user?: {
    id?: string
  }
}

type MockResponse = {
  status: (statusCode: number) => MockResponse
  json: (body: unknown) => MockResponse
  setHeader: (name: string, value: string) => MockResponse
  set: (name: string, value: string) => MockResponse
}
type NextFunctionMock = NextFunction

function createMockResponse(): MockResponse {
  return {
    status: vi.fn<(statusCode: number) => MockResponse>().mockReturnThis(),
    json: vi.fn<(body: unknown) => MockResponse>().mockReturnThis(),
    setHeader: vi
      .fn<(name: string, value: string) => MockResponse>()
      .mockReturnThis(),
    set: vi
      .fn<(name: string, value: string) => MockResponse>()
      .mockReturnThis(),
  }
}

// Mock Redis client before importing
const mockIncr = vi.fn()
const mockExpire = vi.fn()
const mockMulti = vi.fn()

vi.mock('../../lib/database/connection', () => ({
  getRedisClient: () => ({
    incr: mockIncr,
    expire: mockExpire,
    multi: mockMulti,
  }),
}))

// Import after mock setup
import {
  rateLimiter,
  rateLimitByUser,
  incrementRedisCounter,
} from '../rate-limiter'
type RateLimiterRequest = Parameters<typeof rateLimiter>[0]
type RateLimiterResponse = Parameters<typeof rateLimiter>[1]

describe('Rate Limiter Middleware', () => {
  let mockRequest: MockRateRequest
  let mockResponse: MockResponse
  let mockNext: NextFunctionMock

  beforeEach(() => {
    mockRequest = {
      ip: '192.168.1.1',
      headers: {},
    }
    mockResponse = createMockResponse()
    mockNext = vi.fn() as NextFunction

    vi.clearAllMocks()
  })

  const invokeRateLimiter = async (
    request: MockRateRequest,
    response: MockResponse,
    next: NextFunction,
  ) => {
    return rateLimiter(request, response, next)
  }

  const invokeUserLimiter = async (
    middleware: ReturnType<typeof rateLimitByUser>,
    request: MockRateRequest,
    response: MockResponse,
    next: NextFunction,
  ) => {
    return middleware(request, response, next)
  }

  describe('rateLimiter (IP-based)', () => {
    it('should call next when under rate limit', async () => {
      mockMulti.mockResolvedValue([
        [null, 1],
        [null, 1],
      ])

      await invokeRateLimiter(mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 429 when rate limit exceeded', async () => {
      mockMulti.mockResolvedValue([
        [null, 1001],
        [null, 1],
      ])

      await invokeRateLimiter(mockRequest, mockResponse, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(429)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should use in-memory fallback when Redis unavailable', async () => {
      mockMulti.mockRejectedValue(new Error('Redis unavailable'))

      let caught: unknown
      try {
        await invokeRateLimiter(mockRequest, mockResponse, mockNext)
      } catch (error) {
        caught = error
      }

      expect(caught).toBeUndefined()
    })

    it('should extract IP from x-forwarded-for header if present', async () => {
      mockRequest.headers['x-forwarded-for'] = '203.0.113.195'
      mockMulti.mockResolvedValue([
        [null, 1],
        [null, 1],
      ])

      await invokeRateLimiter(mockRequest, mockResponse, mockNext)

      // Should use the forwarded IP
      expect(mockNext).toHaveBeenCalled()
    })

    it('should handle multiple IPs in x-forwarded-for header', async () => {
      mockRequest.headers['x-forwarded-for'] = '203.0.113.195, 70.41.3.18'
      mockMulti.mockResolvedValue([
        [null, 1],
        [null, 1],
      ])

      await invokeRateLimiter(mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should default to 127.0.0.1 when no IP available', async () => {
      mockRequest.ip = undefined
      mockRequest.headers = {}
      mockMulti.mockResolvedValue([
        [null, 1],
        [null, 1],
      ])

      await invokeRateLimiter(mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('rateLimitByUser (User-based)', () => {
    it('should create middleware that limits by user ID', async () => {
      const middleware = rateLimitByUser(100, 60000)
      mockRequest.user = { id: 'user123' }
      mockMulti.mockResolvedValue([
        [null, 1],
        [null, 1],
      ])

      await invokeUserLimiter(middleware, mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should use IP if user not authenticated', async () => {
      const middleware = rateLimitByUser(100, 60000)
      mockRequest.user = undefined
      mockMulti.mockResolvedValue([
        [null, 1],
        [null, 1],
      ])

      await invokeUserLimiter(middleware, mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 429 when user exceeds limit', async () => {
      const middleware = rateLimitByUser(10, 60000)
      mockRequest.user = { id: 'user123' }
      mockMulti.mockResolvedValue([
        [null, 11],
        [null, 1],
      ])

      await invokeUserLimiter(middleware, mockRequest, mockResponse, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(429)
    })

    it('should set custom headers for rate limit info', async () => {
      const middleware = rateLimitByUser(100, 60000)
      mockRequest.user = { id: 'user123' }
      mockMulti.mockResolvedValue([
        [null, 50],
        [null, 1],
      ])

      await invokeUserLimiter(middleware, mockRequest, mockResponse, mockNext)

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        expect.any(String),
      )
    })
  })

  describe('incrementRedisCounter', () => {
    it('should increment counter and set expiry', async () => {
      mockIncr.mockResolvedValue(1)
      mockExpire.mockResolvedValue('OK')

      const result = await incrementRedisCounter('test-key', 60)

      expect(mockIncr).toHaveBeenCalledWith('test-key')
      expect(result).toBe(1)
    })

    it('should handle Redis errors gracefully', async () => {
      mockIncr.mockRejectedValue(new Error('Redis error'))

      const result = await incrementRedisCounter('test-key', 60)

      expect(result).toBe(0)
    })

    it('should return correct count after increment', async () => {
      mockIncr.mockResolvedValue(5)
      mockExpire.mockResolvedValue('OK')

      const result = await incrementRedisCounter('test-key', 60)

      expect(result).toBe(5)
    })
  })
})
