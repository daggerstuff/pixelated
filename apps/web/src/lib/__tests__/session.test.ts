/** @vitest-environment node */

/**
 * Integration tests for Redis session store migration.
 * PIX-3755: Verifies session configuration and store selection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { mockRedis, mockGetFromCache, mockSetInCache, mockRemoveFromCache } =
  vi.hoisted(() => ({
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
    mockRemoveFromCache: vi.fn(),
  }))

vi.mock('@/lib/redis', () => ({
  redis: mockRedis,
  getFromCache: mockGetFromCache,
  setInCache: mockSetInCache,
  removeFromCache: mockRemoveFromCache,
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

import {
  SESSION_CONFIG,
  validateSessionConfig,
  useRedisSessions,
  getSessionStore,
  createRedisStore,
} from '@/lib/session'

describe('Session Configuration (PIX-3755)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env['SESSION_SECRET'] = 'test-secret-key-for-testing-only'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('SESSION_CONFIG', () => {
    it('has HIPAA-compliant defaults', () => {
      expect(SESSION_CONFIG.name).toBe('pixelated.sid')
      expect(SESSION_CONFIG.prefix).toBe('sess:')
      expect(SESSION_CONFIG.maxAge).toBe(24 * 60 * 60 * 1000)
      expect(SESSION_CONFIG.rolling).toBe(true)
      expect(SESSION_CONFIG.saveUninitialized).toBe(false)
      expect(SESSION_CONFIG.resave).toBe(false)
    })

    it('has secure cookie settings', () => {
      expect(SESSION_CONFIG.cookie.httpOnly).toBe(true)
      expect(SESSION_CONFIG.cookie.sameSite).toBe('strict')
      expect(SESSION_CONFIG.cookie.maxAge).toBe(24 * 60 * 60 * 1000)
      expect(SESSION_CONFIG.cookie.path).toBe('/')
    })
  })

  describe('validateSessionConfig', () => {
    it('throws in production without SESSION_SECRET', () => {
      const originalNodeEnv = process.env['NODE_ENV']
      const originalSecret = process.env['SESSION_SECRET']
      process.env['NODE_ENV'] = 'production'
      delete process.env['SESSION_SECRET']

      expect(() => validateSessionConfig()).toThrow(
        'SESSION_SECRET environment variable is required in production',
      )

      process.env['NODE_ENV'] = originalNodeEnv
      if (originalSecret) process.env['SESSION_SECRET'] = originalSecret
    })

    it('does not throw in development without SESSION_SECRET', () => {
      const originalNodeEnv = process.env['NODE_ENV']
      const originalSecret = process.env['SESSION_SECRET']
      process.env['NODE_ENV'] = 'development'
      delete process.env['SESSION_SECRET']

      expect(() => validateSessionConfig()).not.toThrow()

      process.env['NODE_ENV'] = originalNodeEnv
      if (originalSecret) process.env['SESSION_SECRET'] = originalSecret
    })
  })

  describe('useRedisSessions', () => {
    it('returns false by default', () => {
      delete process.env['USE_REDIS_SESSIONS']
      expect(useRedisSessions()).toBe(false)
    })

    it('returns true when USE_REDIS_SESSIONS=true', () => {
      process.env['USE_REDIS_SESSIONS'] = 'true'
      expect(useRedisSessions()).toBe(true)
    })

    it('returns true when USE_REDIS_SESSIONS=1', () => {
      process.env['USE_REDIS_SESSIONS'] = '1'
      expect(useRedisSessions()).toBe(true)
    })

    it('returns false for other values', () => {
      process.env['USE_REDIS_SESSIONS'] = 'false'
      expect(useRedisSessions()).toBe(false)
      process.env['USE_REDIS_SESSIONS'] = '0'
      expect(useRedisSessions()).toBe(false)
      process.env['USE_REDIS_SESSIONS'] = 'yes'
      expect(useRedisSessions()).toBe(false)
    })
  })

  describe('getSessionStore', () => {
    it('returns RedisStore when USE_REDIS_SESSIONS=true', () => {
      process.env['USE_REDIS_SESSIONS'] = 'true'
      const store = getSessionStore()
      expect(mockRedisStore).toHaveBeenCalledWith({
        client: mockRedis,
        prefix: 'sess:',
        ttl: 24 * 60 * 60,
      })
      expect(store).toBeDefined()
    })

    it('returns MemoryStore when USE_REDIS_SESSIONS is not set', () => {
      delete process.env['USE_REDIS_SESSIONS']
      const store = getSessionStore()
      expect(store).toBeDefined()
      expect(mockRedisStore).not.toHaveBeenCalled()
    })
  })

  describe('createRedisStore', () => {
    it('creates RedisStore with correct configuration', () => {
      process.env['USE_REDIS_SESSIONS'] = 'true'
      createRedisStore()

      expect(mockRedisStore).toHaveBeenCalledWith({
        client: mockRedis,
        prefix: 'sess:',
        ttl: 86400,
      })
    })
  })
})
