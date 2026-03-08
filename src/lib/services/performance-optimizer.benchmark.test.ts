
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PerformanceOptimizer } from './performance-optimizer'

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      monitoring: { metricsInterval: 100, alertThresholds: { responseTime: 1000, errorRate: 0.1, memoryUsage: 0.9 } }
    })
  })

  afterEach(() => {
    optimizer.cleanup()
  })

  describe('Cache', () => {
    it('should set and get values', () => {
      optimizer.set('key1', 'value1')
      expect(optimizer.get('key1')).toBe('value1')
    })

    it('should return null for expired entries', async () => {
      optimizer = new PerformanceOptimizer({
        cache: { ttl: 10, maxSize: 100, strategy: 'LRU' }
      })
      optimizer.set('key1', 'value1')
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(optimizer.get('key1')).toBeNull()
    })

    it('should evict entries when maxSize is reached', () => {
        optimizer = new PerformanceOptimizer({
            cache: { maxSize: 2, ttl: 10000, strategy: 'FIFO' }
        })
        optimizer.set('key1', 'value1')
        optimizer.set('key2', 'value2')
        optimizer.set('key3', 'value3')

        expect(optimizer.get('key1')).toBeNull()
        expect(optimizer.get('key2')).toBe('value2')
        expect(optimizer.get('key3')).toBe('value3')
    })

    it('should benchmark cache performance', () => {
        const iterations = 10000
        const start = performance.now()
        for (let i = 0; i < iterations; i++) {
            optimizer.set(`key${i}`, i)
            optimizer.get(`key${i}`)
        }
        const end = performance.now()
        console.log(`Cache performance for ${iterations} operations: ${end - start}ms`)
    })
  })
})
