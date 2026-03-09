import { describe, it, expect, beforeEach } from 'vitest'
import { PerformanceOptimizer } from './performance-optimizer'

describe('PerformanceOptimizer Unit Tests', () => {
  let optimizer: PerformanceOptimizer

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      cache: {
        maxSize: 3,
        ttl: 1000,
        strategy: 'LRU'
      }
    })
  })

  it('should store and retrieve values', () => {
    optimizer.set('a', 1)
    expect(optimizer.get('a')).toBe(1)
  })

  it('should evict expired entries', async () => {
    optimizer.set('a', 1)
    // Manually wait for TTL
    await new Promise(resolve => setTimeout(resolve, 1100))
    expect(optimizer.get('a')).toBeNull()
  })

  it('should follow LRU eviction policy', () => {
    optimizer.set('a', 1)
    optimizer.set('b', 2)
    optimizer.set('c', 3)

    // Access 'a' to make it MRU
    optimizer.get('a')

    // Set 'd', should evict 'b' (oldest, least recently used)
    optimizer.set('d', 4)

    expect(optimizer.get('a')).toBe(1)
    expect(optimizer.get('b')).toBeNull()
    expect(optimizer.get('c')).toBe(3)
    expect(optimizer.get('d')).toBe(4)
  })

  it('should calculate cache hit rate correctly', () => {
    optimizer.set('a', 1)
    optimizer.get('a') // hit
    optimizer.get('b') // miss

    const metrics = (optimizer as any).updateMetrics()
    expect(optimizer.getMetrics().cacheHitRate).toBe(0.5)
  })

  it('should follow FIFO eviction policy', () => {
    const fifoOptimizer = new PerformanceOptimizer({
      cache: {
        maxSize: 3,
        ttl: 1000,
        strategy: 'FIFO'
      }
    })

    fifoOptimizer.set('a', 1)
    fifoOptimizer.set('b', 2)
    fifoOptimizer.set('c', 3)

    // Access 'a' - shouldn't change FIFO order
    fifoOptimizer.get('a')

    fifoOptimizer.set('d', 4)

    expect(fifoOptimizer.get('a')).toBeNull() // 'a' was first in
    expect(fifoOptimizer.get('b')).toBe(2)
    expect(fifoOptimizer.get('c')).toBe(3)
    expect(fifoOptimizer.get('d')).toBe(4)
  })
})
