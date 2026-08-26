import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { RateLimiter } from './rate-limiter'

vi.mock('@upstash/redis', () => {
  const mockRedis = {
    zremrangebyscore: vi.fn(),
    zcard: vi.fn(),
    zrange: vi.fn(),
    zadd: vi.fn(),
    expire: vi.fn(),
  }
  return {
    Redis: vi.fn().mockImplementation(function () {
      return mockRedis
    }),
  }
})

describe('RateLimiter', () => {
  let originalUrl: string | undefined
  let originalToken: string | undefined

  beforeEach(() => {
    originalUrl = process.env['UPSTASH_REDIS_REST_URL']
    originalToken = process.env['UPSTASH_REDIS_REST_TOKEN']
    process.env['UPSTASH_REDIS_REST_URL'] = 'mock-url'
    process.env['UPSTASH_REDIS_REST_TOKEN'] = 'mock-token'
  })

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env['UPSTASH_REDIS_REST_URL']
    } else {
      process.env['UPSTASH_REDIS_REST_URL'] = originalUrl
    }
    if (originalToken === undefined) {
      delete process.env['UPSTASH_REDIS_REST_TOKEN']
    } else {
      process.env['UPSTASH_REDIS_REST_TOKEN'] = originalToken
    }
  })

  it('should allow requests within limit', async () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 10 })
    const redisInstance = (limiter as any).redis
    redisInstance.zremrangebyscore.mockResolvedValue(1)
    redisInstance.zcard.mockResolvedValue(0)
    redisInstance.zadd.mockResolvedValue(1)
    redisInstance.expire.mockResolvedValue(1)

    const result = await limiter.check('127.0.0.1')
    expect(result.success).toBe(true)
    expect(result.limit).toBe(10)
    expect(result.remaining).toBe(9)
  })

  it('should block requests when limit is exceeded', async () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 10 })
    const redisInstance = (limiter as any).redis
    redisInstance.zremrangebyscore.mockResolvedValue(1)
    redisInstance.zcard.mockResolvedValue(10)
    const oldestTime = Date.now() - 500
    redisInstance.zrange.mockResolvedValue(['member', oldestTime.toString()])

    const result = await limiter.check('127.0.0.1')
    expect(result.success).toBe(false)
    expect(result.limit).toBe(10)
    expect(result.remaining).toBe(0)
    expect(result.reset).toBe(oldestTime + 1000)
  })
})
