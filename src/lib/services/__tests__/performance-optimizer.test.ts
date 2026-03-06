import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PerformanceOptimizer } from '../performance-optimizer'

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      cache: {
        maxSize: 10,
        ttl: 100, // 100ms
        strategy: 'LRU'
      },
      monitoring: {
        metricsInterval: 10000, // Disable auto-monitoring
        alertThresholds: {
          responseTime: 1000,
          errorRate: 0.05,
          memoryUsage: 0.8
        }
      }
    })
  })

  afterEach(() => {
    optimizer.cleanup()
  })

  it('should evict expired entries', async () => {
    optimizer.set('key1', 'value1')
    expect(optimizer.get('key1')).toBe('value1')

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150))

    expect(optimizer.get('key1')).toBeNull()
  })

  it('should evict LRU entries when full', () => {
    // Fill cache
    for (let i = 0; i < 10; i++) {
      optimizer.set(`key${i}`, `value${i}`)
    }

    // Access key0 to make it MRU
    optimizer.get('key0')

    // Add another entry to trigger eviction
    optimizer.set('key10', 'value10')

    // key1 should be evicted as it's now the LRU
    expect(optimizer.get('key1')).toBeNull()
    expect(optimizer.get('key0')).toBe('value0')
    expect(optimizer.get('key10')).toBe('value10')
  })

  it('should track metrics correctly', () => {
    optimizer.get('key1') // Miss
    optimizer.set('key1', 'value1')
    optimizer.get('key1') // Hit

    const metrics = optimizer.getMetrics()
    // Manual trigger since we set a long interval
    ;(optimizer as any).updateMetrics()

    const updatedMetrics = optimizer.getMetrics()
    // 1 hit out of 2 accesses = 0.5
    expect(updatedMetrics.cacheHitRate).toBe(0.5)
  })

  it('should optimize eviction performance (bench-like)', () => {
    const largeOptimizer = new PerformanceOptimizer({
      cache: {
        maxSize: 10000,
        ttl: 10000,
        strategy: 'LRU'
      }
    })

    // Pre-fill
    for (let i = 0; i < 10000; i++) {
      largeOptimizer.set(`key${i}`, `value${i}`)
    }

    const start = performance.now()
    // This should be O(1) now, previously O(n)
    largeOptimizer.set('newKey', 'newValue')
    const end = performance.now()

    expect(end - start).toBeLessThan(10) // Should be very fast
    largeOptimizer.cleanup()
  })
})
