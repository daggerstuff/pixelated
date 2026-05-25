import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyAuthToken } from './auth'
import * as auth0Service from '../services/auth0.service'

vi.mock('../services/auth0.service', () => ({
  verifyToken: vi.fn(),
}))

describe('verifyAuthToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes Bearer prefix from token before verifying', async () => {
    vi.mocked(auth0Service.verifyToken).mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.com',
      role: 'client'
    } as any) // suppress since auth0Service typing is complex and we're mocking it

    await verifyAuthToken('Bearer my-token')

    expect(auth0Service.verifyToken).toHaveBeenCalledWith('my-token')
  })

  it('verifies token without Bearer prefix', async () => {
    vi.mocked(auth0Service.verifyToken).mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.com',
      role: 'client'
    } as any) // suppress since auth0Service typing is complex and we're mocking it

    await verifyAuthToken('my-token')

    expect(auth0Service.verifyToken).toHaveBeenCalledWith('my-token')
  })
})
