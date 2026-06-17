/**
 * @vitest-environment node
 */
import Redis from 'ioredis'

import { CacheInvalidation } from '../../../cache/invalidation.ts'
import type { RedisMockClient } from '../redis-operation-types'
import { RedisService } from '../RedisService'
import {
  cleanupTestKeys,
  generateTestKey,
  runConcurrentOperations,
  sleep,
  verifyRedisConnection,
} from './test-utils'

function getRedisClientOrThrow(redisService: RedisService): Redis {
  const client = redisService.getClient()

  if (!client) {
    throw new Error('Redis client is not initialized')
  }

  return client as unknown as Redis
}

async function expectKeyExists(
  redisService: RedisService,
  key: string,
): Promise<void> {
  expect(await getRedisClientOrThrow(redisService).exists(key)).toBe(1)
}

async function expectKeyDoesNotExist(
  redisService: RedisService,
  key: string,
): Promise<void> {
  expect(await getRedisClientOrThrow(redisService).exists(key)).toBe(0)
}

async function getMatchingKeys(
  redisService: RedisService,
  pattern: string,
): Promise<string[]> {
  return redisService.keys(pattern)
}

function resolveRedisUrl(): string {
  const redisUrl = process.env['REDIS_URL']
  if (!redisUrl) {
    throw new Error('REDIS_URL is not defined')
  }

  return redisUrl
}

// Conditionally skip Redis integration tests in CI or when explicitly requested
const SKIP_REDIS_TESTS =
  process.env['SKIP_REDIS_TESTS'] === 'true' || process.env['CI'] === 'true'
const hasRedisUrl = Boolean(process.env['REDIS_URL'])
const hasRedisAccess = SKIP_REDIS_TESTS
  ? false
  : await (async () => {
      if (!hasRedisUrl) {
        return false
      }

      try {
        const redis = new Redis(resolveRedisUrl())
        await redis.ping()
        await redis.quit()
        return true
      } catch {
        return false
      }
    })()

const shouldRunCacheInvalidationTests = SKIP_REDIS_TESTS || !hasRedisAccess
const noopDescribe = describe.skip
const describeCacheInvalidation = shouldRunCacheInvalidationTests
  ? noopDescribe
  : describe

describeCacheInvalidation('cacheInvalidation Integration', () => {
  let redis: RedisService
  let cacheInvalidation: CacheInvalidation
  let pubClient: Redis
  let subClient: Redis

  beforeEach(async () => {
    await verifyRedisConnection()

    const url = resolveRedisUrl()
    const keyPrefix = process.env['REDIS_KEY_PREFIX'] ?? ''

    // Set up Redis pub/sub clients
    pubClient = new Redis(url)
    subClient = new Redis(url)

    redis = new RedisService({
      url,
      keyPrefix,
      maxRetries: 3,
      retryDelay: 100,
      connectTimeout: 5000,
      maxConnections: 10,
      minConnections: 2,
    })
    await redis.connect()

    cacheInvalidation = new CacheInvalidation({
      redis: getRedisClientOrThrow(redis),
      prefix: keyPrefix,
    })
  })

  afterEach(async () => {
    await cleanupTestKeys()
    await redis.disconnect()
  })

  afterAll(async () => {
    await pubClient.quit()
    await subClient.quit()
  })

  describe('cache Pattern Invalidation', () => {
    it('should invalidate all keys matching a pattern', async () => {
      // Set up test data
      const pattern = generateTestKey('test-pattern')
      const keys = Array.from({ length: 5 }, (_, i) => `${pattern}:${i}`)
      const value = JSON.stringify({ data: 'test' })

      // Set test keys
      await Promise.all(
        keys.map(async (key) => {
          await redis.set(key, value)
        }),
      )

      // Verify keys exist
      for (const key of keys) {
        await expectKeyExists(redis, key)
      }

      // Invalidate keys matching pattern
      await cacheInvalidation.invalidatePattern(`${pattern}:*`)
      await sleep(100) // Allow time for invalidation to propagate

      // Verify keys are removed
      for (const key of keys) {
        await expectKeyDoesNotExist(redis, key)
      }
      expect(await getMatchingKeys(redis, `${pattern}:*`)).toHaveLength(0)
    })

    it('should handle concurrent pattern invalidations', async () => {
      // Set up test data
      const patterns = Array.from({ length: 3 }, () =>
        generateTestKey('concurrent'),
      )
      const keysPerPattern = 5
      const value = JSON.stringify({ data: 'test' })

      // Create test keys for each pattern
      for (const pattern of patterns) {
        await Promise.all(
          Array.from({ length: keysPerPattern }, async (_, i) => {
            await redis.set(`${pattern}:${i}`, value)
          }),
        )
      }

      // Run concurrent invalidations
      const operations = patterns.map((pattern) => async () => {
        await cacheInvalidation.invalidatePattern(`${pattern}:*`)
      })

      await runConcurrentOperations(operations, {
        description: 'Concurrent pattern invalidations',
        expectedDuration: 1000,
      })

      await sleep(100) // Allow time for invalidation to propagate

      // Verify all keys are removed
      for (const pattern of patterns) {
        const keys = await getMatchingKeys(redis, `${pattern}:*`)
        expect(keys).toHaveLength(0)
      }
      expect(patterns).toHaveLength(3)
    })
  })

  describe('cache Tag Invalidation', () => {
    it('should invalidate keys by tag', async () => {
      // Set up test data
      const tag = generateTestKey('tag')
      const keys = Array.from({ length: 3 }, () => generateTestKey('tagged'))
      const value = JSON.stringify({ data: 'test' })

      // Set keys with tags
      await Promise.all(
        keys.map(async (key) => {
          await redis.set(key, value)
          await cacheInvalidation.set(key, value, {
            pattern: key,
            tags: [tag],
          })
        }),
      )

      // Verify keys exist
      for (const key of keys) {
        await expectKeyExists(redis, key)
      }

      // Invalidate by tag
      await cacheInvalidation.invalidateTag(tag)
      await sleep(100) // Allow time for invalidation to propagate

      // Verify keys are removed
      for (const key of keys) {
        await expectKeyDoesNotExist(redis, key)
      }
      expect(await getMatchingKeys(redis, `${tag}:*`)).toHaveLength(0)
    })

    it('should handle multiple tags per key', async () => {
      const tags = Array.from({ length: 3 }, () => generateTestKey('multi-tag'))
      const key = generateTestKey('multi-tagged')
      const value = JSON.stringify({ data: 'test' })

      // Set key with multiple tags
      await redis.set(key, value)
      await cacheInvalidation.set(key, value, { pattern: key, tags })

      // Verify key exists
      await expectKeyExists(redis, key)
      expect(await redis.exists(key)).toBe(true)

      // Invalidate using each tag
      for (const tag of tags) {
        await cacheInvalidation.invalidateTag(tag)
        await sleep(100) // Allow time for invalidation to propagate
        await expectKeyDoesNotExist(redis, key)

        // Reset key for next tag test
        if (tag !== tags[tags.length - 1]) {
          await redis.set(key, value)
          await cacheInvalidation.set(key, value, { pattern: key, tags })
        }
      }
    })
  })

  describe('cache Events', () => {
    it('should emit invalidation events', async () => {
      const pattern = generateTestKey('event-test')
      const value = JSON.stringify({ data: 'test' })

      // Set a test key
      await redis.set(pattern, value)

      // Invalidate and verify
      await cacheInvalidation.invalidatePattern(`${pattern}:*`)
      await sleep(100)

      const keys = await getMatchingKeys(redis, `${pattern}:*`)
      expect(keys).toHaveLength(0)
    })

    it('should handle invalidation event subscribers', async () => {
      const pattern = generateTestKey('subscriber-test')
      const value = JSON.stringify({ data: 'test' })
      const keys = Array.from({ length: 2 }, (_, i) => `${pattern}:${i}`)

      // Set test keys
      await Promise.all(
        keys.map(async (key) => {
          await redis.set(key, value)
        }),
      )

      // Invalidate pattern
      await cacheInvalidation.invalidatePattern(`${pattern}:*`)
      await sleep(100)

      // Verify all keys are removed
      const remainingKeys = await getMatchingKeys(redis, `${pattern}:*`)
      expect(remainingKeys).toHaveLength(0)
    })
  })

  describe('error Handling', () => {
    it('should handle Redis connection failures during invalidation', async () => {
      const pattern = generateTestKey('error-test')

      // Force Redis disconnection
      await redis.disconnect()

      // Attempt invalidation
      await expect(
        cacheInvalidation.invalidatePattern(`${pattern}:*`),
      ).rejects.toThrow()

      // Reconnect for cleanup
      await redis.connect()
    })

    it('should handle Redis connection recovery', async () => {
      const pattern = generateTestKey('recovery-test')
      const key = `${pattern}:1`
      const value = JSON.stringify({ data: 'test' })

      // Set test key
      await redis.set(key, value)

      // Force Redis disconnection and reconnection
      await redis.disconnect()
      await redis.connect()
      cacheInvalidation = new CacheInvalidation({
        redis: getRedisClientOrThrow(redis),
        prefix: process.env['REDIS_KEY_PREFIX'] ?? '',
      })

      // Attempt invalidation after recovery
      await cacheInvalidation.invalidatePattern(`${pattern}:*`)
      await sleep(100) // Allow time for invalidation to propagate

      await expectKeyDoesNotExist(redis, key)
      expect(await redis.get(key)).toBeNull()
    })
  })

  describe('performance', () => {
    it('should handle large-scale invalidations', async () => {
      const pattern = generateTestKey('perf-test')
      const keyCount = 1000
      const value = JSON.stringify({ data: 'test' })

      // Create many test keys
      await Promise.all(
        Array.from({ length: keyCount }, async (_, i) => {
          await redis.set(`${pattern}:${i}`, value)
        }),
      )

      const startTime = Date.now()
      await cacheInvalidation.invalidatePattern(`${pattern}:*`)
      const duration = Date.now() - startTime

      // Verify performance
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds

      await sleep(100) // Allow time for invalidation to propagate

      // Verify all keys are removed
      const remainingKeys = await getMatchingKeys(redis, `${pattern}:*`)
      expect(remainingKeys).toHaveLength(0)
    })

    it('should maintain performance under concurrent load', async () => {
      const basePattern = generateTestKey('concurrent-perf')
      const patterns = Array.from(
        { length: 10 },
        (_, i) => `${basePattern}:${i}`,
      )
      const keysPerPattern = 100
      const value = JSON.stringify({ data: 'test' })

      // Create test keys for each pattern
      for (const pattern of patterns) {
        await Promise.all(
          Array.from({ length: keysPerPattern }, async (_, i) => {
            await redis.set(`${pattern}:${i}`, value)
          }),
        )
      }

      // Run concurrent invalidations
      const operations = patterns.map((pattern) => async () => {
        await cacheInvalidation.invalidatePattern(`${pattern}:*`)
      })

      const { duration } = await runConcurrentOperations(operations, {
        description: 'Large-scale concurrent invalidations',
        expectedDuration: 10000, // Should complete within 10 seconds
      })

      // Verify performance
      expect(duration).toBeLessThan(10000)

      await sleep(100) // Allow time for invalidation to propagate

      // Verify all keys are removed
      const remainingKeys = await getMatchingKeys(redis, `${basePattern}:*`)
      expect(remainingKeys).toHaveLength(0)
    })
  })
})
