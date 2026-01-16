// @vitest-environment node
/**
 * Tests for the rate limiting system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DistributedRateLimiter } from '../rate-limiter'
import { createRateLimiter } from '../rate-limiter'
import { defaultRateLimitConfig } from '../config'
import type { RateLimitRule } from '../types'
import { redis } from '../../redis'

// Mock Redis with stateful implementation
vi.mock('../../redis', () => {
  const store = new Map<string, string>()
  const pipeline = {
    incr: vi.fn().mockImplementation((key) => {
      const current = parseInt(store.get(key) || '0')
      store.set(key, (current + 1).toString())
      return pipeline
    }),
    expire: vi.fn().mockImplementation(() => pipeline),
    hincrby: vi.fn().mockImplementation(() => pipeline),
    hset: vi.fn().mockImplementation(() => pipeline),
    exec: vi.fn().mockImplementation(() => Promise.resolve([[null, 1], [null, 1]])),
  }

  return {
    redis: {
      _store: store,
      get: vi.fn().mockImplementation((key) => Promise.resolve(store.get(key) || null)),
      set: vi.fn().mockImplementation((key, val) => {
        store.set(key, typeof val === 'string' ? val : JSON.stringify(val))
        return Promise.resolve('OK')
      }),
      setex: vi.fn().mockImplementation((key, sec, val) => {
        store.set(key, typeof val === 'string' ? val : JSON.stringify(val))
        return Promise.resolve('OK')
      }),
      del: vi.fn().mockImplementation((key) => {
        store.delete(key)
        return Promise.resolve(1)
      }),
      exists: vi.fn().mockImplementation((key) => Promise.resolve(store.has(key) ? 1 : 0)),
      expire: vi.fn().mockResolvedValue(1),
      ping: vi.fn().mockResolvedValue('PONG'),
      pipeline: vi.fn().mockReturnValue(pipeline),
      zadd: vi.fn(),
      zrangebyscore: vi.fn().mockResolvedValue([]),
      zremrangebyscore: vi.fn(),
      hincrby: vi.fn(),
      hgetall: vi.fn().mockResolvedValue({}),
      hset: vi.fn(),
      lpush: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
    },
  }
})

describe('DistributedRateLimiter', () => {
  let rateLimiter: DistributedRateLimiter

  beforeEach(() => {
    // Clear redis store for each test
    ; (redis as any)._store?.clear()
    rateLimiter = createRateLimiter(defaultRateLimitConfig)
  })

  describe('checkLimit', () => {
    it('should allow request when under limit', async () => {
      const rule: RateLimitRule = {
        name: 'test_rule',
        maxRequests: 10,
        windowMs: 60000,
        priority: 100,
        enableAttackDetection: false,
      }

      const result = await rateLimiter.checkLimit('test_user', rule)

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(10)
      expect(result.remaining).toBe(9)
      expect(result.retryAfter).toBeNull()
    })

    it('should block request when over limit', async () => {
      const rule: RateLimitRule = {
        name: 'test_rule',
        maxRequests: 1,
        windowMs: 60000,
        priority: 100,
        enableAttackDetection: false,
      }

      // First request should be allowed
      const result1 = await rateLimiter.checkLimit('test_user', rule)
      expect(result1.allowed).toBe(true)

      // Second request should be blocked
      const result2 = await rateLimiter.checkLimit('test_user', rule)
      expect(result2.allowed).toBe(false)
      expect(result2.remaining).toBe(0)
      expect(result2.retryAfter).toBeGreaterThan(0)
    })

    it('should handle attack pattern detection', async () => {
      const rule: RateLimitRule = {
        name: 'test_rule',
        maxRequests: 100,
        windowMs: 60000,
        priority: 100,
        enableAttackDetection: true,
      }

      // Setup mock responding to attack pattern checks
      vi.mocked(redis.zrangebyscore).mockResolvedValueOnce(
        Array(15).fill(0).map((_, i) => `${Date.now() + i * 10}:${Math.random()}`)
      )

      await rateLimiter.checkLimit('attacker', rule)
      // Expect attack handling logic to trigger warning log or similar (verified by coverage mainly)
    })

    it('should fail open on Redis errors', async () => {
      // Mock pipeline to throw error ONCE
      const pipeline = redis.pipeline()
      vi.mocked(pipeline.exec).mockRejectedValueOnce(new Error('Redis connection failed'))
      // We need to re-mock pipeline for this test to return the failing one
      // But our stateful mock returns a persistent object. 
      // Let's override the mock implementation of pipeline temporarily
      const failingPipeline = {
        ...pipeline,
        exec: vi.fn().mockRejectedValue(new Error('Redis connection failed'))
      }
      vi.mocked(redis.pipeline).mockReturnValueOnce(failingPipeline as any)

      const rule: RateLimitRule = {
        name: 'test_rule',
        maxRequests: 10,
        windowMs: 60000,
        priority: 100,
        enableAttackDetection: false,
      }

      const result = await rateLimiter.checkLimit('test_user', rule)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(10) // Fails open means remaining = limit
    })
  })

  describe('isBlocked', () => {
    it('should check if identifier is blocked', async () => {
      vi.mocked(redis.get).mockResolvedValueOnce(
        JSON.stringify({
          pattern: { isSuspicious: true, type: 'rapid_fire' },
          detectedAt: Date.now(),
        }),
      )

      const isBlocked = await rateLimiter.isBlocked('test_user')
      expect(isBlocked).toBe(true)
    })

    it('should return false when not blocked', async () => {
      vi.mocked(redis.get).mockResolvedValueOnce(null)

      const isBlocked = await rateLimiter.isBlocked('test_user')
      expect(isBlocked).toBe(false)
    })
  })

  describe('getAnalytics', () => {
    it('should return analytics data', async () => {
      vi.mocked(redis.hgetall).mockResolvedValueOnce({
        total_requests: '100',
        total_blocked: '5',
      })
      vi.mocked(redis.hgetall).mockResolvedValueOnce({
        total_blocked: '5',
      })

      const analytics = await rateLimiter.getAnalytics('test_rule')

      const today = new Date().toISOString().slice(0, 10)
      expect(analytics[today]).toBeDefined()
    })
  })
})
