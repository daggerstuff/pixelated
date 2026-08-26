/**
 * Unit tests for src/lib/memory/memory-api-client.ts — PIX-3903.
 */

import { describe, it, expect, vi } from 'vitest'

import {
  DEFAULT_MEMORY_API_BASE_URL,
  DEFAULT_INGESTION_GATE_BASE_URL,
  IngestionGateClient,
  MemoryApiClient,
  MemoryApiClientError,
} from '../memory-api-client'

type MockFetch = ReturnType<typeof vi.fn>

function createMockClient(mockFetch: MockFetch) {
  return new MemoryApiClient({
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

function mockError(status: number, body: unknown = {}) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as Response
}

const sampleMemory = {
  id: '00000000-0000-4000-8000-000000000001',
  content: 'Test memory',
  scope: 'session' as const,
  retention: 'short_term' as const,
  category: 'general',
  tags: ['test'],
  version: 1,
  importance: 0.5,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null,
}

describe('MemoryApiClient defaults', () => {
  it('uses /api/v1/memory as the default base URL', () => {
    const client = new MemoryApiClient()
    expect(client.baseUrl).toBe(DEFAULT_MEMORY_API_BASE_URL)
    expect(client.baseUrl).toBe('/api/v1/memory')
  })
})

describe('IngestionGateClient defaults', () => {
  it('uses /api/ingestion/gate as the default base URL', () => {
    const client = new IngestionGateClient()
    expect(client.baseUrl).toBe(DEFAULT_INGESTION_GATE_BASE_URL)
    expect(client.baseUrl).toBe('/api/ingestion/gate')
  })
})

describe('create()', () => {
  it('posts to /api/v1/memory and returns the v1 envelope', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(mockJsonResponse({ data: sampleMemory }, 201))
    const client = createMockClient(mockFetch)

    const result = await client.create({ content: 'Test memory' })

    expect(result.data.id).toBe(sampleMemory.id)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/memory',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('list()', () => {
  it('gets /api/v1/memory with query params', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        data: [sampleMemory],
        pagination: { limit: 10, offset: 0, total: 1 },
      }),
    )
    const client = createMockClient(mockFetch)

    await client.list({
      limit: 10,
      offset: 0,
      category: 'general',
      tags: undefined,
    })

    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('/api/v1/memory')
    expect(url).toContain('limit=10')
    expect(url).toContain('offset=0')
    expect(url).toContain('category=general')
  })
})

describe('search()', () => {
  it('posts to /api/v1/memory/search', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        data: [sampleMemory],
        query: 'test',
        pagination: { limit: 10, offset: 0, total: 1 },
      }),
    )
    const client = createMockClient(mockFetch)

    await client.search({ q: 'test', limit: 10 })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/memory/search',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('update()', () => {
  it('patches /api/v1/memory/:id', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(mockJsonResponse({ data: sampleMemory }))
    const client = createMockClient(mockFetch)

    await client.update(sampleMemory.id, { content: 'Updated' })

    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toBe(`/api/v1/memory/${sampleMemory.id}`)
    expect((mockFetch.mock.calls[0][1] as RequestInit).method).toBe('PATCH')
  })
})

describe('delete()', () => {
  it('deletes /api/v1/memory/:id', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(mockJsonResponse({ data: { id: sampleMemory.id } }))
    const client = createMockClient(mockFetch)

    await client.delete(sampleMemory.id)

    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toBe(`/api/v1/memory/${sampleMemory.id}`)
    expect((mockFetch.mock.calls[0][1] as RequestInit).method).toBe('DELETE')
  })

  it('throws MemoryApiClientError on 404', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        mockError(404, { error: 'not_found', message: 'Not found' }),
      )
    const client = createMockClient(mockFetch)

    await expect(client.delete(sampleMemory.id)).rejects.toThrow(
      MemoryApiClientError,
    )
  })
})

describe('ingest()', () => {
  it('posts to /api/ingestion/gate/ingest', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        accepted: true,
        report: { passed: true },
        request_id: 'req-1',
      }),
    )
    const client = new IngestionGateClient({
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    const result = await client.ingest({
      content: 'Test memory',
      source_id: 'source-1',
      user_id: 'user-1',
    })

    expect(result.accepted).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ingestion/gate/ingest',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('health()', () => {
  it('gets /api/ingestion/gate/health', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(mockJsonResponse({ status: 'healthy' }))
    const client = new IngestionGateClient({
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    const result = await client.health()

    expect(result['status']).toBe('healthy')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ingestion/gate/health',
      expect.objectContaining({}),
    )
  })
})
