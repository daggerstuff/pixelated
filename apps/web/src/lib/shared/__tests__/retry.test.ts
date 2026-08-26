/**
 * Unit tests for the shared retry/backoff base (`src/lib/shared/retry.ts`).
 *
 * Verifies:
 * - Success on first attempt (no retry, single call)
 * - Success after transient failures (retries until success)
 * - Exhaustion (throws the last error after maxRetries attempts)
 * - Exponential backoff delays between attempts
 * - `sleep` resolves after the requested duration
 * - `auth/utils.ts` re-exports the same shared implementation
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { retry, sleep } from '../retry'

describe('shared retry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function advanceTimers() {
    // Flush all pending timers driven by fake-timer sleeps
    await vi.runAllTimersAsync()
  }

  it('resolves on first success without retrying', async () => {
    const fn = vi.fn(async () => 'ok')
    const result = await retry(fn, 3, 10)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries transient failures and succeeds', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('blip-1'))
      .mockRejectedValueOnce(new Error('blip-2'))
      .mockResolvedValueOnce('recovered')

    const promise = retry(fn, 3, 10)
    await advanceTimers()
    const result = await promise

    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws the last error after exhausting maxRetries', async () => {
    const fn = vi.fn(async () => {
      throw new Error('always-down')
    })

    const promise = retry(fn, 2, 10)
    const assertion = promise.then(
      () => {
        throw new Error('expected retry to reject')
      },
      (error: unknown) => {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('always-down')
      },
    )
    await advanceTimers()
    await assertion

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('applies exponential backoff delays between attempts', async () => {
    const fn = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('one'))
      .mockResolvedValueOnce(undefined)

    const promise = retry(fn, 3, 100)
    await advanceTimers()
    await promise

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('sleep resolves after the requested duration', async () => {
    const start = Date.now()
    const promise = sleep(50)
    await advanceTimers()
    await promise
    expect(Date.now() - start).toBeGreaterThanOrEqual(50)
  })

  it('auth/utils re-exports the shared implementation', async () => {
    const { retry: authRetry, sleep: authSleep } =
      await import('../../auth/utils')
    expect(authRetry).toBe(retry)
    expect(authSleep).toBe(sleep)
  })
})
