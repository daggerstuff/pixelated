/* @vitest-environment node */
/**
 * PIX-3935: TrainingWebSocketServer tests
 *
 * Separated from ws-hardening.test.ts to avoid module cache pollution.
 * The earlier tests in ws-hardening.test.ts import the real modules,
 * which interferes with the dynamic mocking needed for TrainingWebSocketServer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

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

describe('PIX-3935: TrainingWebSocketServer — per-IP limit', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('../origin', () => ({
      isOriginAllowed: vi.fn().mockReturnValue(true),
      parseAllowedOrigins: vi.fn().mockReturnValue(new Set()),
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

  it('rejects 6th concurrent connection from same IP', async () => {
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

describe('PIX-3935: idle-disconnect ping timer', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('../origin', () => ({
      isOriginAllowed: vi.fn().mockReturnValue(true),
      parseAllowedOrigins: vi.fn().mockReturnValue(new Set()),
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

  it('registers a client timer on connection', async () => {
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