import { describe, expect, it, vi } from 'vitest'
import { requireMemoryUser } from '../_shared'
import { getCurrentUser } from '@/lib/auth'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

describe('requireMemoryUser', () => {
  it('calls getCurrentUser with the provided request', async () => {
    const request = new Request('http://localhost')
    const mockUser = { id: 'user-1' }
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

    const result = await requireMemoryUser(request)

    expect(getCurrentUser).toHaveBeenCalledWith(request)
    expect(result).toEqual(mockUser)
  })
})
