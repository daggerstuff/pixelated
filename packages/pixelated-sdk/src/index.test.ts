/**
 * SDK Contract Tests
 *
 * These tests verify the SDK contract against the OpenAPI specification.
 * Run these tests to ensure the SDK remains compatible with the API.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import { PixelatedClient, ForesightClientError } from './index'

// Mock fetch for testing
const mockFetch = vi.fn()
globalThis.fetch = mockFetch as any

describe('SDK Contract Tests', () => {
  let client: PixelatedClient

  beforeEach(() => {
    mockFetch.mockClear()
    client = new PixelatedClient({
      apiKey: 'test_key',
      baseUrl: 'https://api.pixelatedempathy.com/api/v1',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('System Endpoints', () => {
    it('getHealth should call /health endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'healthy',
          timestamp: new Date().toISOString(),
        }),
        text: async () => JSON.stringify({ status: 'healthy' }),
      } as any)

      await client.system.getHealth()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object),
      )
    })
  })

  describe('User Endpoints', () => {
    it('getProfile should call /profile endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ profile: { id: '1', email: 'test@example.com' } }),
        text: async () => JSON.stringify({ profile: {} }),
      } as any)

      await client.user.getProfile()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profile'),
        expect.any(Object),
      )
    })

    it('getPreferences should call /preferences endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ preferences: { theme: 'dark' } }),
        text: async () => JSON.stringify({ preferences: {} }),
      } as any)

      await client.user.getPreferences()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/preferences'),
        expect.any(Object),
      )
    })
  })

  describe('Search Endpoint', () => {
    it('query should call /search with query params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
        text: async () => JSON.stringify({ results: [] }),
      } as any)

      await client.search.query('test query', { limit: 10 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/search?q=test+query'),
        expect.any(Object),
      )
    })
  })

  describe('Bias Analysis Endpoint', () => {
    it('analyze should call /bias-analysis/analyze', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '1', biases: [], overallScore: 0 }),
        text: async () => JSON.stringify({}),
      } as any)

      await client.biasAnalysis.analyze({ text: 'test' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bias-analysis/analyze'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('Memory Endpoints', () => {
    it('listSessions should call /memory/sessions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [] }),
        text: async () => JSON.stringify({ sessions: [] }),
      } as any)

      await client.memory.listSessions({ limit: 10 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/memory/sessions'),
        expect.any(Object),
      )
    })

    it('getSession should call /memory/sessions/:id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: { id: '123' } }),
        text: async () => JSON.stringify({ session: {} }),
      } as any)

      await client.memory.getSession('123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/memory/sessions/123'),
        expect.any(Object),
      )
    })

    it('addTurn should call /memory/sessions/:id/turns', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ turn: { id: '1' } }),
        text: async () => JSON.stringify({ turn: {} }),
      } as any)

      await client.memory.addTurn('123', { role: 'user', content: 'hello' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/memory/sessions/123/turns'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('Developer API Keys', () => {
    it('list should call /developer/api-keys', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ keys: [] }),
        text: async () => JSON.stringify({ keys: [] }),
      } as any)

      await client.apiKeys.list()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/developer/api-keys'),
        expect.any(Object),
      )
    })

    it('create should call /developer/api-keys with POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'new_key', id: '123' }),
        text: async () => JSON.stringify({}),
      } as any)

      await client.apiKeys.create('Test Key', ['read'])

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/developer/api-keys'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('revoke should call /developer/api-keys/:id with DELETE', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        text: async () => JSON.stringify({}),
      } as any)

      await client.apiKeys.revoke('123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/developer/api-keys/123'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  describe('Authentication Headers', () => {
    it('should include X-API-Key header when apiKey is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        text: async () => JSON.stringify({}),
      } as any)

      const clientWithKey = new PixelatedClient({ apiKey: 'test_key' })
      await clientWithKey.system.getHealth()

      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[1]?.headers).toMatchObject({
        'X-API-Key': 'test_key',
      })
    })

    it('should include Authorization header when jwt is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        text: async () => JSON.stringify({}),
      } as any)

      const clientWithJwt = new PixelatedClient({ jwt: 'test_jwt' })
      await clientWithJwt.system.getHealth()

      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[1]?.headers).toMatchObject({
        Authorization: 'Bearer test_jwt',
      })
    })
  })

  describe('Error Handling', () => {
    it('should throw ApiError on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' }),
        text: async () => JSON.stringify({ error: 'Invalid API key' }),
      } as any)

      await expect(() => client.system.getHealth()).rejects.toThrow(
        'Invalid API key',
      )
    })

    it('should retry on 429 rate limit', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Map([['retry-after', '1']]),
          json: async () => ({}),
          text: async () => JSON.stringify({}),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
          text: async () => JSON.stringify({}),
        } as any)

      const clientWithRetries = new PixelatedClient({
        apiKey: 'test',
        maxRetries: 1,
        retryDelay: 10,
      })

      await clientWithRetries.system.getHealth()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('ForesightClient', () => {
    const memoryBase = 'https://api.pixelatedempathy.com/api/v1/memory'

    it('storeMemory should POST to /api/v1/memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'mem-1',
          content: 'test',
          category: 'fact',
          scope: 'session',
          retention: 'short_term',
          importance: 0.5,
          createdAt: '2026-01-01T00:00:00Z',
        }),
        text: async () => JSON.stringify({}),
      } as any)

      const result = await client.foresight.storeMemory({ content: 'test' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(memoryBase),
        expect.objectContaining({ method: 'POST' }),
      )
      expect(result.id).toBe('mem-1')
    })

    it('getMemory should GET /api/v1/memory/:id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'mem-1',
            content: 'test',
            category: 'fact',
            scope: 'session',
            retention: 'short_term',
            importance: 0.5,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: null,
          },
        }),
        text: async () => JSON.stringify({}),
      } as any)

      const result = await client.foresight.getMemory({ memoryId: 'mem-1' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`${memoryBase}/mem-1`),
        expect.any(Object),
      )
      expect(result.id).toBe('mem-1')
    })

    it('queryMemories should GET /api/v1/memory/search?q=...', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          pagination: { limit: 10, offset: 0, total: 0 },
        }),
        text: async () => JSON.stringify({}),
      } as any)

      const result = await client.foresight.queryMemories({
        query: 'test search',
        limit: 10,
        offset: 0,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/search?q=test+search'),
        expect.any(Object),
      )
      expect(result.pagination.total).toBe(0)
    })

    it('listMemories should GET /api/v1/memory?limit=...', async () => {
      const mockResponse = {
        data: [],
        pagination: { limit: 5, offset: 0, total: 0 },
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      } as any)

      const result = await client.foresight.listMemories({
        limit: 5,
        offset: 0,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=5'),
        expect.any(Object),
      )
      expect(result.pagination.limit).toBe(5)
    })

    it('updateMemory should PATCH /api/v1/memory/:id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'mem-1',
            content: 'updated',
            category: 'fact',
            scope: 'session',
            retention: 'short_term',
            importance: 0.8,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
          },
        }),
        text: async () => JSON.stringify({}),
      } as any)

      const result = await client.foresight.updateMemory({
        memoryId: 'mem-1',
        content: 'updated',
        importance: 0.8,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`${memoryBase}/mem-1`),
        expect.objectContaining({ method: 'PATCH' }),
      )
      expect(result.importance).toBe(0.8)
    })

    it('deleteMemory should DELETE /api/v1/memory/:id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'mem-1' }),
        text: async () => JSON.stringify({}),
      } as any)

      const result = await client.foresight.deleteMemory({
        memoryId: 'mem-1',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`${memoryBase}/mem-1`),
        expect.objectContaining({ method: 'DELETE' }),
      )
      expect(result.id).toBe('mem-1')
    })

    it('should throw ForesightClientError on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: async () => ({ error: 'Validation failed' }),
        text: async () => JSON.stringify({}),
      } as any)

      await expect(() =>
        client.foresight.storeMemory({ content: 'test' }),
      ).rejects.toThrow(ForesightClientError)
    })

    it('should forward X-API-Key header from parent client', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          pagination: { limit: 10, offset: 0, total: 0 },
        }),
        text: async () => JSON.stringify({}),
      } as any)

      await client.foresight.listMemories()

      const callHeaders = mockFetch.mock.calls[0][1]?.headers as Headers
      expect(callHeaders.get('X-API-Key')).toBe('test_key')
    })

    it('should forward Authorization header when parent uses JWT', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          pagination: { limit: 10, offset: 0, total: 0 },
        }),
        text: async () => JSON.stringify({}),
      } as any)

      const jwtClient = new PixelatedClient({ jwt: 'test_jwt' })
      await jwtClient.foresight.listMemories()

      const callHeaders = mockFetch.mock.calls[0][1]?.headers as Headers
      expect(callHeaders.get('Authorization')).toBe('Bearer test_jwt')
    })

    it('storeMemory should reject invalid input via Zod', async () => {
      await expect(() =>
        (client.foresight.storeMemory as any)({ content: '' }),
      ).rejects.toThrow()
    })
  })

  describe('Developer Memory Endpoints', () => {
    const developerBase =
      'https://api.pixelatedempathy.com/api/v1/developer/memory'

    it('developer.memory.storeMemory should POST to /api/v1/developer/memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'mem-dev-1',
          content: 'developer memory',
          category: 'fact',
          scope: 'session',
          retention: 'short_term',
          importance: 0.5,
          createdAt: '2026-01-01T00:00:00Z',
        }),
        text: async () => JSON.stringify({}),
      } as any)

      const result = await client.developer.memory.storeMemory({
        content: 'developer memory',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(developerBase),
        expect.objectContaining({ method: 'POST' }),
      )
      expect(result.id).toBe('mem-dev-1')
    })

    it('developer.memory.getMemory should GET /api/v1/developer/memory/:id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'mem-dev-1',
            content: 'developer memory',
            category: 'fact',
            scope: 'session',
            retention: 'short_term',
            importance: 0.5,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: null,
          },
        }),
        text: async () => JSON.stringify({}),
      } as any)

      const result = await client.developer.memory.getMemory({
        memoryId: 'mem-dev-1',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`${developerBase}/mem-dev-1`),
        expect.any(Object),
      )
      expect(result.id).toBe('mem-dev-1')
    })

    it('developer.memory.listMemories should GET /api/v1/developer/memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          pagination: { limit: 10, offset: 0, total: 0 },
        }),
        text: async () => JSON.stringify({}),
      } as any)

      await client.developer.memory.listMemories({ limit: 10, offset: 0 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(developerBase),
        expect.any(Object),
      )
    })

    it('should forward X-API-Key header to developer endpoints', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          pagination: { limit: 10, offset: 0, total: 0 },
        }),
        text: async () => JSON.stringify({}),
      } as any)

      await client.developer.memory.listMemories()

      const callHeaders = mockFetch.mock.calls[0][1]?.headers as Headers
      expect(callHeaders.get('X-API-Key')).toBe('test_key')
    })
  })
})
