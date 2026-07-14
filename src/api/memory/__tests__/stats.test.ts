/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { getCurrentUser } from '@/lib/auth'

import { GET } from '../routes/stats'

const mockGetMemoryStats = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))

vi.mock('../_shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../_shared')>()
  return {
    ...actual,
    getGateway: vi.fn(() => ({ getMemoryStats: mockGetMemoryStats })),
  }
})

describe('Memory Stats Endpoints', () => {
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
    it('returns memory statistics successfully', async () => {
      mockGetMemoryStats.mockResolvedValueOnce({
        totalMemories: 10,
        categoryCounts: { test: 10 },
      })

      const request = new Request('http://localhost/api/memory/stats')
      const response = await GET({ request, params: {} })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toMatchObject({
        success: true,
        data: {
          totalMemories: 10,
          categoryCounts: { test: 10 },
        },
        message: 'Memory statistics retrieved successfully',
      })
      expect(mockGetMemoryStats).toHaveBeenCalledWith({
        userId: 'test-user-id',
        accountId: 'test-account-id',
        workspaceId: 'test-workspace-id',
        includeShared: true,
        category: undefined,
        scope: undefined,
        retention: undefined,
      })
    })

    it('returns a 500 error when getMemoryStats fails', async () => {
      mockGetMemoryStats.mockRejectedValueOnce(new Error('Gateway error'))

      const request = new Request('http://localhost/api/memory/stats')
      const response = await GET({ request, params: {} })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data).toMatchObject({
        error: 'Internal Server Error',
        message: 'Failed to get memory statistics',
      })
    })
  })
})
