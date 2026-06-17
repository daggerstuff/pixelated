/* @vitest-environment node */
/**
 * src/pages/api/v1/memory/__tests__/v1.contract.test.ts
 *
 * PIX-3904: Full Zod schema contract validation for the v1 public memory API.
 *
 * These tests call the live route handlers (with stubbed gateway) and assert
 * that the FULL JSON response body passes the Zod response schemas from
 * src/lib/memory/contract/v1.ts.
 *
 * This is distinct from v1-memory-routes.test.ts (PIX-1908) which only checks
 * status codes, envelope shape, and field leaks — NOT full Zod schema
 * validation.
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
import { MemoryApiError } from '@/lib/memory/contract/errors'
import {
  CreateMemoryResponse,
  DeleteMemoryResponse,
  GetMemoryResponse,
  ListMemoriesResponse,
  SearchMemoriesResponse,
  UpdateMemoryResponse,
} from '@/lib/memory/contract/v1'
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

const MEMORY_ID = '11111111-1111-4111-8111-111111111111'
const CREATED_AT = '2026-01-01T00:00:00.000Z'
const UPDATED_AT = '2026-01-02T00:00:00.000Z'

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

/**
 * Build a realistic ProductMemoryRecord with BOTH public and internal fields.
 * The route handler's toPublicMemory() helper strips internal fields before
 * the response is constructed, so the Zod response schema should only see
 * the public projection.
 */
function makeMemoryRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: MEMORY_ID,
    content: 'test memory content',
    metadata: {},
    scope: 'session',
    retention: 'short_term',
    category: 'general',
    tags: ['test'],
    version: 1,
    importance: 0.5,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    // Internal fields — must be stripped by toPublicMemory() before response
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
    accessedAt: CREATED_AT,
    lastRetrievedAt: CREATED_AT,
    schemaVersion: '1.0',
    emotionalContext: null,
    empathyMetrics: null,
    gist: null,
    ...overrides,
  }
}

describe('v1 public memory API Zod contract validation (PIX-3904)', () => {
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
  // GET /api/v1/memory — list
  // ------------------------------------------------------------------

  describe('GET /api/v1/memory (list)', () => {
    it('validates response against ListMemoriesResponse schema', async () => {
      gateway.listMemories.mockResolvedValue({
        memories: [makeMemoryRecord()],
        total: 1,
      })

      const response = await listMemories({
        request: makeRequest('http://localhost/api/v1/memory'),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
      const body = await response.json()
      const result = ListMemoriesResponse.safeParse(body)
      expect(
        result.success,
        `ListMemoriesResponse validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })

    it('validates empty list response', async () => {
      gateway.listMemories.mockResolvedValue({
        memories: [],
        total: 0,
      })

      const response = await listMemories({
        request: makeRequest('http://localhost/api/v1/memory'),
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      const result = ListMemoriesResponse.safeParse(body)
      expect(
        result.success,
        `ListMemoriesResponse (empty) validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })
  })

  // ------------------------------------------------------------------
  // POST /api/v1/memory — create
  // ------------------------------------------------------------------

  describe('POST /api/v1/memory (create)', () => {
    it('validates response against CreateMemoryResponse schema', async () => {
      gateway.createMemory.mockResolvedValue(makeMemoryRecord())

      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/memory', {
          content: 'test memory content',
        }),
      })

      expect(response.status).toBe(201)
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
      const body = await response.json()
      const result = CreateMemoryResponse.safeParse(body)
      expect(
        result.success,
        `CreateMemoryResponse validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })

    it('validates response with all optional fields', async () => {
      gateway.createMemory.mockResolvedValue(
        makeMemoryRecord({
          scope: 'arc',
          retention: 'long_term',
          category: 'preference',
          tags: ['important', 'user-saved'],
          importance: 0.9,
        }),
      )

      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/memory', {
          content: 'detailed memory',
          scope: 'arc',
          retention: 'long_term',
          category: 'preference',
          tags: ['important', 'user-saved'],
          importance: 0.9,
        }),
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      const result = CreateMemoryResponse.safeParse(body)
      expect(
        result.success,
        `CreateMemoryResponse (all fields) validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })
  })

  // ------------------------------------------------------------------
  // GET /api/v1/memory/:memoryId — get by ID
  // ------------------------------------------------------------------

  describe('GET /api/v1/memory/:memoryId (get by ID)', () => {
    it('validates response against GetMemoryResponse schema', async () => {
      gateway.getMemory.mockResolvedValue(makeMemoryRecord())

      const response = await getMemoryById({
        params: { memoryId: MEMORY_ID },
        request: makeRequest(`http://localhost/api/v1/memory/${MEMORY_ID}`),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
      const body = await response.json()
      const result = GetMemoryResponse.safeParse(body)
      expect(
        result.success,
        `GetMemoryResponse validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })
  })

  // ------------------------------------------------------------------
  // PATCH /api/v1/memory/:memoryId — update
  // ------------------------------------------------------------------

  describe('PATCH /api/v1/memory/:memoryId (update)', () => {
    it('validates response against UpdateMemoryResponse schema', async () => {
      gateway.updateMemory.mockResolvedValue(
        makeMemoryRecord({
          content: 'updated content',
          updatedAt: UPDATED_AT,
        }),
      )

      const response = await patchMemoryById({
        params: { memoryId: MEMORY_ID },
        request: makeRequest(`http://localhost/api/v1/memory/${MEMORY_ID}`, {
          content: 'updated content',
        }),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
      const body = await response.json()
      const result = UpdateMemoryResponse.safeParse(body)
      expect(
        result.success,
        `UpdateMemoryResponse validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })
  })

  // ------------------------------------------------------------------
  // DELETE /api/v1/memory/:memoryId — delete
  // ------------------------------------------------------------------

  describe('DELETE /api/v1/memory/:memoryId (delete)', () => {
    it('validates response against DeleteMemoryResponse schema', async () => {
      gateway.deleteMemory.mockResolvedValue(undefined)

      const response = await deleteMemoryById({
        params: { memoryId: MEMORY_ID },
        request: makeRequest(`http://localhost/api/v1/memory/${MEMORY_ID}`),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
      const body = await response.json()
      const result = DeleteMemoryResponse.safeParse(body)
      expect(
        result.success,
        `DeleteMemoryResponse validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })
  })

  // ------------------------------------------------------------------
  // GET /api/v1/memory/search — search via query params
  // ------------------------------------------------------------------

  describe('GET /api/v1/memory/search (search via query)', () => {
    it('validates response against SearchMemoriesResponse schema', async () => {
      gateway.searchMemories.mockResolvedValue({
        memories: [makeMemoryRecord()],
        total: 1,
      })

      const response = await searchGet({
        request: makeRequest('http://localhost/api/v1/memory/search?q=anxiety'),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
      const body = await response.json()
      const result = SearchMemoriesResponse.safeParse(body)
      expect(
        result.success,
        `SearchMemoriesResponse (GET) validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })

    it('validates empty search results', async () => {
      gateway.searchMemories.mockResolvedValue({
        memories: [],
        total: 0,
      })

      const response = await searchGet({
        request: makeRequest(
          'http://localhost/api/v1/memory/search?q=nonexistent',
        ),
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      const result = SearchMemoriesResponse.safeParse(body)
      expect(
        result.success,
        `SearchMemoriesResponse (empty) validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })
  })

  // ------------------------------------------------------------------
  // POST /api/v1/memory/search — search via body
  // ------------------------------------------------------------------

  describe('POST /api/v1/memory/search (search via body)', () => {
    it('validates response against SearchMemoriesResponse schema', async () => {
      gateway.searchMemories.mockResolvedValue({
        memories: [makeMemoryRecord()],
        total: 1,
      })

      const response = await searchPost({
        request: makeRequest('http://localhost/api/v1/memory/search', {
          q: 'anxiety coping',
        }),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
      const body = await response.json()
      const result = SearchMemoriesResponse.safeParse(body)
      expect(
        result.success,
        `SearchMemoriesResponse (POST) validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })
  })

  // ------------------------------------------------------------------
  // Error responses — validate against MemoryApiError schema
  // ------------------------------------------------------------------

  describe('Error responses validate against MemoryApiError schema', () => {
    it('401 unauthorized error', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const response = await listMemories({
        request: makeRequest('http://localhost/api/v1/memory'),
      })

      expect(response.status).toBe(401)
      const body = await response.json()
      const result = MemoryApiError.safeParse(body)
      expect(
        result.success,
        `MemoryApiError (401) validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })

    it('404 not found error', async () => {
      gateway.getMemory.mockResolvedValue(null)

      const response = await getMemoryById({
        params: { memoryId: MEMORY_ID },
        request: makeRequest(`http://localhost/api/v1/memory/${MEMORY_ID}`),
      })

      expect(response.status).toBe(404)
      const body = await response.json()
      const result = MemoryApiError.safeParse(body)
      expect(
        result.success,
        `MemoryApiError (404) validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })

    it('400 validation error', async () => {
      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/memory', {
          content: 'hi',
          rogue: 'nope',
        }),
      })

      expect(response.status).toBe(400)
      const body = await response.json()
      const result = MemoryApiError.safeParse(body)
      expect(
        result.success,
        `MemoryApiError (400) validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })

    it('502 upstream_unavailable error', async () => {
      gateway.createMemory.mockRejectedValue(
        new ProductMemoryGatewayError('downstream exploded', 502),
      )

      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/memory', {
          content: 'hi',
        }),
      })

      expect(response.status).toBe(502)
      const body = await response.json()
      const result = MemoryApiError.safeParse(body)
      expect(
        result.success,
        `MemoryApiError (502) validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })

    it('403 forbidden error', async () => {
      gateway.createMemory.mockRejectedValue(
        new ProductMemoryGatewayError('User scope mismatch', 403),
      )

      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/memory', {
          content: 'hi',
        }),
      })

      expect(response.status).toBe(403)
      const body = await response.json()
      const result = MemoryApiError.safeParse(body)
      expect(
        result.success,
        `MemoryApiError (403) validation failed: ${JSON.stringify(!result.success ? result.error.issues : 'unknown error')}`,
      ).toBe(true)
    })
  })

  // ------------------------------------------------------------------
  // Contract version header on every endpoint
  // ------------------------------------------------------------------

  describe('X-Memory-Contract-Version header', () => {
    it('is present on list endpoint', async () => {
      gateway.listMemories.mockResolvedValue({ memories: [], total: 0 })
      const response = await listMemories({
        request: makeRequest('http://localhost/api/v1/memory'),
      })
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
    })

    it('is present on create endpoint', async () => {
      gateway.createMemory.mockResolvedValue(makeMemoryRecord())
      const response = await createMemory({
        request: makeRequest('http://localhost/api/v1/memory', {
          content: 'test',
        }),
      })
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
    })

    it('is present on get-by-id endpoint', async () => {
      gateway.getMemory.mockResolvedValue(makeMemoryRecord())
      const response = await getMemoryById({
        params: { memoryId: MEMORY_ID },
        request: makeRequest(`http://localhost/api/v1/memory/${MEMORY_ID}`),
      })
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
    })

    it('is present on update endpoint', async () => {
      gateway.updateMemory.mockResolvedValue(makeMemoryRecord())
      const response = await patchMemoryById({
        params: { memoryId: MEMORY_ID },
        request: makeRequest(`http://localhost/api/v1/memory/${MEMORY_ID}`, {
          content: 'updated',
        }),
      })
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
    })

    it('is present on delete endpoint', async () => {
      gateway.deleteMemory.mockResolvedValue(undefined)
      const response = await deleteMemoryById({
        params: { memoryId: MEMORY_ID },
        request: makeRequest(`http://localhost/api/v1/memory/${MEMORY_ID}`),
      })
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
    })

    it('is present on search GET endpoint', async () => {
      gateway.searchMemories.mockResolvedValue({ memories: [], total: 0 })
      const response = await searchGet({
        request: makeRequest('http://localhost/api/v1/memory/search?q=test'),
      })
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
    })

    it('is present on search POST endpoint', async () => {
      gateway.searchMemories.mockResolvedValue({ memories: [], total: 0 })
      const response = await searchPost({
        request: makeRequest('http://localhost/api/v1/memory/search', {
          q: 'test',
        }),
      })
      expect(response.headers.get('X-Memory-Contract-Version')).toBe('1.0.0')
    })
  })
})
