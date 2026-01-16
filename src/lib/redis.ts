/**
 * Redis client wrapper for ioredis
 * This module provides a consistent interface for Redis operations with proper error handling
 */

import Redis from 'ioredis'

// Get Redis configuration from environment variables directly
const getRedisConfig = () => {
  return {
    restUrl: process.env['UPSTASH_REDIS_REST_URL'] || process.env['REDIS_URL'],
    restToken: process.env['UPSTASH_REDIS_REST_TOKEN'],
    url: process.env['REDIS_URL'] || process.env['UPSTASH_REDIS_REST_URL'],
  }
}

// Determine if we're in a production environment
const isProduction = () => {
  return process.env['NODE_ENV'] === 'production'
}

// Create a mock Redis client for development
function createMockRedisClient() {
  const message = isProduction()
    ? 'CRITICAL: Using mock Redis client in production. This should never happen.'
    : 'Using mock Redis client for development. Redis operations will be mocked.'

  console.warn(message)

  const mockStore = new Map<string, string>()

  // Helper: convert glob-style pattern (supports '*') into a safe RegExp
  // Escapes regex metacharacters except '*' then replaces all '*' with '.*'
  const patternToRegex = (pattern: string): RegExp => {
    if (pattern === '*' || pattern === '') return /^.*$/
    // Escape regex special chars except '*'
    const escaped = pattern.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&')
    const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$'
    return new RegExp(regexStr)
  }

  // Return a mock client with all Redis operations needed by the threat detection system
  return {
    // Basic operations
    get: async (key: string) => mockStore.get(key) || null,
    set: async (key: string, value: string, ..._args: (string | number)[]) => {
      mockStore.set(key, value)
      return 'OK'
    },
    del: async (key: string) => {
      const existed = mockStore.has(key)
      mockStore.delete(key)
      return existed ? 1 : 0
    },
    exists: async (key: string) => (mockStore.has(key) ? 1 : 0),
    expire: async (key: string, _seconds: number) =>
      mockStore.has(key) ? 1 : 0,

    // Advanced operations needed by rate limiter
    setex: async (key: string, seconds: number, value: string) => {
      mockStore.set(key, value)
      return 'OK'
    },
    hincrby: async (key: string, field: string, increment: number) => {
      const hashKey = `${key}:${field}`
      const current = parseInt(mockStore.get(hashKey) || '0')
      const newValue = current + increment
      mockStore.set(hashKey, newValue.toString())
      return newValue
    },
    hgetall: async (key: string) => {
      const result: Record<string, string> = {}
      for (const [k, v] of mockStore.entries()) {
        if (k.startsWith(`${key}:`)) {
          const field = k.substring(key.length + 1)
          result[field] = v
        }
      }
      return result
    },
    hset: async (key: string, field: string, value: string) => {
      mockStore.set(`${key}:${field}`, value)
      return 1
    },

    // Pipeline operations
    pipeline: () => ({
      setex: (key: string, seconds: number, value: string) => ({
        setex: [key, seconds, value],
      }),
      hincrby: (key: string, field: string, increment: number) => ({
        hincrby: [key, field, increment],
      }),
      incr: (key: string) => ({
        incr: [key],
      }),
      expire: (key: string, seconds: number) => ({
        expire: [key, seconds],
      }),
      hset: (key: string, field: string, value: string | number) => ({
        hset: [key, field, value],
      }),
      exec: async () => [['OK'], [1]], // Mock successful pipeline execution
    }),

    // Connection operations
    ping: async () => 'PONG',
    quit: async () => 'OK',
    disconnect: () => { },
    status: 'ready',

    // List operations
    lpush: async (key: string, ...values: string[]) => {
      const listKey = `list:${key}`
      const existing = mockStore.get(listKey) || '[]'
      const list = JSON.parse(existing)
      list.unshift(...values)
      mockStore.set(listKey, JSON.stringify(list))
      return list.length
    },
    lrange: async (key: string, start: number, stop: number) => {
      const listKey = `list:${key}`
      const existing = mockStore.get(listKey) || '[]'
      const list = JSON.parse(existing)
      return list.slice(start, stop + 1)
    },
    lrem: async (key: string, count: number, value: string) => {
      const listKey = `list:${key}`
      const existing = mockStore.get(listKey) || '[]'
      const list = JSON.parse(existing)
      const filtered = list.filter((item: string) => item !== value)
      mockStore.set(listKey, JSON.stringify(filtered))
      return list.length - filtered.length
    },

    // Sorted set operations
    zadd: async (key: string, score: number, member: string) => {
      const zsetKey = `zset:${key}`
      const existing = mockStore.get(zsetKey) || '{}'
      const zset = JSON.parse(existing)
      zset[member] = score
      mockStore.set(zsetKey, JSON.stringify(zset))
      return 1
    },
    zrangebyscore: async (key: string, min: number, max: number) => {
      const zsetKey = `zset:${key}`
      const existing = mockStore.get(zsetKey) || '{}'
      const zset = JSON.parse(existing)
      return Object.entries(zset)
        .filter(
          ([_, score]) => (score as number) >= min && (score as number) <= max,
        )
        .map(([member]) => member)
    },
    zremrangebyscore: async (key: string, min: number, max: number) => {
      const zsetKey = `zset:${key}`
      const existing = mockStore.get(zsetKey) || '{}'
      const zset = JSON.parse(existing)
      let removed = 0
      for (const [member, score] of Object.entries(zset)) {
        if ((score as number) >= min && (score as number) <= max) {
          delete zset[member]
          removed++
        }
      }
      mockStore.set(zsetKey, JSON.stringify(zset))
      return removed
    },

    // Additional operations
    keys: async (pattern: string) => {
      const re = patternToRegex(pattern)
      return Array.from(mockStore.keys()).filter((k) => re.test(k))
    },
    flushall: async () => {
      mockStore.clear()
      return 'OK'
    },
    ttl: async (key: string) => (mockStore.has(key) ? -1 : -2),

    // Event emitter methods (for compatibility)
    on: () => { },
    off: () => { },
    emit: () => false,
  }
}

/**
 * Create Redis client with appropriate configuration (lazy)
 * Returns a real Redis client if credentials are present, otherwise a mock client.
 */
function createRedisClient() {
  const { restUrl, restToken } = getRedisConfig()

  if (restUrl) {
    // Initialize ioredis client with credentials
    return new Redis(restUrl, {
      password: restToken,
      // Add any additional options here if needed
    })
  } else {
    // Log appropriate warnings in production
    if (isProduction()) {
      console.error(
        'CRITICAL: Missing Redis credentials in production environment',
      )
    }
    return createMockRedisClient()
  }
}

export const redis = createRedisClient()

// Backward-compatible helper for modules expecting a getter
export function getRedisClient() {
  return redis
}

/**
 * Wrapper function for Redis get with error handling
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key)
    if (raw === null) {
      return null
    }
    try {
      return JSON.parse(raw) as unknown as T
    } catch {
      // If not JSON, return as-is
      return raw as unknown as T
    }
  } catch (error: unknown) {
    console.error(`Error getting key ${key} from Redis:`, error)
    return null
  }
}

/**
 * Wrapper function for Redis set with error handling
 */
export async function setInCache(
  key: string,
  value: unknown,
  expirationSeconds?: number,
): Promise<boolean> {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    if (expirationSeconds) {
      await redis.set(key, serialized, 'EX', expirationSeconds)
    } else {
      await redis.set(key, serialized)
    }
    return true
  } catch (error: unknown) {
    console.error(`Error setting key ${key} in Redis:`, error)
    return false
  }
}

/**
 * Wrapper function for Redis del with error handling
 */
export async function removeFromCache(key: string): Promise<boolean> {
  try {
    await redis.del(key)
    return true
  } catch (error: unknown) {
    console.error(`Error removing key ${key} from Redis:`, error)
    return false
  }
}

/**
 * Check Redis connectivity
 */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const pingResult = await redis.ping()
    return pingResult === 'PONG'
  } catch (error: unknown) {
    console.error('Redis connectivity check failed:', error)
    return false
  }
}

/**
 * Health check for Redis service
 */
export async function getRedisHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  details?: unknown
}> {
  try {
    const isConnected = await checkRedisConnection()
    if (isConnected) {
      return { status: 'healthy' }
    } else {
      return {
        status: 'unhealthy',
        details: { message: 'Could not connect to Redis' },
      }
    }
  } catch (error: unknown) {
    return {
      status: 'unhealthy',
      details: {
        message: 'Redis health check failed',
        error: error instanceof Error ? String(error) : String(error),
      },
    }
  }
}
