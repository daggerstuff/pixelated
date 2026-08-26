/**
 * src/tests/api/v1/memory-routes.test.ts
 *
 * Integration tests for the v1 public memory API.
 *
 * These tests verify that the full request → auth → validation → gateway →
 * response pipeline works end-to-end through the middleware, contract schemas,
 * and route handlers.
 *
 * Unit-level contract tests live in
 * src/pages/api/v1/memory/__tests__/v1-memory-routes.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
} from '../../../pages/api/v1/memory/[memoryId]'
import {
  GET as listMemories,
  POST as createMemory,
} from '../../../pages/api/v1/memory/index'
import {
  GET as searchGet,
  POST as searchPost,
} from '../../../pages/api/v1/memory/search'

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

function uuid(id: number): string {
  const hex = id.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}

describe('GET /api/v1/memory', () => {
  let gateway: ReturnType<typeof makeGateway>

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = makeGateway()
    mockGetCurrentUser.mockResolvedValue(makeUser())
    ;(
      getProductMemoryGateway as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue(gateway)
  })

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const response = await listMemories({
      request: makeRequest('http://localhost/api/v1/memory'),
    })
    expect(response.status).toBe(401)
  })

  it('returns 200 with paginated results', async () => {
    const id = uuid(1)
    gateway.listMemories.mockResolvedValue({
      memories: [
        {
          id,
          content: 'memory content',
          metadata: {},
          scope: 'session',
          retention: 'short_term',
          category: 'general',
          tags: ['test'],
          version: 1,
          importance: 0.5,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: null,
        },
      ],
      total: 1,
    })

    const response = await listMemories({
      request: makeRequest('http://localhost/api/v1/memory?limit=10&offset=0'),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: unknown[]
      pagination: { limit: number; offset: number; total: number }
    }
    expect(body.data).toHaveLength(1)
    expect(body.pagination).toEqual({ limit: 10, offset: 0, total: 1 })
    expect(gateway.listMemories).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        limit: 10,
        offset: 0,
      }),
    )
  })

  it('returns 200 with empty list when no memories', async () => {
    gateway.listMemories.mockResolvedValue({ memories: [], total: 0 })

    const response = await listMemories({
      request: makeRequest('http://localhost/api/v1/memory'),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: unknown[]
      pagination: { total: number }
    }
    expect(body.data).toEqual([])
    expect(body.pagination.total).toBe(0)
  })

  it('returns 502 when gateway throws 502', async () => {
    gateway.listMemories.mockRejectedValue(
      new ProductMemoryGatewayError('upstream error', 502),
    )

    const response = await listMemories({
      request: makeRequest('http://localhost/api/v1/memory'),
    })
    expect(response.status).toBe(502)
  })
})

describe('POST /api/v1/memory', () => {
  let gateway: ReturnType<typeof makeGateway>

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = makeGateway()
    mockGetCurrentUser.mockResolvedValue(makeUser())
    ;(
      getProductMemoryGateway as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue(gateway)
  })

  it('returns 201 with created memory', async () => {
    const id = uuid(1)
    gateway.createMemory.mockResolvedValue({
      id,
      content: 'new memory',
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
        content: 'new memory',
      }),
    })
    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      data: { id: string; content: string }
    }
    expect(body.data.id).toBe(id)
    expect(body.data.content).toBe('new memory')
    expect(gateway.createMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'new memory',
        userId: 'user-123',
      }),
    )
  })

  it('returns 400 when content is missing', async () => {
    const response = await createMemory({
      request: makeRequest('http://localhost/api/v1/memory', {}),
    })
    expect(response.status).toBe(400)
    expect(gateway.createMemory).not.toHaveBeenCalled()
  })

  it('returns 400 when content is empty string', async () => {
    const response = await createMemory({
      request: makeRequest('http://localhost/api/v1/memory', {
        content: '',
      }),
    })
    expect(response.status).toBe(400)
    expect(gateway.createMemory).not.toHaveBeenCalled()
  })

  it('returns 400 when content is not a string', async () => {
    const response = await createMemory({
      request: makeRequest('http://localhost/api/v1/memory', {
        content: 42,
      }),
    })
    expect(response.status).toBe(400)
    expect(gateway.createMemory).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/memory/:memoryId', () => {
  let gateway: ReturnType<typeof makeGateway>

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = makeGateway()
    mockGetCurrentUser.mockResolvedValue(makeUser())
    ;(
      getProductMemoryGateway as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue(gateway)
  })

  it('returns 200 with the memory', async () => {
    const id = uuid(1)
    gateway.getMemory.mockResolvedValue({
      id,
      content: 'single memory',
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

    const response = await getMemoryById({
      params: { memoryId: id },
      request: makeRequest(`http://localhost/api/v1/memory/${id}`),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: { id: string; content: string }
    }
    expect(body.data.id).toBe(id)
    expect(body.data.content).toBe('single memory')
  })

  it('returns 404 when memory is not found', async () => {
    gateway.getMemory.mockResolvedValue(null)

    const response = await getMemoryById({
      params: { memoryId: uuid(1) },
      request: makeRequest(`http://localhost/api/v1/memory/${uuid(1)}`),
    })
    expect(response.status).toBe(404)
  })

  it('returns 400 when memoryId is not a valid UUID', async () => {
    const response = await getMemoryById({
      params: { memoryId: 'not-a-uuid' },
      request: makeRequest('http://localhost/api/v1/memory/not-a-uuid'),
    })
    expect(response.status).toBe(400)
    expect(gateway.getMemory).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/v1/memory/:memoryId', () => {
  let gateway: ReturnType<typeof makeGateway>

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = makeGateway()
    mockGetCurrentUser.mockResolvedValue(makeUser())
    ;(
      getProductMemoryGateway as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue(gateway)
  })

  it('returns 200 with updated memory', async () => {
    const id = uuid(1)
    gateway.updateMemory.mockResolvedValue({
      id,
      content: 'updated content',
      metadata: {},
      scope: 'session',
      retention: 'short_term',
      category: 'general',
      tags: [],
      version: 2,
      importance: 0.5,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })

    const response = await patchMemoryById({
      params: { memoryId: id },
      request: makeRequest(`http://localhost/api/v1/memory/${id}`, {
        content: 'updated content',
      }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: { id: string; content: string }
    }
    expect(body.data.id).toBe(id)
    expect(body.data.content).toBe('updated content')
  })

  it('returns 400 when content is missing', async () => {
    const response = await patchMemoryById({
      params: { memoryId: uuid(1) },
      request: makeRequest(`http://localhost/api/v1/memory/${uuid(1)}`, {}),
    })
    expect(response.status).toBe(400)
    expect(gateway.updateMemory).not.toHaveBeenCalled()
  })

  it('returns 400 when memoryId is invalid', async () => {
    const response = await patchMemoryById({
      params: { memoryId: 'bad' },
      request: makeRequest('http://localhost/api/v1/memory/bad', {
        content: 'hi',
      }),
    })
    expect(response.status).toBe(400)
    expect(gateway.updateMemory).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/v1/memory/:memoryId', () => {
  let gateway: ReturnType<typeof makeGateway>

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = makeGateway()
    mockGetCurrentUser.mockResolvedValue(makeUser())
    ;(
      getProductMemoryGateway as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue(gateway)
  })

  it('returns 200 with deleted id', async () => {
    const id = uuid(1)
    gateway.deleteMemory.mockResolvedValue(undefined)

    const response = await deleteMemoryById({
      params: { memoryId: id },
      request: makeRequest(`http://localhost/api/v1/memory/${id}`),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: { id: string } }
    expect(body.data.id).toBe(id)
    expect(gateway.deleteMemory).toHaveBeenCalledWith(
      expect.objectContaining({ memoryId: id }),
    )
  })

  it('returns 400 when memoryId is invalid', async () => {
    const response = await deleteMemoryById({
      params: { memoryId: 'bad' },
      request: makeRequest('http://localhost/api/v1/memory/bad'),
    })
    expect(response.status).toBe(400)
    expect(gateway.deleteMemory).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/memory/search', () => {
  let gateway: ReturnType<typeof makeGateway>

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = makeGateway()
    mockGetCurrentUser.mockResolvedValue(makeUser())
    ;(
      getProductMemoryGateway as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue(gateway)
  })

  it('returns 200 with search results', async () => {
    const id = uuid(1)
    gateway.searchMemories.mockResolvedValue({
      memories: [
        {
          id,
          content: 'found memory',
          metadata: {},
          scope: 'session',
          retention: 'short_term',
          category: 'general',
          tags: [],
          version: 1,
          importance: 0.5,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: null,
        },
      ],
      total: 1,
    })

    const response = await searchGet({
      request: makeRequest('http://localhost/api/v1/memory/search?q=test'),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: unknown[]
      pagination: { total: number }
    }
    expect(body.data).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })

  it('returns 400 when q is missing', async () => {
    const response = await searchGet({
      request: makeRequest('http://localhost/api/v1/memory/search'),
    })
    expect(response.status).toBe(400)
  })

  it('returns 502 when gateway errors', async () => {
    gateway.searchMemories.mockRejectedValue(
      new ProductMemoryGatewayError('search failed', 502),
    )
    const response = await searchGet({
      request: makeRequest('http://localhost/api/v1/memory/search?q=test'),
    })
    expect(response.status).toBe(502)
  })
})

describe('POST /api/v1/memory/search', () => {
  let gateway: ReturnType<typeof makeGateway>

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = makeGateway()
    mockGetCurrentUser.mockResolvedValue(makeUser())
    ;(
      getProductMemoryGateway as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue(gateway)
  })

  it('returns 200 with search results', async () => {
    gateway.searchMemories.mockResolvedValue({ memories: [], total: 0 })

    const response = await searchPost({
      request: makeRequest('http://localhost/api/v1/memory/search', {
        q: 'anxiety',
      }),
    })
    expect(response.status).toBe(200)
    expect(gateway.searchMemories).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'anxiety' }),
    )
  })

  it('returns 400 when q is missing', async () => {
    const response = await searchPost({
      request: makeRequest('http://localhost/api/v1/memory/search', {}),
    })
    expect(response.status).toBe(400)
    expect(gateway.searchMemories).not.toHaveBeenCalled()
  })

  it('returns 400 when query (not q) is used (v1 contract uses q)', async () => {
    const response = await searchPost({
      request: makeRequest('http://localhost/api/v1/memory/search', {
        query: 'anxiety',
      }),
    })
    expect(response.status).toBe(400)
    expect(gateway.searchMemories).not.toHaveBeenCalled()
  })
})

describe('v1 memory API — auth gating', () => {
  let gateway: ReturnType<typeof makeGateway>

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = makeGateway()
    ;(
      getProductMemoryGateway as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue(gateway)
  })

  it('all routes return 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const routes = [
      listMemories({ request: makeRequest('http://localhost/api/v1/memory') }),
      createMemory({
        request: makeRequest('http://localhost/api/v1/memory', {
          content: 'hi',
        }),
      }),
      getMemoryById({
        params: { memoryId: uuid(1) },
        request: makeRequest(`http://localhost/api/v1/memory/${uuid(1)}`),
      }),
      searchGet({
        request: makeRequest('http://localhost/api/v1/memory/search?q=test'),
      }),
    ]

    const results = await Promise.all(routes)
    for (const response of results) {
      expect(response.status).toBe(401)
    }
  })
})
