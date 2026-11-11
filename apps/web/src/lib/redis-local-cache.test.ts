/**
 * In-process fallback for the session, identity, and role caches.
 *
 * The configured Redis host is NXDOMAIN, so every read of these keys is a
 * guaranteed miss that still pays a connect attempt (diagnosis D2: ~10 ms
 * typical, ~1.5 s worst case per request). Keeping a small per-isolate copy
 * makes them hits within an isolate and stops every token validation from
 * paying a Management API round-trip for the role (D4's amplifier). Redis stays
 * the first source when it is reachable, and no other key prefix is cached
 * locally, so the rate limiter and the session-binding check keep their
 * existing miss-on-unreachable behaviour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockConnect, mockGet, mockSet, mockDel } = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDel: vi.fn(),
}))

vi.mock('@/lib/services/redis/RedisService', () => ({
  RedisService: class {
    connect = mockConnect
    get = mockGet
    set = mockSet
    del = mockDel
    isHealthy = vi.fn()
    getClient = () => null
    disconnect = vi.fn()
  },
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mockConnect.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('local cache fallback for the dead Redis host', () => {
  it('serves a cached identity when Redis cannot be reached', async () => {
    mockGet.mockRejectedValue(new Error('Redis connection closed'))
    const { getFromCache, setInCache } = await import('./redis')

    await setInCache('identity:sub:org-a', { internalId: 'uuid-a' }, 60)
    await expect(getFromCache('identity:sub:org-a')).resolves.toEqual({
      internalId: 'uuid-a',
    })
  })

  it('serves a cached role and session token locally', async () => {
    mockGet.mockRejectedValue(new Error('Redis connection closed'))
    const { getFromCache, setInCache } = await import('./redis')

    await setInCache('auth0:role:org-a', 'therapist', 300)
    await setInCache('session:token:abc', { session: { id: 's' } }, 60)

    await expect(getFromCache('auth0:role:org-a')).resolves.toBe('therapist')
    await expect(getFromCache('session:token:abc')).resolves.toEqual({
      session: { id: 's' },
    })
  })

  it('does not cache other prefixes locally (rate limit and session binding unchanged)', async () => {
    mockGet.mockRejectedValue(new Error('Redis connection closed'))
    const { getFromCache, setInCache } = await import('./redis')

    await setInCache('rate_limit:signin:1.2.3.4', { count: 1 }, 3_600)
    await setInCache('session_binding:uuid-a:sid', { ip: '1.2.3.4' }, 86_400)

    await expect(getFromCache('rate_limit:signin:1.2.3.4')).resolves.toBeNull()
    await expect(getFromCache('session_binding:uuid-a:sid')).resolves.toBeNull()
  })

  it('prefers Redis when it is reachable', async () => {
    mockGet.mockResolvedValue('"from-redis"')
    const { getFromCache, setInCache } = await import('./redis')

    await setInCache('identity:sub:org-a', 'local-value', 60)
    await expect(getFromCache('identity:sub:org-a')).resolves.toBe('from-redis')
  })

  it('expires a local entry after its TTL', async () => {
    vi.useFakeTimers()
    mockGet.mockRejectedValue(new Error('Redis connection closed'))
    const { getFromCache, setInCache } = await import('./redis')

    await setInCache('identity:sub:org-a', 'local-value', 1)
    await expect(getFromCache('identity:sub:org-a')).resolves.toBe(
      'local-value',
    )

    vi.setSystemTime(Date.now() + 1_500)
    await expect(getFromCache('identity:sub:org-a')).resolves.toBeNull()
  })

  it('drops a local entry when the key is removed', async () => {
    mockGet.mockRejectedValue(new Error('Redis connection closed'))
    const { getFromCache, removeFromCache, setInCache } =
      await import('./redis')

    await setInCache('identity:sub:org-a', 'local-value', 60)
    await removeFromCache('identity:sub:org-a')

    await expect(getFromCache('identity:sub:org-a')).resolves.toBeNull()
  })
})
