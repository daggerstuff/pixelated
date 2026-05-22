/**
 * Unit tests for src/lib/memory/memory-api-client.ts — PIX-510 Task 4.
 * Uses a mock fetch to test client logic without needing a running server.
 */

import { describe, it, expect, vi } from 'vitest'

import { MemoryApiClient, MemoryApiError } from '../memory-api-client'

// ─── Mock fetch factory ───────────────────────────────────────────────────────

type MockFetch = jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>

function createMockClient(mockFetch: MockFetch) {
  return new MemoryApiClient({
    baseUrl: 'http://test:8000',
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

function mockNoContent(status = 204) {
  return Promise.resolve(new Response(null, { status })) as unknown as Response
}

function mockError(status: number, body: unknown = {}) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as Response
}

// ─── Health ───────────────────────────────────────────────────────────────────

describe('health()', () => {
  it('returns health status', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      mockJsonResponse({
        status: 'ok',
        memory_count: 42,
        scorer_latency_ms: 0.01,
        classifier_latency_ms: 0.02,
      }),
    )
    const client = createMockClient(mockFetch)
    const result = await client.health()
    expect(result.status).toBe('ok')
    expect(result.memoryCount).toBe(42)
    expect(result.scorerLatencyMs).toBe(0.01)
  })
})

// ─── Create ────────────────────────────────────────────────────────────────────

describe('create()', () => {
  it('creates a memory block', async () => {
    const mockBlock = {
      id: 'mem_123',
      tenantId: 't1',
      sessionId: 's1',
      content: 'Test memory',
      timestamp: Date.now(),
      importance: {
        raw: 0.5,
        recency: 0.9,
        relevance: 0.5,
        emotionalWeight: 1,
        actionability: 0.5,
      },
      emotions: { valence: 0.5, arousal: 0.5, categories: ['joy'] },
      gating: {
        piiStatus: 'absent',
        crisisFlag: false,
        traumaIndicators: [],
        consentGate: 'open',
      },
      consolidation: {
        phase: 'raw',
        lastProcessed: Date.now(),
        remCycles: 3,
        schemaReferences: [],
      },
    }
    const mockFetch = jest
      .fn()
      .mockResolvedValue(mockJsonResponse(mockBlock, 201))
    const client = createMockClient(mockFetch)

    const result = await client.create({
      tenantId: 't1',
      sessionId: 's1',
      content: 'Test memory',
    })

    expect(result.id).toBe('mem_123')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://test:8000/memories',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

// ─── Search ────────────────────────────────────────────────────────────────────

describe('search()', () => {
  it('builds correct query params', async () => {
    const mockFetch = jest.fn().mockResolvedValue(mockJsonResponse([]))
    const client = createMockClient(mockFetch)

    await client.search({
      tenantId: 't1',
      minImportance: 0.5,
      crisisOnly: true,
      limit: 10,
      offset: 5,
    })

    const call = mockFetch.mock.calls[0]
    const url = call[0] as string
    expect(url).toContain('tenant_id=t1')
    expect(url).toContain('min_importance=0.5')
    expect(url).toContain('crisis_only=true')
    expect(url).toContain('limit=10')
    expect(url).toContain('offset=5')
  })

  it('returns empty array for unknown tenant', async () => {
    const mockFetch = jest.fn().mockResolvedValue(mockJsonResponse([]))
    const client = createMockClient(mockFetch)
    const result = await client.search({ tenantId: 'unknown' })
    expect(result).toHaveLength(0)
  })
})

// ─── Get ──────────────────────────────────────────────────────────────────────

describe('get()', () => {
  it('fetches a single memory by id', async () => {
    const mockBlock = {
      id: 'mem_123',
      tenantId: 't1',
      sessionId: 's1',
      content: 'Test',
      timestamp: 0,
      importance: {
        raw: 0.5,
        recency: 0,
        relevance: 0,
        emotionalWeight: 1,
        actionability: 0.5,
      },
      emotions: { valence: 0.5, arousal: 0.5, categories: [] },
      gating: {
        piiStatus: 'absent',
        crisisFlag: false,
        traumaIndicators: [],
        consentGate: 'open',
      },
      consolidation: {
        phase: 'raw',
        lastProcessed: 0,
        remCycles: 0,
        schemaReferences: [],
      },
    }
    const mockFetch = jest.fn().mockResolvedValue(mockJsonResponse(mockBlock))
    const client = createMockClient(mockFetch)

    const result = await client.get('mem_123', 't1')

    expect(result.id).toBe('mem_123')
    const call = mockFetch.mock.calls[0]
    const url = call[0] as string
    expect(url).toContain('mem_123')
    expect(url).toContain('tenant_id=t1')
  })
})

// ─── Delete ───────────────────────────────────────────────────────────────────

describe('delete()', () => {
  it('sends DELETE request', async () => {
    const mockFetch = jest.fn().mockResolvedValue(mockNoContent())
    const client = createMockClient(mockFetch)

    await client.delete('mem_123', 't1')

    const call = mockFetch.mock.calls[0]
    expect((call[1] as RequestInit).method).toBe('DELETE')
  })

  it('throws MemoryApiError on 404', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValue(mockError(404, { detail: 'Not found' }))
    const client = createMockClient(mockFetch)

    await expect(client.delete('nonexistent', 't1')).rejects.toThrow(
      MemoryApiError,
    )
  })
})

// ─── Score ─────────────────────────────────────────────────────────────────────

describe('score()', () => {
  it('returns score response', async () => {
    const mockScore = {
      id: 'mem_123',
      importance: {
        raw: 0.72,
        recency: 0.85,
        relevance: 0.91,
        emotionalWeight: 2.0,
        actionability: 0.5,
      },
      components: {
        recency: 0.85,
        relevance: 0.91,
        emotionalWeight: 2.0,
        actionability: 0.5,
      },
    }
    const mockFetch = jest.fn().mockResolvedValue(mockJsonResponse(mockScore))
    const client = createMockClient(mockFetch)

    const result = await client.score('mem_123', 't1')

    expect(result.id).toBe('mem_123')
    expect(result.components.recency).toBe(0.85)
  })
})

// ─── Trajectory ───────────────────────────────────────────────────────────────

describe('trajectory()', () => {
  it('returns trajectory data', async () => {
    const mockTraj = {
      sessionId: 's1',
      memoryCount: 3,
      trend: 'escalating',
      crisisIndicators: [],
      maxIntensity: 0.8,
      trajectory: [
        { memoryId: 'm1', valence: 0.6, arousal: 0.5, dominance: 0.7 },
        { memoryId: 'm2', valence: 0.5, arousal: 0.6, dominance: 0.6 },
        { memoryId: 'm3', valence: 0.4, arousal: 0.8, dominance: 0.4 },
      ],
    }
    const mockFetch = jest.fn().mockResolvedValue(mockJsonResponse(mockTraj))
    const client = createMockClient(mockFetch)

    const result = await client.trajectory('s1', 't1')

    expect(result.sessionId).toBe('s1')
    expect(result.trend).toBe('escalating')
    expect(result.trajectory).toHaveLength(3)
  })
})
