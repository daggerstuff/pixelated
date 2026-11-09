/**
 * Regression coverage for the memoized Redis connect promise.
 *
 * `ensureConnected()` used to memoize `service.connect()` and clear it only on
 * success. A rejected connect left a rejected promise cached forever, and a
 * connect that never settled poisoned the isolate: every later cache read
 * awaited the same dead promise, which is the pre-pool hang path that the
 * identity cache read sits on. The memo is now cleared on failure and timeout,
 * and the connect itself is time-bounded, so a later call retries.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockConnect, mockGet, mockSet, mockDel, mockIsHealthy } = vi.hoisted(
  () => ({
    mockConnect: vi.fn(),
    mockGet: vi.fn(),
    mockSet: vi.fn(),
    mockDel: vi.fn(),
    mockIsHealthy: vi.fn(),
  }),
)

vi.mock('@/lib/services/redis/RedisService', () => ({
  RedisService: class {
    connect = mockConnect
    get = mockGet
    set = mockSet
    del = mockDel
    isHealthy = mockIsHealthy
    getClient = () => null
    disconnect = vi.fn()
  },
}))

const DEADLINE_MS = 3_000

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mockGet.mockResolvedValue(null)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ensureConnected promise lifetime', () => {
  it('exposes the configured connect deadline', async () => {
    const redis = await import('./redis')
    expect(redis.REDIS_CONNECT_DEADLINE_MS).toBe(DEADLINE_MS)
  })

  it('runs a second connect attempt after the first one fails', async () => {
    mockConnect.mockRejectedValueOnce(new Error('connect failed'))
    const { getFromCache } = await import('./redis')

    await expect(getFromCache('identity:sub:org-a')).resolves.toBeNull()
    expect(mockConnect).toHaveBeenCalledTimes(1)

    await expect(getFromCache('identity:sub:org-a')).resolves.toBeNull()
    expect(mockConnect).toHaveBeenCalledTimes(2)
  })

  it('times out a stalled connect, clears the memo, and retries', async () => {
    vi.useFakeTimers()
    mockConnect.mockReturnValue(new Promise(() => {}))
    const { getFromCache, REDIS_CONNECT_DEADLINE_MS } = await import('./redis')

    const first = getFromCache('identity:sub:org-a')
    await vi.advanceTimersByTimeAsync(REDIS_CONNECT_DEADLINE_MS)
    await expect(first).resolves.toBeNull()
    expect(mockConnect).toHaveBeenCalledTimes(1)

    const second = getFromCache('identity:sub:org-a')
    await vi.advanceTimersByTimeAsync(REDIS_CONNECT_DEADLINE_MS)
    await expect(second).resolves.toBeNull()
    expect(mockConnect).toHaveBeenCalledTimes(2)
  })

  it('connects once and reuses the established connection', async () => {
    mockConnect.mockResolvedValue(undefined)
    mockGet.mockResolvedValue(JSON.stringify({ ok: true }))
    const { getFromCache } = await import('./redis')

    await expect(getFromCache('some-key')).resolves.toEqual({ ok: true })
    await expect(getFromCache('some-key')).resolves.toEqual({ ok: true })
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })
})
