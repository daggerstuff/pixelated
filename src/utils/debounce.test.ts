import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { debounce } from './debounce'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should debounce a function', () => {
    const func = vi.fn()
    const debouncedFunc = debounce(func, 100)

    debouncedFunc()
    debouncedFunc()
    debouncedFunc()

    expect(func).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)

    expect(func).toHaveBeenCalledTimes(1)
  })

  it('should call immediately if immediate is true', () => {
    const func = vi.fn()
    const debouncedFunc = debounce(func, 100, true)

    debouncedFunc()
    debouncedFunc()
    debouncedFunc()

    expect(func).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)

    expect(func).toHaveBeenCalledTimes(1)
  })

  it('should call again after timeout if immediate is true', () => {
    const func = vi.fn()
    const debouncedFunc = debounce(func, 100, true)

    debouncedFunc()
    expect(func).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)

    debouncedFunc()
    expect(func).toHaveBeenCalledTimes(2)
  })

  it('should pass arguments to the debounced function', () => {
    const func = vi.fn()
    const debouncedFunc = debounce(func, 100)

    debouncedFunc('test', 123)
    vi.advanceTimersByTime(100)

    expect(func).toHaveBeenCalledWith('test', 123)
  })

})
