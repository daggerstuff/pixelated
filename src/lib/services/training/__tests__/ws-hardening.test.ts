/* @vitest-environment node */
/**
 * PIX-3935: WebSocket hardening — origin, rate-limit, ACL, audit, idle-disconnect, per-IP
 *
 * Tests cover:
 *   1. origin.ts — parseAllowedOrigins, isOriginAllowed
 *   2. ratelimit.ts — RateLimiter with mocked Redis
 *   3. session-store.ts — SessionStore with mocked Mongo
 *   4. audit-log.ts — AuditLog with mocked Mongo
 *   5. TrainingWebSocketServer — origin rejection, per-IP limit, idle timer
 *   6. checkOrigin convenience function
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 1. Origin module ─────────────────────────────────────────────

describe('PIX-3935: origin.ts — parseAllowedOrigins', () => {
  it('returns empty set for undefined input (no restriction)', async () => {
    const { parseAllowedOrigins } = await import('../origin')
    const result = parseAllowedOrigins(undefined)
    expect(result.size).toBe(0)
  })

  it('returns empty set for empty string (no restriction)', async () => {
    const { parseAllowedOrigins } = await import('../origin')
    expect(parseAllowedOrigins('').size).toBe(0)
    expect(parseAllowedOrigins('  ').size).toBe(0)
  })

  it('parses a single origin', async () => {
    const { parseAllowedOrigins } = await import('../origin')
    const result = parseAllowedOrigins('https://app.pixelatedempathy.com')
    expect(result.size).toBe(1)
    expect(result.has('https://app.pixelatedempathy.com')).toBe(true)
  })

  it('parses multiple origins and strips trailing slashes', async () => {
    const { parseAllowedOrigins } = await import('../origin')
    const result = parseAllowedOrigins(
      'https://app.pixelatedempathy.com,https://www.pixelatedempathy.com/',
    )
    expect(result.size).toBe(2)
    expect(result.has('https://app.pixelatedempathy.com')).toBe(true)
    expect(result.has('https://www.pixelatedempathy.com')).toBe(true)
  })
})

describe('PIX-3935: origin.ts — isOriginAllowed', () => {
  it('allows any origin when set is empty (no restriction)', async () => {
    const { isOriginAllowed } = await import('../origin')
    expect(isOriginAllowed('http://evil.com', new Set())).toBe(true)
    expect(isOriginAllowed(undefined, new Set())).toBe(true)
  })

  it('rejects undefined origin when restriction is active', async () => {
    const { isOriginAllowed } = await import('../origin')
    const allowed = new Set(['https://app.pixelatedempathy.com'])
    expect(isOriginAllowed(undefined, allowed)).toBe(false)
  })

  it('allows matching origin', async () => {
    const { isOriginAllowed } = await import('../origin')
    const allowed = new Set(['https://app.pixelatedempathy.com'])
    expect(isOriginAllowed('https://app.pixelatedempathy.com', allowed)).toBe(
      true,
    )
  })

  it('rejects non-matching origin', async () => {
    const { isOriginAllowed } = await import('../origin')
    const allowed = new Set(['https://app.pixelatedempathy.com'])
    expect(isOriginAllowed('https://evil.com', allowed)).toBe(false)
  })
})

// ── 2. Rate limiter ──────────────────────────────────────────────

describe('PIX-3935: ratelimit.ts — RateLimiter', () => {
  it('allows requests under the limit', async () => {
    const mockRedis = {
      incr: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(55),
      expire: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
    }
    const { RateLimiter } = await import('../ratelimit')
    const limiter = new RateLimiter(mockRedis as any, 30, 60)
    const result = await limiter.check('user-1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(29)
    expect(mockRedis.incr).toHaveBeenCalledWith('ratelimit:ws:user-1')
  })

  it('blocks requests when limit is exceeded', async () => {
    const mockRedis = {
      incr: vi.fn().mockResolvedValue(31),
      ttl: vi.fn().mockResolvedValue(30),
      expire: vi.fn(),
      del: vi.fn(),
    }
    const { RateLimiter } = await import('../ratelimit')
    const limiter = new RateLimiter(mockRedis as any, 30, 60)
    const result = await limiter.check('user-1')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets the counter for a user', async () => {
    const mockRedis = {
      del: vi.fn().mockResolvedValue(1),
      incr: vi.fn(),
      ttl: vi.fn(),
      expire: vi.fn(),
    }
    const { RateLimiter } = await import('../ratelimit')
    const limiter = new RateLimiter(mockRedis as any)
    await limiter.reset('user-1')
    expect(mockRedis.del).toHaveBeenCalledWith('ratelimit:ws:user-1')
  })

  it('resets on reconnect', async () => {
    const mockRedis = {
      del: vi.fn().mockResolvedValue(1),
      incr: vi.fn(),
      ttl: vi.fn(),
      expire: vi.fn(),
    }
    const { RateLimiter } = await import('../ratelimit')
    const limiter = new RateLimiter(mockRedis as any)
    await limiter.handleReconnect('user-1')
    expect(mockRedis.del).toHaveBeenCalledWith('ratelimit:ws:user-1')
  })

  it('sets TTL on first increment', async () => {
    const mockRedis = {
      incr: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(-1),
      expire: vi.fn().mockResolvedValue(1),
      del: vi.fn(),
    }
    const { RateLimiter } = await import('../ratelimit')
    const limiter = new RateLimiter(mockRedis as any, 30, 60)
    await limiter.check('user-1')
    expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:ws:user-1', 60)
  })

  it('fail-opens on Redis error', async () => {
    const mockRedis = {
      incr: vi.fn().mockRejectedValue(new Error('Connection refused')),
      ttl: vi.fn(),
      expire: vi.fn(),
      del: vi.fn(),
    }
    const { RateLimiter } = await import('../ratelimit')
    const limiter = new RateLimiter(mockRedis as any)
    const result = await limiter.check('user-1')
    expect(result.allowed).toBe(true) // fail-open
  })
})

// ── 3. Session Store ─────────────────────────────────────────────

describe('PIX-3935: session-store.ts — SessionStore', () => {
  it('save and load a session document', async () => {
    const mockCollection = {
      updateOne: vi.fn().mockResolvedValue({ upsertedId: 'mock' }),
      findOne: vi.fn().mockResolvedValue({
        sessionId: 'session-1',
        attendees: ['user-1'],
        lastEventId: 5,
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }),
      createIndexes: vi.fn().mockResolvedValue(undefined),
      insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock' }),
      findOneAndUpdate: vi.fn().mockResolvedValue({
        lastEventId: 6,
      }),
    }

    const { SessionStore } = await import('../session-store')
    const store = new SessionStore({ collection: () => mockCollection } as any)

    await store.save({
      sessionId: 'session-1',
      attendees: ['user-1'],
      lastEventId: 5,
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })

    const loaded = await store.load('session-1')
    expect(loaded).not.toBeNull()
    expect(loaded!.sessionId).toBe('session-1')
    expect(loaded!.lastEventId).toBe(5)
  })

  it('creates a fresh session on reconnect when none exists', async () => {
    const mockCollection = {
      updateOne: vi.fn(),
      findOne: vi.fn().mockResolvedValue(null),
      createIndexes: vi.fn(),
      insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock' }),
      findOneAndUpdate: vi.fn(),
      deleteOne: vi.fn(),
    }

    const { SessionStore } = await import('../session-store')
    const store = new SessionStore({ collection: () => mockCollection } as any)

    const result = await store.reconnect('session-new', 'user-1')
    expect(result.session.sessionId).toBe('session-new')
    expect(result.session.attendees).toContain('user-1')
    expect(result.resumeFrom).toBe(1)
    expect(mockCollection.insertOne).toHaveBeenCalled()
  })

  it('resumes existing session on reconnect', async () => {
    const existingSession = {
      sessionId: 'session-1',
      attendees: ['user-1'],
      lastEventId: 42,
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const mockCollection = {
      updateOne: vi.fn(),
      findOne: vi.fn().mockResolvedValue(existingSession),
      createIndexes: vi.fn(),
      insertOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      deleteOne: vi.fn(),
    }

    const { SessionStore } = await import('../session-store')
    const store = new SessionStore({ collection: () => mockCollection } as any)

    const result = await store.reconnect('session-1', 'user-2')
    expect(result.session.lastEventId).toBe(42)
    expect(result.resumeFrom).toBe(43)
  })

  it('increments event ID', async () => {
    const mockCollection = {
      createIndexes: vi.fn(),
      findOneAndUpdate: vi.fn().mockResolvedValue({ lastEventId: 7 }),
    }
    const { SessionStore } = await import('../session-store')
    const store = new SessionStore({ collection: () => mockCollection } as any)
    const eventId = await store.nextEventId('session-1')
    expect(eventId).toBe(7)
  })

  it('deletes a session', async () => {
    const mockCollection = {
      createIndexes: vi.fn(),
      deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    }
    const { SessionStore } = await import('../session-store')
    const store = new SessionStore({ collection: () => mockCollection } as any)
    await store.delete('session-1')
    expect(mockCollection.deleteOne).toHaveBeenCalledWith({
      sessionId: 'session-1',
    })
  })
})

// ── 4. Audit Log ─────────────────────────────────────────────────

describe('PIX-3935: audit-log.ts — AuditLog', () => {
  it('writes an audit entry', async () => {
    const insertOne = vi.fn().mockResolvedValue({ insertedId: 'mock' })
    const mockQuery = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    }
    const mockCollection = {
      insertOne,
      createIndexes: vi.fn().mockResolvedValue(undefined),
      find: vi.fn().mockReturnValue(mockQuery),
    }

    const { AuditLog } = await import('../audit-log')
    const audit = new AuditLog({ collection: () => mockCollection } as any)
    await audit.write({
      sessionId: 'session-1',
      userId: 'user-1',
      role: 'supervisor',
      type: 'session_message',
      ts: '2026-01-01T00:00:00Z',
    })
    expect(insertOne).toHaveBeenCalledTimes(1)
  })

  it('queries entries by sessionId', async () => {
    const mockQuery = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([
        {
          sessionId: 'session-1',
          userId: 'user-1',
          type: 'session_message',
          ts: '2026-01-01T00:00:00Z',
        },
      ]),
    }
    const mockCollection = {
      find: vi.fn().mockReturnValue(mockQuery),
      createIndexes: vi.fn(),
      insertOne: vi.fn(),
    }

    const { AuditLog } = await import('../audit-log')
    const audit = new AuditLog({ collection: () => mockCollection } as any)
    const results = await audit.queryBySession('session-1')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('session_message')
  })

  it('queries entries by userId', async () => {
    const mockQuery = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([
        {
          sessionId: 'session-1',
          userId: 'user-1',
          type: 'join_session',
          ts: '2026-01-01T00:00:00Z',
        },
      ]),
    }
    const mockCollection = {
      find: vi.fn().mockReturnValue(mockQuery),
      createIndexes: vi.fn(),
      insertOne: vi.fn(),
    }

    const { AuditLog } = await import('../audit-log')
    const audit = new AuditLog({ collection: () => mockCollection } as any)
    const results = await audit.queryByUser('user-1')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('join_session')
  })
})

// ── 5. TrainingWebSocketServer — origin rejection ────────────────

describe('PIX-3935: TrainingWebSocketServer — origin rejection', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('../origin', () => ({
      isOriginAllowed: vi.fn().mockReturnValue(false),
      parseAllowedOrigins: vi
        .fn()
        .mockReturnValue(new Set(['https://app.pixelatedempathy.com'])),
    }))
    vi.doMock('../session-store', () => ({
      SessionStore: vi.fn().mockImplementation(() => ({
        init: vi.fn(),
        close: vi.fn(),
        save: vi.fn(),
        load: vi.fn(),
      })),
    }))
    vi.doMock('../ratelimit', () => ({
      RateLimiter: vi.fn().mockImplementation(() => ({
        check: vi.fn().mockResolvedValue(true),
        consume: vi.fn().mockResolvedValue(true),
      })),
    }))
    vi.doMock('../../ai/GestaltClient', () => ({
      GestaltClient: vi.fn().mockImplementation(() => ({
        send: vi.fn(),
        close: vi.fn(),
      })),
    }))
    vi.doMock('../../auth/jwt-service', () => ({
      validateToken: vi.fn(),
    }))
  })

  it('rejects connection from non-allowed origin', async () => {
    const { TrainingWebSocketServer } =
      await import('../TrainingWebSocketServer')
    const server = new TrainingWebSocketServer(0, {
      auditLog: {
        write: vi.fn(),
        queryBySession: vi.fn(),
        queryByUser: vi.fn(),
      } as any,
    })

    const closeSpy = vi.fn()
    const mockWs = {
      close: closeSpy,
      on: vi.fn(),
      ping: vi.fn(),
      readyState: 1,
      send: vi.fn(),
    }

    server['handleConnection'](
      mockWs as any,
      {
        headers: { origin: 'https://evil.com' },
        url: '/?token=abc',
        socket: { remoteAddress: '127.0.0.1' },
      } as any,
    )

    expect(closeSpy).toHaveBeenCalledWith(1008, 'Origin not allowed')
  })

  it('allows connection from allowed origin', async () => {
    vi.doMock('../origin', () => ({
      isOriginAllowed: vi.fn().mockReturnValue(true),
      parseAllowedOrigins: vi
        .fn()
        .mockReturnValue(new Set(['https://app.pixelatedempathy.com'])),
    }))

    const { TrainingWebSocketServer } =
      await import('../TrainingWebSocketServer')
    const server = new TrainingWebSocketServer(0, {
      auditLog: {
        write: vi.fn(),
        queryBySession: vi.fn(),
        queryByUser: vi.fn(),
      } as any,
    })

    const closeSpy = vi.fn()
    const mockWs = {
      close: closeSpy,
      on: vi.fn(),
      ping: vi.fn(),
      readyState: 1,
      send: vi.fn(),
    }

    server['handleConnection'](
      mockWs as any,
      {
        headers: { origin: 'https://app.pixelatedempathy.com' },
        url: '/?token=abc',
        socket: { remoteAddress: '127.0.0.1' },
      } as any,
    )

    expect(closeSpy).not.toHaveBeenCalledWith(1008, 'Origin not allowed')
  })
})

// ── 6. Per-IP limit ──────────────────────────────────────────────

describe('PIX-3935: TrainingWebSocketServer — per-IP limit', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('rejects 6th concurrent connection from same IP', async () => {
    vi.doMock('../origin', () => ({
      isOriginAllowed: vi.fn().mockReturnValue(true),
      parseAllowedOrigins: vi.fn().mockReturnValue(new Set()),
    }))

    const { TrainingWebSocketServer } =
      await import('../TrainingWebSocketServer')
    const server = new TrainingWebSocketServer(0, {
      auditLog: {
        write: vi.fn(),
        queryBySession: vi.fn(),
        queryByUser: vi.fn(),
      } as any,
    })

    const closeSpy = vi.fn()
    const makeWs = () => ({
      close: closeSpy,
      on: vi.fn(),
      ping: vi.fn(),
      readyState: 1,
      send: vi.fn(),
    })

    for (let i = 0; i < 5; i++) {
      server['handleConnection'](
        makeWs() as any,
        {
          headers: { origin: 'https://app.pixelatedempathy.com' },
          url: '/?token=abc',
          socket: { remoteAddress: '10.0.0.1' },
        } as any,
      )
    }

    closeSpy.mockClear()
    server['handleConnection'](
      makeWs() as any,
      {
        headers: { origin: 'https://app.pixelatedempathy.com' },
        url: '/?token=abc',
        socket: { remoteAddress: '10.0.0.1' },
      } as any,
    )

    expect(closeSpy).toHaveBeenCalledWith(
      1008,
      'Too many connections from this IP',
    )
  })

  it('allows connections from different IPs', async () => {
    vi.doMock('../origin', () => ({
      isOriginAllowed: vi.fn().mockReturnValue(true),
      parseAllowedOrigins: vi.fn().mockReturnValue(new Set()),
    }))

    const { TrainingWebSocketServer } =
      await import('../TrainingWebSocketServer')
    const server = new TrainingWebSocketServer(0, {
      auditLog: {
        write: vi.fn(),
        queryBySession: vi.fn(),
        queryByUser: vi.fn(),
      } as any,
    })

    const closeSpy = vi.fn()
    const makeWs = () => ({
      close: closeSpy,
      on: vi.fn(),
      ping: vi.fn(),
      readyState: 1,
      send: vi.fn(),
    })

    for (let i = 0; i < 6; i++) {
      server['handleConnection'](
        makeWs() as any,
        {
          headers: { origin: 'https://app.pixelatedempathy.com' },
          url: '/?token=abc',
          socket: { remoteAddress: `10.0.0.${i}` },
        } as any,
      )
    }

    expect(closeSpy).not.toHaveBeenCalled()
  })
})

// ── 7. Idle-disconnect timer ─────────────────────────────────────

describe('PIX-3935: idle-disconnect ping timer', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('registers a client timer on connection', async () => {
    vi.doMock('../origin', () => ({
      isOriginAllowed: vi.fn().mockReturnValue(true),
      parseAllowedOrigins: vi.fn().mockReturnValue(new Set()),
    }))

    const { TrainingWebSocketServer } =
      await import('../TrainingWebSocketServer')
    const server = new TrainingWebSocketServer(0)
    const mockWs = {
      close: vi.fn(),
      on: vi.fn(),
      ping: vi.fn(),
      readyState: 1,
      send: vi.fn(),
    }

    server['handleConnection'](
      mockWs as any,
      {
        headers: {},
        url: '/?token=abc',
        socket: { remoteAddress: '127.0.0.1' },
      } as any,
    )

    // Verify a timer was registered (setInterval was called in handleConnection)
    expect(server['clientTimers'].size).toBeGreaterThanOrEqual(1)
    // Verify lastPong entry was set (Date.now() recorded on connect)
    expect(server['lastPong'].size).toBeGreaterThanOrEqual(1)
  })
})

// ── 8. checkOrigin convenience function ──────────────────────────

describe('PIX-3935: origin.ts — checkOrigin', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env['ALLOWED_ORIGINS']
  })

  it('returns true when ALLOWED_ORIGINS is not set', async () => {
    const { checkOrigin } =
      await vi.importActual<typeof import('../origin')>('../origin')
    expect(checkOrigin('http://evil.com')).toBe(true)
  })

  it('respects env var when set', async () => {
    process.env['ALLOWED_ORIGINS'] = 'https://app.pixelatedempathy.com'
    const { checkOrigin } =
      await vi.importActual<typeof import('../origin')>('../origin')
    expect(checkOrigin('https://app.pixelatedempathy.com')).toBe(true)
    expect(checkOrigin('https://evil.com')).toBe(false)
  })
})
