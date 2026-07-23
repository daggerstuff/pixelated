import { describe, it, expect, beforeEach, vi } from 'vitest'

// Use vi.hoisted for mock objects referenced in vi.mock factories
const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    zremrangebyscore: vi.fn(),
    zcard: vi.fn(),
    zadd: vi.fn(),
    incr: vi.fn(),
    setex: vi.fn(),
    get: vi.fn(),
  },
}))

// Mock crypto (jsdom doesn't support node:crypto)
vi.mock('crypto', () => ({
  randomBytes: (n: number) => ({
    toString: () => 'mock'.repeat(n),
  }),
  default: {
    randomBytes: (n: number) => ({
      toString: () => 'mock'.repeat(n),
    }),
  },
}))

vi.mock('../../redis', () => ({
  redis: mockRedis,
}))

vi.mock('../../logging/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { RateLimitService } from '../RateLimitService'
import { resetRateLimitService } from '../RateLimitService'
import { API_TIERS, inferTierFromRateLimit, DEFAULT_TIER } from '../types'
import type { ApiTier } from '../types'
import { createRateLimitResponse, setRateLimitHeaders } from '../middleware'

const freeTier = API_TIERS.free
const devTier = API_TIERS.developer
const proTier = API_TIERS.professional
const entTier = API_TIERS.enterprise

describe('types', () => {
  it('should have 4 tiers', () => {
    expect(Object.keys(API_TIERS)).toHaveLength(4)
    expect(API_TIERS.free).toBeDefined()
    expect(API_TIERS.developer).toBeDefined()
    expect(API_TIERS.professional).toBeDefined()
    expect(API_TIERS.enterprise).toBeDefined()
  })

  it('should have increasing limits per tier', () => {
    expect(freeTier.requestsPerMinute).toBeLessThan(devTier.requestsPerMinute)
    expect(devTier.requestsPerMinute).toBeLessThan(proTier.requestsPerMinute)
    expect(proTier.requestsPerMinute).toBeLessThan(entTier.requestsPerMinute)
    expect(freeTier.dailyQuota).toBeLessThan(devTier.dailyQuota)
    expect(freeTier.monthlyQuota).toBeLessThan(devTier.monthlyQuota)
  })

  it('should infer tier from rate limit value', () => {
    expect(inferTierFromRateLimit(60)).toBe('free')
    expect(inferTierFromRateLimit(200)).toBe('developer')
    expect(inferTierFromRateLimit(1000)).toBe('professional')
    expect(inferTierFromRateLimit(5000)).toBe('enterprise')
    expect(inferTierFromRateLimit(0)).toBe('free')
    expect(inferTierFromRateLimit(99999)).toBe('enterprise')
  })

  it('should have developer as default tier', () => {
    expect(DEFAULT_TIER).toBe('developer')
  })

  it('should have burstAllowance on each tier', () => {
    expect(freeTier.burstAllowance).toBe(10)
    expect(devTier.burstAllowance).toBe(25)
    expect(proTier.burstAllowance).toBe(50)
    expect(entTier.burstAllowance).toBe(100)
  })
})

describe('RateLimitService', () => {
  let service: RateLimitService

  beforeEach(() => {
    vi.clearAllMocks()
    resetRateLimitService()
    service = new RateLimitService()
  })

  describe('checkRateLimit', () => {
    it('should allow when under limit', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(undefined)
      mockRedis.zcard.mockResolvedValue(10)
      mockRedis.zadd.mockResolvedValue(1)

      const result = await service.checkRateLimit('key-1', devTier)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(189)
      expect(result.limit).toBe(200)
      expect(result.retryAfterSeconds).toBe(0)
    })

    it('should block when at limit', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(undefined)
      mockRedis.zcard.mockResolvedValue(200)
      mockRedis.zadd.mockResolvedValue(1)

      const result = await service.checkRateLimit('key-1', devTier)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfterSeconds).toBeGreaterThan(0)
    })

    it('should fail open on Redis error', async () => {
      mockRedis.zremrangebyscore.mockRejectedValue(new Error('Redis down'))

      const result = await service.checkRateLimit('key-1', devTier)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(200)
    })
  })

  describe('checkQuota', () => {
    it('should allow and increment daily quota', async () => {
      mockRedis.incr.mockResolvedValue(5)
      mockRedis.setex.mockResolvedValue('OK')

      const result = await service.checkQuota('key-1', devTier, 'daily')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4995)
      expect(result.limit).toBe(5000)
      expect(result.period).toBe('daily')
    })

    it('should set TTL on first use (count === 1)', async () => {
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.setex.mockResolvedValue('OK')

      await service.checkQuota('key-1', devTier, 'daily')

      expect(mockRedis.setex).toHaveBeenCalled()
    })

    it('should not set TTL on subsequent use', async () => {
      mockRedis.incr.mockResolvedValue(5)
      mockRedis.setex.mockResolvedValue('OK')

      await service.checkQuota('key-1', devTier, 'daily')

      expect(mockRedis.setex).not.toHaveBeenCalled()
    })

    it('should block when quota exceeded', async () => {
      mockRedis.incr.mockResolvedValue(5001)

      const result = await service.checkQuota('key-1', devTier, 'daily')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfterSeconds).toBeGreaterThan(0)
    })

    it('should block when monthly quota exceeded', async () => {
      mockRedis.incr.mockResolvedValue(50001)

      const result = await service.checkQuota('key-1', devTier, 'monthly')

      expect(result.allowed).toBe(false)
      expect(result.limit).toBe(50000)
    })

    it('should fail open on Redis error', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis down'))

      const result = await service.checkQuota('key-1', devTier, 'daily')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(5000)
    })
  })

  describe('check (combined)', () => {
    it('should allow when rate limit and quotas pass', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(undefined)
      mockRedis.zcard.mockResolvedValue(10)
      mockRedis.zadd.mockResolvedValue(1)
      mockRedis.incr.mockResolvedValue(5)
      mockRedis.setex.mockResolvedValue('OK')
      mockRedis.get.mockResolvedValue('5')

      const result = await service.check('key-1', devTier)

      expect(result.allowed).toBe(true)
      expect(result.tier.name).toBe('developer')
    })

    it('should block when rate limit fails (no quota consumed)', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(undefined)
      mockRedis.zcard.mockResolvedValue(200)

      const result = await service.check('key-1', devTier)

      expect(result.allowed).toBe(false)
      expect(result.rateLimit.allowed).toBe(false)
      // Quota should NOT have been incremented
      expect(mockRedis.incr).not.toHaveBeenCalled()
    })

    it('should block when daily quota fails', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(undefined)
      mockRedis.zcard.mockResolvedValue(10)
      mockRedis.zadd.mockResolvedValue(1)
      mockRedis.incr.mockResolvedValueOnce(5001)
      mockRedis.get.mockResolvedValue('0')

      const result = await service.check('key-1', devTier)

      expect(result.allowed).toBe(false)
      expect(result.dailyQuota.allowed).toBe(false)
    })

    it('should block when monthly quota fails', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(undefined)
      mockRedis.zcard.mockResolvedValue(10)
      mockRedis.zadd.mockResolvedValue(1)
      mockRedis.incr
        .mockResolvedValueOnce(5) // daily
        .mockResolvedValueOnce(50001) // monthly
      mockRedis.setex.mockResolvedValue('OK')
      mockRedis.get.mockResolvedValue('5')

      const result = await service.check('key-1', devTier)

      expect(result.allowed).toBe(false)
      expect(result.monthlyQuota.allowed).toBe(false)
    })
  })

  describe('getQuotaStatus', () => {
    it('should return read-only quota without incrementing', async () => {
      mockRedis.get.mockResolvedValue('100')

      const result = await service.getQuotaStatus('key-1', devTier, 'daily')

      expect(result.remaining).toBe(4900)
      expect(result.limit).toBe(5000)
      expect(mockRedis.incr).not.toHaveBeenCalled()
    })

    it('should handle zero usage', async () => {
      mockRedis.get.mockResolvedValue(null)

      const result = await service.getQuotaStatus('key-1', devTier, 'daily')

      expect(result.remaining).toBe(5000)
      expect(result.allowed).toBe(true)
    })

    it('should fail open on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'))

      const result = await service.getQuotaStatus('key-1', devTier, 'daily')

      expect(result.allowed).toBe(true)
    })
  })

  describe('getUsage', () => {
    it('should return full usage snapshot', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(undefined)
      mockRedis.zcard.mockResolvedValue(50)
      mockRedis.get
        .mockResolvedValueOnce('100') // daily
        .mockResolvedValueOnce('500') // monthly

      const usage = await service.getUsage('key-1', devTier)

      expect(usage.apiKeyId).toBe('key-1')
      expect(usage.tier.name).toBe('developer')
      expect(usage.rateLimit.currentWindowCount).toBe(50)
      expect(usage.rateLimit.limit).toBe(200)
      expect(usage.dailyQuota.remaining).toBe(4900)
      expect(usage.monthlyQuota.remaining).toBe(49500)
      expect(usage.lastChecked).toBeTruthy()
    })

    it('should set alertThresholdExceeded when near rate limit', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(undefined)
      mockRedis.zcard.mockResolvedValue(185) // 185/200 = 92.5% > 90%
      mockRedis.get.mockResolvedValue('0')

      const usage = await service.getUsage('key-1', devTier)

      expect(usage.alertThresholdExceeded).toBe(true)
    })

    it('should set alertThresholdExceeded when near daily quota', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(undefined)
      mockRedis.zcard.mockResolvedValue(0)
      mockRedis.get.mockResolvedValueOnce('4200') // 4200/5000 = 84% > 80%
      mockRedis.get.mockResolvedValueOnce('0')

      const usage = await service.getUsage('key-1', devTier)

      expect(usage.alertThresholdExceeded).toBe(true)
    })

    it('should not set alert when usage is low', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(undefined)
      mockRedis.zcard.mockResolvedValue(10)
      mockRedis.get.mockResolvedValue('10')

      const usage = await service.getUsage('key-1', devTier)

      expect(usage.alertThresholdExceeded).toBe(false)
    })
  })

  describe('createAlert', () => {
    it('should create rate limit alert', () => {
      const alert = service.createAlert(
        'key-1',
        'rate_limit',
        devTier,
        180,
        200,
      )

      expect(alert.alertId).toContain('key-1')
      expect(alert.type).toBe('rate_limit')
      expect(alert.currentUsage).toBe(180)
      expect(alert.limit).toBe(200)
      expect(alert.message).toContain('rate limit')
    })

    it('should create daily quota alert', () => {
      const alert = service.createAlert(
        'key-1',
        'daily_quota',
        devTier,
        4500,
        5000,
      )

      expect(alert.type).toBe('daily_quota')
      expect(alert.currentUsage).toBe(4500)
      expect(alert.limit).toBe(5000)
    })

    it('should create monthly quota alert', () => {
      const alert = service.createAlert(
        'key-1',
        'monthly_quota',
        devTier,
        45000,
        50000,
      )

      expect(alert.type).toBe('monthly_quota')
      expect(alert.limit).toBe(50000)
    })
  })

  describe('tier helpers', () => {
    it('should get tier by name', () => {
      expect(service.getTier('free').name).toBe('free')
      expect(service.getTier('enterprise').name).toBe('enterprise')
    })

    it('should get default tier', () => {
      expect(service.getDefaultTier().name).toBe('developer')
    })

    it('should infer tier from rate limit', () => {
      expect(service.getTierForRateLimit(60).name).toBe('free')
      expect(service.getTierForRateLimit(200).name).toBe('developer')
      expect(service.getTierForRateLimit(1000).name).toBe('professional')
      expect(service.getTierForRateLimit(5000).name).toBe('enterprise')
    })
  })
})

describe('middleware', () => {
  const mockResult = {
    allowed: true,
    rateLimit: {
      allowed: true,
      remaining: 100,
      limit: 200,
      resetTimeMs: Date.now() + 60000,
      retryAfterSeconds: 0,
    },
    dailyQuota: {
      allowed: true,
      remaining: 4000,
      limit: 5000,
      period: 'daily' as const,
      resetTimeMs: Date.now() + 86400000,
      retryAfterSeconds: 0,
    },
    monthlyQuota: {
      allowed: true,
      remaining: 40000,
      limit: 50000,
      period: 'monthly' as const,
      resetTimeMs: Date.now() + 2592000000,
      retryAfterSeconds: 0,
    },
    tier: devTier,
  }

  it('setRateLimitHeaders should set all rate limit headers', () => {
    const response = new Response('{}', {
      headers: { 'Content-Type': 'application/json' },
    })
    const updated = setRateLimitHeaders(response, mockResult)

    expect(updated.headers.get('X-RateLimit-Limit')).toBe('200')
    expect(updated.headers.get('X-RateLimit-Remaining')).toBe('100')
    expect(updated.headers.get('X-RateLimit-Daily-Remaining')).toBe('4000')
    expect(updated.headers.get('X-RateLimit-Monthly-Remaining')).toBe('40000')
  })

  it('createRateLimitResponse should create 429 with Retry-After', () => {
    const blockedResult = {
      ...mockResult,
      allowed: false,
      rateLimit: {
        allowed: false,
        remaining: 0,
        limit: 200,
        resetTimeMs: Date.now() + 30000,
        retryAfterSeconds: 30,
      },
    }
    const response = createRateLimitResponse(blockedResult)

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('30')
    expect(response.headers.get('X-RateLimit-Limit')).toBe('200')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Content-Type')).toBe('application/json')
  })

  it('createRateLimitResponse should identify daily quota exceeded', () => {
    const blockedResult = {
      ...mockResult,
      allowed: false,
      rateLimit: {
        allowed: true,
        remaining: 100,
        limit: 200,
        resetTimeMs: Date.now() + 30000,
        retryAfterSeconds: 0,
      },
      dailyQuota: {
        allowed: false,
        remaining: 0,
        limit: 5000,
        period: 'daily' as const,
        resetTimeMs: Date.now() + 86400000,
        retryAfterSeconds: 86400,
      },
    }
    const response = createRateLimitResponse(blockedResult)

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('86400')
  })

  it('createRateLimitResponse should identify monthly quota exceeded', () => {
    const blockedResult = {
      ...mockResult,
      allowed: false,
      rateLimit: {
        allowed: true,
        remaining: 100,
        limit: 200,
        resetTimeMs: Date.now() + 30000,
        retryAfterSeconds: 0,
      },
      dailyQuota: {
        allowed: true,
        remaining: 4000,
        limit: 5000,
        period: 'daily' as const,
        resetTimeMs: Date.now() + 86400000,
        retryAfterSeconds: 0,
      },
      monthlyQuota: {
        allowed: false,
        remaining: 0,
        limit: 50000,
        period: 'monthly' as const,
        resetTimeMs: Date.now() + 2592000000,
        retryAfterSeconds: 2592000,
      },
    }
    const response = createRateLimitResponse(blockedResult)

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('2592000')
  })
})

import {
  getRateLimitService as _getRateLimitService,
  resetRateLimitService as _resetRateLimitService,
} from '../RateLimitService'

describe('singleton', () => {
  beforeEach(() => {
    _resetRateLimitService()
  })

  it('should return same instance', () => {
    const s1 = _getRateLimitService()
    const s2 = _getRateLimitService()
    expect(s1).toBe(s2)
  })

  it('should reset on resetRateLimitService', () => {
    const s1 = _getRateLimitService()
    _resetRateLimitService()
    const s2 = _getRateLimitService()
    expect(s1).not.toBe(s2)
  })
})
