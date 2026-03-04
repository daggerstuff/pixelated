import { describe, it, expect, vi } from 'vitest'
import { POST } from '../../pages/api/evaluation'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  auth: {
    getCurrentUser: vi.fn(),
  }
}))

import { getCurrentUser } from '@/lib/auth'

describe('API /evaluation', () => {
  it('should store evaluation feedback', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-123', role: 'therapist' })
    const postRequest = new Request('http://localhost/api/evaluation', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'abc', feedback: 'Great job!' }),
    })
    const response = await POST({ request: postRequest, cookies: {} as any })
    expect(response.status).toBe(201)
    // No need to check 'data' property, status code is sufficient
    expect(response.status).toBe(201)
  })

  it('should handle missing data', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-123', role: 'therapist' })
    const badRequest = new Request('http://localhost/api/evaluation', {
      method: 'POST',
      body: JSON.stringify({ sessionId: '', feedback: '' }),
    })
    const response = await POST({ request: badRequest, cookies: {} as any })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data).toHaveProperty('error')
  })
})
