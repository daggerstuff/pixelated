/* @vitest-environment node */
/**
 * POST /api/auth/signin route tests.
 *
 * Proves the CSRF token minted by the KV-backed store is accepted, that the
 * Auth0 credential verdict surfaces as 401 rather than a config error, and
 * that a missing or invalid token is rejected before Auth0 is called.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '../signin'

const CSRF_TOKEN = 'b'.repeat(64)

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }))

vi.mock('../../../../lib/services/auth0.service', () => ({
  auth0UserService: {
    signIn: signInMock,
  },
}))

vi.mock('../../../../lib/audit', () => ({
  AuditEventType: { LOGIN: 'LOGIN' },
  createAuditLog: vi.fn(async () => undefined),
}))

vi.mock('../../../../lib/security', () => ({
  logSecurityEvent: vi.fn(),
  SecurityEventType: {
    AUTHENTICATION_SUCCESS: 'AUTHENTICATION_SUCCESS',
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
    CSRF_VIOLATION: 'CSRF_VIOLATION',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  },
}))

vi.mock('../../../../lib/mcp/phase6-integration', () => ({
  updatePhase6AuthenticationProgress: vi.fn(async () => undefined),
}))

vi.mock('../../../../lib/auth/auth0-jwt-service', () => ({
  validateToken: vi.fn(),
}))

vi.mock('../../../../lib/auth/auth0-adaptive-mfa-service', () => ({
  auth0AdaptiveMFAService: { shouldRequireMFA: vi.fn() },
}))

vi.mock('../../../../lib/redis', () => ({
  getFromCache: vi.fn(async () => null),
  setInCache: vi.fn(async () => true),
}))

interface FakeKv {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

function createFakeKv(expiresAt: number): FakeKv {
  const values = new Map<string, string>([
    [`csrf:${CSRF_TOKEN}`, JSON.stringify({ token: CSRF_TOKEN, expiresAt })],
  ])
  return {
    async get(key: string) {
      return values.get(key) ?? null
    },
    async put(key: string, value: string) {
      values.set(key, value)
    },
  }
}

function callSignin(
  body: Record<string, string>,
  options: { csrfToken?: string; expiresAt?: number; locals?: unknown } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Origin': 'https://pixelatedempathy.com',
  }
  if (options.csrfToken !== undefined) {
    headers['X-CSRF-Token'] = options.csrfToken
  }

  const request = new Request('https://pixelatedempathy.com/api/auth/signin', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const locals = options.locals ?? {
    runtime: {
      env: {
        CSRF_TOKENS: createFakeKv(options.expiresAt ?? Date.now() + 3_600_000),
      },
    },
  }

  return POST({ request, clientAddress: '203.0.113.10', locals })
}

describe('POST /api/auth/signin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signs in with a valid KV-backed CSRF token and sets the auth-token cookie', async () => {
    signInMock.mockResolvedValueOnce({
      user: {
        id: 'auth0|synthetic-org-a',
        email: 'l03-org-a@example.invalid',
        role: 'therapist',
        fullName: 'Synthetic Org A',
        avatarUrl: undefined,
      },
      token: 'test-access-token',
      refreshToken: 'test-refresh-token',
    })

    const response = await callSignin(
      {
        email: 'l03-org-a@example.invalid',
        password: 'correct-horse-battery-staple',
      },
      { csrfToken: CSRF_TOKEN },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.user.id).toBe('auth0|synthetic-org-a')
    expect(response.headers.get('Set-Cookie')).toContain(
      'auth-token=test-access-token',
    )
    expect(signInMock).toHaveBeenCalledWith(
      'l03-org-a@example.invalid',
      'correct-horse-battery-staple',
    )
  })

  it('returns 401 Invalid credentials for a wrong password', async () => {
    signInMock.mockRejectedValueOnce(new Error('Invalid credentials'))

    const response = await callSignin(
      {
        email: 'l03-org-a@example.invalid',
        password: 'wrong-password',
      },
      { csrfToken: CSRF_TOKEN },
    )
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Invalid credentials' })
    expect(signInMock).toHaveBeenCalledTimes(1)
  })

  it('returns 403 for a missing token without reaching Auth0', async () => {
    const response = await callSignin({
      email: 'l03-org-a@example.invalid',
      password: 'correct-horse-battery-staple',
    })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ error: 'CSRF token required' })
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('returns 403 for an invalid token without reaching Auth0', async () => {
    const response = await callSignin(
      {
        email: 'l03-org-a@example.invalid',
        password: 'correct-horse-battery-staple',
      },
      { csrfToken: 'not-a-stored-token' },
    )
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ error: 'Invalid CSRF token' })
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('returns 403 for an expired token', async () => {
    const response = await callSignin(
      {
        email: 'l03-org-a@example.invalid',
        password: 'correct-horse-battery-staple',
      },
      { csrfToken: CSRF_TOKEN, expiresAt: Date.now() - 1000 },
    )
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ error: 'CSRF token has expired' })
    expect(signInMock).not.toHaveBeenCalled()
  })
})
