import { describe, it, expect, beforeEach, vi } from 'vitest'
import { query } from '../index'
import {
  DeveloperApiKeyManager,
  initializeDeveloperApiKeysTable,
} from '../developer-api-keys'

vi.mock('../index', () => ({
  query: vi.fn(),
}))

describe('DeveloperApiKeyManager', () => {
  let manager: DeveloperApiKeyManager
  const mockQuery = vi.mocked(query)

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new DeveloperApiKeyManager()
  })

  describe('createApiKey', () => {
    it('should generate a new API key with proper format', () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
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
        ],
        rowCount: 1,
      } as any)

      return manager.createApiKey({
        user_id: 'user-1',
        name: 'Test Key',
      }).then((result) => {
        expect(result.plain_key).toMatch(/^dev_/)
        expect(result.api_key.name).toBe('Test Key')
      })
    })
  })

  describe('validateApiKey', () => {
    it('should return invalid for empty key', () => {
      return manager.validateApiKey('').then((result) => {
        expect(result.valid).toBe(false)
        expect(result.error).toBe('API key is required')
      })
    })

    it('should return invalid for non-existent key', () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

      return manager.validateApiKey('dev_invalid').then((result) => {
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Invalid API key')
      })
    })
  })

  describe('listApiKeys', () => {
    it('should return list of API keys for user', () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'key-1', name: 'Key 1' },
          { id: 'key-2', name: 'Key 2' },
        ],
        rowCount: 2,
      } as any)

      return manager.listApiKeys('user-1').then((keys) => {
        expect(keys).toHaveLength(2)
      })
    })
  })
})
