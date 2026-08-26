/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { getCurrentUser } from '@/lib/auth'

import { GET } from '../routes/[memoryId]'

const mockGetMemory = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))

vi.mock('../_shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../_shared')>()
  return {
    ...actual,
    getGateway: vi.fn(() => ({ getMemory: mockGetMemory })),
  }
})

describe('Memory ID Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'test-user-id',
      accountId: 'test-account-id',
      workspaceId: 'test-workspace-id',
      role: 'user',
    })
  })

  describe('GET', () => {
    it('returns a 400 if memoryId parameter is missing', async () => {
      const request = new Request('http://localhost/api/memory')
      const response = await GET({ request, params: {} })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data).toMatchObject({
        error: 'Bad Request',
        message: 'memoryId parameter is required',
      })
    })

    it('returns a 404 if the memory is not found', async () => {
      mockGetMemory.mockResolvedValueOnce(null)

      const request = new Request('http://localhost/api/memory/mem-123')
      const response = await GET({ request, params: { memoryId: 'mem-123' } })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data).toMatchObject({
        error: 'Not Found',
        message: 'Memory not found',
      })
    })
  })
})
