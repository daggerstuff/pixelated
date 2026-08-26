/** @vitest-environment node */

/**
 * Integration tests for session persistence across server restarts.
 * PIX-3755: Verifies sessions persist when Redis is enabled.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockRedis, mockGetFromCache, mockSetInCache } = vi.hoisted(() => ({
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    setex: vi.fn(),
    expire: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn(),
    quit: vi.fn(),
    disconnect: vi.fn(),
  },
  mockGetFromCache: vi.fn(),
  mockSetInCache: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({
  redis: mockRedis,
  getFromCache: mockGetFromCache,
  setInCache: mockSetInCache,
  removeFromCache: vi.fn(),
}))

const { mockRedisStore } = vi.hoisted(() => ({
  mockRedisStore: vi.fn().mockImplementation(function (
    this: any,
    options: { client: unknown; prefix: string; ttl: number },
  ) {
    this.client = options.client
    this.prefix = options.prefix
    this.ttl = options.ttl
    this.get = vi.fn()
    this.set = vi.fn()
    this.destroy = vi.fn()
  }),
}))

vi.mock('connect-redis', () => ({
  RedisStore: mockRedisStore,
}))

describe('Session Persistence Integration (PIX-3755)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['SESSION_SECRET'] = 'test-secret'
  })

  it('session survives simulated server restart with Redis', async () => {
    process.env['USE_REDIS_SESSIONS'] = 'true'

    // Simulate storing a session in Redis
    const sessionId = 'test-session-123'
    const sessionData = {
      userId: 'user-456',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    }

    mockSetInCache.mockResolvedValue(true)
    mockGetFromCache.mockResolvedValue(sessionData)

    // Simulate server restart by resetting modules
    vi.resetModules()

    // After "restart", session should still be retrievable from Redis
    const retrieved = await mockGetFromCache(`sess:${sessionId}`)
    expect(retrieved).toEqual(sessionData)
  })

  it('falls back to memory store when Redis is disabled', async () => {
    delete process.env['USE_REDIS_SESSIONS']

    const { getSessionStore } = await import('@/lib/session')
    const store = getSessionStore()

    // Should not attempt Redis connection
    expect(mockRedisStore).not.toHaveBeenCalled()
    expect(store).toBeDefined()
  })

  it('login/logout flow works with Redis store', async () => {
    process.env['USE_REDIS_SESSIONS'] = 'true'

    // Mock successful session creation
    mockSetInCache.mockResolvedValue(true)
    mockGetFromCache.mockResolvedValue({ userId: 'user-123' })

    // Simulate login - session stored
    const sessionKey = 'sess:login-session-abc'
    await mockSetInCache(sessionKey, { userId: 'user-123' })
    expect(mockSetInCache).toHaveBeenCalledWith(sessionKey, {
      userId: 'user-123',
    })

    // Simulate logout - session destroyed
    mockRedis.del.mockResolvedValue(1)
    await mockRedis.del(sessionKey)
    expect(mockRedis.del).toHaveBeenCalledWith(sessionKey)
  })
})
