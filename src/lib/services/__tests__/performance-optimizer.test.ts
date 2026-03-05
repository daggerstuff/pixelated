import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PerformanceOptimizer } from '../performance-optimizer'

describe('PerformanceOptimizer', () => {
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

  afterEach(() => {
    optimizer.cleanup()
  })

  describe('Cache Operations', () => {
    it('should store and retrieve values', () => {
      optimizer.set('key1', 'value1')
      expect(optimizer.get('key1')).toBe('value1')
    })

    it('should return null for non-existent keys', () => {
      expect(optimizer.get('nonexistent')).toBeNull()
    })

    it('should evict expired entries', async () => {
      optimizer.set('key1', 'value1')

      // Manually manipulate time or wait
      await new Promise(resolve => setTimeout(resolve, 1100))

      expect(optimizer.get('key1')).toBeNull()
    })

    it('should follow LRU eviction strategy', () => {
      optimizer.set('key1', 'value1')
      optimizer.set('key2', 'value2')
      optimizer.set('key3', 'value3')

      // Access key1 to make it most recent
      optimizer.get('key1')

      // Adding key4 should evict key2 (the least recently used)
      optimizer.set('key4', 'value4')

      expect(optimizer.get('key1')).toBe('value1')
      expect(optimizer.get('key2')).toBeNull()
      expect(optimizer.get('key3')).toBe('value3')
      expect(optimizer.get('key4')).toBe('value4')
    })

    it('should track cache hit rate correctly', () => {
      optimizer.set('key1', 'value1')

      optimizer.get('key1') // Hit
      optimizer.get('key2') // Miss
      optimizer.get('key1') // Hit

      // Trigger metrics update (manually if possible or wait for interval)
      // Since updateMetrics is private, we check the exposed metrics
      // But updateMetrics is called by interval. We can use getMetrics()
      // after forcing an update if we could, but let's check if getMetrics returns latest

      // @ts-ignore - accessing private for testing
      optimizer.updateMetrics()

      const metrics = optimizer.getMetrics()
      expect(metrics.cacheHitRate).toBe(2/3)
    })

    it('should maintain chronological order in Map after updates', () => {
        optimizer.set('key1', 'value1')
        optimizer.set('key2', 'value2')

        // key1 is oldest
        // @ts-ignore
        expect(optimizer.cache.keys().next().value).toBe('key1')

        optimizer.set('key1', 'value1-updated')
        // key1 should now be newest
        // @ts-ignore
        const keys = Array.from(optimizer.cache.keys())
        expect(keys[keys.length - 1]).toBe('key1')
        expect(keys[0]).toBe('key2')
    })
  })
})
