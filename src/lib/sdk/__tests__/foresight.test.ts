/**
 * Unit tests for src/lib/sdk/foresight.ts — PIX-3832.
 */

import { describe, it, expect, vi } from 'vitest'

import {
  ForesightClient,
  ForesightClientError,
  StoreMemoryInput,
  GetMemoryInput,
  QueryMemoriesInput,
  DeleteMemoryInput,
  ForesightMemory,
} from '../foresight'

type MockFetch = ReturnType<typeof vi.fn>

function createTestClient(mockFetch: MockFetch) {
  return new ForesightClient({
    baseUrl: '/api/v1/memory',
    fetchFn: mockFetch as unknown as typeof fetch,
  })
}

function mockJsonResponse(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as Response
}

const sampleForesightMemory = {
  id: '00000000-0000-4000-8000-000000000001',
  content: 'Test memory content',
  category: 'fact',
  tags: ['test'],
  scope: 'fact',
  retention: 'short_term',
  importance: 0.5,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null,
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe('StoreMemoryInput schema', () => {
  it('accepts valid minimal input', () => {
    const result = StoreMemoryInput.safeParse({ content: 'Hello world' })
    expect(result.success).toBe(true)
  })

  it('accepts full input with all optional fields', () => {
    const result = StoreMemoryInput.safeParse({
      content: 'Hello',
      category: 'fact',
      tags: ['tag1', 'tag2'],
      scope: 'session',
      retention: 'long_term',
      importance: 0.8,
      emotionalContext: { valence: 0.5, arousal: 0.3 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty content', () => {
    const result = StoreMemoryInput.safeParse({ content: '' })
    expect(result.success).toBe(false)
  })

  it('rejects content exceeding max length', () => {
    const result = StoreMemoryInput.safeParse({
      content: 'x'.repeat(64_001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown keys due to .strict()', () => {
    const result = StoreMemoryInput.safeParse({
      content: 'Hello',
      unknownField: 'disallowed',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid importance outside [0, 1]', () => {
    const result = StoreMemoryInput.safeParse({
      content: 'Hello',
      importance: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('GetMemoryInput schema', () => {
  it('accepts valid UUID', () => {
    const result = GetMemoryInput.safeParse({
      memoryId: '00000000-0000-4000-8000-000000000001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid UUID', () => {
    const result = GetMemoryInput.safeParse({ memoryId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects unknown keys', () => {
    const result = GetMemoryInput.safeParse({
      memoryId: '00000000-0000-4000-8000-000000000001',
      extra: 'disallowed',
    })
    expect(result.success).toBe(false)
  })
})

describe('QueryMemoriesInput schema', () => {
  it('accepts minimal query', () => {
    const result = QueryMemoriesInput.safeParse({ query: 'therapeutic' })
    expect(result.success).toBe(true)
  })

  it('applies defaults for limit and offset', () => {
    const result = QueryMemoriesInput.safeParse({ query: 'test' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(10)
      expect(result.data.offset).toBe(0)
    }
  })

  it('rejects query shorter than 1 char', () => {
    const result = QueryMemoriesInput.safeParse({ query: '' })
    expect(result.success).toBe(false)
  })

  it('rejects limit of 0', () => {
    const result = QueryMemoriesInput.safeParse({
      query: 'test',
      limit: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects limit over 100', () => {
    const result = QueryMemoriesInput.safeParse({
      query: 'test',
      limit: 101,
    })
    expect(result.success).toBe(false)
  })
})

describe('DeleteMemoryInput schema', () => {
  it('accepts valid UUID', () => {
    const result = DeleteMemoryInput.safeParse({
      memoryId: '00000000-0000-4000-8000-000000000001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing memoryId', () => {
    const result = DeleteMemoryInput.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('ForesightMemory schema', () => {
  it('parses valid memory record', () => {
    const result = ForesightMemory.safeParse(sampleForesightMemory)
    expect(result.success).toBe(true)
  })

  it('accepts optional emotionalContext', () => {
    const result = ForesightMemory.safeParse({
      ...sampleForesightMemory,
      emotionalContext: {
        valence: 0.2,
        arousal: 0.8,
        primary_emotion: 'joy',
        intensity: 0.9,
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts extra fields silently (lenient output schema)', () => {
    // ForesightMemory is the output schema — the API may return internal
    // fields beyond the public contract. Unknown keys are allowed.
    const result = ForesightMemory.safeParse({
      ...sampleForesightMemory,
      extraField: 'allowed',
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Client methods
// ---------------------------------------------------------------------------

describe('ForesightClient storeMemory', () => {
  it('POSTs to baseUrl with validated body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        id: '00000000-0000-4000-8000-000000000001',
        content: 'Hello',
        category: 'fact',
        tags: [],
        scope: 'fact',
        retention: 'short_term',
        importance: 0.5,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    )
    const client = createTestClient(mockFetch)

    await client.storeMemory({ content: 'Hello', category: 'fact' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/memory')
    expect(init.method).toBe('POST')
  })

  it('throws ForesightClientError on non-2xx', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = createTestClient(mockFetch)

    await expect(client.storeMemory({ content: 'Hello' })).rejects.toThrow(
      ForesightClientError,
    )
  })
})

describe('ForesightClient getMemory', () => {
  it('GETs /:memoryId', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        data: sampleForesightMemory,
      }),
    )
    const client = createTestClient(mockFetch)

    await client.getMemory({
      memoryId: '00000000-0000-4000-8000-000000000001',
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toBe('/api/v1/memory/00000000-0000-4000-8000-000000000001')
  })
})

describe('ForesightClient queryMemories', () => {
  it('GETs /search with query params', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        data: [sampleForesightMemory],
        pagination: { limit: 10, offset: 0, total: 1 },
      }),
    )
    const client = createTestClient(mockFetch)

    await client.queryMemories({
      query: 'therapeutic',
      limit: 10,
      offset: 0,
      useHybrid: true,
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toContain('/api/v1/memory/search')
    expect(url).toContain('q=therapeutic')
    expect(url).toContain('limit=10')
  })
})

describe('ForesightClient listMemories', () => {
  it('GETs / with limit and offset', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        data: [sampleForesightMemory],
        pagination: { limit: 20, offset: 0, total: 1 },
      }),
    )
    const client = createTestClient(mockFetch)

    await client.listMemories({ limit: 20, offset: 0 })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toBe('/api/v1/memory?limit=20&offset=0')
  })

  it('uses default limit 20 when called with no args', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        data: [],
        pagination: { limit: 20, offset: 0, total: 0 },
      }),
    )
    const client = createTestClient(mockFetch)

    await client.listMemories()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toBe('/api/v1/memory?limit=20&offset=0')
  })
})

describe('ForesightClient updateMemory', () => {
  it('PATCHes /:memoryId with body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        data: sampleForesightMemory,
      }),
    )
    const client = createTestClient(mockFetch)

    await client.updateMemory({
      memoryId: '00000000-0000-4000-8000-000000000001',
      content: 'Updated content',
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/memory/00000000-0000-4000-8000-000000000001')
    expect(init.method).toBe('PATCH')
  })
})

describe('ForesightClient deleteMemory', () => {
  it('DELETEs /:memoryId', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        id: '00000000-0000-4000-8000-000000000001',
      }),
    )
    const client = createTestClient(mockFetch)

    await client.deleteMemory({
      memoryId: '00000000-0000-4000-8000-000000000001',
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/memory/00000000-0000-4000-8000-000000000001')
    expect(init.method).toBe('DELETE')
  })
})

describe('ForesightClient default baseUrl', () => {
  it('defaults to /api/v1/memory', () => {
    const client = new ForesightClient()
    expect(client.baseUrl).toBe('/api/v1/memory')
  })
})
