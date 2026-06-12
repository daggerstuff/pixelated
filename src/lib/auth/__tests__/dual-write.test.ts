/** @vitest-environment node */

/**
 * PIX-215 PR4: Dual-write mode unit tests.
 *
 * Covers:
 *  - shouldDualWrite() env flag handling
 *  - dualWriteGetUserById() match / mismatch / skipped outcomes
 *  - Legacy-path errors are swallowed (provider is source of truth)
 *  - Field-level comparison covers all comparable IdentityProviderUser fields
 *  - null-vs-user and user-vs-null produce a single 'id' discrepancy
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  IdentityProvider,
  IdentityProviderUser,
} from '../identity-provider'

const { mockGetUserById } = vi.hoisted(() => ({
  mockGetUserById: vi.fn(),
}))

vi.mock('../../../services/auth0.service', () => ({
  auth0UserService: { getUserById: mockGetUserById },
}))

import { dualWriteGetUserById, shouldDualWrite } from '../dual-write'

function makeUser(
  overrides: Partial<IdentityProviderUser> = {},
): IdentityProviderUser {
  return {
    id: 'auth0|user-1',
    email: 'a@b.test',
    role: 'therapist',
    fullName: 'User One',
    avatarUrl: 'https://cdn/avatar.png',
    lastLogin: '2026-06-01T00:00:00Z',
    userMetadata: {},
    ...overrides,
  }
}

function makeProvider(
  getUserByIdImpl: IdentityProvider['getUserById'],
): IdentityProvider {
  return {
    name: 'test',
    validateToken: vi.fn(),
    getUserById: getUserByIdImpl,
    findInternalIdBySub: vi.fn(),
    linkSubToInternalId: vi.fn(),
    findSubByInternalId: vi.fn(),
  }
}

const originalEnv = { ...process.env }
let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env['AUTH_DUAL_WRITE']
  delete process.env['AUTH_DUAL_WRITE_SAMPLE']
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warnSpy.mockRestore()
  process.env = { ...originalEnv }
})

describe('shouldDualWrite', () => {
  it('returns false when neither flag is set', () => {
    expect(shouldDualWrite()).toBe(false)
  })

  it('returns true when AUTH_DUAL_WRITE=true', () => {
    process.env['AUTH_DUAL_WRITE'] = 'true'
    expect(shouldDualWrite()).toBe(true)
  })

  it('returns true for AUTH_DUAL_WRITE_SAMPLE=1', () => {
    process.env['AUTH_DUAL_WRITE_SAMPLE'] = '1'
    expect(shouldDualWrite()).toBe(true)
  })

  it('returns false for AUTH_DUAL_WRITE_SAMPLE=0', () => {
    process.env['AUTH_DUAL_WRITE_SAMPLE'] = '0'
    expect(shouldDualWrite()).toBe(false)
  })
})

describe('dualWriteGetUserById', () => {
  it('returns skipped when shouldDualWrite is false', async () => {
    const getUserById = vi.fn()
    const provider = makeProvider(getUserById)
    const result = await dualWriteGetUserById(provider, 'auth0|user-1')
    expect(result).toEqual({ status: 'skipped' })
    expect(getUserById).not.toHaveBeenCalled()
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it('returns match when provider and legacy agree', async () => {
    process.env['AUTH_DUAL_WRITE'] = 'true'
    const user = makeUser()
    const provider = makeProvider(vi.fn().mockResolvedValueOnce(user))
    mockGetUserById.mockResolvedValueOnce({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      lastLogin: user.lastLogin,
      userMetadata: user.userMetadata,
    })
    const result = await dualWriteGetUserById(provider, 'auth0|user-1')
    expect(result.status).toBe('match')
    if (result.status === 'match') {
      expect(result.user).toEqual(user)
    }
  })

  it('returns mismatch with field-level discrepancies', async () => {
    process.env['AUTH_DUAL_WRITE'] = 'true'
    const provider = makeProvider(
      vi
        .fn()
        .mockResolvedValueOnce(
          makeUser({ role: 'therapist', email: 'provider@b.test' }),
        ),
    )
    mockGetUserById.mockResolvedValueOnce({
      id: 'auth0|user-1',
      email: 'legacy@b.test',
      role: 'admin',
      fullName: 'User One',
      avatarUrl: 'https://cdn/avatar.png',
      lastLogin: '2026-06-01T00:00:00Z',
      userMetadata: {},
    })
    const result = await dualWriteGetUserById(provider, 'auth0|user-1')
    expect(result.status).toBe('mismatch')
    if (result.status === 'mismatch') {
      const fields = result.discrepancies.map((d) => d.field).sort()
      expect(fields).toEqual(['email', 'role'])
    }
  })

  it('returns match when both return null', async () => {
    process.env['AUTH_DUAL_WRITE'] = 'true'
    const provider = makeProvider(vi.fn().mockResolvedValueOnce(null))
    mockGetUserById.mockResolvedValueOnce(null)
    const result = await dualWriteGetUserById(provider, 'auth0|missing')
    expect(result.status).toBe('match')
  })

  it('returns mismatch when provider is null and legacy has a user', async () => {
    process.env['AUTH_DUAL_WRITE'] = 'true'
    const provider = makeProvider(vi.fn().mockResolvedValueOnce(null))
    mockGetUserById.mockResolvedValueOnce({
      id: 'auth0|user-1',
      email: 'a@b.test',
      role: 'therapist',
    })
    const result = await dualWriteGetUserById(provider, 'auth0|user-1')
    expect(result.status).toBe('mismatch')
    if (result.status === 'mismatch') {
      expect(result.discrepancies).toHaveLength(1)
      expect(result.discrepancies[0]?.field).toBe('id')
    }
  })

  it('swallows legacy errors and returns match on null', async () => {
    process.env['AUTH_DUAL_WRITE'] = 'true'
    const provider = makeProvider(vi.fn().mockResolvedValueOnce(null))
    mockGetUserById.mockRejectedValueOnce(new Error('legacy boom'))
    const result = await dualWriteGetUserById(provider, 'auth0|user-1')
    expect(result.status).toBe('match')
    if (result.status === 'match') {
      expect(result.user).toBeNull()
    }
  })

  it('swallows legacy errors and returns provider user', async () => {
    process.env['AUTH_DUAL_WRITE'] = 'true'
    const user = makeUser()
    const provider = makeProvider(vi.fn().mockResolvedValueOnce(user))
    mockGetUserById.mockRejectedValueOnce(new Error('legacy boom'))
    const result = await dualWriteGetUserById(provider, 'auth0|user-1')
    expect(result.status).toBe('match')
    if (result.status === 'match') {
      expect(result.user).toEqual(user)
    }
  })

  it('logs a warn for each mismatch with a structured payload', async () => {
    process.env['AUTH_DUAL_WRITE'] = 'true'
    const provider = makeProvider(vi.fn().mockResolvedValueOnce(makeUser()))
    mockGetUserById.mockResolvedValueOnce({
      id: 'auth0|user-1',
      email: 'different@b.test',
      role: 'therapist',
    })
    await dualWriteGetUserById(provider, 'auth0|user-1')
    expect(warnSpy).toHaveBeenCalled()
    const [msg, payload] = warnSpy.mock.calls[0] as [string, unknown]
    expect(msg).toMatch(/mismatch/)
    expect(payload).toBeInstanceOf(Array)
  })
})
