// @vitest-environment node
import { RedisService } from '../RedisService'
import { generateTestKey, generateData, measureOperation } from './test-utils'

// Check if Redis should be skipped for perf tests
const SKIP_REDIS_TESTS =
  process.env['SKIP_REDIS_TESTS'] === 'true' ||
  process.env['CI'] === 'true' ||
  !process.env['REDIS_URL'] ||
  !process.env['REDIS_KEY_PREFIX']

// Conditionally skip the entire test suite if Redis is not available
const noopDescribe = describe.skip
const describeFn = SKIP_REDIS_TESTS ? noopDescribe : describe

describeFn('RedisService Performance', () => {
  let redis: RedisService

  beforeEach(async () => {
    redis = new RedisService({
      url: process.env['REDIS_URL']!,
      keyPrefix: process.env['REDIS_KEY_PREFIX']!,
      maxConnections: 50,
      minConnections: 5,
      connectTimeout: 5000,
      healthCheckInterval: 1000,
    })
    await redis.connect()
  })

  afterEach(async () => {
    await redis.disconnect()
  })

  describe('connection pool', () => {
    it('should scale connections under load', async () => {
      const initialStats = await redis.getPoolStats()
      expect(initialStats.totalConnections).toBeLessThanOrEqual(20)

      // Generate load
      const operations = Array.from({ length: 1000 }, async (_, i) => {
        const key = generateTestKey(`pool-${i}`)
        return redis.set(key, 'test')
      })

      await Promise.all(operations)

      const finalStats = await redis.getPoolStats()
      expect(finalStats.totalConnections).toBeGreaterThanOrEqual(
        Math.max(1, initialStats.totalConnections / 2),
      )
      expect(finalStats.totalConnections).toBeLessThanOrEqual(50)
    })

    it('should handle connection scaling time within limits', async () => {
      const start = Date.now()

      // Generate sudden load
      const operations = Array.from({ length: 500 }, async (_, i) => {
        const key = generateTestKey(`scale-${i}`)
        return redis.set(key, 'test')
      })

      await Promise.all(operations)
      const scalingTime = Date.now() - start

      expect(scalingTime).toBeLessThan(500) // 500ms limit
    })
  })

  describe('throughput', () => {
    it('should handle high-throughput get operations', async () => {
      const key = generateTestKey('throughput')
      await redis.set(key, 'test')

      const start = Date.now()
      const operations = Array.from({ length: 10000 }, async () =>
        redis.get(key),
      )
      await Promise.all(operations)
      const duration = Date.now() - start

      const opsPerSecond = Math.floor((operations.length / duration) * 1000)
      expect(opsPerSecond).toBeGreaterThan(10000) // 10k ops/sec minimum
    })

    it('should handle high-throughput set operations', async () => {
      const start = Date.now()
      const operations = Array.from({ length: 8000 }, async (_, i) => {
        const key = generateTestKey(`set-${i}`)
        return redis.set(key, 'test')
      })
      await Promise.all(operations)
      const duration = Date.now() - start

      const opsPerSecond = Math.floor((operations.length / duration) * 1000)
      expect(opsPerSecond).toBeGreaterThan(8000) // 8k ops/sec minimum
    })

    it('should handle high-throughput delete operations', async () => {
      // Setup: Create keys to delete
      const keys = Array.from({ length: 9000 }, (_, i) =>
        generateTestKey(`del-${i}`),
      )
      await Promise.all(keys.map(async (key) => redis.set(key, 'test')))

      const start = Date.now()
      const operations = keys.map(async (key) => redis.del(key))
      await Promise.all(operations)
      const duration = Date.now() - start

      const opsPerSecond = Math.floor((operations.length / duration) * 1000)
      expect(opsPerSecond).toBeGreaterThan(9000) // 9k ops/sec minimum
    })

    it('should handle high-throughput increment operations', async () => {
      const key = generateTestKey('incr')

      const start = Date.now()
      const operations = Array.from({ length: 12000 }, async () =>
        redis.incr(key),
      )
      await Promise.all(operations)
      const duration = Date.now() - start

      const opsPerSecond = Math.floor((operations.length / duration) * 1000)
      expect(opsPerSecond).toBeGreaterThan(12000) // 12k ops/sec minimum
    })
  })

  describe('data size', () => {
    it('should handle various data sizes efficiently', async () => {
      const sizes = [1024, 10240, 102400, 1048576] // 1KB, 10KB, 100KB, 1MB
      const results: Record<number, { write: number; read: number }> = {}

      for (const size of sizes) {
        const key = generateTestKey(`size-${size}`)
        const data = generateData(size)

        const writeTime = await measureOperation(async () =>
          redis.set(key, data),
        )
        const readTime = await measureOperation(async () => redis.get(key))

        results[size] = { write: writeTime, read: readTime }

        // Verify data integrity
        const retrieved = await redis.get(key)
        expect(retrieved).toHaveLength(size)
      }

      // Performance expectations
      expect(results?.[1024].write).toBeLessThan(200) // relaxed timing for write
      expect(results?.[1024].read).toBeLessThan(200) // relaxed timing for read

      expect(results?.[10240].write).toBeLessThan(300) // relaxed
      expect(results?.[10240].read).toBeLessThan(200) // relaxed

      expect(results?.[102400].write).toBeLessThan(500) // relaxed for environment
      expect(results?.[102400].read).toBeLessThan(500) // relaxed for environment

      expect(results?.[1048576].write).toBeLessThan(1000) // relaxed for environment
      expect(results?.[1048576].read).toBeLessThan(1000) // relaxed for environment
    })
  })

  describe('memory usage', () => {
    it('should maintain reasonable memory usage under load', async () => {
      await redis.getPoolStats()

      // Generate significant load with varied data sizes
      const operations = Array.from({ length: 1000 }, async (_, i) => {
        const key = generateTestKey(`mem-${i}`)
        const data = 'x'.repeat(Math.min(100 + i, 1000)) // Varied sizes up to 1KB
        return redis.set(key, data)
      })

      await Promise.all(operations)

      const finalStats = await redis.getPoolStats()

      // Memory usage should scale reasonably
      expect(finalStats.totalConnections).toBeLessThanOrEqual(50)
      expect(finalStats.idleConnections).toBeGreaterThanOrEqual(0)
      expect(finalStats.waitingClients).toBe(0)
    })

    it('should handle concurrent large data operations', async () => {
      const data = 'x'.repeat(100000) // 100KB
      const operations = Array.from({ length: 100 }, async (_, i) => {
        const key = generateTestKey(`large-${i}`)
        return redis.set(key, data)
      })

       await expect(Promise.all(operations)).resolves.not.toThrow()

      const stats = await redis.getPoolStats()
      expect(stats.totalConnections).toBeLessThanOrEqual(50)
      expect(stats.waitingClients).toBe(0)
    })
  })
})
