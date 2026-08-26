import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as auth0Service from '../lib/services/auth0.service'
import { verifyAuthToken } from './auth'

vi.mock('../lib/services/auth0.service', () => ({
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
      role: 'user' as const,
    })

    await verifyAuthToken('Bearer my-token')

    expect(auth0Service.verifyToken).toHaveBeenCalledWith('my-token')
  })

  it('verifies token without Bearer prefix', async () => {
    vi.mocked(auth0Service.verifyToken).mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.com',
      role: 'user' as const,
    })

    await verifyAuthToken('my-token')

    expect(auth0Service.verifyToken).toHaveBeenCalledWith('my-token')
  })
})
