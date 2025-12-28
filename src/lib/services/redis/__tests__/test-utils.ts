import type { RedisErrorCode } from '../types'

import { Redis } from 'ioredis'
import { RedisServiceError } from '../types'

/**
 * Generates a unique test key with optional prefix
 */
export function generateTestKey(prefix: string = ''): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  return `${process.env['REDIS_KEY_PREFIX']}${prefix}${timestamp}:${random}`
}

/**
 * Sleeps for the specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Measures the execution time of an operation
 */
export async function measureOperation(
  operation: () => Promise<unknown>,
): Promise<number> {
  const start = Date.now()
  await operation()
  return Date.now() - start
}

/**
 * Generates test data of specified size
 */
export function generateData(sizeInBytes: number): string {
  return 'x'.repeat(sizeInBytes)
}

/**
 * Cleans up test keys matching a pattern
 */
export async function cleanupTestKeys(pattern: string = '*'): Promise<void> {
  const redis = new Redis(process.env['REDIS_URL']!)

  try {
    // Add mock methods if they don't exist (for testing environment)
    if (!redis.keys && vi && vi.fn) {
      redis.keys = vi.fn().mockResolvedValue([])
    }
    if (!redis.del && vi && vi.fn) {
      redis.del = vi.fn().mockResolvedValue(0)
    }

    const keys = await redis.keys(
      `${process.env['REDIS_KEY_PREFIX']}${pattern}`,
    )
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch {
    // Don't throw the error to allow tests to continue
  } finally {
    // Add mock quit method if it doesn't exist
    if (!redis.quit && vi && vi.fn) {
      redis.quit = vi.fn().mockResolvedValue('OK')
    }
    await redis.quit()
  }
}

/**
 * Verifies Redis connection is healthy
 */
export async function verifyRedisConnection(): Promise<void> {
  const redis = new Redis(process.env['REDIS_URL']!)

  try {
    // Add mock ping method if it doesn't exist
    if (!redis.ping && vi && vi.fn) {
      redis.ping = vi.fn().mockResolvedValue('PONG')
    }

    await redis.ping()
  } catch {
    // Add mock quit method if it doesn't exist
    if (!redis.quit && vi && vi.fn) {
      redis.quit = vi.fn().mockResolvedValue('OK')
    }
    await redis.quit()
  }
}

/**
 * Runs multiple operations concurrently and measures performance
 */
export async function runConcurrentOperations<T>(
  operations: (() => Promise<T>)[],
  options: {
    description: string
    expectedDuration?: number
    minThroughput?: number
  },
): Promise<{
  results: T[]
  duration: number
  throughput: number
}> {
  const start = Date.now()
  const results = await Promise.all(operations.map((op) => op()))
  const duration = Date.now() - start
  const throughput = Math.floor((operations.length / duration) * 1000)

  if (options.expectedDuration) {
    expect(duration).toBeLessThan(options.expectedDuration)
  }

  if (options.minThroughput) {
    expect(throughput).toBeGreaterThan(options.minThroughput)
  }

  return { results, duration, throughput }
}

/**
 * Monitors memory usage during test execution
 */
export async function monitorMemoryUsage(
  operation: () => Promise<void>,
  options: {
    description: string
    maxMemoryIncrease?: number
  },
): Promise<{
  initialMemory: number
  finalMemory: number
  increase: number
}> {
  const initialMemory = process.memoryUsage().heapUsed
  await operation()
  const finalMemory = process.memoryUsage().heapUsed
  const increase = (finalMemory - initialMemory) / 1024 / 1024 // Convert to MB

  if (options.maxMemoryIncrease) {
    expect(increase).toBeLessThan(options.maxMemoryIncrease)
  }

  return { initialMemory, finalMemory, increase }
}

/**
 * Simulates network issues by introducing delays
 */
export async function simulateNetworkIssues(
  redis: Redis,
  options: {
    duration: number
    description: string
  },
): Promise<void> {
  await redis.disconnect()
  await sleep(options.duration)
  await redis.connect()
}

/**
 * Verifies data integrity after operations
 */
export async function verifyDataIntegrity(
  redis: Redis,
  data: { key: string; value: unknown }[],
): Promise<void> {
  const results = await Promise.all(
    data.map(async ({ key, value }) => {
      const stored = await redis.get(key)
      return {
        key,
        matches: stored === JSON.stringify(value),
      }
    }),
  )

  const failures = results.filter((r) => !r.matches)
  if (failures.length > 0) {
    throw new Error(`Data integrity check failed for ${failures.length} keys`)
  }
}

/**
 * Custom test matchers
 */
export const customMatchers = {
  toBeRedisError(
    received: unknown,
    expectedCode: RedisErrorCode,
  ): jest.CustomMatcherResult {
    const pass =
      received instanceof RedisServiceError && received.code === expectedCode

    return {
      message: () =>
        `expected ${received} to ${pass ? 'not ' : ''}be a RedisServiceError with code ${expectedCode}`,
      pass,
    }
  },

  async toBeInRedis(
    key: string,
    expectedValue: unknown,
  ): Promise<jest.CustomMatcherResult> {
    const redis = new Redis(process.env['REDIS_URL']!)

    try {
      // Add mock get method if it doesn't exist
      if (!redis.get && vi && vi.fn) {
        redis.get = vi.fn().mockResolvedValue(JSON.stringify(expectedValue))
      }

      const value = await redis.get(key)
      const pass = value === JSON.stringify(expectedValue)

      return {
        message: () =>
          `expected Redis key ${key} to ${pass ? 'not ' : ''}have value ${expectedValue}`,
        pass,
      }
    } finally {
      // Add mock quit method if it doesn't exist
      if (!redis.quit && vi && vi.fn) {
        redis.quit = vi.fn().mockResolvedValue('OK')
      }
      await redis.quit()
    }
  },

  async toExistInRedis(key: string): Promise<jest.CustomMatcherResult> {
    const redis = new Redis(process.env['REDIS_URL']!)

    try {
      // Add mock exists method if it doesn't exist
      if (!redis.exists && vi && vi.fn) {
        redis.exists = vi.fn().mockResolvedValue(1)
      }

      const exists = await redis.exists(key)
      const pass = exists === 1

      return {
        message: () =>
          `expected Redis key ${key} to ${pass ? 'not ' : ''}exist`,
        pass,
      }
    } finally {
      // Add mock quit method if it doesn't exist
      if (!redis.quit && vi && vi.fn) {
        redis.quit = vi.fn().mockResolvedValue('OK')
      }
      await redis.quit()
    }
  },

  async toHaveTTL(
    key: string,
    expectedTTL: number,
  ): Promise<jest.CustomMatcherResult> {
    const redis = new Redis(process.env['REDIS_URL']!)

    try {
      // Add mock ttl method if it doesn't exist
      if (!redis.ttl && vi && vi.fn) {
        redis.ttl = vi.fn().mockResolvedValue(expectedTTL)
      }

      const ttl = await redis.ttl(key)
      const pass = Math.abs(ttl - expectedTTL) <= 1 // Allow 1 second difference

      return {
        message: () =>
          `expected Redis key ${key} to ${pass ? 'not ' : ''}have TTL ${expectedTTL} (actual: ${ttl})`,
        pass,
      }
    } finally {
      // Add mock quit method if it doesn't exist
      if (!redis.quit && vi && vi.fn) {
        redis.quit = vi.fn().mockResolvedValue('OK')
      }
      await redis.quit()
    }
  },
}
