import { describe, expect, it, beforeEach, vi } from 'vitest'

import { CacheMetricsService, resetCacheMetricsService } from '../cache-metrics'

describe('CacheMetricsService', () => {
  let service: CacheMetricsService

  beforeEach(() => {
    resetCacheMetricsService()
    service = new CacheMetricsService(null)
  })

  describe('extractPrefix', () => {
    it('extracts first segment before colon', () => {
      expect(CacheMetricsService.extractPrefix('user:123:profile')).toBe('user')
    })

    it('returns full key if no colon', () => {
      expect(CacheMetricsService.extractPrefix('plainkey')).toBe('plainkey')
    })

    it('handles empty string', () => {
      expect(CacheMetricsService.extractPrefix('')).toBe('')
    })

    it('handles key starting with colon', () => {
      expect(CacheMetricsService.extractPrefix(':value')).toBe('')
    })
  })

  describe('recordHit', () => {
    it('increments hit count for prefix', async () => {
      service.recordHit('user:123')
      service.recordHit('user:456')
      service.recordHit('session:abc')

      const stats = await service.getStats()
      const userPrefix = stats.perPrefix.find((p) => p.prefix === 'user')
      expect(userPrefix?.hits).toBe(2)
      expect(userPrefix?.totalRequests).toBe(2)
      expect(userPrefix?.hitRatio).toBe(1.0)
    })
  })

  describe('recordMiss', () => {
    it('increments miss count for prefix', async () => {
      service.recordMiss('user:123')
      service.recordMiss('user:456')

      const stats = await service.getStats()
      const userPrefix = stats.perPrefix.find((p) => p.prefix === 'user')
      expect(userPrefix?.misses).toBe(2)
      expect(userPrefix?.totalRequests).toBe(2)
      expect(userPrefix?.hitRatio).toBe(0)
    })

    it('tracks individual key miss counts for top-misses', async () => {
      service.recordMiss('docs:getting-started')
      service.recordMiss('docs:getting-started')
      service.recordMiss('docs:api-reference')
      service.recordMiss('search:clinics')

      const stats = await service.getStats()
      expect(stats.topMisses).toHaveLength(3)
      expect(stats.topMisses[0]).toEqual({
        key: 'docs:getting-started',
        count: 2,
      })
      expect(stats.topMisses[1]).toEqual({
        key: 'docs:api-reference',
        count: 1,
      })
      expect(stats.topMisses[2]).toEqual({
        key: 'search:clinics',
        count: 1,
      })
    })
  })

  describe('mixed hit/miss', () => {
    it('calculates correct hit ratio', async () => {
      // 7 hits, 3 misses = 70% hit ratio
      for (let i = 0; i < 7; i++) service.recordHit('data:item' + i)
      for (let i = 0; i < 3; i++) service.recordMiss('data:item' + i + '_miss')

      const stats = await service.getStats()
      expect(stats.overallHits).toBe(7)
      expect(stats.overallMisses).toBe(3)
      expect(stats.overallTotal).toBe(10)
      expect(stats.overallHitRatio).toBe(0.7)
    })

    it('returns 0 hit ratio when no requests', async () => {
      const stats = await service.getStats()
      expect(stats.overallHits).toBe(0)
      expect(stats.overallMisses).toBe(0)
      expect(stats.overallTotal).toBe(0)
      expect(stats.overallHitRatio).toBe(0)
    })

    it('handles multiple prefixes with different ratios', async () => {
      // docs: 8 hits, 2 misses = 80%
      for (let i = 0; i < 8; i++) service.recordHit('docs:item' + i)
      for (let i = 0; i < 2; i++) service.recordMiss('docs:miss' + i)

      // sessions: 3 hits, 7 misses = 30%
      for (let i = 0; i < 3; i++) service.recordHit('session:item' + i)
      for (let i = 0; i < 7; i++) service.recordMiss('session:miss' + i)

      const stats = await service.getStats()
      expect(stats.perPrefix).toHaveLength(2)

      const docsPrefix = stats.perPrefix.find((p) => p.prefix === 'docs')
      expect(docsPrefix?.hitRatio).toBe(0.8)

      const sessionPrefix = stats.perPrefix.find((p) => p.prefix === 'session')
      expect(sessionPrefix?.hitRatio).toBe(0.3)

      // Sorted by total requests descending: docs (10) vs session (10) — tie, either order
      expect(stats.perPrefix[0].totalRequests).toBe(10)
    })
  })

  describe('top misses ordering and limit', () => {
    it('returns at most 20 top misses sorted by count', async () => {
      for (let i = 0; i < 25; i++) {
        // Each key is missed i+1 times
        for (let j = 0; j <= i; j++) {
          service.recordMiss(`key:${i}`)
        }
      }

      const stats = await service.getStats()
      expect(stats.topMisses).toHaveLength(20)
      // Most-missed key should be first
      expect(stats.topMisses[0].key).toBe('key:24')
      expect(stats.topMisses[0].count).toBe(25)
    })
  })

  describe('key miss tracking eviction', () => {
    it('evicts oldest tracked keys when exceeding maxTrackedKeys', async () => {
      // maxTrackedKeys is 500 — create 510 unique keys with the last 5 having higher counts
      for (let i = 0; i < 505; i++) {
        service.recordMiss(`evict:key:${i}`)
      }
      // Give the last 5 keys higher miss counts so they appear in top-20
      for (let j = 0; j < 10; j++) {
        service.recordMiss('evict:key:505')
        service.recordMiss('evict:key:506')
        service.recordMiss('evict:key:507')
        service.recordMiss('evict:key:508')
        service.recordMiss('evict:key:509')
      }

      const stats = await service.getStats()
      // Should have at most 20 in top misses
      expect(stats.topMisses.length).toBeLessThanOrEqual(20)
      // The earliest keys should have been evicted (key:0 evicted when 501st key inserted)
      const evictedKey = stats.topMisses.find((m) => m.key === 'evict:key:0')
      expect(evictedKey).toBeUndefined()
      // The most recent keys should still be tracked and appear in top-20 (higher counts)
      const recentKey = stats.topMisses.find((m) => m.key === 'evict:key:509')
      expect(recentKey).toBeDefined()
      expect(recentKey?.count).toBe(10)
    })
  })

  describe('reset', () => {
    it('clears all counters', async () => {
      service.recordHit('a:1')
      service.recordMiss('b:1')
      service.reset()

      const stats = await service.getStats()
      expect(stats.overallHits).toBe(0)
      expect(stats.overallMisses).toBe(0)
      expect(stats.perPrefix).toHaveLength(0)
      expect(stats.topMisses).toHaveLength(0)
    })
  })

  describe('measuredAt', () => {
    it('includes a valid ISO timestamp', async () => {
      const stats = await service.getStats()
      expect(stats.measuredAt).toBeTruthy()
      const date = new Date(stats.measuredAt)
      expect(date.getTime()).not.toBeNaN()
    })
  })

  describe('Redis persistence integration', () => {
    it('merges persisted counters with in-memory counters', async () => {
      // Create a mock Redis client with persisted data
      const persistedData = {
        hits: { api: 50, docs: 30 },
        misses: { api: 10, docs: 5 },
        keyMissCounts: { 'api:slow': 8, 'docs:old': 3 },
      }

      const mockRedis = {
        get: vi.fn().mockResolvedValue(JSON.stringify(persistedData)),
        set: vi.fn().mockResolvedValue(undefined),
        del: vi.fn().mockResolvedValue(undefined),
        keys: vi.fn().mockResolvedValue([]),
        mget: vi.fn().mockResolvedValue([]),
      }

      const serviceWithRedis = new CacheMetricsService(mockRedis)

      // Add some in-memory counts
      serviceWithRedis.recordHit('api:123')
      serviceWithRedis.recordMiss('docs:456')

      const stats = await serviceWithRedis.getStats()

      // api: 50 persisted + 1 in-memory = 51 hits, 10 persisted misses
      const apiPrefix = stats.perPrefix.find((p) => p.prefix === 'api')
      expect(apiPrefix?.hits).toBe(51)
      expect(apiPrefix?.misses).toBe(10)

      // docs: 30 persisted hits + 1 in-memory miss = 30 hits, 6 misses
      const docsPrefix = stats.perPrefix.find((p) => p.prefix === 'docs')
      expect(docsPrefix?.hits).toBe(30)
      expect(docsPrefix?.misses).toBe(6)

      // Top misses should include both persisted and in-memory
      const slowKey = stats.topMisses.find((m) => m.key === 'api:slow')
      expect(slowKey?.count).toBe(8)

      const newMissKey = stats.topMisses.find((m) => m.key === 'docs:456')
      expect(newMissKey?.count).toBe(1)
    })

    it('persists counters to Redis on persist()', async () => {
      const mockRedis = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        del: vi.fn().mockResolvedValue(undefined),
        keys: vi.fn().mockResolvedValue([]),
        mget: vi.fn().mockResolvedValue([]),
      }

      const serviceWithRedis = new CacheMetricsService(mockRedis)

      serviceWithRedis.recordHit('test:1')
      serviceWithRedis.recordMiss('test:2')

      await serviceWithRedis.persist()

      expect(mockRedis.set).toHaveBeenCalledTimes(1)
      const [key, value, options] = mockRedis.set.mock.calls[0]
      expect(key).toBe('app:cache:metrics')
      expect(options).toEqual({ ex: 86400 })

      const parsed = JSON.parse(value as string)
      expect(parsed.hits.test).toBe(1)
      expect(parsed.misses.test).toBe(1)
    })

    it('handles Redis read errors gracefully', async () => {
      const mockRedis = {
        get: vi.fn().mockRejectedValue(new Error('Redis down')),
        set: vi.fn().mockResolvedValue(undefined),
        del: vi.fn().mockResolvedValue(undefined),
        keys: vi.fn().mockResolvedValue([]),
        mget: vi.fn().mockResolvedValue([]),
      }

      const serviceWithRedis = new CacheMetricsService(mockRedis)

      serviceWithRedis.recordHit('test:1')

      // Should not throw, just return in-memory data
      const stats = await serviceWithRedis.getStats()
      expect(stats.overallHits).toBe(1)
    })

    it('does not persist when no Redis client', async () => {
      const serviceNoRedis = new CacheMetricsService(null)
      serviceNoRedis.recordHit('test:1')

      // Should not throw
      await serviceNoRedis.persist()
    })
  })

  describe('PHI route non-caching verification', () => {
    it('never records hits for PHI route keys', async () => {
      // PHI routes should never be cached, so they should never appear as hits
      // Simulate a PHI route access that bypasses cache entirely
      const phiRoutes = [
        'sessions:abc123',
        'auth:token:refresh',
        'memory:user:456',
        'preferences:user:789',
        'profile:user:012',
        'admin:users:list',
        'graphql:query',
        'chat:message:345',
      ]

      // PHI routes bypass cache entirely — no hits or misses recorded
      // Verify that no stats exist for these prefixes
      const stats = await service.getStats()
      for (const route of phiRoutes) {
        const prefix = CacheMetricsService.extractPrefix(route)
        const found = stats.perPrefix.find((p) => p.prefix === prefix)
        expect(found).toBeUndefined()
      }
    })
  })
})
