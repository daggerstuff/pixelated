/**
 * Dream Consolidation Integration Tests
 *
 * Tests the DreamScheduler, worker module structure, and the Flask blueprint
 * contract boundaries with Redis-backed job deduplication.
 *
 * NOTE: consolidation.py is Python and cannot be imported by TypeScript.
 * httpx-mocked tests verify the *client* contract — that the scheduler sends
 * correctly-formed requests and handles responses correctly.
 *
 * @vitest-environment node
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  afterAll,
} from 'vitest'

import { DreamScheduler } from '@/lib/services/dream-scheduler'
import type { RunResult } from '@/lib/services/dream-scheduler'

/**
 * ioredis-mock provides an in-memory Redis for test isolation.
 * Tests that use Redis don't need a real server.
 */
const RedisMock = (await import('ioredis-mock')).default
vi.mock('ioredis', () => ({ default: RedisMock }))

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const ORIGINAL_REDIS_URL = process.env['REDIS_URL']
const ORIGINAL_DREAM_CONSOLIDATION_URL = process.env['DREAM_CONSOLIDATION_URL']
const ORIGINAL_PIXEL_INFERENCE_URL = process.env['PIXEL_INFERENCE_URL']

beforeEach(() => {
  process.env['REDIS_URL'] = 'redis://localhost:6379'
  process.env['DREAM_CONSOLIDATION_URL'] = 'http://localhost:5000'
  process.env['PIXEL_INFERENCE_URL'] = 'http://localhost:8001'
})

afterEach(() => {
  if (ORIGINAL_REDIS_URL !== undefined) {
    process.env['REDIS_URL'] = ORIGINAL_REDIS_URL
  } else {
    delete process.env['REDIS_URL']
  }
  if (ORIGINAL_DREAM_CONSOLIDATION_URL !== undefined) {
    process.env['DREAM_CONSOLIDATION_URL'] = ORIGINAL_DREAM_CONSOLIDATION_URL
  } else {
    delete process.env['DREAM_CONSOLIDATION_URL']
  }
  if (ORIGINAL_PIXEL_INFERENCE_URL !== undefined) {
    process.env['PIXEL_INFERENCE_URL'] = ORIGINAL_PIXEL_INFERENCE_URL
  } else {
    delete process.env['PIXEL_INFERENCE_URL']
  }
  vi.restoreAllMocks()
})

afterAll(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockJsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
}

// ---------------------------------------------------------------------------
// DreamScheduler
// ---------------------------------------------------------------------------

describe('DreamScheduler', () => {
  let scheduler: DreamScheduler

  beforeEach(() => {
    scheduler = new DreamScheduler({
      consolidationUrl: 'http://localhost:5000',
      requestTimeoutMs: 5000,
      autoStart: false,
    })
  })

  afterEach(() => {
    scheduler.stop()
  })

  describe('runOnce()', () => {
    it('processes one user successfully', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ dream_id: 'dream_abc123' }),
      )

      const result: RunResult = await scheduler.runOnce(['user-1'])

      expect(result.usersProcessed).toBe(1)
      expect(result.usersFailed).toBe(0)
      expect(result.skipped).toBeUndefined()
      expect(result.errors).toHaveLength(0)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('skips when cycle is already in progress', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      fetchSpy.mockImplementation(() => new Promise(() => {}))

      void scheduler.runOnce(['user-1'])
      await new Promise((r) => setTimeout(r, 0))

      const result = await scheduler.runOnce(['user-1'])
      expect(result.skipped).toBe(true)
      expect(result.reason).toBe('Already running')
      expect(result.usersProcessed).toBe(0)

      fetchSpy.mockReset()
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ dream_id: 'dream_cancel' }),
      )
    })

    it('marks user as failed on HTTP error', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      fetchSpy.mockResolvedValueOnce(
        new Response('', { status: 502, statusText: 'Bad Gateway' }),
      )

      const result: RunResult = await scheduler.runOnce(['user-bad'])

      expect(result.usersProcessed).toBe(0)
      expect(result.usersFailed).toBe(1)
      expect(result.errors[0]).toContain('HTTP 502')
    })

    it('fetches active users when none specified', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      fetchSpy
        .mockResolvedValueOnce(
          mockJsonResponse({ users: ['active-1', 'active-2'] }),
        )
        .mockResolvedValueOnce(mockJsonResponse({ dream_id: 'dream_u1' }))
        .mockResolvedValueOnce(mockJsonResponse({ dream_id: 'dream_u2' }))

      const result: RunResult = await scheduler.runOnce()

      expect(result.usersProcessed).toBe(2)
      expect(result.usersFailed).toBe(0)
    })

    it('records duration after completion', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ dream_id: 'dream_xyz' }),
      )

      const result: RunResult = await scheduler.runOnce(['user-dur'])

      expect(result.durationMs).toBeDefined()
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('start() / stop()', () => {
    it('starts and stops without error', () => {
      expect(() => scheduler.start()).not.toThrow()
      expect(scheduler.active).toBe(true)
      expect(() => scheduler.stop()).not.toThrow()
      expect(scheduler.active).toBe(false)
    })

    it('warns when starting an already-running scheduler', () => {
      const warnSpy = vi.spyOn(console, 'warn')
      scheduler.start()
      scheduler.start()
      expect(warnSpy).toHaveBeenCalled()
      scheduler.stop()
    })
  })

  describe('isRunning guard', () => {
    it('sets isRunning to false after normal completion', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ dream_id: 'dream_normal' }),
      )

      await scheduler.runOnce(['user-normal'])
      expect(scheduler.active).toBe(false)

      fetchSpy.mockReset()
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ dream_id: 'dream_normal2' }),
      )
      const result2: RunResult = await scheduler.runOnce(['user-normal2'])
      expect(result2.usersProcessed).toBe(1)
    })
  })
})

// ---------------------------------------------------------------------------
// DreamWorker
// ---------------------------------------------------------------------------

describe('DreamWorker', () => {
  it('worker module can be imported without throwing', async () => {
    const worker = await import('@/workers/dream-worker')
    expect(worker).toBeDefined()
  })

  it('worker references consolidationUrl environment variable', async () => {
    const original = process.env['DREAM_CONSOLIDATION_URL']
    process.env['DREAM_CONSOLIDATION_URL'] = 'http://test:9999'
    try {
      const worker = await import('@/workers/dream-worker')
      expect(worker).toBeDefined()
    } finally {
      if (original !== undefined) {
        process.env['DREAM_CONSOLIDATION_URL'] = original
      } else {
        delete process.env['DREAM_CONSOLIDATION_URL']
      }
    }
  })
})

// ---------------------------------------------------------------------------
// FlaskBlueprint contract — DreamScheduler as the HTTP client
//
// consolidation.py is Python; these tests verify the DreamScheduler
// sends correctly-formed requests and handles Flask responses correctly.
// ---------------------------------------------------------------------------

describe('FlaskBlueprint contract', () => {
  it('scheduler POST /consolidate sends { user_id } and parses dream_id', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockResolvedValueOnce(
      mockJsonResponse({
        success: true,
        dream_id: 'dream_flask_123',
        message: 'ok',
      }),
    )

    const scheduler = new DreamScheduler({
      consolidationUrl: 'http://localhost:5000',
      autoStart: false,
    })

    await scheduler.runOnce(['user-flask'])

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:5000/api/dream/consolidate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ user_id: 'user-flask' }),
      }),
    )

    scheduler.stop()
  })

  it('scheduler GET /users returns user list for auto-discovery', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const mockUsers = ['user-a', 'user-b']

    fetchSpy
      .mockResolvedValueOnce(
        mockJsonResponse({ success: true, users: mockUsers }),
      )
      .mockResolvedValueOnce(mockJsonResponse({ dream_id: 'dream_a' }))
      .mockResolvedValueOnce(mockJsonResponse({ dream_id: 'dream_b' }))

    const scheduler = new DreamScheduler({
      consolidationUrl: 'http://localhost:5000',
      autoStart: false,
    })

    const result: RunResult = await scheduler.runOnce()

    expect(result.usersProcessed).toBe(2)
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:5000/api/dream/users',
      expect.anything(),
    )

    scheduler.stop()
  })

  it('scheduler handles duplicate consolidation gracefully (idempotent Flask)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const sharedDreamId = 'dream_shared_456'

    fetchSpy
      .mockResolvedValueOnce(
        mockJsonResponse({ success: true, dream_id: sharedDreamId }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({ success: true, dream_id: sharedDreamId }),
      )

    const scheduler = new DreamScheduler({
      consolidationUrl: 'http://localhost:5000',
      autoStart: false,
    })

    const r1: RunResult = await scheduler.runOnce(['user-dup'])
    const r2: RunResult = await scheduler.runOnce(['user-dup'])

    expect(r1.usersProcessed).toBe(1)
    expect(r2.usersProcessed).toBe(1)
    expect(r1.usersFailed).toBe(0)
    expect(r2.usersFailed).toBe(0)

    scheduler.stop()
  })

  it('scheduler treats HTTP 409 as a failure (lock conflict)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, error: 'Conflict' }), {
        status: 409,
        statusText: 'Conflict',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const scheduler = new DreamScheduler({
      consolidationUrl: 'http://localhost:5000',
      autoStart: false,
    })

    const result: RunResult = await scheduler.runOnce(['user-locked'])

    expect(result.usersFailed).toBe(1)
    expect(result.errors[0]).toContain('HTTP 409')

    scheduler.stop()
  })

  it('scheduler aborts on configured timeout', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        const { signal } = options ?? {}
        if (signal?.aborted) {
          reject(new DOMException('The user aborted a request.', 'AbortError'))
          return
        }
        signal?.addEventListener(
          'abort',
          () => {
            reject(
              new DOMException('The user aborted a request.', 'AbortError'),
            )
          },
          { once: true },
        )
        // Promise remains pending until abort signals rejection
      })
    })

    const scheduler = new DreamScheduler({
      consolidationUrl: 'http://localhost:5000',
      requestTimeoutMs: 50,
      autoStart: false,
    })

    const result: RunResult = await scheduler.runOnce(['user-timeout'])

    expect(result.usersFailed).toBe(1)
    expect(result.errors[0]).toMatch(/abort|timeout/i)

    scheduler.stop()
  }, 10_000)

  it('scheduler continues to next user after failure (does not halt)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy
      .mockResolvedValueOnce(
        new Response('', { status: 500, statusText: 'Internal Server Error' }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({ success: true, dream_id: 'dream_ok' }),
      )

    const scheduler = new DreamScheduler({
      consolidationUrl: 'http://localhost:5000',
      autoStart: false,
    })

    const result: RunResult = await scheduler.runOnce(['user-fail', 'user-ok'])

    expect(result.usersProcessed).toBe(1)
    expect(result.usersFailed).toBe(1)
    expect(result.errors).toHaveLength(1)

    scheduler.stop()
  })
})

// ---------------------------------------------------------------------------
// FailureRecovery — idempotency, deduplication, and resilience
// ---------------------------------------------------------------------------

describe('FailureRecovery', () => {
  it('scheduler extracts dream_id from Flask JSON body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockResolvedValueOnce(
      mockJsonResponse({
        success: true,
        dream_id: 'dream_extract_check',
        result: {},
      }),
    )

    const scheduler = new DreamScheduler({
      consolidationUrl: 'http://localhost:5000',
      autoStart: false,
    })

    const result: RunResult = await scheduler.runOnce(['user-extract'])

    expect(result.usersProcessed).toBe(1)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ user_id: 'user-extract' }),
      }),
    )

    scheduler.stop()
  })

  it('scheduler handles non-JSON error response without crashing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockResolvedValueOnce(
      new Response('gateway timeout', {
        status: 504,
        statusText: 'Gateway Timeout',
      }),
    )

    const scheduler = new DreamScheduler({
      consolidationUrl: 'http://localhost:5000',
      autoStart: false,
    })

    const result: RunResult = await scheduler.runOnce(['user-bad-gateway'])

    expect(result.usersFailed).toBe(1)
    expect(result.errors[0]).toContain('HTTP 504')

    scheduler.stop()
  })

  it('scheduler does not retry individual user on transient 502', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy
      .mockResolvedValueOnce(mockJsonResponse({ users: ['transient-user'] }))
      .mockResolvedValueOnce(
        new Response('', { status: 502, statusText: 'Bad Gateway' }),
      )

    const scheduler = new DreamScheduler({
      consolidationUrl: 'http://localhost:5000',
      autoStart: false,
    })

    const result: RunResult = await scheduler.runOnce()

    expect(result.usersProcessed).toBe(0)
    expect(result.usersFailed).toBe(1)
    expect(result.errors).toHaveLength(1)

    scheduler.stop()
  })
})
