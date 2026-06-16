import { describe, it, expect, vi } from 'vitest'
import { RateLimiter } from './rate-limiter'

vi.mock('@upstash/redis', () => {
  return {
    Redis: vi.fn().mockImplementation(() => ({
      zremrangebyscore: vi.fn().mockResolvedValue(1),
      zcard: vi.fn().mockResolvedValue(0),
      zrange: vi.fn().mockResolvedValue([]),
      zadd: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    })),
  }
})

describe('RateLimiter', () => {
  it('should allow requests within limit', async () => {
    process.env['UPSTASH_REDIS_REST_URL'] = 'mock-url'
    process.env['UPSTASH_REDIS_REST_TOKEN'] = 'mock-token'
    const limiter = new RateLimiter({ windowMs: 1000, max: 10 })
    const result = await limiter.check('127.0.0.1')
    expect(result.success).toBe(true)
    expect(result.limit).toBe(10)
    expect(result.remaining).toBe(9)
  })
})
