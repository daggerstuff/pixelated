import { RedisService } from '../RedisService'
import { generateTestKey, generateData, measureOperation } from './test-utils'

// Define interface for test function
interface TestFunction {
  (name: string, fn: () => void): void
  skip: (name: string, fn: () => void) => void
}

// Check if Redis should be skipped for perf tests
const SKIP_REDIS_TESTS =
  process.env.SKIP_REDIS_TESTS === 'true' || process.env.CI === 'true'

// Conditionally skip the entire test suite if Redis is not available
const describeFn = SKIP_REDIS_TESTS ? (describe as TestFunction).skip : describe

describeFn('RedisService Performance', () => {
  let redis: RedisService

  beforeEach(async () => {
    redis = new RedisService({
      url: process.env['REDIS_URL']!,
      keyPrefix: process.env.REDIS_KEY_PREFIX!,
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
      expect(initialStats.totalConnections).toBeLessThanOrEqual(10)

      // Generate load
      const operations = Array.from({ length: 1000 }, (_, i) => {
        const key = generateTestKey(`pool-${i}`)
        return redis.set(key, 'test')
      })

      await Promise.all(operations)

      const finalStats = await redis.getPoolStats()
      expect(finalStats.totalConnections).toBeGreaterThan(
        initialStats.totalConnections,
      )
      expect(finalStats.totalConnections).toBeLessThanOrEqual(50)
    })

    it('should handle connection scaling time within limits', async () => {
      const start = Date.now()

      // Generate sudden load
      const operations = Array.from({ length: 500 }, (_, i) => {
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
      const operations = Array.from({ length: 10000 }, () => redis.get(key))
      await Promise.all(operations)
      const duration = Date.now() - start

      const opsPerSecond = Math.floor((operations.length / duration) * 1000)
      expect(opsPerSecond).toBeGreaterThan(10000) // 10k ops/sec minimum
    })

    it('should handle high-throughput set operations', async () => {
      const start = Date.now()
      const operations = Array.from({ length: 8000 }, (_, i) => {
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
      await Promise.all(keys.map((key) => redis.set(key, 'test')))

      const start = Date.now()
      const operations = keys.map((key) => redis.del(key))
      await Promise.all(operations)
      const duration = Date.now() - start

      const opsPerSecond = Math.floor((operations.length / duration) * 1000)
      expect(opsPerSecond).toBeGreaterThan(9000) // 9k ops/sec minimum
    })

    it('should handle high-throughput increment operations', async () => {
      const key = generateTestKey('incr')

      const start = Date.now()
      const operations = Array.from({ length: 12000 }, () => redis.incr(key))
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

        const writeTime = await measureOperation(() => redis.set(key, data))
        const readTime = await measureOperation(() => redis.get(key))

        results[size] = { write: writeTime, read: readTime }

        // Verify data integrity
        const retrieved = await redis.get(key)
        expect(retrieved).toHaveLength(size)
      }

      // Performance expectations
      expect(results[1024].write).toBeLessThan(1) // 1ms for 1KB write
      expect(results[1024].read).toBeLessThan(1) // 1ms for 1KB read

      expect(results[10240].write).toBeLessThan(2) // 2ms for 10KB write
      expect(results[10240].read).toBeLessThan(1) // 1ms for 10KB read

      expect(results[102400].write).toBeLessThan(10) // 10ms for 100KB write
      expect(results[102400].read).toBeLessThan(5) // 5ms for 100KB read

      expect(results[1048576].write).toBeLessThan(50) // 50ms for 1MB write
      expect(results[1048576].read).toBeLessThan(25) // 25ms for 1MB read
    })
  })

  describe('memory usage', () => {
    it('should maintain reasonable memory usage under load', async () => {
      await redis.getPoolStats()

      // Generate significant load with varied data sizes
      const operations = Array.from({ length: 1000 }, (_, i) => {
        const key = generateTestKey(`mem-${i}`)
        const data = 'x'.repeat(Math.min(100 + i, 1000)) // Varied sizes up to 1KB
        return redis.set(key, data)
      })

      await Promise.all(operations)

      const finalStats = await redis.getPoolStats()

      // Memory usage should scale reasonably
      expect(finalStats.totalConnections).toBeLessThanOrEqual(50)
      expect(finalStats.idleConnections).toBeGreaterThan(0)
      expect(finalStats.waitingClients).toBe(0)
    })

    it('should handle concurrent large data operations', async () => {
      const data = 'x'.repeat(100000) // 100KB
      const operations = Array.from({ length: 100 }, (_, i) => {
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
