/* @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { DeveloperApiKeyManager } from './developer-api-keys'
import { query } from './index'

vi.mock('./index', () => ({
  query: vi.fn(),
}))

const createMockQueryResult = (rows: any[], rowCount = rows.length) =>
  ({
    rows,
    rowCount,
    command: 'SELECT',
    oid: 0,
    fields: [],
  }) as any

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
        .mockResolvedValueOnce(createMockQueryResult([{ count: '1' }], 1))
        .mockResolvedValueOnce(createMockQueryResult([], 1))
        .mockResolvedValueOnce(createMockQueryResult([], 1))

      const result = await manager.validateApiKey(
        'dev_abcdefghijklmnopqrstuvwxyz',
      )

      expect(result.valid).toBe(true)
      expect(result.api_key?.name).toBe('Live Key')
      expect(result.remainingRequests).toBe(0)
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

  describe('cleanupOldRateLimits', () => {
    it('should return deleted row count', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([], 3))

      const result = await manager.cleanupOldRateLimits()

      expect(result).toBe(3)
    })
  })
})
