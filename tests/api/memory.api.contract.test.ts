import { test, expect } from '@playwright/test'
import { APIRequestContext, APIResponse } from '@playwright/test'

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5173'

// Helper functions
async function getAuthHeaders(): Promise<Record<string, string>> {
  // In a real test, we would get a valid JWT or API key
  // For now, we'll use a placeholder that should be replaced in actual test setup
  return {
    Authorization: `Bearer test-jwt-token`,
    'X-API-Key': 'test-api-key',
  }
}

async function makeRequest(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  options: {
    params?: Record<string, string | number | boolean>
    data?: unknown
    headers?: Record<string, string>
  } = {},
): Promise<APIResponse> {
  const url = new URL(`${BASE_URL}${endpoint}`)

  // Add query params
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value))
    })
  }

  const headers = {
    ...(await getAuthHeaders()),
    ...(options.headers || {}),
  }

  switch (method) {
    case 'GET':
      return request.get(url.toString(), { headers })
    case 'POST':
      return request.post(url.toString(), {
        data: options.data,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      })
    case 'PUT':
      return request.put(url.toString(), {
        data: options.data,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      })
    case 'DELETE':
      return request.delete(url.toString(), { headers })
  }
}

// Test suite
test.describe('Memory API Contract Tests', () => {
  let request: APIRequestContext

  test.beforeAll(async ({ request: apiRequest }) => {
    request = apiRequest
  })

  test.describe('Create Memory (POST /api/memory)', () => {
    test('should create a memory with valid content', async () => {
      const response = await makeRequest(request, 'POST', '/api/memory', {
        data: {
          content: 'Test memory content',
          metadata: { source: 'test', category: 'unit-test' },
        },
      })

      expect(response.status()).toBe(201)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.memory_id).toBeTruthy()
      expect(json.memory).toMatchObject({
        content: 'Test memory content',
        metadata: { source: 'test', category: 'unit-test' },
      })
      expect(json.memory.id).toBe(json.memory_id)
      expect(json.memory.createdAt).toBeTruthy()
    })

    test('should reject request with missing content', async () => {
      const response = await makeRequest(request, 'POST', '/api/memory', {
        data: {
          metadata: { source: 'test' },
        },
      })

      expect(response.status()).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Bad Request')
      expect(json.message).toContain('content parameter is required')
    })

    test('should reject request with empty content', async () => {
      const response = await makeRequest(request, 'POST', '/api/memory', {
        data: {
          content: '',
          metadata: { source: 'test' },
        },
      })

      expect(response.status()).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Bad Request')
      expect(json.message).toContain('content parameter is required')
    })
  })

  test.describe('List Memories (GET /api/memory)', () => {
    test('should list memories with pagination', async () => {
      // First create a memory to ensure we have something to list
      await makeRequest(request, 'POST', '/api/memory', {
        data: {
          content: 'Test memory for listing',
          metadata: { source: 'test', category: 'unit-test' },
        },
      })

      const response = await makeRequest(request, 'GET', '/api/memory', {
        params: {
          limit: 10,
          offset: 0,
        },
      })

      expect(response.status()).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(Array.isArray(json.memories)).toBe(true)
      expect(json.pagination).toMatchObject({
        limit: 10,
        offset: 0,
      })
      expect(json.pagination.total).toBeGreaterThanOrEqual(0)
    })

    test('should filter memories by category', async () => {
      const response = await makeRequest(request, 'GET', '/api/memory', {
        params: {
          category: 'unit-test',
        },
      })

      expect(response.status()).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      // All returned memories should have the unit-test category in metadata
      json.memories.forEach((memory: any) => {
        expect(memory.metadata.category).toBe('unit-test')
      })
    })
  })

  test.describe('Search Memories (GET /api/memory/search)', () => {
    test('should search memories by query string', async () => {
      // Create a memory with searchable content
      await makeRequest(request, 'POST', '/api/memory', {
        data: {
          content: 'This is a unique search term for testing',
          metadata: { source: 'test', category: 'search-test' },
        },
      })

      const response = await makeRequest(request, 'GET', '/api/memory/search', {
        params: {
          q: 'unique search term',
        },
      })

      expect(response.status()).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(Array.isArray(json.memories)).toBe(true)
      expect(json.query).toBe('unique search term')
      expect(json.memories.length).toBeGreaterThan(0)
      // At least one memory should contain the search term
      const found = json.memories.some((memory: any) =>
        memory.content.includes('unique search term'),
      )
      expect(found).toBe(true)
    })

    test('should reject search with missing query parameter', async () => {
      const response = await makeRequest(request, 'GET', '/api/memory/search', {
        params: {
          limit: 10,
        },
      })

      expect(response.status()).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Bad Request')
      expect(json.message).toContain('Search query string is required')
    })
  })

  test.describe('Get Memory by ID (GET /api/memory/:memoryId)', () => {
    test('should retrieve a specific memory by ID', async () => {
      // Create a memory
      const createResponse = await makeRequest(request, 'POST', '/api/memory', {
        data: {
          content: 'Test memory for retrieval',
          metadata: { source: 'test', category: 'retrieval-test' },
        },
      })

      expect(createResponse.status()).toBe(201)
      const createJson = await createResponse.json()
      const memoryId = createJson.memory_id

      // Retrieve the memory
      const response = await makeRequest(
        request,
        'GET',
        `/api/memory/${memoryId}`,
      )

      expect(response.status()).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.memory).toMatchObject({
        id: memoryId,
        content: 'Test memory for retrieval',
        metadata: { source: 'test', category: 'retrieval-test' },
      })
      expect(json.memory.createdAt).toBeTruthy()
    })

    test('should return 404 for non-existent memory ID', async () => {
      const response = await makeRequest(
        request,
        'GET',
        `/api/memory/00000000-0000-0000-0000-000000000000`,
      )

      expect(response.status()).toBe(404)
      const json = await response.json()
      expect(json.error).toBe('Not Found')
      expect(json.message).toBe('Memory not found')
    })
  })

  test.describe('Update Memory (PUT /api/memory/:memoryId)', () => {
    test('should update an existing memory', async () => {
      // Create a memory
      const createResponse = await makeRequest(request, 'POST', '/api/memory', {
        data: {
          content: 'Original content',
          metadata: { source: 'test', category: 'update-test', version: 1 },
        },
      })

      expect(createResponse.status()).toBe(201)
      const createJson = await createResponse.json()
      const memoryId = createJson.memory_id

      // Update the memory
      const response = await makeRequest(
        request,
        'PUT',
        `/api/memory/${memoryId}`,
        {
          data: {
            content: 'Updated content',
            metadata: { source: 'test', category: 'update-test', version: 2 },
          },
        },
      )

      expect(response.status()).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.memory).toMatchObject({
        id: memoryId,
        content: 'Updated content',
        metadata: { source: 'test', category: 'update-test', version: 2 },
      })
      expect(json.memory.updatedAt).toBeTruthy()
      // updatedAt should be newer than or equal to createdAt
      expect(new Date(json.memory.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(json.memory.createdAt).getTime(),
      )
    })

    test('should reject update with missing content', async () => {
      // Create a memory first
      const createResponse = await makeRequest(request, 'POST', '/api/memory', {
        data: {
          content: 'Original content',
          metadata: { source: 'test' },
        },
      })

      expect(createResponse.status()).toBe(201)
      const createJson = await createResponse.json()
      const memoryId = createJson.memory_id

      // Try to update with missing content
      const response = await makeRequest(
        request,
        'PUT',
        `/api/memory/${memoryId}`,
        {
          data: {
            metadata: { source: 'test' },
          },
        },
      )

      expect(response.status()).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Bad Request')
      expect(json.message).toBe('content parameter is required')
    })

    test('should return 404 for non-existent memory ID', async () => {
      const response = await makeRequest(
        request,
        'PUT',
        `/api/memory/00000000-0000-0000-0000-000000000000`,
        {
          data: {
            content: 'Updated content',
            metadata: { source: 'test' },
          },
        },
      )

      expect(response.status()).toBe(404)
      const json = await response.json()
      expect(json.error).toBe('Not Found')
      expect(json.message).toBe('Memory not found')
    })
  })

  test.describe('Delete Memory (DELETE /api/memory/:memoryId)', () => {
    test('should delete an existing memory', async () => {
      // Create a memory
      const createResponse = await makeRequest(request, 'POST', '/api/memory', {
        data: {
          content: 'Memory to delete',
          metadata: { source: 'test', category: 'delete-test' },
        },
      })

      expect(createResponse.status()).toBe(201)
      const createJson = await createResponse.json()
      const memoryId = createJson.memory_id

      // Delete the memory
      const response = await makeRequest(
        request,
        'DELETE',
        `/api/memory/${memoryId}`,
      )

      expect(response.status()).toBe(204)

      // Verify it's gone
      const getResponse = await makeRequest(
        request,
        'GET',
        `/api/memory/${memoryId}`,
      )
      expect(getResponse.status()).toBe(404)
    })

    test('should return 404 for non-existent memory ID', async () => {
      const response = await makeRequest(
        request,
        'DELETE',
        `/api/memory/00000000-0000-0000-0000-000000000000`,
      )

      expect(response.status()).toBe(404)
      const json = await response.json()
      expect(json.error).toBe('Not Found')
      expect(json.message).toBe('Memory not found')
    })
  })

  test.describe('Memory Stats (GET /api/memory/stats)', () => {
    test('should return memory statistics', async () => {
      const response = await makeRequest(request, 'GET', '/api/memory/stats')

      expect(response.status()).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.stats).toMatchObject({
        totalMemories: expect.any(Number),
        categoryCounts: expect.any(Object),
      })
      expect(typeof json.stats.totalMemories).toBe('number')
      expect(json.stats.totalMemories).toBeGreaterThanOrEqual(0)
    })
  })

  test.describe('Authentication Requirements', () => {
    test('should require authentication for all endpoints', async () => {
      // Test without auth headers
      const endpoints = [
        { method: 'GET' as const, path: '/api/memory' },
        { method: 'POST' as const, path: '/api/memory' },
        { method: 'GET' as const, path: '/api/memory/search' },
        { method: 'GET' as const, path: '/api/memory/stats' },
        // For ID-based endpoints, we'll use a placeholder ID
        {
          method: 'GET' as const,
          path: `/api/memory/00000000-0000-0000-0000-000000000000`,
        },
        {
          method: 'PUT' as const,
          path: `/api/memory/00000000-0000-0000-0000-000000000000`,
        },
        {
          method: 'DELETE' as const,
          path: `/api/memory/00000000-0000-0000-0000-000000000000`,
        },
      ]

      for (const { method, path } of endpoints) {
        let response: APIResponse
        switch (method) {
          case 'GET':
            response = await request.get(`${BASE_URL}${path}`)
            break
          case 'POST':
            response = await request.post(`${BASE_URL}${path}`, {
              data: { content: 'test' },
              headers: { 'Content-Type': 'application/json' },
            })
            break
          case 'PUT':
            response = await request.put(`${BASE_URL}${path}`, {
              data: { content: 'test' },
              headers: { 'Content-Type': 'application/json' },
            })
            break
          case 'DELETE':
            response = await request.delete(`${BASE_URL}${path}`)
            break
        }

        // Should be 401 Unauthorized
        expect(response.status()).toBe(401)
        const json = await response.json()
        expect(json.error).toBe('Unauthorized')
      }
    })
  })
})
