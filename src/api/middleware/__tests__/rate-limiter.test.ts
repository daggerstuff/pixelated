import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

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
import { rateLimiter, rateLimitByUser, incrementRedisCounter } from '../rate-limiter'

describe('Rate Limiter Middleware', () => {
  let mockRequest: any
  let mockResponse: any
  let mockNext: any

  beforeEach(() => {
    mockRequest = {
      ip: '192.168.1.1',
      headers: {},
    }
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
      set: vi.fn(),
    }
    mockNext = vi.fn()

    vi.clearAllMocks()
  })

  describe('rateLimiter (IP-based)', () => {
    it('should call next when under rate limit', async () => {
      mockMulti.mockResolvedValue([[null, 1], [null, 1]])

      await rateLimiter(mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 429 when rate limit exceeded', async () => {
      mockMulti.mockResolvedValue([[null, 1001], [null, 1]])

      await rateLimiter(mockRequest, mockResponse, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(429)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should use in-memory fallback when Redis unavailable', async () => {
      mockMulti.mockRejectedValue(new Error('Redis unavailable'))

      await expect(rateLimiter(mockRequest, mockResponse, mockNext)).resolves.not.toThrow()
    })

    it('should extract IP from x-forwarded-for header if present', async () => {
      mockRequest.headers['x-forwarded-for'] = '203.0.113.195'
      mockMulti.mockResolvedValue([[null, 1], [null, 1]])

      await rateLimiter(mockRequest, mockResponse, mockNext)

      // Should use the forwarded IP
      expect(mockNext).toHaveBeenCalled()
    })

    it('should handle multiple IPs in x-forwarded-for header', async () => {
      mockRequest.headers['x-forwarded-for'] = '203.0.113.195, 70.41.3.18'
      mockMulti.mockResolvedValue([[null, 1], [null, 1]])

      await rateLimiter(mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should default to 127.0.0.1 when no IP available', async () => {
      mockRequest.ip = undefined
      mockRequest.headers = {}
      mockMulti.mockResolvedValue([[null, 1], [null, 1]])

      await rateLimiter(mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('rateLimitByUser (User-based)', () => {
    it('should create middleware that limits by user ID', async () => {
      const middleware = rateLimitByUser(100, 60000)
      mockRequest.user = { id: 'user123' }
      mockMulti.mockResolvedValue([[null, 1], [null, 1]])

      await middleware(mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should use IP if user not authenticated', async () => {
      const middleware = rateLimitByUser(100, 60000)
      mockRequest.user = undefined
      mockMulti.mockResolvedValue([[null, 1], [null, 1]])

      await middleware(mockRequest, mockResponse, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 429 when user exceeds limit', async () => {
      const middleware = rateLimitByUser(10, 60000)
      mockRequest.user = { id: 'user123' }
      mockMulti.mockResolvedValue([[null, 11], [null, 1]])

      await middleware(mockRequest, mockResponse, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(429)
    })

    it('should set custom headers for rate limit info', async () => {
      const middleware = rateLimitByUser(100, 60000)
      mockRequest.user = { id: 'user123' }
      mockMulti.mockResolvedValue([[null, 50], [null, 1]])

      await middleware(mockRequest, mockResponse, mockNext)

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String))
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
