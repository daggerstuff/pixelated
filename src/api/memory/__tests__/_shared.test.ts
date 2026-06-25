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

describe('jsonResponse', () => {
  it('creates a Response with JSON payload and default status 200', async () => {
    const payload = { key: 'value' }
    const { jsonResponse } = await import('../_shared')
    const response = jsonResponse(payload)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json')

    const data = await response.json()
    expect(data).toEqual(payload)
  })
})
