/* @vitest-environment node */
/**
 * src/pages/api/v1/memory/__tests__/v1-memory-routes.test.ts
 *
 * PIX-1908: Contract tests for the canonical v1 public memory API.
 *
 * These tests pin the public surface:
 *
 *  - HTTP status codes
 *  - Response envelope shape (no leaked internal fields)
 *  - Error envelope shape and stable `error` codes
 *  - Rejection of internal-only identity fields
 *  - Validation behavior (strict mode)
 *
 * If any of these tests fail, the public contract has changed and
 * downstream SDKs / OpenAPI / docs must be regenerated.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
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

import { getCurrentUser } from '@/lib/auth'
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

const mockGetCurrentUser = vi.mocked(getCurrentUser)

function makeRequest(url: string, body?: unknown): Request {
  return {
    url,
    json: vi.fn().mockResolvedValue(body ?? {}),
  } as unknown as Request
}

function makeUser() {
  return {
    id: 'user-123',
    accountId: 'account-1',
    workspaceId: 'workspace-1',
    role: 'user',
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

const FORBIDDEN_FIELDS = [
  'userId',
  'user_id',
  'accountId',
  'account_id',
  'workspaceId',
  'workspace_id',
  'tenantId',
  'tenant_id',
  'bankId',
  'bank_id',
  'vectorId',
  'vector_id',
  'sourceService',
  'source_service',
  'isGhost',
  'is_ghost',
  'synthesizedFrom',
  'synthesized_from',
  'decayRate',
  'decay_rate',
  'strengthTrend',
  'strength_trend',
  'activationCount',
  'activation_count',
  'retrievalCount',
  'retrieval_count',
  'accessedAt',
  'accessed_at',
  'lastRetrievedAt',
  'last_retrieved_at',
  'schemaVersion',
  'schema_version',
  'emotionalContext',
  'emotional_context',
  'empathyMetrics',
  'empathy_metrics',
  'gist',
]

describe('v1 public memory API contract (PIX-1908)', () => {
  let gateway: ReturnType<typeof makeGateway>

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = makeGateway()
    mockGetCurrentUser.mockResolvedValue(makeUser())
    ;(
      getProductMemoryGateway as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue(gateway)
  })

  // ------------------------------------------------------------------
  // Response envelope shape — no internal field leaks
  // ------------------------------------------------------------------

  describe('PublicMemory shape (no internal field leaks)', () => {
    it('GET /memory/:id returns only public fields', async () => {
      gateway.getMemory.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        content: 'hello',
        metadata: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        // All of these are INTERNAL and MUST NOT appear in the public response:
        tenantId: 'leaked',
        bankId: 'leaked',
        vectorId: 'leaked',
        sourceService: 'leaked',
        isGhost: true,
        synthesizedFrom: ['leaked'],
        decayRate: 0.99,
        strengthTrend: 'leaked',
        activationCount: 999,
        retrievalCount: 999,
        accessedAt: 'leaked',
        lastRetrievedAt: 'leaked',
        schemaVersion: 'leaked',
        emotionalContext: { leaked: true } as never,
        empathyMetrics: { leaked: true } as never,
        gist: 'leaked',
        scope: 'session',
        retention: 'short_term',
        category: 'general',
        tags: [],
        version: 1,
        importance: 0.5,
      })

      const response = await getMemoryById({
        params: { memoryId: '11111111-1111-4111-8111-111111111111' },
        request: makeRequest(
          'http://localhost/api/v1/memory/11111111-1111-4111-8111-111111111111',
        ),
      })

      expect(response.status).toBe(200)
      const body = (await response.json()) as { data: Record<string, unknown> }
      for (const field of FORBIDDEN_FIELDS) {
        expect(body.data).not.toHaveProperty(field)
      }
      // Public fields are present
      expect(body.data).toHaveProperty('id')
      expect(body.data).toHaveProperty('content')
      expect(body.data).toHaveProperty('scope')
      expect(body.data).toHaveProperty('retention')
      expect(body.data).toHaveProperty('category')
      expect(body.data).toHaveProperty('tags')
      expect(body.data).toHaveProperty('version')
      expect(body.data).toHaveProperty('importance')
      expect(body.data).toHaveProperty('createdAt')
      expect(body.data).toHaveProperty('updatedAt')
    })

    it('POST /memory returns only public fields', async () => {
      gateway.createMemory.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        content: 'hi',
        metadata: {},
        // Internal fields that must NOT leak:
        tenantId: 'leaked',
        bankId: 'leaked',
        vectorId: 'leaked',
        sourceService: 'leaked',
        isGhost: true,
        scope: 'session',
        retention: 'short_term',
        category: 'general',
        tags: [],
        version: 1,
        importance: 0.5,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: null,
      })

      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/memory', {
          content: 'hi',
        }),
      })

      expect(response.status).toBe(201)
      const body = (await response.json()) as { data: Record<string, unknown> }
      for (const field of FORBIDDEN_FIELDS) {
        expect(body.data).not.toHaveProperty(field)
      }
    })
  })

  // ------------------------------------------------------------------
  // Request validation — strict mode rejects unknown / identity fields
  // ------------------------------------------------------------------

  describe('Request validation', () => {
    it('POST /memory rejects unknown fields (strict mode)', async () => {
      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/memory', {
          content: 'hi',
          rogue: 'nope',
        }),
      })
      expect(response.status).toBe(400)
      const body = (await response.json()) as { error: string }
      expect(body.error).toBe('validation_failed')
      expect(gateway.createMemory).not.toHaveBeenCalled()
    })

    it('POST /memory rejects identity fields (userId, accountId, etc.)', async () => {
      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/memory', {
          content: 'hi',
          userId: 'attacker',
          accountId: 'attacker',
          workspaceId: 'attacker',
          tenantId: 'attacker',
        }),
      })
      expect(response.status).toBe(400)
      const body = (await response.json()) as { error: string }
      expect(body.error).toBe('validation_failed')
      expect(gateway.createMemory).not.toHaveBeenCalled()
    })

    it('POST /search rejects unknown fields', async () => {
      const response = await searchPost({
        request: makeRequest('http://localhost/api/v1/memory/search', {
          q: 'hello',
          userId: 'attacker',
        }),
      })
      expect(response.status).toBe(400)
    })

    it('PATCH /memory/:id rejects identity fields', async () => {
      const response = await patchMemoryById({
        params: { memoryId: '11111111-1111-4111-8111-111111111111' },
        request: makeRequest(
          'http://localhost/api/v1/memory/11111111-1111-4111-8111-111111111111',
          { content: 'updated', userId: 'attacker' },
        ),
      })
      expect(response.status).toBe(400)
    })
  })

  // ------------------------------------------------------------------
  // Error envelope — stable codes
  // ------------------------------------------------------------------

  describe('Error envelope', () => {
    it('401 returns { error: "unauthorized", message }', async () => {
      mockGetCurrentUser.mockResolvedValue(null)
      const response = await listMemories({
        request: makeRequest('http://localhost/api/v1/memory'),
      })
      expect(response.status).toBe(401)
      const body = (await response.json()) as { error: string; message: string }
      expect(body.error).toBe('unauthorized')
      expect(typeof body.message).toBe('string')
    })

    it('404 returns { error: "not_found", message }', async () => {
      gateway.getMemory.mockResolvedValue(null)
      const response = await getMemoryById({
        params: { memoryId: '11111111-1111-4111-8111-111111111111' },
        request: makeRequest(
          'http://localhost/api/v1/memory/11111111-1111-4111-8111-111111111111',
        ),
      })
      expect(response.status).toBe(404)
      const body = (await response.json()) as { error: string; message: string }
      expect(body.error).toBe('not_found')
    })

    it('gateway 502 maps to upstream_unavailable', async () => {
      gateway.createMemory.mockRejectedValue(
        new ProductMemoryGatewayError('downstream exploded', 502),
      )
      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/memory', {
          content: 'hi',
        }),
      })
      expect(response.status).toBe(502)
      const body = (await response.json()) as { error: string }
      expect(body.error).toBe('upstream_unavailable')
    })

    it('gateway 403 maps to forbidden', async () => {
      gateway.createMemory.mockRejectedValue(
        new ProductMemoryGatewayError('User scope mismatch', 403),
      )
      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/memory', {
          content: 'hi',
        }),
      })
      expect(response.status).toBe(403)
      const body = (await response.json()) as { error: string }
      expect(body.error).toBe('forbidden')
    })
  })

  // ------------------------------------------------------------------
  // Response headers — contract version is advertised
  // ------------------------------------------------------------------

  describe('Response headers', () => {
    it('exposes X-Memory-Contract-Version: 1.0.0', async () => {
      gateway.listMemories.mockResolvedValue({ memories: [], total: 0 })
      const response = await listMemories({
        request: makeRequest('http://localhost/api/v1/memory'),
      })
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
    })
  })

  // ------------------------------------------------------------------
  // Happy paths — gateway delegation
  // ------------------------------------------------------------------

  describe('Happy paths', () => {
    it('POST /memory delegates to gateway with session-derived scope', async () => {
      const user = makeUser()
      mockGetCurrentUser.mockResolvedValue(user)
      gateway.createMemory.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        content: 'hi',
        metadata: {},
        scope: 'session',
        retention: 'short_term',
        category: 'general',
        tags: [],
        version: 1,
        importance: 0.5,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: null,
      })

      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/memory', {
          content: 'hi',
        }),
      })
      expect(response.status).toBe(201)
      expect(gateway.createMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          accountId: user.accountId,
          workspaceId: user.workspaceId,
          content: 'hi',
        }),
      )
      // Caller-supplied identity must NOT have leaked into the scope call.
      const call = gateway.createMemory.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >
      expect(call).not.toHaveProperty('tenantId')
    })

    it('DELETE /memory/:id returns 200 with the deleted id', async () => {
      const id = '11111111-1111-4111-8111-111111111111'
      gateway.deleteMemory.mockResolvedValue(undefined)
      const response = await deleteMemoryById({
        params: { memoryId: id },
        request: makeRequest(`http://localhost/api/v1/memory/${id}`),
      })
      expect(response.status).toBe(200)
      const body = (await response.json()) as { data: { id: string } }
      expect(body.data.id).toBe(id)
    })

    it('GET /memory/search requires q', async () => {
      const response = await searchGet({
        request: makeRequest('http://localhost/api/v1/memory/search'),
      })
      expect(response.status).toBe(400)
      const body = (await response.json()) as { error: string }
      expect(body.error).toBe('validation_failed')
    })

    it('POST /memory/search requires q (same field name as GET)', async () => {
      const response = await searchPost({
        request: makeRequest('http://[REDACTED]/api/v1/memory/search', {
          query: 'legacy-field-name',
        }),
      })
      expect(response.status).toBe(400)
      const body = (await response.json()) as { error: string }
      expect(body.error).toBe('validation_failed')
    })

    it('POST /memory/search delegates to gateway with q', async () => {
      gateway.searchMemories.mockResolvedValue({ memories: [], total: 0 })
      const response = await searchPost({
        request: makeRequest('http://[REDACTED]/api/v1/memory/search', {
          q: 'anxiety coping',
        }),
      })
      expect(response.status).toBe(200)
      expect(gateway.searchMemories).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'anxiety coping' }),
      )
      const body = (await response.json()) as { query: string }
      expect(body.query).toBe('anxiety coping')
    })
  })
})
