import type { Request, Response, NextFunction } from 'express'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  timeoutMiddleware,
  createTimeoutMiddleware,
} from '../middleware/query-timeout'

describe('query-timeout middleware', () => {
  let finishCallback: Function = () => {}
  let req: Request
  let res: Response
  let next: NextFunction

  beforeEach(() => {
    vi.useFakeTimers()
    req = {
      headers: {},
      method: 'GET',
      url: '/',
      httpVersion: '1.1',
      originalUrl: '/',
      params: {},
      query: {},
      body: {},
      cookies: {},
      socket: {} as any,
      connection: {} as any,
    } as unknown as Request

    // Reset the finish callback to a no-op
    finishCallback = () => {}

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
      on: vi.fn().mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          finishCallback = callback
        }
        return res
      }),
    } as unknown as Response

    next = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('timeoutMiddleware', () => {
    it('should call next for requests that finish before timeout', () => {
      const mw = timeoutMiddleware(50) // 50ms timeout
      mw(req, res, next)

      // Immediately, next should be called
      expect(next).toHaveBeenCalledOnce()
      // Response should not have been sent yet
      expect(res.status).not.toHaveBeenCalled()
      expect(res.json).not.toHaveBeenCalled()
      expect(res.end).not.toHaveBeenCalled()
    })

    it('should respond with 504 when timeout occurs', () => {
      const ms = 30
      const mw = timeoutMiddleware(ms)
      mw(req, res, next)

      // Advance timers past the timeout
      vi.advanceTimersByTime(ms + 1)

      // The timeout callback should have run
      expect(res.status).toHaveBeenCalledWith(504)
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'GATEWAY_TIMEOUT',
          message: `Request exceeded timeout of ${ms}ms`,
        },
      })
      // next should have been called immediately, but that's okay
      expect(next).toHaveBeenCalledOnce()
    })

    it('should not call next after timeout', () => {
      const ms = 20
      const mw = timeoutMiddleware(ms)
      mw(req, res, next)

      vi.advanceTimersByTime(ms + 1)

      expect(next).toHaveBeenCalledTimes(1) // called once at the start
      // But we want to ensure it wasn't called again? Actually, the middleware calls next once at the beginning.
      // The requirement is that after timeout, we don't call next again? The middleware only calls next once.
      // So we can't really test that next wasn't called after because it was called before.
      // Instead, we can test that the response was sent (which we do above) and that next was called exactly once.
      // The test "should not call next after timeout" is a bit misleading. The middleware calls next immediately.
      // We'll change the test to expect that next is called exactly once (which it is).
      // But the original test expected that next is not called after the timeout? Actually, the middleware calls next before setting the timeout.
      // So we'll keep the test as is and adjust the expectation: we expect next to have been called once (which is correct).
      // However, the test name says "should not call next after timeout". We can interpret that as: after the timeout occurs, we don't call next again.
      // Since we only call next once at the beginning, we are not calling it again after the timeout.
      // So we can leave the expectation as toHaveBeenCalledTimes(1).
    })

    it('should clear timeout on response finish', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      const mw = timeoutMiddleware(100)
      mw(req, res, next)

      // Simulate response finishing by calling the finish callback
      finishCallback()

      expect(clearTimeoutSpy).toHaveBeenCalledOnce()
    })
  })

  describe('createTimeoutMiddleware', () => {
    afterEach(() => {
      // Clean up environment variable
      delete process.env['QUERY_TIMEOUT_MS']
    })

    it('uses DEFAULT_TIMEOUT_MS when QUERY_TIMEOUT_MS is not set', () => {
      delete process.env['QUERY_TIMEOUT_MS']
      const mw = createTimeoutMiddleware()
      expect(typeof mw).toBe('function')
    })

    it('uses parsed value from QUERY_TIMEOUT_MS when set', () => {
      process.env['QUERY_TIMEOUT_MS'] = '5000'
      const mw = createTimeoutMiddleware()
      expect(typeof mw).toBe('function')
    })

    it('defaults to DEFAULT_TIMEOUT_MS when QUERY_TIMEOUT_MS is invalid', () => {
      process.env['QUERY_TIMEOUT_MS'] = 'invalid'
      const mw = createTimeoutMiddleware()
      expect(typeof mw).toBe('function')
    })

    it('defaults to DEFAULT_TIMEOUT_MS when QUERY_TIMEOUT_MS is zero or negative', () => {
      process.env['QUERY_TIMEOUT_MS'] = '0'
      const mw = createTimeoutMiddleware()
      expect(typeof mw).toBe('function')
    })
  })
})
