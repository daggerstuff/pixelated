/**
 * Regression coverage for the bounded Redis command path.
 *
 * `ensureConnected()` bounds the *connect* (`REDIS_CONNECT_DEADLINE_MS`), but
 * the command that follows it had no bound. On a reconnecting ioredis client
 * that command waits in the offline queue until the reconnect resolves, so a
 * dead Redis turned a cache read into the rest of the route's 8 s deadline.
 * Measured on `f811440d6` / Worker `af615b73`: 81 of 81 deadline legs carried a
 * Redis `getaddrinfo ENOTFOUND` at request offset 1–2 ms and then silence
 * (`planning/pilot-readiness-2026-11-04/evidence/availability-remeasure-f811440d6-2026-11-10.md`
 * §7).
 *
 * The command is now raced against a short deadline. A timed-out read is a
 * cache miss (the existing in-process fallback serves) and a timed-out write is
 * a failed shared write, so the caller always receives a usable result. A
 * reachable Redis answers in single-digit milliseconds and never sees the
 * deadline.
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

/** A command that never settles, like a queued command on a reconnecting client. */
const neverSettles = <T>() => new Promise<T>(() => {})

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mockConnect.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('bounded Redis command path', () => {
  it('bounds the command well below the 8s route deadline', async () => {
    const { REDIS_COMMAND_DEADLINE_MS } = await import('./redis')

    expect(REDIS_COMMAND_DEADLINE_MS).toBeGreaterThan(0)
    expect(REDIS_COMMAND_DEADLINE_MS).toBeLessThan(1_000)
  })

  it('serves the in-process fallback inside the bound when the command never settles', async () => {
    vi.useFakeTimers()
    const { getFromCache, setInCache, REDIS_COMMAND_DEADLINE_MS } =
      await import('./redis')

    // Seed the isolate's copy while the shared cache is healthy.
    mockSet.mockResolvedValue(undefined)
    await setInCache('session:token:abc', { session: { id: 's' } }, 60)

    // Now the client queues the read forever.
    mockGet.mockImplementation(() => neverSettles<string | null>())

    const read = getFromCache('session:token:abc')
    await vi.advanceTimersByTimeAsync(REDIS_COMMAND_DEADLINE_MS)

    // The caller gets a usable result — the cached session — not a rejection
    // and not an 8 s wait.
    await expect(read).resolves.toEqual({ session: { id: 's' } })
  })

  it('returns a cache miss inside the bound when nothing is cached locally', async () => {
    vi.useFakeTimers()
    const { getFromCache, REDIS_COMMAND_DEADLINE_MS } = await import('./redis')

    mockGet.mockImplementation(() => neverSettles<string | null>())

    const read = getFromCache('identity:sub:unmapped')
    await vi.advanceTimersByTimeAsync(REDIS_COMMAND_DEADLINE_MS)

    await expect(read).resolves.toBeNull()
  })

  it('bounds the write and keeps the local copy for later reads', async () => {
    vi.useFakeTimers()
    const { getFromCache, setInCache, REDIS_COMMAND_DEADLINE_MS } =
      await import('./redis')

    mockSet.mockImplementation(() => neverSettles<void>())

    const write = setInCache('auth0:role:org-a', 'therapist', 300)
    await vi.advanceTimersByTimeAsync(REDIS_COMMAND_DEADLINE_MS)

    // The shared write did not take: `false` keeps its existing meaning.
    await expect(write).resolves.toBe(false)

    // The local copy was written first, so the fallback still serves it.
    mockGet.mockImplementation(() => neverSettles<string | null>())
    const read = getFromCache('auth0:role:org-a')
    await vi.advanceTimersByTimeAsync(REDIS_COMMAND_DEADLINE_MS)
    await expect(read).resolves.toBe('therapist')
  })

  it('is unchanged for a reachable Redis', async () => {
    const { getFromCache, setInCache } = await import('./redis')

    mockGet.mockResolvedValue(JSON.stringify({ internalId: 'uuid-a' }))
    mockSet.mockResolvedValue(undefined)

    await expect(setInCache('identity:sub:org-a', 'local', 60)).resolves.toBe(
      true,
    )
    // Redis is still the first source when it answers.
    await expect(getFromCache('identity:sub:org-a')).resolves.toEqual({
      internalId: 'uuid-a',
    })
    expect(mockGet).toHaveBeenCalledWith('identity:sub:org-a')
    expect(mockSet).toHaveBeenCalledWith('identity:sub:org-a', 'local', 60_000)
  })
})
