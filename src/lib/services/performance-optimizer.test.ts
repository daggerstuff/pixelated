import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PerformanceOptimizer } from './performance-optimizer'

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      cache: {
        maxSize: 10,
        ttl: 1000,
        strategy: 'LRU',
      },
    })
  })

  afterEach(() => {
    optimizer.cleanup()
  })

  it('should be able to set and get values from cache', () => {
    optimizer.set('test', 'value')
    expect(optimizer.get('test')).toBe('value')
  })

  it('should return null for non-existent keys', () => {
    expect(optimizer.get('non-existent')).toBeNull()
  })

  it('should return null for expired keys', () => {
    vi.useFakeTimers()
    optimizer.set('test', 'value')
    vi.advanceTimersByTime(1500)
    expect(optimizer.get('test')).toBeNull()
    vi.useRealTimers()
  })

  it('should evict based on LRU strategy', () => {
    // Fill cache
    for (let i = 0; i < 10; i++) {
      optimizer.set(`key${i}`, `value${i}`)
    }

    // Access key0 to make it most recently used
    optimizer.get('key0')

    // Add another key to trigger eviction
    optimizer.set('key10', 'value10')

    // key1 should be evicted as it's the oldest (LRU)
    expect(optimizer.get('key1')).toBeNull()
    expect(optimizer.get('key0')).toBe('value0')
    expect(optimizer.get('key10')).toBe('value10')
  })

  it('should evict based on FIFO strategy', () => {
    const fifoOptimizer = new PerformanceOptimizer({
      cache: {
        maxSize: 10,
        ttl: 1000,
        strategy: 'FIFO',
      },
    })

    for (let i = 0; i < 10; i++) {
      fifoOptimizer.set(`key${i}`, `value${i}`)
    }

    // Access key0
    fifoOptimizer.get('key0')

    // Add another key
    fifoOptimizer.set('key10', 'value10')

    // key0 should be evicted as it was the first one added, regardless of access
    expect(fifoOptimizer.get('key0')).toBeNull()
    fifoOptimizer.cleanup()
  })

  it('should benchmark set operations', () => {
    const largeOptimizer = new PerformanceOptimizer({
      cache: {
        maxSize: 10000,
        ttl: 1000000,
        strategy: 'LRU',
      },
    })

    const start = performance.now()
    for (let i = 0; i < 10000; i++) {
      largeOptimizer.set(`key${i}`, `value${i}`)
    }
    const end = performance.now()
    console.log(`Time to set 10000 items: ${end - start}ms`)
    largeOptimizer.cleanup()
  })
})
