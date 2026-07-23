/* @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { LegacyRedisClient } from '../../redis'
import { DeveloperApiKeyManager } from '../developer-api-keys'
import { query, DbQueryResult } from '../index'

vi.mock('../index', () => ({
  query: vi.fn(),
}))

vi.mock('../../redis', () => {
  const mockRedis: LegacyRedisClient = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    setex: vi.fn().mockResolvedValue('OK'),
    expire: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn(),
    hset: vi.fn().mockResolvedValue(1),
    hget: vi.fn().mockResolvedValue(null),
    hgetall: vi.fn().mockResolvedValue({}),
    hdel: vi.fn().mockResolvedValue(1),
    hincrby: vi.fn().mockResolvedValue(1),
    hlen: vi.fn().mockResolvedValue(0),
    incr: vi.fn().mockResolvedValue(1),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    lpush: vi.fn().mockResolvedValue(1),
    lrange: vi.fn().mockResolvedValue([]),
    rpoplpush: vi.fn().mockResolvedValue(null),
    lrem: vi.fn().mockResolvedValue(1),
    llen: vi.fn().mockResolvedValue(0),
    keys: vi.fn().mockResolvedValue([]),
    zadd: vi.fn().mockResolvedValue(1),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    zcard: vi.fn().mockResolvedValue(5),
    pipeline: vi.fn(),
    multi: vi.fn(),
  }

  return {
    redis: mockRedis,
    getFromCache: vi.fn(),
    setInCache: vi.fn(),
    removeFromCache: vi.fn(),
    getRedisClient: vi.fn(),
    checkRedisConnection: vi.fn(),
    getRedisHealth: vi.fn(),
  }
})

// Suppress security event logging in tests
vi.mock('../../security', () => ({
  logSecurityEvent: vi.fn(),
  SecurityEventType: {
    AUTHENTICATION_SUCCESS: 'authentication_success',
    AUTHENTICATION_FAILED: 'authentication_failed',
    AUTHORIZATION_FAILED: 'authorization_failed',
  },
}))

type QueryResultRow = Record<string, unknown>

type MockQueryResult<TRow> = {
  rows: TRow[]
  rowCount: number
  command: string
  oid: number
  fields: unknown[]
}

const createMockQueryResult = (
  rows: unknown[],
  rowCount = rows.length,
): DbQueryResult<QueryResultRow> => ({
  rows: rows as unknown as QueryResultRow[],
  rowCount,
  command: 'SELECT',
  oid: 0,
  fields: [],
})

const sampleKey = {
  id: 'key-1',
  user_id: 'user-1',
  key_prefix: 'dev_abcde',
  name: 'Test Key',
  scopes: ['read', 'write'],
  rate_limit: 1000,
  is_active: true,
  last_used_at: null,
  last_failed_at: null,
  expires_at: null,
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-01-01'),
}

describe('DeveloperApiKeyManager — Admin Methods', () => {
  let manager: DeveloperApiKeyManager
  const mockQuery = vi.mocked(query)

  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockReset()
    manager = new DeveloperApiKeyManager()
  })

  describe('listAllApiKeys', () => {
    it('should list all keys without filters', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([sampleKey]))

      const keys = await manager.listAllApiKeys()
      expect(keys).toHaveLength(1)
      expect(keys[0].id).toBe('key-1')
      expect(keys[0].name).toBe('Test Key')
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })

    it('should filter by active only', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([sampleKey]))

      const keys = await manager.listAllApiKeys({ activeOnly: true })
      expect(keys).toHaveLength(1)
      const sql = mockQuery.mock.calls[0][0] as string
      expect(sql).toContain('is_active = true')
    })

    it('should filter by userId', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([sampleKey]))

      const keys = await manager.listAllApiKeys({ userId: 'user-1' })
      expect(keys).toHaveLength(1)
      const sql = mockQuery.mock.calls[0][0] as string
      expect(sql).toContain('user_id = $1')
    })

    it('should combine filters', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([sampleKey]))

      const keys = await manager.listAllApiKeys({
        activeOnly: true,
        userId: 'user-1',
      })
      expect(keys).toHaveLength(1)
      const sql = mockQuery.mock.calls[0][0] as string
      expect(sql).toContain('is_active = true')
      expect(sql).toContain('user_id = $1')
    })

    it('should return empty array when no keys', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([]))

      const keys = await manager.listAllApiKeys()
      expect(keys).toHaveLength(0)
    })

    it('should not return key_hash', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([sampleKey]))

      const keys = await manager.listAllApiKeys()
      expect(keys[0]).not.toHaveProperty('key_hash')
    })
  })

  describe('getApiKeyStats', () => {
    it('should return comprehensive stats', async () => {
      mockQuery
        .mockResolvedValueOnce(createMockQueryResult([{ count: 10 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ count: 7 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ count: 2 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ count: 1 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ avg: 850 }]))
        .mockResolvedValueOnce(
          createMockQueryResult([
            { scopes: ['read', 'write'] },
            { scopes: ['read', 'admin'] },
            { scopes: ['read'] },
          ]),
        )

      const stats = await manager.getApiKeyStats()
      expect(stats.totalKeys).toBe(10)
      expect(stats.activeKeys).toBe(7)
      expect(stats.inactiveKeys).toBe(3)
      expect(stats.expiredKeys).toBe(2)
      expect(stats.recentFailures).toBe(1)
      expect(stats.averageRateLimit).toBe(850)
      expect(stats.keysByScope).toEqual({
        read: 3,
        write: 1,
        admin: 1,
      })
    })

    it('should handle null average', async () => {
      mockQuery
        .mockResolvedValueOnce(createMockQueryResult([{ count: 0 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ count: 0 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ count: 0 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ count: 0 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ avg: null }]))
        .mockResolvedValueOnce(createMockQueryResult([]))

      const stats = await manager.getApiKeyStats()
      expect(stats.totalKeys).toBe(0)
      expect(stats.averageRateLimit).toBe(0)
      expect(Object.keys(stats.keysByScope)).toHaveLength(0)
    })

    it('should count scopes across active keys', async () => {
      mockQuery
        .mockResolvedValueOnce(createMockQueryResult([{ count: 3 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ count: 3 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ count: 0 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ count: 0 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ avg: 1000 }]))
        .mockResolvedValueOnce(
          createMockQueryResult([
            { scopes: ['memory:read', 'memory:write'] },
            { scopes: ['memory:read', 'developer:manage'] },
            { scopes: ['analytics:read', 'memory:read'] },
          ]),
        )

      const stats = await manager.getApiKeyStats()
      expect(stats.keysByScope['memory:read']).toBe(3)
      expect(stats.keysByScope['memory:write']).toBe(1)
      expect(stats.keysByScope['developer:manage']).toBe(1)
      expect(stats.keysByScope['analytics:read']).toBe(1)
    })
  })

  describe('getApiKeyUsage', () => {
    it('should return current usage from Redis', async () => {
      mockQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            id: 'key-1',
            rate_limit: 1000,
            last_used_at: new Date('2025-07-23T00:00:00Z'),
            last_failed_at: null,
          },
        ]),
      )

      const usage = await manager.getApiKeyUsage('key-1')
      expect(usage.apiKeyId).toBe('key-1')
      expect(usage.rateLimit).toBe(1000)
      expect(usage.currentWindowCount).toBe(5)
      expect(usage.remaining).toBe(995)
      expect(usage.lastUsedAt).toBeTruthy()
      expect(usage.lastFailedAt).toBeNull()
    })

    it('should throw when key not found', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([]))

      await expect(manager.getApiKeyUsage('nonexistent')).rejects.toThrow(
        'API key not found',
      )
    })

    it('should handle Redis errors gracefully', async () => {
      const { redis } = await import('../../redis')
      vi.mocked(redis.zremrangebyscore).mockRejectedValueOnce(
        new Error('Redis unavailable'),
      )

      mockQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            id: 'key-1',
            rate_limit: 500,
            last_used_at: null,
            last_failed_at: null,
          },
        ]),
      )

      const usage = await manager.getApiKeyUsage('key-1')
      expect(usage.currentWindowCount).toBe(0)
      expect(usage.remaining).toBe(500)
    })

    it('should use default rate limit if missing', async () => {
      mockQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            id: 'key-1',
            rate_limit: null,
            last_used_at: null,
            last_failed_at: null,
          },
        ]),
      )

      const usage = await manager.getApiKeyUsage('key-1')
      expect(usage.rateLimit).toBe(1000)
    })
  })
})
