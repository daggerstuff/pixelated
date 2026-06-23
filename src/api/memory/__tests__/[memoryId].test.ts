import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GET } from '../routes/[memoryId]'
import { getCurrentUser } from '@/lib/auth'

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
      id: 'test-user-id', accountId: 'test-account-id',
      workspaceId: 'test-workspace-id', role: 'user',
    } as any)
  })

  describe('GET', () => {
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
