/** @vitest-environment node */

/**
 * PIX-215 PR2: IdentityProvider abstraction unit tests.
 *
 * Covers:
 *  - Factory caching (getIdentityProvider returns the same instance)
 *  - setIdentityProvider override + resetIdentityProvider clearing
 *  - Auth0IdentityProvider.name === 'auth0'
 *  - validateToken delegation to auth0-jwt-service
 *  - getUserById delegation to auth0UserService (incl. null path + field mapping)
 *  - findInternalIdBySub via `query` (no client) and via client.query
 *  - linkSubToInternalId via `query` and via client.query
 *  - findSubByInternalId returns the sub or null
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  IdentityProvider,
  IdentityProviderUser,
  TokenValidationResult,
} from '../identity-provider'

const {
  mockQuery,
  mockClientQuery,
  mockRelease,
  mockValidateToken,
  mockAuth0GetUserById,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockClientQuery: vi.fn(),
  mockRelease: vi.fn(),
  mockValidateToken: vi.fn(),
  mockAuth0GetUserById: vi.fn(),
}))

vi.mock('../../db', () => ({
  query: mockQuery,
}))

vi.mock('../auth0-jwt-service', () => ({
  validateToken: mockValidateToken,
}))

vi.mock('../../../services/auth0.service', () => ({
  auth0UserService: {
    getUserById: mockAuth0GetUserById,
  },
}))

vi.mock('../../redis', () => ({
  getFromCache: vi.fn(),
  setInCache: vi.fn(),
  removeFromCache: vi.fn(),
}))

vi.mock('../../security', () => ({
  logSecurityEvent: vi.fn(),
  SecurityEventType: {
    TOKEN_VALIDATED: 'TOKEN_VALIDATED',
    TOKEN_VALIDATION_FAILED: 'TOKEN_VALIDATION_FAILED',
  },
}))

vi.mock('../../mcp/phase6-integration', () => ({
  updatePhase6AuthenticationProgress: vi.fn(),
}))

import { Auth0IdentityProvider } from '../auth0-identity-provider'
import {
  getIdentityProvider,
  resetIdentityProvider,
  setIdentityProvider,
} from '../identity-provider'

afterEach(() => {
  vi.clearAllMocks()
  resetIdentityProvider()
})

describe('IdentityProvider factory', () => {
  it('returns an Auth0IdentityProvider by default', () => {
    const provider = getIdentityProvider()
    expect(provider).toBeInstanceOf(Auth0IdentityProvider)
    expect(provider.name).toBe('auth0')
  })

  it('caches the same instance across calls', () => {
    const a = getIdentityProvider()
    const b = getIdentityProvider()
    expect(a).toBe(b)
  })

  it('resetIdentityProvider forces the next call to build a new instance', () => {
    const a = getIdentityProvider()
    resetIdentityProvider()
    const b = getIdentityProvider()
    expect(a).not.toBe(b)
    expect(b).toBeInstanceOf(Auth0IdentityProvider)
  })

  it('setIdentityProvider replaces the active provider', () => {
    const customProvider: IdentityProvider = {
      name: 'test-provider',
      validateToken: vi.fn(),
      getUserById: vi.fn(),
      findInternalIdBySub: vi.fn(),
      linkSubToInternalId: vi.fn(),
      findSubByInternalId: vi.fn(),
    }
    setIdentityProvider(customProvider)
    const provider = getIdentityProvider()
    expect(provider).toBe(customProvider)
    expect(provider.name).toBe('test-provider')
  })

  it('setIdentityProvider(null) clears the cache; next call returns default', () => {
    setIdentityProvider({
      name: 'throwaway',
      validateToken: vi.fn(),
      getUserById: vi.fn(),
      findInternalIdBySub: vi.fn(),
      linkSubToInternalId: vi.fn(),
      findSubByInternalId: vi.fn(),
    })
    setIdentityProvider(null)
    const provider = getIdentityProvider()
    expect(provider).toBeInstanceOf(Auth0IdentityProvider)
  })
})

describe('Auth0IdentityProvider.validateToken', () => {
  it('delegates to auth0-jwt-service.validateToken with the requested audience', async () => {
    const expected: TokenValidationResult = {
      valid: true,
      userId: 'auth0|abc',
      role: 'therapist',
      email: 'a@b.test',
      expiresAt: 1_700_000_000,
    }
    mockValidateToken.mockResolvedValueOnce(expected)
    const provider = getIdentityProvider()
    const result = await provider.validateToken('jwt.token.here', 'access')
    expect(mockValidateToken).toHaveBeenCalledWith('jwt.token.here', 'access')
    expect(result).toEqual(expected)
  })

  it('passes through an invalid result without modification', async () => {
    const invalid: TokenValidationResult = { valid: false, error: 'expired' }
    mockValidateToken.mockResolvedValueOnce(invalid)
    const provider = getIdentityProvider()
    const result = await provider.validateToken('stale.token', 'refresh')
    expect(mockValidateToken).toHaveBeenCalledWith('stale.token', 'refresh')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('expired')
  })
})

describe('Auth0IdentityProvider.getUserById', () => {
  it('returns null when auth0UserService returns null', async () => {
    mockAuth0GetUserById.mockResolvedValueOnce(null)
    const provider = getIdentityProvider()
    const result = await provider.getUserById('auth0|nope')
    expect(result).toBeNull()
  })

  it('maps the Auth0 user to IdentityProviderUser shape', async () => {
    const auth0User = {
      id: 'auth0|user-1',
      email: 'user@example.test',
      role: 'therapist',
      fullName: 'User One',
      avatarUrl: 'https://cdn/avatar.png',
      lastLogin: '2026-06-01T00:00:00Z',
      userMetadata: { foo: 'bar' },
    }
    mockAuth0GetUserById.mockResolvedValueOnce(auth0User)
    const provider = getIdentityProvider()
    const result = (await provider.getUserById(
      'auth0|user-1',
    )) as IdentityProviderUser
    expect(result.id).toBe('auth0|user-1')
    expect(result.email).toBe('user@example.test')
    expect(result.role).toBe('therapist')
    expect(result.fullName).toBe('User One')
    expect(result.avatarUrl).toBe('https://cdn/avatar.png')
    expect(result.lastLogin).toBe('2026-06-01T00:00:00Z')
    expect(result.userMetadata).toEqual({ foo: 'bar' })
  })
})

describe('Auth0IdentityProvider.findInternalIdBySub', () => {
  it('calls query() when no client is provided and returns the mapping', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { user_id: '00000000-0000-0000-0000-000000000abc', role: 'admin' },
      ],
      rowCount: 1,
    })
    const provider = getIdentityProvider()
    const result = await provider.findInternalIdBySub('auth0|abc')
    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('FROM auth_accounts aa')
    expect(sql).toContain('WHERE aa.provider_id = $1')
    expect(sql).toContain('AND aa.provider    = $2')
    expect(params).toEqual(['auth0|abc', 'auth0'])
    expect(result).toEqual({
      internalId: '00000000-0000-0000-0000-000000000abc',
      role: 'admin',
    })
  })

  it('uses client.query() when a client is provided and skips query()', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [
        { user_id: '11111111-1111-1111-1111-111111111111', role: 'therapist' },
      ],
      rowCount: 1,
    })
    const provider = getIdentityProvider()
    const result = await provider.findInternalIdBySub('auth0|tx', {
      query: mockClientQuery,
      release: mockRelease,
    })
    expect(mockClientQuery).toHaveBeenCalledTimes(1)
    expect(mockQuery).not.toHaveBeenCalled()
    const [sql, params] = mockClientQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('FROM auth_accounts aa')
    expect(params).toEqual(['auth0|tx', 'auth0'])
    expect(result).toEqual({
      internalId: '11111111-1111-1111-1111-111111111111',
      role: 'therapist',
    })
  })

  it('returns null when the query yields no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    const provider = getIdentityProvider()
    const result = await provider.findInternalIdBySub('auth0|missing')
    expect(result).toBeNull()
  })
})

describe('Auth0IdentityProvider.linkSubToInternalId', () => {
  it('issues INSERT INTO auth_accounts via query() with the provider name', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 })
    const provider = getIdentityProvider()
    await provider.linkSubToInternalId(
      'auth0|new',
      '00000000-0000-0000-0000-000000000999',
    )
    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockClientQuery).not.toHaveBeenCalled()
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('INSERT INTO auth_accounts')
    expect(sql).toContain('ON CONFLICT DO NOTHING')
    expect(params).toHaveLength(4)
    expect(params[1]).toBe('00000000-0000-0000-0000-000000000999')
    expect(params[2]).toBe('auth0')
    expect(params[3]).toBe('auth0|new')
    expect(typeof params[0]).toBe('string')
  })

  it('uses client.query() when a client is provided and skips query()', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 })
    const provider = getIdentityProvider()
    await provider.linkSubToInternalId(
      'auth0|in-tx',
      '00000000-0000-0000-0000-000000000777',
      { query: mockClientQuery, release: mockRelease },
    )
    expect(mockClientQuery).toHaveBeenCalledTimes(1)
    expect(mockQuery).not.toHaveBeenCalled()
    const [sql, params] = mockClientQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('INSERT INTO auth_accounts')
    expect(params[1]).toBe('00000000-0000-0000-0000-000000000777')
    expect(params[2]).toBe('auth0')
    expect(params[3]).toBe('auth0|in-tx')
  })
})

describe('Auth0IdentityProvider.findSubByInternalId', () => {
  it('returns the provider_id when a link exists', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ provider_id: 'auth0|found' }],
      rowCount: 1,
    })
    const provider = getIdentityProvider()
    const result = await provider.findSubByInternalId(
      '00000000-0000-0000-0000-000000000123',
    )
    expect(result).toBe('auth0|found')
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('FROM auth_accounts')
    expect(sql).toContain('WHERE user_id = $1')
    expect(sql).toContain('AND provider = $2')
    expect(params).toEqual(['00000000-0000-0000-0000-000000000123', 'auth0'])
  })

  it('returns null when no link exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    const provider = getIdentityProvider()
    const result = await provider.findSubByInternalId(
      '00000000-0000-0000-0000-000000000000',
    )
    expect(result).toBeNull()
  })
})
