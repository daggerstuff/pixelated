/* @vitest-environment node */
/**
 * src/pages/api/v1/developer/memory/__tests__/developer-memory-routes.test.ts
 *
 * PIX-231: Contract tests for the developer-facing v1 public memory API.
 *
 * These tests verify:
 *   - API-key authentication is required
 *   - Read operations require `read` or `memory:read`
 *   - Write operations require `write` or `memory:write`
 *   - Response shape matches the public v1 memory contract
 *   - Internal fields are not leaked
 *   - The X-Memory-Contract-Version header is advertised
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/developer-api-keys', () => ({
  developerApiKeyManager: {
    validateApiKey: vi.fn(),
  },
}))

vi.mock('@/lib/db/index', () => ({
  userManager: {
    getUserById: vi.fn(),
  },
}))

vi.mock('@/lib/services/product-memory-gateway', () => ({
  getProductMemoryGateway: vi.fn(),
  ProductMemoryGatewayError: class ProductMemoryGatewayError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message)
      this.name = 'ProductMemoryGatewayError'
    }
  },
}))

import {
  developerApiKeyManager,
  type ApiKeyScope,
  type ApiKeyValidationResult,
} from '@/lib/db/developer-api-keys'
import { userManager } from '@/lib/db/index'
import {
  getProductMemoryGateway,
  ProductMemoryGatewayError,
} from '@/lib/services/product-memory-gateway'

import {
  GET as getMemoryById,
  PATCH as patchMemoryById,
  DELETE as deleteMemoryById,
} from '../[memoryId]'
import { GET as listMemories, POST as createMemory } from '../index'
import { GET as searchGet, POST as searchPost } from '../search'

const mockValidateApiKey = vi.mocked(developerApiKeyManager.validateApiKey)
const mockGetUserById = vi.mocked(userManager.getUserById)

function makeRequest(
  url: string,
  options: { body?: unknown; apiKey?: string } = {},
): Request {
  const headers = new Headers()
  if (options.apiKey) {
    headers.set('X-API-Key', options.apiKey)
  }
  return {
    url,
    headers,
    json: vi.fn().mockResolvedValue(options.body ?? {}),
  } as unknown as Request
}

function makeApiKey(scopes: string[]): ApiKeyValidationResult {
  return {
    valid: true,
    api_key: {
      id: 'key-1',
      user_id: 'dev-user-1',
      key_hash: '',
      key_prefix: 'dev_',
      name: 'Test Key',
      scopes: scopes as ApiKeyScope[],
      rate_limit: 1000,
      is_active: true,
      last_used_at: null,
      last_failed_at: null,
      expires_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    remainingRequests: 999,
    resetTimeMs: Date.now() + 60_000,
  }
}

function makeGateway() {
  return {
    createMemory: vi.fn(),
    listMemories: vi.fn(),
    searchMemories: vi.fn(),
    updateMemory: vi.fn(),
    getMemory: vi.fn(),
    deleteMemory: vi.fn(),
    getMemoryStats: vi.fn(),
  }
}

function makeMemoryRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    content: 'test memory content',
    metadata: {},
    scope: 'session',
    retention: 'short_term',
    category: 'general',
    tags: ['test'],
    version: 1,
    importance: 0.5,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    // Internal fields must be stripped by toPublicMemory()
    tenantId: 'tenant-leaked',
    bankId: 'bank-leaked',
    vectorId: 'vector-leaked',
    sourceService: 'source-leaked',
    isGhost: false,
    synthesizedFrom: [],
    decayRate: 0.5,
    strengthTrend: 'stable',
    activationCount: 0,
    retrievalCount: 0,
    accessedAt: '2026-01-01T00:00:00.000Z',
    lastRetrievedAt: '2026-01-01T00:00:00.000Z',
    schemaVersion: '1.0',
    emotionalContext: null,
    empathyMetrics: null,
    gist: null,
    ...overrides,
  }
}

describe('developer v1 public memory API (PIX-231)', () => {
  let gateway: ReturnType<typeof makeGateway>

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = makeGateway()
    ;(
      getProductMemoryGateway as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue(gateway)
    mockGetUserById.mockResolvedValue({
      id: 'dev-user-1',
      workspace_id: 'workspace-1',
    })
  })

  // ------------------------------------------------------------------
  // Authentication
  // ------------------------------------------------------------------

  describe('authentication', () => {
    it('rejects requests without X-API-Key', async () => {
      const response = await listMemories({
        request: makeRequest('http://localhost/api/v1/developer/memory'),
      })
      expect(response.status).toBe(401)
      const body = (await response.json()) as { error: string }
      expect(body.error).toBe('unauthorized')
    })

    it('rejects invalid API keys', async () => {
      mockValidateApiKey.mockResolvedValue({ valid: false, error: 'invalid' })
      const response = await listMemories({
        request: makeRequest('http://localhost/api/v1/developer/memory', {
          apiKey: 'bad-key',
        }),
      })
      expect(response.status).toBe(401)
      const body = (await response.json()) as { error: string }
      expect(body.error).toBe('unauthorized')
    })
  })

  // ------------------------------------------------------------------
  // Scope authorization
  // ------------------------------------------------------------------

  describe('scope authorization', () => {
    it('allows read with memory:read scope', async () => {
      mockValidateApiKey.mockResolvedValue(makeApiKey(['memory:read']))
      gateway.listMemories.mockResolvedValue({ memories: [], total: 0 })
      const response = await listMemories({
        request: makeRequest('http://localhost/api/v1/developer/memory', {
          apiKey: 'dev_key',
        }),
      })
      expect(response.status).toBe(200)
    })

    it('allows read with generic read scope', async () => {
      mockValidateApiKey.mockResolvedValue(makeApiKey(['read']))
      gateway.listMemories.mockResolvedValue({ memories: [], total: 0 })
      const response = await listMemories({
        request: makeRequest('http://localhost/api/v1/developer/memory', {
          apiKey: 'dev_key',
        }),
      })
      expect(response.status).toBe(200)
    })

    it('forbids read with only write scope', async () => {
      mockValidateApiKey.mockResolvedValue(makeApiKey(['write']))
      const response = await listMemories({
        request: makeRequest('http://localhost/api/v1/developer/memory', {
          apiKey: 'dev_key',
        }),
      })
      expect(response.status).toBe(403)
      const body = (await response.json()) as { error: string }
      expect(body.error).toBe('forbidden')
    })

    it('forbids create with only read scope', async () => {
      mockValidateApiKey.mockResolvedValue(makeApiKey(['read']))
      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/developer/memory', {
          apiKey: 'dev_key',
          body: { content: 'hello' },
        }),
      })
      expect(response.status).toBe(403)
    })

    it('allows create with memory:write scope', async () => {
      mockValidateApiKey.mockResolvedValue(makeApiKey(['memory:write']))
      gateway.createMemory.mockResolvedValue(makeMemoryRecord())
      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/developer/memory', {
          apiKey: 'dev_key',
          body: { content: 'hello' },
        }),
      })
      expect(response.status).toBe(201)
    })
  })

  // ------------------------------------------------------------------
  // Happy paths
  // ------------------------------------------------------------------

  describe('happy paths', () => {
    beforeEach(() => {
      mockValidateApiKey.mockResolvedValue(makeApiKey(['read', 'write']))
    })

    it('GET /developer/memory lists memories scoped to the API key user', async () => {
      gateway.listMemories.mockResolvedValue({
        memories: [makeMemoryRecord()],
        total: 1,
      })

      const response = await listMemories({
        request: makeRequest('http://localhost/api/v1/developer/memory', {
          apiKey: 'dev_key',
        }),
      })

      expect(response.status).toBe(200)
      expect(gateway.listMemories).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'dev-user-1',
          workspaceId: 'workspace-1',
        }),
      )
      const body = (await response.json()) as {
        data: Array<Record<string, unknown>>
      }
      expect(body.data).toHaveLength(1)
    })

    it('POST /developer/memory creates a memory', async () => {
      gateway.createMemory.mockResolvedValue(makeMemoryRecord())

      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/developer/memory', {
          apiKey: 'dev_key',
          body: { content: 'hello developer api' },
        }),
      })

      expect(response.status).toBe(201)
      expect(gateway.createMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'dev-user-1',
          content: 'hello developer api',
        }),
      )
    })

    it('GET /developer/memory/:id fetches a memory', async () => {
      gateway.getMemory.mockResolvedValue(makeMemoryRecord())

      const response = await getMemoryById({
        params: { memoryId: '11111111-1111-4111-8111-111111111111' },
        request: makeRequest(
          'http://localhost/api/v1/developer/memory/11111111-1111-4111-8111-111111111111',
          { apiKey: 'dev_key' },
        ),
      })

      expect(response.status).toBe(200)
    })

    it('PATCH /developer/memory/:id updates a memory', async () => {
      gateway.updateMemory.mockResolvedValue(makeMemoryRecord())

      const response = await patchMemoryById({
        params: { memoryId: '11111111-1111-4111-8111-111111111111' },
        request: makeRequest(
          'http://localhost/api/v1/developer/memory/11111111-1111-4111-8111-111111111111',
          { apiKey: 'dev_key', body: { content: 'updated' } },
        ),
      })

      expect(response.status).toBe(200)
    })

    it('DELETE /developer/memory/:id deletes a memory', async () => {
      gateway.deleteMemory.mockResolvedValue(undefined)

      const response = await deleteMemoryById({
        params: { memoryId: '11111111-1111-4111-8111-111111111111' },
        request: makeRequest(
          'http://localhost/api/v1/developer/memory/11111111-1111-4111-8111-111111111111',
          { apiKey: 'dev_key' },
        ),
      })

      expect(response.status).toBe(200)
      const body = (await response.json()) as { data: { id: string } }
      expect(body.data.id).toBe('11111111-1111-4111-8111-111111111111')
    })

    it('GET /developer/memory/search searches memories', async () => {
      gateway.searchMemories.mockResolvedValue({
        memories: [makeMemoryRecord()],
        total: 1,
      })

      const response = await searchGet({
        request: makeRequest(
          'http://localhost/api/v1/developer/memory/search?q=anxiety',
          { apiKey: 'dev_key' },
        ),
      })

      expect(response.status).toBe(200)
      expect(gateway.searchMemories).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'anxiety',
          userId: 'dev-user-1',
        }),
      )
    })

    it('POST /developer/memory/search accepts a JSON body', async () => {
      gateway.searchMemories.mockResolvedValue({
        memories: [makeMemoryRecord()],
        total: 1,
      })

      const response = await searchPost({
        request: makeRequest(
          'http://localhost/api/v1/developer/memory/search',
          { apiKey: 'dev_key', body: { q: 'anxiety coping' } },
        ),
      })

      expect(response.status).toBe(200)
      const body = (await response.json()) as { query: string }
      expect(body.query).toBe('anxiety coping')
    })
  })

  // ------------------------------------------------------------------
  // Error envelope
  // ------------------------------------------------------------------

  describe('error envelope', () => {
    it('maps gateway errors to canonical MemoryApiError', async () => {
      mockValidateApiKey.mockResolvedValue(makeApiKey(['read', 'write']))
      gateway.createMemory.mockRejectedValue(
        new ProductMemoryGatewayError('downstream exploded', 502),
      )

      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/developer/memory', {
          apiKey: 'dev_key',
          body: { content: 'hi' },
        }),
      })

      expect(response.status).toBe(502)
      const body = (await response.json()) as { error: string }
      expect(body.error).toBe('upstream_unavailable')
    })
  })

  // ------------------------------------------------------------------
  // Response headers
  // ------------------------------------------------------------------

  describe('response headers', () => {
    it('exposes X-Memory-Contract-Version: 1.0.0', async () => {
      mockValidateApiKey.mockResolvedValue(makeApiKey(['read']))
      gateway.listMemories.mockResolvedValue({ memories: [], total: 0 })

      const response = await listMemories({
        request: makeRequest('http://localhost/api/v1/developer/memory', {
          apiKey: 'dev_key',
        }),
      })

      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
    })
  })

  // ------------------------------------------------------------------
  // Privacy / field leaks
  // ------------------------------------------------------------------

  describe('privacy', () => {
    it('does not leak internal fields', async () => {
      mockValidateApiKey.mockResolvedValue(makeApiKey(['read']))
      gateway.getMemory.mockResolvedValue(makeMemoryRecord())

      const response = await getMemoryById({
        params: { memoryId: '11111111-1111-4111-8111-111111111111' },
        request: makeRequest(
          'http://localhost/api/v1/developer/memory/11111111-1111-4111-8111-111111111111',
          { apiKey: 'dev_key' },
        ),
      })

      const body = (await response.json()) as { data: Record<string, unknown> }
      const forbidden = [
        'tenantId',
        'bankId',
        'vectorId',
        'sourceService',
        'isGhost',
        'synthesizedFrom',
        'decayRate',
        'strengthTrend',
        'activationCount',
        'retrievalCount',
        'accessedAt',
        'lastRetrievedAt',
        'schemaVersion',
        'emotionalContext',
        'empathyMetrics',
        'gist',
      ]
      for (const field of forbidden) {
        expect(body.data).not.toHaveProperty(field)
      }
    })
  })
})
