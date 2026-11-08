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

import { resolveInternalUserId } from '../internal-identity'

const LINKED_SUB = 'auth0|linked-therapist'
const INTERNAL_UUID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetFromCache.mockResolvedValue(null)
  mockSetInCache.mockResolvedValue(undefined)
  mockTransaction.mockImplementation(
    async (callback: (client: unknown) => Promise<void>) => callback({}),
  )
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('resolveInternalUserId — sub to platform UUID bridge', () => {
  it('maps a linked Auth0 sub to the internal users.id UUID', async () => {
    mockProvider.findInternalIdBySub.mockResolvedValue({
      internalId: INTERNAL_UUID,
      role: 'therapist',
    })

    const resolved = await resolveInternalUserId({
      id: LINKED_SUB,
      email: 'linked@example.test',
      role: 'therapist',
    })

    expect(resolved).toBe(INTERNAL_UUID)
    expect(resolved).not.toBe(LINKED_SUB)
    expect(mockProvider.findInternalIdBySub).toHaveBeenCalledWith(
      LINKED_SUB,
      expect.anything(),
    )
  })

  it('returns null instead of throwing when identity resolution fails', async () => {
    mockProvider.findInternalIdBySub.mockRejectedValue(
      new Error('connection terminated unexpectedly'),
    )

    await expect(
      resolveInternalUserId({ id: LINKED_SUB, email: 'linked@example.test' }),
    ).resolves.toBeNull()
  })

  it('returns null when the principal has no id', async () => {
    await expect(resolveInternalUserId({})).resolves.toBeNull()
    await expect(resolveInternalUserId(null)).resolves.toBeNull()
    expect(mockProvider.findInternalIdBySub).not.toHaveBeenCalled()
  })
})
