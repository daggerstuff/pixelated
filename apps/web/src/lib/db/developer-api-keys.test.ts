/* @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { LegacyRedisClient } from '../redis'
import { DeveloperApiKeyManager } from './developer-api-keys'
import { query, DbQueryResult } from './index'

vi.mock('./index', () => ({
  query: vi.fn(),
}))

vi.mock('../redis', () => {
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
    zcard: vi.fn().mockResolvedValue(0),
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

describe('DeveloperApiKeyManager', () => {
  let manager: DeveloperApiKeyManager
  const mockQuery = vi.mocked(query)

  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockReset()
    manager = new DeveloperApiKeyManager()
  })

  describe('createApiKey', () => {
    it('should generate a new API key with proper format', async () => {
      mockQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            id: 'test-id',
            user_id: 'user-1',
            key_hash: 'hash',
            key_prefix: 'dev_',
            name: 'Test Key',
            scopes: ['read', 'write'],
            rate_limit: 1000,
            is_active: true,
            last_used_at: null,
            expires_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]),
      )

      const result = await manager.createApiKey({
        user_id: 'user-1',
        name: 'Test Key',
      })

      expect(result.plain_key).toMatch(/^dev_/)
      expect(result.api_key.name).toBe('Test Key')
    })
  })

  describe('validateApiKey', () => {
    it('should return invalid for empty key', async () => {
      const result = await manager.validateApiKey('')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('API key is required')
    })

    it('should return invalid for non-existent key', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([], 0))

      const result = await manager.validateApiKey('dev_invalid')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid API key')
    })

    it('should return valid for non-expired key within limit', async () => {
      mockQuery
        .mockResolvedValueOnce(
          createMockQueryResult([
            {
              id: 'key-1',
              user_id: 'user-1',
              key_hash: 'hash',
              key_prefix: 'dev_abc',
              name: 'Live Key',
              scopes: ['read'],
              rate_limit: 2,
              is_active: true,
              last_used_at: null,
              last_failed_at: null,
              expires_at: new Date(Date.now() + 3600_000),
              created_at: new Date(),
              updated_at: new Date(),
            },
          ]),
        )
        .mockResolvedValueOnce(createMockQueryResult([], 1))

      const result = await manager.validateApiKey(
        'dev_abcdefghijklmnopqrstuvwxyz',
      )

      expect(result.valid).toBe(true)
      expect(result.api_key?.name).toBe('Live Key')
      expect(result.remainingRequests).toBe(1)
    })

    it('should return invalid when key is expired', async () => {
      mockQuery
        .mockResolvedValueOnce(
          createMockQueryResult([
            {
              id: 'key-1',
              user_id: 'user-1',
              key_hash: 'hash',
              key_prefix: 'dev_abc',
              name: 'Expired Key',
              scopes: ['read'],
              rate_limit: 1_000,
              is_active: true,
              last_used_at: null,
              last_failed_at: null,
              expires_at: new Date(Date.now() - 1000),
              created_at: new Date(),
              updated_at: new Date(),
            },
          ]),
        )
        .mockResolvedValueOnce(createMockQueryResult([], 1))
        .mockResolvedValueOnce(createMockQueryResult([], 1))

      const result = await manager.validateApiKey(
        'dev_abcdefghijklmnopqrstuvwxyz',
      )

      expect(result.valid).toBe(false)
      expect(result.error).toBe('API key has expired')
    })
  })

  describe('listApiKeys', () => {
    it('should return list of API keys for user', async () => {
      mockQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { id: 'key-1', name: 'Key 1' },
          { id: 'key-2', name: 'Key 2' },
        ]),
      )

      const keys = await manager.listApiKeys('user-1')

      expect(keys).toHaveLength(2)
    })
  })

  describe('getApiKeyById', () => {
    it('should return null when key is not found', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([], 0))

      const result = await manager.getApiKeyById('unknown', 'user-1')

      expect(result).toBeNull()
    })

    it('should return key details when key is found', async () => {
      mockQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            id: 'key-1',
            user_id: 'user-1',
            key_prefix: 'dev_abc',
            name: 'Live Key',
            scopes: ['read'],
            rate_limit: 1000,
            is_active: true,
            last_used_at: null,
            last_failed_at: null,
            expires_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]),
      )

      const result = await manager.getApiKeyById('key-1', 'user-1')

      expect(result?.id).toBe('key-1')
      expect(result?.name).toBe('Live Key')
    })
  })

  describe('updateApiKeyScopes', () => {
    it('should return false when scopes are invalid', async () => {
      const result = await manager.updateApiKeyScopes('key-1', 'user-1', [
        'bad_scope',
      ])

      expect(result).toBe(false)
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('should update scopes for valid input', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([], 1))

      const result = await manager.updateApiKeyScopes('key-1', 'user-1', [
        'read',
      ])

      expect(result).toBe(true)
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })
  })

  describe('revokeApiKey', () => {
    it('should return true when revocation succeeds', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([], 1))

      const result = await manager.revokeApiKey('key-1', 'user-1')

      expect(result).toBe(true)
    })

    it('should return false when revocation does not find row', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([], 0))

      const result = await manager.revokeApiKey('missing', 'user-1')

      expect(result).toBe(false)
    })
  })

  describe('revokeApiKeySystem', () => {
    it('should return false when system revocation does not update anything', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([], 0))

      const result = await manager.revokeApiKeySystem('missing')

      expect(result).toBe(false)
    })
  })

  describe('rotateApiKey', () => {
    it('should throw when key is not found', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([], 0))

      await expect(manager.rotateApiKey('unknown', 'user-1')).rejects.toThrow(
        'API key not found or does not belong to user',
      )
    })

    it('should deactivate old key and create new key atomically', async () => {
      const existingKey = {
        id: 'key-1',
        user_id: 'user-1',
        key_prefix: 'dev_old',
        name: 'Old Key',
        scopes: ['read', 'write'],
        rate_limit: 1000,
        is_active: true,
        last_used_at: null,
        last_failed_at: null,
        expires_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const newKeyRow = {
        id: 'key-2',
        user_id: 'user-1',
        key_hash: 'new-hash',
        key_prefix: 'dev_new',
        name: 'Old Key',
        scopes: ['read', 'write'],
        rate_limit: 1000,
        is_active: true,
        last_used_at: null,
        last_failed_at: null,
        expires_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      mockQuery
        .mockResolvedValueOnce(createMockQueryResult([existingKey]))
        .mockResolvedValueOnce(createMockQueryResult([newKeyRow]))

      const result = await manager.rotateApiKey('key-1', 'user-1')

      expect(result.plain_key).toMatch(/^dev_/)
      expect(result.api_key.id).toBe('key-2')
      expect(result.api_key.name).toBe('Old Key')
      expect(result.api_key.is_active).toBe(true)
      expect(mockQuery).toHaveBeenCalledTimes(2)
    })

    it('should use custom name and expiry when provided', async () => {
      const existingKey = {
        id: 'key-1',
        user_id: 'user-1',
        key_prefix: 'dev_old',
        name: 'Old Key',
        scopes: ['read'],
        rate_limit: 500,
        is_active: true,
        last_used_at: null,
        last_failed_at: null,
        expires_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const newKeyRow = {
        id: 'key-2',
        user_id: 'user-1',
        key_hash: 'new-hash',
        key_prefix: 'dev_new',
        name: 'Rotated Key',
        scopes: ['read'],
        rate_limit: 500,
        is_active: true,
        last_used_at: null,
        last_failed_at: null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        created_at: new Date(),
        updated_at: new Date(),
      }

      mockQuery
        .mockResolvedValueOnce(createMockQueryResult([existingKey]))
        .mockResolvedValueOnce(createMockQueryResult([newKeyRow]))

      const result = await manager.rotateApiKey('key-1', 'user-1', {
        name: 'Rotated Key',
        expires_in_days: 30,
      })

      expect(result.api_key.name).toBe('Rotated Key')
      expect(result.api_key.expires_at).toBeDefined()
    })
  })

  describe('cleanupOldRateLimits', () => {
    it('should return deleted row count', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([], 3))

      const result = await manager.cleanupOldRateLimits()

      expect(result).toBe(3)
    })
  })
})
