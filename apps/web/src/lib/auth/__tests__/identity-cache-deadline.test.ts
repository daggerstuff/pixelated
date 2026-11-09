/**
 * Regression coverage for the identity cache read and write.
 *
 * `resolveIdentity()` reads the Redis identity cache before any SQL. Redis is
 * unreachable from the Worker, and a stalled connect made that read an
 * unbounded await in front of the database — the pre-pool hang. The cache read
 * is now bounded, so an unreachable cache cannot block identity resolution: the
 * resolver falls through to the database lookup. The cache write that follows
 * the SQL lookup is bounded the same way, so populating the cache cannot hold
 * the resolved request open either.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockTransaction, mockGetFromCache, mockSetInCache, mockProvider } =
  vi.hoisted(() => ({
    mockTransaction: vi.fn(),
    mockGetFromCache: vi.fn(),
    mockSetInCache: vi.fn(),
    mockProvider: {
      name: 'auth0',
      validateToken: vi.fn(),
      getUserById: vi.fn(),
      findInternalIdBySub: vi.fn(),
      linkSubToInternalId: vi.fn(),
      findSubByInternalId: vi.fn(),
    },
  }))

vi.mock('../../db/index', () => ({ transaction: mockTransaction }))
vi.mock('../../redis', () => ({
  getFromCache: mockGetFromCache,
  setInCache: mockSetInCache,
  removeFromCache: vi.fn(),
}))
vi.mock('../identity-provider', () => ({
  getIdentityProvider: () => mockProvider,
}))

import * as userIdentity from '../user-identity'

const DEADLINE_MS = 750
const LINKED_SUB = 'auth0|linked-therapist'
const INTERNAL_UUID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'

const profile = () => ({
  sub: LINKED_SUB,
  email: 'linked@example.test',
  emailVerified: true,
  role: 'therapist',
})

beforeEach(() => {
  vi.clearAllMocks()
  mockSetInCache.mockResolvedValue(true)
  mockTransaction.mockImplementation(
    async (callback: (client: unknown) => Promise<void>) => callback({}),
  )
  mockProvider.findInternalIdBySub.mockResolvedValue({
    internalId: INTERNAL_UUID,
    role: 'therapist',
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('identity cache read deadline', () => {
  it('exposes the configured cache read deadline', () => {
    expect(userIdentity.IDENTITY_CACHE_READ_DEADLINE_MS).toBe(DEADLINE_MS)
  })

  it('falls through to the database when the cache read never settles', async () => {
    vi.useFakeTimers()
    mockGetFromCache.mockReturnValue(new Promise(() => {}))

    const pending = userIdentity.resolveIdentity(profile())
    await vi.advanceTimersByTimeAsync(DEADLINE_MS)
    const identity = await pending

    expect(identity.internalId).toBe(INTERNAL_UUID)
    expect(mockProvider.findInternalIdBySub).toHaveBeenCalledWith(
      LINKED_SUB,
      expect.anything(),
    )
  })

  it('uses a cache hit without querying the database', async () => {
    mockGetFromCache.mockResolvedValue({
      internalId: INTERNAL_UUID,
      auth0Sub: LINKED_SUB,
      email: 'linked@example.test',
      emailVerified: true,
      role: 'therapist',
      isNewUser: true,
    })

    const identity = await userIdentity.resolveIdentity(profile())

    expect(identity.internalId).toBe(INTERNAL_UUID)
    expect(identity.isNewUser).toBe(false)
    expect(mockProvider.findInternalIdBySub).not.toHaveBeenCalled()
  })
})

describe('identity cache write deadline', () => {
  it('exposes the configured cache write deadline', () => {
    expect(userIdentity.IDENTITY_CACHE_WRITE_DEADLINE_MS).toBe(1_000)
  })

  it('resolves the identity when the cache write never settles', async () => {
    vi.useFakeTimers()
    mockGetFromCache.mockResolvedValue(null)
    mockSetInCache.mockReturnValue(new Promise(() => {}))

    const pending = userIdentity.resolveIdentity(profile())
    await vi.advanceTimersByTimeAsync(
      userIdentity.IDENTITY_CACHE_WRITE_DEADLINE_MS,
    )
    const identity = await pending

    expect(identity.internalId).toBe(INTERNAL_UUID)
    expect(mockSetInCache).toHaveBeenCalledTimes(1)
  })
})
