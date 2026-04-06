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
    const func = vi.fn<any>()
    const debouncedFunc = debounce(func, 100)

    debouncedFunc()
    debouncedFunc()
    debouncedFunc()

    expect(func).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)

    expect(func).toHaveBeenCalledTimes(1)
  })

  it('should call immediately if immediate is true', () => {
    const func = vi.fn<any>()
    const debouncedFunc = debounce(func, 100, true)

    debouncedFunc()
    debouncedFunc()
    debouncedFunc()

    expect(func).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)

    expect(func).toHaveBeenCalledTimes(1)
  })

  it('should call again after timeout if immediate is true', () => {
    const func = vi.fn<any>()
    const debouncedFunc = debounce(func, 100, true)

    debouncedFunc()
    expect(func).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)

    debouncedFunc()
    expect(func).toHaveBeenCalledTimes(2)
  })

  it('should pass arguments to the debounced function', () => {
    const func = vi.fn<any>()
    const debouncedFunc = debounce(func, 100)

    debouncedFunc('test', 123)
    
    // Validate it hasn't been called yet (Patience Protocol/Review suggestion)
    expect(func).not.toHaveBeenCalled()
    
    vi.advanceTimersByTime(100)

    // Use toHaveBeenLastCalledWith to ensure exactly these args (Review suggestion)
    expect(func).toHaveBeenCalledTimes(1)
    expect(func).toHaveBeenLastCalledWith('test', 123)
  })

  it('should forward arguments from the most recent call', () => {
    const func = vi.fn<any>()
    const debouncedFunc = debounce(func, 100)

    debouncedFunc('first', 1)
    debouncedFunc('second', 2)
    debouncedFunc('third', 3)

    vi.advanceTimersByTime(100)

    expect(func).toHaveBeenCalledTimes(1)
    expect(func).toHaveBeenLastCalledWith('third', 3)
  })

  it('should pass arguments when immediate is true', () => {
    const func = vi.fn<any>()
    const debouncedFunc = debounce(func, 100, true)

    debouncedFunc('immediate', { ok: true })
    
    expect(func).toHaveBeenCalledTimes(1)
    expect(func).toHaveBeenLastCalledWith('immediate', { ok: true })

    vi.advanceTimersByTime(100)
    expect(func).toHaveBeenCalledTimes(1)
  })

  it('should handle complex argument types correctly', () => {
    const func = vi.fn<any>()
    const debouncedFunc = debounce(func, 100)
    
    const obj = { nested: { value: 1 } }
    const arr = [1, 2, 3]
    const callback = () => 'result'

    debouncedFunc(obj, arr, callback)
    
    vi.advanceTimersByTime(100)

    expect(func).toHaveBeenCalledTimes(1)
    expect(func).toHaveBeenLastCalledWith(obj, arr, callback)
  })

})
