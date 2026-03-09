import { describe, it, expect, beforeEach } from 'vitest'
import { PerformanceOptimizer } from './performance-optimizer'

describe('PerformanceOptimizer Cache Benchmark', () => {
  let optimizer: PerformanceOptimizer
  const MAX_SIZE = 10000
  const ITERATIONS = 10000

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      cache: {
        maxSize: MAX_SIZE,
        ttl: 300000,
        strategy: 'LRU'
      }
    })
  })

  it('benchmarks cache set and evict performance', () => {
    const start = performance.now()

    // Fill the cache to its limit
    for (let i = 0; i < MAX_SIZE; i++) {
      optimizer.set(`key-${i}`, { data: i })
    }

    // Perform operations that trigger eviction
    for (let i = MAX_SIZE; i < MAX_SIZE + ITERATIONS; i++) {
      optimizer.set(`key-${i}`, { data: i })
    }

    const end = performance.now()
    const duration = end - start
    process.stdout.write(`Cache SET performance (including eviction): ${duration.toFixed(2)}ms for ${MAX_SIZE + ITERATIONS} operations\n`)
    process.stdout.write(`Average SET time: ${(duration / (MAX_SIZE + ITERATIONS)).toFixed(4)}ms\n`)
  })

  it('benchmarks metrics calculation performance', () => {
    // Fill the cache
    for (let i = 0; i < MAX_SIZE; i++) {
      optimizer.set(`key-${i}`, { data: i })
      optimizer.get(`key-${i}`) // Increase access count
    }

    const start = performance.now()

    for (let i = 0; i < 100; i++) {
      (optimizer as any).updateMetrics()
    }

    const end = performance.now()
    const duration = end - start
    process.stdout.write(`Metrics calculation performance: ${duration.toFixed(2)}ms for 100 updates on ${MAX_SIZE} entries\n`)
    process.stdout.write(`Average update time: ${(duration / 100).toFixed(4)}ms\n`)
  })
})
