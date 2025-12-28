import type { RedisServiceConfig } from '../types'
import { RedisService } from '../RedisService'
import { RedisErrorCode } from '../types'
import { generateTestKey, sleep } from './test-utils'

expect.extend({
  toBeRedisError(
    received: unknown,
    code: RedisErrorCode,
  ): jest.CustomMatcherResult {
    const error = received as { code?: RedisErrorCode }
    const pass = error?.code === code
    return {
      message: () => `expected error code ${code} but received ${error?.code}`,
      pass,
    }
  },
})

// Conditionally skip Redis integration tests in CI or when explicitly requested
const SKIP_REDIS_TESTS =
  process.env['SKIP_REDIS_TESTS'] === 'true' || process.env['CI'] === 'true'
const describeFn = SKIP_REDIS_TESTS ? describe.skip : describe

describeFn('RedisService Integration Tests', () => {
  let redis: RedisService
  const config: RedisServiceConfig = {
    url: process.env['REDIS_URL'] || 'redis://localhost:6379',
    keyPrefix: 'integration:',
    maxRetries: 3,
    retryDelay: 100,
    connectTimeout: 1000,
    maxConnections: 10,
    minConnections: 2,
    healthCheckInterval: 1000,
  }

  beforeAll(async () => {
    redis = new RedisService(config)
    await redis.connect()

    // Clear test keys
    const keys = await redis.keys('integration:*')
    for (const key of keys) {
      await redis.del(key)
    }
  })

  afterAll(async () => {
    // Cleanup test keys
    const keys = await redis.keys('integration:*')
    for (const key of keys) {
      await redis.del(key)
    }
    await redis.disconnect()
  })

  describe('Service Integration', () => {
    describe('Cache Service Integration', () => {
      it('should work with cache invalidation patterns', async () => {
        // Setup cache entries
        await redis.set('integration:cache:key1', 'value1', 3600000)
        await redis.set('integration:cache:key2', 'value2', 3600000)
        await redis.set('integration:cache:key3', 'value3', 3600000)

        // Verify cache entries
        expect(await redis.get('integration:cache:key1')).toBe('value1')
        expect(await redis.get('integration:cache:key2')).toBe('value2')
        expect(await redis.get('integration:cache:key3')).toBe('value3')

        // Invalidate specific key
        await redis.del('integration:cache:key1')
        expect(await redis.exists('integration:cache:key1')).toBe(false)
        expect(await redis.exists('integration:cache:key2')).toBe(true)

        // Pattern-based invalidation
        const keys = await redis.keys('integration:cache:*')
        await Promise.all(keys.map((key) => redis.del(key)))

        // Verify all cache entries are invalidated
        expect(await redis.exists('integration:cache:key2')).toBe(false)
        expect(await redis.exists('integration:cache:key3')).toBe(false)
      })

      it('should handle TTL-based cache expiration', async () => {
        await redis.set('integration:cache:ttl', 'test', 1000) // 1 second TTL
        expect(await redis.get('integration:cache:ttl')).toBe('test')

        // Wait for expiration
        await new Promise((resolve) => setTimeout(resolve, 1100))
        expect(await redis.get('integration:cache:ttl')).toBeNull()
      })
    })

    describe('Session Management Integration', () => {
      it('should handle session lifecycle', async () => {
        const sessionId = 'test-session'
        const userData = {
          id: '123',
          name: 'Test User',
          roles: ['user'],
        }

        // Create session
        await redis.set(
          `integration:session:${sessionId}`,
          JSON.stringify(userData),
          1800000, // 30 minutes
        )

        // Verify session
        const session = await redis.get(`integration:session:${sessionId}`)
        expect(JSON.parse(session!) as unknown).toEqual(userData)

        // Update session
        userData.roles.push('admin')
        await redis.set(
          `integration:session:${sessionId}`,
          JSON.stringify(userData),
          1800000,
        )

        // Verify update
        const updatedSession = await redis.get(
          `integration:session:${sessionId}`,
        )
        expect((JSON.parse(updatedSession!) as any).roles).toContain('admin')

        // Delete session
        await redis.del(`integration:session:${sessionId}`)
        expect(await redis.get(`integration:session:${sessionId}`)).toBeNull()
      })

      it('should handle concurrent session operations', async () => {
        const sessions = Array.from({ length: 100 }, (_, i) => ({
          id: `session-${i}`,
          data: { userId: `user-${i}`, timestamp: Date.now() },
        }))

        // Create sessions concurrently
        await Promise.all(
          sessions.map((session) =>
            redis.set(
              `integration:session:${session.id}`,
              JSON.stringify(session.data),
              1800000,
            ),
          ),
        )

        // Verify all sessions
        const results = await Promise.all(
          sessions.map((session) =>
            redis.get(`integration:session:${session.id}`),
          ),
        )

        results.forEach((result, i) => {
          expect(JSON.parse(result!) as unknown).toEqual(sessions[i]!.data)
        })
      })
    })

    describe('Analytics Integration', () => {
      it('should track event counts', async () => {
        const eventTypes = ['pageView', 'click', 'error'] as const
        const counts: Record<string, number> = {}

        // Simulate events
        for (let i = 0; i < 100; i++) {
          const type = eventTypes[i % eventTypes.length]!
          const key = `integration:analytics:${type}`
          await redis.incr(key)
          counts[type] = (counts[type] ?? 0) + 1
        }

        // Verify counts
        for (const type of eventTypes) {
          const count = await redis.get(`integration:analytics:${type}`)
          expect(Number.parseInt(count!, 10)).toBe(counts[type]!)
        }
      })

      it('should store and retrieve event details', async () => {
        const events = Array.from({ length: 50 }, (_, i) => ({
          id: `event-${i}`,
          type: i % 2 === 0 ? 'success' : 'error',
          timestamp: Date.now(),
          data: { message: `Event ${i}` },
        }))

        // Store events
        await Promise.all(
          events.map((event) =>
            redis.set(
              `integration:analytics:event:${event.id}`,
              JSON.stringify(event),
              86400000, // 24 hours
            ),
          ),
        )

        // Add to type-based sets
        await Promise.all(
          events.map((event) =>
            redis.sadd(`integration:analytics:events:${event.type}`, event.id),
          ),
        )

        // Verify event storage
        const successIds = await redis.smembers(
          'integration:analytics:events:success',
        )
        const errorIds = await redis.smembers(
          'integration:analytics:events:error',
        )

        expect(successIds.length + errorIds.length).toBe(events.length)

        // Verify event details
        const successEvents = await Promise.all(
          successIds.map((id) =>
            redis.get(`integration:analytics:event:${id}`),
          ),
        )
        successEvents.forEach((event) => {
          const parsed = JSON.parse(event!) as any
          expect(parsed.type).toBe('success')
        })
      })
    })

    describe('Pattern Recognition Integration', () => {
      it('should store and match patterns', async () => {
        const patterns = Array.from({ length: 10 }, (_, i) => ({
          id: `pattern-${i}`,
          type: 'behavior',
          sequence: ['login', 'search', 'view', 'logout'],
          confidence: 0.8 + i / 100,
        }))

        // Store patterns
        await Promise.all(
          patterns.map((pattern) =>
            redis.set(
              `integration:patterns:${pattern.id}`,
              JSON.stringify(pattern),
              3600000, // 1 hour
            ),
          ),
        )

        // Add to confidence-based sets
        await Promise.all(
          patterns.map((pattern) =>
            redis.sadd(
              `integration:patterns:confidence:${Math.floor(pattern.confidence * 10)}`,
              pattern.id,
            ),
          ),
        )

        // Verify pattern storage
        const highConfidenceIds = await redis.smembers(
          'integration:patterns:confidence:8',
        )
        expect(highConfidenceIds.length).toBeGreaterThan(0)

        const highConfidencePatterns = await Promise.all(
          highConfidenceIds.map((id) =>
            redis.get(`integration:patterns:${id}`),
          ),
        )
        highConfidencePatterns.forEach((pattern) => {
          const parsed = JSON.parse(pattern!) as any
          expect(parsed.confidence).toBeGreaterThanOrEqual(0.8)
        })
      })
    })

    describe('Error Recovery Integration', () => {
      it('should handle connection interruptions gracefully', async () => {
        // Store initial data
        await redis.set('integration:recovery:test', 'initial')
        expect(await redis.get('integration:recovery:test')).toBe('initial')

        // Simulate connection interruption
        await redis.disconnect()
        await redis.connect()

        // Verify data persistence
        expect(await redis.get('integration:recovery:test')).toBe('initial')

        // Continue operations
        await redis.set('integration:recovery:test', 'updated')
        expect(await redis.get('integration:recovery:test')).toBe('updated')
      })

      it('should maintain data integrity during reconnection', async () => {
        const key = 'integration:recovery:counter'
        await redis.set(key, '0')

        const operations = Array.from({ length: 100 }, async (_, i) => {
          if (i === 50) {
            await redis.disconnect()
            await redis.connect()
          }
          await redis.incr(key)
        })

        await Promise.all(operations)
        const finalValue = await redis.get(key)
        expect(Number.parseInt(finalValue!, 10)).toBe(100)
      })
    })

    describe('Cross-Service Integration', () => {
      it('should handle complex multi-service scenarios', async () => {
        // Simulate user session with analytics and pattern recognition
        const sessionId = 'test-user-session'
        const userId = 'test-user'

        // Create session
        await redis.set(
          `integration:session:${sessionId}`,
          JSON.stringify({ userId, active: true }),
          1800000,
        )

        // Track user events
        const events = ['login', 'search', 'view', 'purchase']
        for (const event of events) {
          // Increment event counter
          await redis.incr(`integration:analytics:${event}`)

          // Store event details
          await redis.set(
            `integration:analytics:${sessionId}:${Date.now()}`,
            JSON.stringify({ event, userId }),
            86400000,
          )

          // Add to user's event set
          await redis.sadd(`integration:user:${userId}:events`, event)
        }

        // Verify integration
        const userEvents = await redis.smembers(
          `integration:user:${userId}:events`,
        )
        expect(userEvents).toEqual(expect.arrayContaining(events))

        const session = JSON.parse(
          (await redis.get(`integration:session:${sessionId}`))!,
        )
        expect(session.userId).toBe(userId)

        // Cleanup
        await redis.del(`integration:session:${sessionId}`)
        await redis.del(`integration:user:${userId}:events`)
      })
    })
  })

  describe('connection pool', () => {
    it('should maintain connection pool within limits', async () => {
      const operations = Array.from({ length: 20 }, async (_, i) => {
        const key = generateTestKey(`pool-${i}`)
        await redis.set(key, 'test')
        await sleep(100)
        return redis.get(key)
      })

      await Promise.all(operations)

      const stats = await redis.getPoolStats()
      expect(stats.totalConnections).toBeLessThanOrEqual(10)
      expect(stats.totalConnections).toBeGreaterThanOrEqual(2)
    })

    it('should handle connection failures gracefully', async () => {
      // Simulate network issues by creating a new instance with invalid config
      const unstableRedis = new RedisService({
        url: 'redis://invalid:6379',
        keyPrefix: 'test:',
        maxRetries: 2,
        retryDelay: 100,
        connectTimeout: 1000,
      })

      await expect(unstableRedis.connect()).rejects.toBeRedisError(
        RedisErrorCode.CONNECTION_FAILED,
      )
      expect(await unstableRedis.isHealthy()).toBe(false)
    })

    it('should recover from temporary connection issues', async () => {
      // Simulate temporary connection loss
      await redis.disconnect()
      await sleep(1000)
      await redis.connect()

      const key = generateTestKey('recovery')
      await redis.set(key, 'test')

      expect(await redis.isHealthy()).toBe(true)
      expect(await redis.get(key)).toBe('test')
    })
  })

  describe('data persistence', () => {
    it('should persist data between connections', async () => {
      const key = generateTestKey('persist')
      await redis.set(key, 'test')

      // Disconnect and reconnect
      await redis.disconnect()
      await redis.connect()

      expect(await redis.get(key)).toBe('test')
    })

    it('should handle TTL between connections', async () => {
      const key = generateTestKey('ttl')
      await redis.set(key, 'test', 5)

      // Disconnect and reconnect
      await redis.disconnect()
      await redis.connect()

      const ttl = await redis.ttl(key)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(5)
    })
  })

  describe('concurrent operations', () => {
    it('should handle multiple set operations concurrently', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => {
        const key = generateTestKey(`concurrent-set-${i}`)
        return redis.set(key, `value-${i}`)
      })

      await expect(Promise.all(operations)).resolves.not.toThrow()
    })

    it('should handle mixed operations concurrently', async () => {
      const key = generateTestKey('mixed')
      const operations = [
        redis.set(key, 'initial'),
        redis.get(key),
        redis.set(key, 'updated'),
        redis.get(key),
        redis.del(key),
        redis.exists(key),
      ]

      const results = await Promise.all(operations)
      expect(results[5]).toBe(false) // Key should not exist after deletion
    })

    it('should handle set operations concurrently', async () => {
      const key = generateTestKey('set')
      const members = Array.from({ length: 100 }, (_, i) => `member-${i}`)

      await Promise.all(members.map((m) => redis.sadd(key, m)))
      const result = await redis.smembers(key)

      expect(result).toHaveLength(members.length)
      members.forEach((m) => expect(result).toContain(m))
    })
  })

  describe('error recovery', () => {
    it('should retry failed operations', async () => {
      // Create a new instance with retry configuration
      const retryRedis = new RedisService({
        url: process.env['REDIS_URL']!,
        keyPrefix: process.env['REDIS_KEY_PREFIX']!,
        maxRetries: 3,
        retryDelay: 100,
      })

      await retryRedis.connect()

      try {
        const key = generateTestKey('retry')
        await retryRedis.set(key, 'test')

        // Force disconnect to simulate failure
        await retryRedis.disconnect()

        // This should retry and eventually fail
        await expect(retryRedis.get(key)).rejects.toBeRedisError(
          RedisErrorCode.OPERATION_FAILED,
        )
      } finally {
        await retryRedis.disconnect()
      }
    })

    it('should handle multiple connection losses', async () => {
      for (let i = 0; i < 3; i++) {
        await redis.disconnect()
        await sleep(100)
        await redis.connect()

        const key = generateTestKey(`reconnect-${i}`)
        await redis.set(key, 'test')
        expect(await redis.get(key)).toBe('test')
      }
    })
  })

  describe('health checks', () => {
    it('should perform periodic health checks', async () => {
      const key = generateTestKey('health')
      await redis.set(key, 'test')

      // Wait for a few health check intervals
      await sleep(2500)

      expect(await redis.isHealthy()).toBe(true)
      expect(await redis.get(key)).toBe('test')
    })

    it('should detect unhealthy connections', async () => {
      await redis.disconnect()

      // Wait for health check to detect issue
      await sleep(1500)

      expect(await redis.isHealthy()).toBe(false)
    })
  })
})
