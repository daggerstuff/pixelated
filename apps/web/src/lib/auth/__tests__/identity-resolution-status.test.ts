/** @vitest-environment node */

/**
 * A provider outage during first-login identity resolution is retryable.
 *
 * The token validated, but the provider could not answer the profile lookup the
 * first login needs. That is an outage, not a broken identity: the middleware
 * answers the same bounded `503` + `Retry-After` shape it uses when token
 * validation itself cannot reach the provider, instead of a `500` a client
 * renders as a hard error. A non-provider failure keeps its `500`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockValidateToken, mockResolveIdentity, ProviderError } = vi.hoisted(
  () => {
    class ProviderError extends Error {
      constructor() {
        super('Identity provider profile lookup failed')
        this.name = 'IdentityProviderUnavailableError'
      }
    }
    return {
      mockValidateToken: vi.fn(),
      mockResolveIdentity: vi.fn(),
      ProviderError,
    }
  },
)

vi.mock('../auth0-jwt-service', () => ({ validateToken: mockValidateToken }))

vi.mock('../user-identity', () => ({
  resolveIdentity: mockResolveIdentity,
  IdentityProviderUnavailableError: ProviderError,
}))

vi.mock('../../services/auth0.service', () => ({
  auth0UserService: { getUserById: vi.fn() },
}))

vi.mock('../redis', () => ({
  getFromCache: vi.fn(),
  setInCache: vi.fn(),
  removeFromCache: vi.fn(),
}))

import { authenticateRequest } from '../auth0-middleware'

const validToken = () => ({
  valid: true,
  userId: 'auth0|first-login-outage',
  role: 'therapist',
  tokenId: 'jti-outage',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  payload: { email: '', email_verified: false },
})

const apiRequest = () =>
  new Request('http://localhost:5173/api/workspace/documents', {
    headers: { authorization: 'Bearer test-token' },
  })

beforeEach(() => {
  vi.clearAllMocks()
  mockValidateToken.mockResolvedValue(validToken())
})

describe('identity resolution status', () => {
  it('answers a retryable 503 when the provider cannot resolve a first login', async () => {
    mockResolveIdentity.mockRejectedValue(new ProviderError())

    const result = await authenticateRequest(apiRequest())

    expect(result.success).toBe(false)
    expect(result.response?.status).toBe(503)
    expect(result.response?.headers.get('retry-after')).toBe('30')
    expect(result.response?.headers.get('cache-control')).toBe('no-store')
  })

  it('keeps the 500 for a failure that is not a provider outage', async () => {
    mockResolveIdentity.mockRejectedValue(new Error('unexpected'))

    const result = await authenticateRequest(apiRequest())

    expect(result.success).toBe(false)
    expect(result.response?.status).toBe(500)
  })
})
