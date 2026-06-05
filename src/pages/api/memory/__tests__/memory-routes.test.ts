/* @vitest-environment node */
/**
 * src/pages/api/memory/__tests__/memory-routes.test.ts
 *
 * PIX-328: Verifies product memory routes are wired through the
 * `ProductMemoryGateway` and not the legacy in-process `MemoryService`.
 *
 * Coverage: create / list / search / update / delete / [memoryId] / stats
 * through the route layer, asserting auth gating, validation, gateway
 * delegation, and error mapping.
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
import { POST as createMemory } from '../create'
import { DELETE as deleteMemoryRoute } from '../delete'
import { GET as listMemories } from '../list'
import { GET as searchGet, POST as searchPost } from '../search'
import { GET as getMemoryStats } from '../stats'
import { PUT as updatePut, PATCH as updatePatch } from '../update'

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockGetGateway = vi.mocked(getProductMemoryGateway)

function makeRequest(url: string, body?: unknown): Request {
  return {
    url,
    json: vi.fn().mockResolvedValue(body ?? {}),
  } as unknown as Request
}

function makeUser(overrides: Record<string, unknown> = {}): {
  id: string
  accountId: string
  workspaceId: string
  role: string
} {
  return {
    id: 'user-123',
    accountId: 'account-1',
    workspaceId: 'workspace-1',
    role: 'user',
    ...overrides,
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

describe('Memory API routes (PIX-328: gateway-backed)', () => {
  let gateway: ReturnType<typeof makeGateway>

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = makeGateway()
    mockGetGateway.mockReturnValue(
      gateway as unknown as ReturnType<typeof getProductMemoryGateway>,
    )
  })

  // ------------------------------------------------------------------
  // POST /api/memory/create
  // ------------------------------------------------------------------
  describe('POST /api/memory/create', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null)
      const response = await createMemory({
        request: makeRequest('http://localhost/api/memory/create', {
          content: 'hi',
        }),
      })
      expect(response.status).toBe(401)
      expect(gateway.createMemory).not.toHaveBeenCalled()
    })

    it('returns 400 when content is missing', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      const response = await createMemory({
        request: makeRequest('http://localhost/api/memory/create', {}),
      })
      expect(response.status).toBe(400)
      expect(gateway.createMemory).not.toHaveBeenCalled()
    })

    it('returns 201 and calls gateway with user+account+workspace scope', async () => {
      const user = makeUser()
      mockGetCurrentUser.mockResolvedValue(user)
      gateway.createMemory.mockResolvedValue({
        id: 'mem-1',
        content: 'hi',
        metadata: {},
      })

      const response = await createMemory({
        request: makeRequest('http://localhost/api/memory/create', {
          content: 'hi',
          metadata: { source: 'test' },
        }),
      })

      expect(response.status).toBe(201)
      const body = (await response.json()) as {
        success: boolean
        memory_id: string
      }
      expect(body.success).toBe(true)
      expect(body.memory_id).toBe('mem-1')
      expect(gateway.createMemory).toHaveBeenCalledWith({
        userId: user.id,
        accountId: user.accountId,
        workspaceId: user.workspaceId,
        includeShared: true,
        content: 'hi',
        metadata: { source: 'test' },
      })
    })

    it('maps a gateway 502 to a Bad Gateway response', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.createMemory.mockRejectedValue(
        new ProductMemoryGatewayError('downstream exploded', 502),
      )

      const response = await createMemory({
        request: makeRequest('http://localhost/api/memory/create', {
          content: 'hi',
        }),
      })
      expect(response.status).toBe(502)
    })
  })

  // ------------------------------------------------------------------
  // GET /api/memory/list
  // ------------------------------------------------------------------
  describe('GET /api/memory/list', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null)
      const response = await listMemories({
        request: makeRequest('http://localhost/api/memory/list'),
      })
      expect(response.status).toBe(401)
    })

    it('returns 200 with memories and pagination on success', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.listMemories.mockResolvedValue({
        memories: [
          { id: 'mem-1', content: 'first', metadata: {} },
          { id: 'mem-2', content: 'second', metadata: {} },
        ],
        total: 2,
      })

      const response = await listMemories({
        request: makeRequest(
          'http://localhost/api/memory/list?limit=5&offset=10',
        ),
      })
      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        success: boolean
        memories: unknown[]
        pagination: { limit: number; offset: number; total: number }
      }
      expect(body.success).toBe(true)
      expect(body.memories).toHaveLength(2)
      expect(body.pagination).toEqual({ limit: 5, offset: 10, total: 2 })
      expect(gateway.listMemories).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5, offset: 10 }),
      )
    })

    it('returns 400 when requested userId does not match authenticated user', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      const response = await listMemories({
        request: makeRequest(
          'http://localhost/api/memory/list?userId=someone-else',
        ),
      })
      expect(response.status).toBe(400)
    })
  })

  // ------------------------------------------------------------------
  // GET / POST /api/memory/search
  // ------------------------------------------------------------------
  describe('GET /api/memory/search', () => {
    it('returns 400 when query is missing', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      const response = await searchGet({
        request: makeRequest('http://localhost/api/memory/search'),
      })
      expect(response.status).toBe(400)
    })

    it('returns 200 with results on success', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.searchMemories.mockResolvedValue({
        memories: [{ id: 'mem-1', content: 'matching', metadata: {} }],
        total: 1,
      })

      const response = await searchGet({
        request: makeRequest('http://localhost/api/memory/search?q=match'),
      })
      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        query: string
        memories: unknown[]
      }
      expect(body.query).toBe('match')
      expect(gateway.searchMemories).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'match' }),
      )
    })
  })

  describe('POST /api/memory/search', () => {
    it('returns 200 with results on success', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.searchMemories.mockResolvedValue({
        memories: [],
        total: 0,
      })

      const response = await searchPost({
        request: makeRequest('http://localhost/api/memory/search', {
          query: 'find me',
        }),
      })
      expect(response.status).toBe(200)
      expect(gateway.searchMemories).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'find me' }),
      )
    })
  })

  // ------------------------------------------------------------------
  // PUT / PATCH /api/memory/update
  // ------------------------------------------------------------------
  describe('PUT /api/memory/update', () => {
    it('returns 400 when memoryId or content missing', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      const response = await updatePut({
        request: makeRequest('http://localhost/api/memory/update', {
          content: 'new',
        }),
      })
      expect(response.status).toBe(400)
    })

    it('returns 200 and calls gateway on success', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.updateMemory.mockResolvedValue({
        id: 'mem-1',
        content: 'updated',
        metadata: {},
      })

      const response = await updatePut({
        request: makeRequest('http://localhost/api/memory/update', {
          memoryId: 'mem-1',
          content: 'updated',
        }),
      })
      expect(response.status).toBe(200)
      expect(gateway.updateMemory).toHaveBeenCalledWith(
        expect.objectContaining({ memoryId: 'mem-1', content: 'updated' }),
      )
    })
  })

  describe('PATCH /api/memory/update', () => {
    it('shares the same handler as PUT', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.updateMemory.mockResolvedValue({
        id: 'mem-1',
        content: 'updated',
        metadata: {},
      })

      const response = await updatePatch({
        request: makeRequest('http://localhost/api/memory/update', {
          memoryId: 'mem-1',
          content: 'updated',
        }),
      })
      expect(response.status).toBe(200)
    })
  })

  // ------------------------------------------------------------------
  // DELETE /api/memory/delete
  // ------------------------------------------------------------------
  describe('DELETE /api/memory/delete', () => {
    it('returns 400 when memoryId is missing', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      const response = await deleteMemoryRoute({
        request: makeRequest('http://localhost/api/memory/delete', {}),
      })
      expect(response.status).toBe(400)
    })

    it('returns 200 on success', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.deleteMemory.mockResolvedValue(undefined)

      const response = await deleteMemoryRoute({
        request: makeRequest('http://localhost/api/memory/delete', {
          memoryId: 'mem-1',
        }),
      })
      expect(response.status).toBe(200)
      expect(gateway.deleteMemory).toHaveBeenCalledWith(
        expect.objectContaining({ memoryId: 'mem-1' }),
      )
    })
  })

  // ------------------------------------------------------------------
  // /api/memory/:memoryId
  // ------------------------------------------------------------------
  describe('GET /api/memory/:memoryId', () => {
    it('returns 200 with the memory', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.getMemory.mockResolvedValue({
        id: 'mem-1',
        content: 'hello',
        metadata: {},
      })

      const response = await getMemoryById({
        params: { memoryId: 'mem-1' },
        request: makeRequest('http://localhost/api/memory/mem-1'),
      })
      expect(response.status).toBe(200)
      const body = (await response.json()) as { memory: { id: string } }
      expect(body.memory.id).toBe('mem-1')
    })

    it('returns 404 when gateway resolves to null', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.getMemory.mockResolvedValue(null)

      const response = await getMemoryById({
        params: { memoryId: 'mem-999' },
        request: makeRequest('http://localhost/api/memory/mem-999'),
      })
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /api/memory/:memoryId', () => {
    it('returns 200 on success', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.updateMemory.mockResolvedValue({
        id: 'mem-1',
        content: 'patched',
        metadata: {},
      })

      const response = await patchMemoryById({
        params: { memoryId: 'mem-1' },
        request: makeRequest('http://localhost/api/memory/mem-1', {
          content: 'patched',
        }),
      })
      expect(response.status).toBe(200)
    })
  })

  describe('DELETE /api/memory/:memoryId', () => {
    it('returns 200 on success', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.deleteMemory.mockResolvedValue(undefined)

      const response = await deleteMemoryById({
        params: { memoryId: 'mem-1' },
        request: makeRequest('http://localhost/api/memory/mem-1'),
      })
      expect(response.status).toBe(200)
    })
  })

  // ------------------------------------------------------------------
  // GET /api/memory/stats
  // ------------------------------------------------------------------
  describe('GET /api/memory/stats', () => {
    it('returns 200 with stats on success', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.getMemoryStats.mockResolvedValue({
        totalMemories: 42,
        categoryCounts: { emotion: 10, bias: 5 },
      })

      const response = await getMemoryStats({
        request: makeRequest('http://localhost/api/memory/stats'),
      })
      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        totalMemories: number
        categoryCounts: Record<string, number>
      }
      expect(body.totalMemories).toBe(42)
      expect(body.categoryCounts).toEqual({ emotion: 10, bias: 5 })
    })
  })
})
