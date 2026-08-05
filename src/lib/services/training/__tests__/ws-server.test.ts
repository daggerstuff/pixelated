/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockIsOriginAllowed = vi.fn().mockReturnValue(true)
const mockParseAllowedOrigins = vi.fn().mockReturnValue(new Set())
const mockSessionStore = vi.fn().mockImplementation(() => ({
  init: vi.fn(),
  close: vi.fn(),
  save: vi.fn(),
  load: vi.fn(),
}))
const mockRateLimiter = vi.fn().mockImplementation(() => ({
  check: vi.fn().mockResolvedValue(true),
  consume: vi.fn().mockResolvedValue(true),
}))
const mockGestaltClient = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
}))
const mockValidateToken = vi.fn()

vi.mock('../origin', () => ({
  isOriginAllowed: (...args: unknown[]) => mockIsOriginAllowed(...args),
  parseAllowedOrigins: (...args: unknown[]) => mockParseAllowedOrigins(...args),
}))

vi.mock('../session-store', () => ({
  SessionStore: (...args: unknown[]) => mockSessionStore(...args),
}))

vi.mock('../ratelimit', () => ({
  RateLimiter: (...args: unknown[]) => mockRateLimiter(...args),
}))

vi.mock('../../ai/GestaltClient', () => ({
  GestaltClient: (...args: unknown[]) => mockGestaltClient(...args),
}))

vi.mock('../../auth/jwt-service', () => ({
  validateToken: (...args: unknown[]) => mockValidateToken(...args),
}))

import { TrainingWebSocketServer } from '../TrainingWebSocketServer'

describe('PIX-3935: TrainingWebSocketServer — origin rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsOriginAllowed.mockReturnValue(true)
    mockParseAllowedOrigins.mockReturnValue(
      new Set(['https://app.pixelatedempathy.com']),
    )
  })

  it('rejects connection from non-allowed origin', () => {
    mockIsOriginAllowed.mockReturnValue(false)

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

  it('allows connection from allowed origin', () => {
    mockIsOriginAllowed.mockReturnValue(true)

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
    vi.clearAllMocks()
    mockIsOriginAllowed.mockReturnValue(true)
    mockParseAllowedOrigins.mockReturnValue(new Set())
  })

  it('rejects 6th concurrent connection from same IP', () => {
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

  it('allows connections from different IPs', () => {
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
    vi.clearAllMocks()
    mockIsOriginAllowed.mockReturnValue(true)
    mockParseAllowedOrigins.mockReturnValue(new Set())
  })

  it('registers a client timer on connection', () => {
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

    expect(server['clientTimers'].size).toBeGreaterThanOrEqual(1)
    expect(server['lastPong'].size).toBeGreaterThanOrEqual(1)
  })
})
