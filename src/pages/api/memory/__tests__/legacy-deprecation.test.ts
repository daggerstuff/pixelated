/* @vitest-environment node */
/**
 * src/pages/api/memory/__tests__/legacy-deprecation.test.ts
 *
 * Verifies that legacy /api/memory/* routes emit Deprecation and Sunset
 * headers, and that the memory data in the legacy envelope is compatible
 * with the v1 PublicMemory schema.
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
import { PublicMemory } from '@/lib/memory/contract/v1'
import { getProductMemoryGateway } from '@/lib/services/product-memory-gateway'

import {
  GET as getMemoryById,
  PATCH as patchMemoryById,
  DELETE as deleteMemoryById,
} from '../[memoryId]'
import { POST as createMemory } from '../create'
import { GET as listMemories } from '../list'

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

/** Schema that validates only the PublicMemory-compatible fields from a
 *  legacy memory object, ignoring extra fields and the non-UUID id. */
const LegacyPublicMemoryShape = PublicMemory.omit({ id: true })
  .partial()
  .strip()

/** Extract the memory object(s) from a legacy response body. */
function extractMemory(body: Record<string, unknown>): unknown {
  if (body['memory']) return body['memory']
  if (body['memories']) return (body['memories'] as unknown[])[0]
  return null
}

describe('Legacy /api/memory/* deprecation headers', () => {
  let gateway: ReturnType<typeof makeGateway>

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = makeGateway()
    mockGetGateway.mockReturnValue(
      gateway as unknown as ReturnType<typeof getProductMemoryGateway>,
    )
  })

  // ------------------------------------------------------------------
  // Deprecation + Sunset header assertions
  // ------------------------------------------------------------------

  describe('Deprecation and Sunset headers', () => {
    it('GET /api/memory/:memoryId returns Deprecation and Sunset headers', async () => {
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

      expect(response.headers.get('Deprecation')).toBe('true')
      const sunset = response.headers.get('Sunset')
      expect(sunset).toBeTruthy()
      expect(() => new Date(sunset!)).not.toThrow()
      expect(response.status).toBe(200)
    })

    it('POST /api/memory/create returns Deprecation and Sunset headers', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.createMemory.mockResolvedValue({
        id: 'mem-1',
        content: 'hi',
        metadata: {},
      })

      const response = await createMemory({
        request: makeRequest('http://localhost/api/memory/create', {
          content: 'hi',
        }),
      })

      expect(response.headers.get('Deprecation')).toBe('true')
      const sunset = response.headers.get('Sunset')
      expect(sunset).toBeTruthy()
      expect(() => new Date(sunset!)).not.toThrow()
      expect(response.status).toBe(201)
    })

    it('GET /api/memory/list returns Deprecation and Sunset headers', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.listMemories.mockResolvedValue({
        memories: [{ id: 'mem-1', content: 'first', metadata: {} }],
        total: 1,
      })

      const response = await listMemories({
        request: makeRequest('http://localhost/api/memory/list'),
      })

      expect(response.headers.get('Deprecation')).toBe('true')
      const sunset = response.headers.get('Sunset')
      expect(sunset).toBeTruthy()
      expect(() => new Date(sunset!)).not.toThrow()
      expect(response.status).toBe(200)
    })

    it('PATCH /api/memory/:memoryId returns Deprecation and Sunset headers', async () => {
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

      expect(response.headers.get('Deprecation')).toBe('true')
      const sunset = response.headers.get('Sunset')
      expect(sunset).toBeTruthy()
      expect(() => new Date(sunset!)).not.toThrow()
      expect(response.status).toBe(200)
    })

    it('DELETE /api/memory/:memoryId returns Deprecation and Sunset headers', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.deleteMemory.mockResolvedValue(undefined)

      const response = await deleteMemoryById({
        params: { memoryId: 'mem-1' },
        request: makeRequest('http://localhost/api/memory/mem-1'),
      })

      expect(response.headers.get('Deprecation')).toBe('true')
      const sunset = response.headers.get('Sunset')
      expect(sunset).toBeTruthy()
      expect(() => new Date(sunset!)).not.toThrow()
      expect(response.status).toBe(200)
    })

    it('Sunset header value is a valid HTTP date', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.listMemories.mockResolvedValue({
        memories: [],
        total: 0,
      })

      const response = await listMemories({
        request: makeRequest('http://localhost/api/memory/list'),
      })

      const sunset = response.headers.get('Sunset')!
      // HTTP-date format: "Fri, 01 Jan 2027 00:00:00 GMT"
      expect(sunset).toMatch(
        /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/,
      )
      const parsed = new Date(sunset)
      expect(parsed.toString()).not.toBe('Invalid Date')
      // Validate weekday matches actual date (catches stale day-name regressions)
      expect(sunset).toBe(parsed.toUTCString())
    })
  })

  // ------------------------------------------------------------------
  // PublicMemory schema compatibility
  // ------------------------------------------------------------------

  describe('Legacy memory data is compatible with PublicMemory schema', () => {
    it('GET /api/memory/:memoryId memory passes PublicMemory shape validation', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.getMemory.mockResolvedValue({
        id: 'mem-1',
        content: 'hello world',
        metadata: {},
      })

      const response = await getMemoryById({
        params: { memoryId: 'mem-1' },
        request: makeRequest('http://localhost/api/memory/mem-1'),
      })

      const body = (await response.json()) as Record<string, unknown>
      const memory = extractMemory(body)
      expect(memory).not.toBeNull()

      const result = LegacyPublicMemoryShape.safeParse(memory)
      expect(result.success).toBe(true)
    })

    it('POST /api/memory/create memory passes PublicMemory shape validation', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.createMemory.mockResolvedValue({
        id: 'mem-1',
        content: 'new memory',
        metadata: {},
      })

      const response = await createMemory({
        request: makeRequest('http://localhost/api/memory/create', {
          content: 'new memory',
        }),
      })

      const body = (await response.json()) as Record<string, unknown>
      const memory = extractMemory(body)
      expect(memory).not.toBeNull()

      const result = LegacyPublicMemoryShape.safeParse(memory)
      expect(result.success).toBe(true)
    })

    it('GET /api/memory/list memories pass PublicMemory shape validation', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.listMemories.mockResolvedValue({
        memories: [
          { id: 'mem-1', content: 'first', metadata: {} },
          { id: 'mem-2', content: 'second', metadata: {} },
        ],
        total: 2,
      })

      const response = await listMemories({
        request: makeRequest('http://localhost/api/memory/list'),
      })

      const body = (await response.json()) as Record<string, unknown>
      const memories = body['memories'] as unknown[]
      expect(memories).toHaveLength(2)

      for (const memory of memories) {
        const result = LegacyPublicMemoryShape.safeParse(memory)
        expect(result.success).toBe(true)
      }
    })

    it('PATCH /api/memory/:memoryId memory passes PublicMemory shape validation', async () => {
      mockGetCurrentUser.mockResolvedValue(makeUser())
      gateway.updateMemory.mockResolvedValue({
        id: 'mem-1',
        content: 'patched content',
        metadata: {},
      })

      const response = await patchMemoryById({
        params: { memoryId: 'mem-1' },
        request: makeRequest('http://localhost/api/memory/mem-1', {
          content: 'patched content',
        }),
      })

      const body = (await response.json()) as Record<string, unknown>
      const memory = extractMemory(body)
      expect(memory).not.toBeNull()

      const result = LegacyPublicMemoryShape.safeParse(memory)
      expect(result.success).toBe(true)
    })
  })
})
