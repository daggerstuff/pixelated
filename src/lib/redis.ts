/**
 * Redis client wrapper for ioredis
 * This module provides a consistent interface for Redis operations with proper error handling
 */

import Redis from 'ioredis'

type RedisCommand = (...args: any[]) => any
type RedisClient = Record<string, RedisCommand> & { status?: string }

// Get Redis configuration from environment variables directly
const getRedisConfig = () => {
  return {
    // Prioritize REDIS_URL for ioredis connection (rediss://) over REST URL (https://)
    connectionUrl:
      process.env['REDIS_URL'] ?? process.env['UPSTASH_REDIS_REST_URL'],
    restToken: process.env['UPSTASH_REDIS_REST_TOKEN'],
  }
}

// Determine if we're in a production environment
const isProduction = () => {
  return process.env['NODE_ENV'] === 'production'
}

const isTestEnvironment = () => {
  const nodeEnv = process.env['NODE_ENV']
  return (
    nodeEnv === 'test' ||
    nodeEnv === 'ci' ||
    nodeEnv === undefined ||
    process.env['VITEST'] === '1' ||
    process.env['VITEST'] === 'true' ||
    process.argv.some((arg) => arg.includes('vitest')) ||
    process.env['JEST_WORKER_ID'] !== undefined
  )
}

// Create a mock Redis client for development
function createMockRedisClient(): RedisClient {
  const message = isProduction()
    ? 'CRITICAL: Using mock Redis client in production. This should never happen.'
    : 'Using mock Redis client for development. Redis operations will be mocked.'

  console.warn(message)

  const mockStore = new Map<string, string>()

  function patternToRegex(pattern: string): RegExp {
    // Helper: convert glob-style pattern (supports '*') into a safe RegExp
    // Escapes regex metacharacters except '*' then replaces all '*' with '.*'
    if (pattern === '*' || pattern === '') return /^.*$/
    // Escape regex special chars except '*'
    const escaped = pattern.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&')
    const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$'
    return new RegExp(regexStr)
  }

  function parseJsonArray(value: string): string[] {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
      ? parsed
      : []
  }

    const parsed: unknown = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const result: Record<string, string> = {}
      for (const [key, rawValue] of Object.entries(parsed)) {
        if (typeof rawValue === 'string') {
          result[key] = rawValue
        }
      }
      return result
    }
    return {}
  }

  function parseNumberRecord(value: string): Record<string, number> {
    const parsed: unknown = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const result: Record<string, number> = {}
      for (const [key, rawValue] of Object.entries(parsed)) {
        if (typeof rawValue === 'number') {
          result[key] = rawValue
        }
      }
      return result
    }
    return {}
  }

  // Return a mock client with all Redis operations needed by the threat detection system
  return {
    // Basic operations
    get: async (key: string) => mockStore['get'](key) ?? null,
    set: async (key: string, value: string, ..._args: (string | number)[]) => {
      mockStore['set'](key, value)
      return 'OK'
    },
    del: async (key: string) => {
      const existed = mockStore.has(key)
      mockStore['delete'](key)
      return existed ? 1 : 0
    },
    exists: async (key: string) => (mockStore.has(key) ? 1 : 0),
    expire: async (key: string, _seconds: number) =>
      mockStore.has(key) ? 1 : 0,

    // Advanced operations needed by rate limiter
    setex: async (key: string, seconds: number, value: string) => {
      mockStore['set'](key, value)
      return 'OK'
    },
    hincrby: async (key: string, field: string, increment: number) => {
      const hashKey = `${key}:${field}`
      const current = parseInt(mockStore['get'](hashKey) ?? '0')
      const newValue = current + increment
      mockStore['set'](hashKey, newValue.toString())
      return newValue
    },
    hgetall: async (key: string) => {
      const result: Record<string, string> = {}
      for (const [k, v] of Array.from(mockStore.entries())) {
        if (k.startsWith(`${key}:`)) {
          const field = k.substring(key.length + 1)
          result[field] = v
        }
      }
      return result
    },
    hset: async (key: string, field: string, value: string) => {
      mockStore['set'](`${key}:${field}`, value)
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
    disconnect: () => {},

    // List operations
    lpush: async (key: string, ...values: string[]) => {
      const listKey = `list:${key}`
      const list = parseJsonArray(mockStore['get'](listKey) ?? '[]')
      list.unshift(...values)
      mockStore['set'](listKey, JSON.stringify(list))
      return list.length
    },
    lRange: async (key: string, start: number, stop: number) => {
      const listKey = `list:${key}`
      return parseJsonArray(mockStore['get'](listKey) ?? '[]').slice(
        start,
        stop + 1,
      )
    },
    lrem: async (key: string, count: number, value: string) => {
      const listKey = `list:${key}`
      const list = parseJsonArray(mockStore['get'](listKey) ?? '[]')
      const filtered = list.filter((item: string) => item !== value)
      mockStore['set'](listKey, JSON.stringify(filtered))
      return list.length - filtered.length
    },
    rpoplpush: async (source: string, destination: string) => {
      const sourceKey = `list:${source}`
      const destinationKey = `list:${destination}`
      const sourceList = parseJsonArray(mockStore['get'](sourceKey) ?? '[]')
      if (sourceList.length === 0) {
        return null
      }
      const value = sourceList.pop()
      if (value === undefined) {
        return null
      }
      mockStore['set'](sourceKey, JSON.stringify(sourceList))
      const destinationList = parseJsonArray(
        mockStore['get'](destinationKey) ?? '[]',
      )
      destinationList.unshift(value)
      mockStore['set'](destinationKey, JSON.stringify(destinationList))
      return value
    },
    llen: async (key: string) => {
      const listKey = `list:${key}`
      const list = parseJsonArray(mockStore['get'](listKey) ?? '[]')
      return list.length
    },

    // Sorted set operations
    zadd: async (key: string, score: number, member: string) => {
      const zsetKey = `zset:${key}`
      const zset = parseNumberRecord(mockStore['get'](zsetKey) ?? '{}')
      zset[member] = score
      mockStore['set'](zsetKey, JSON.stringify(zset))
      return 1
    },
    zrangebyscore: async (key: string, min: number, max: number) => {
      const zsetKey = `zset:${key}`
      const zset = parseNumberRecord(mockStore['get'](zsetKey) ?? '{}')
      return Object.entries(zset)
        .filter(([, score]) => score >= min && score <= max)
        .map(([member]) => member)
    },
    zremrangebyscore: async (key: string, min: number, max: number) => {
      const zsetKey = `zset:${key}`
      const zset = parseNumberRecord(mockStore['get'](zsetKey) ?? '{}')
      let removed = 0
      for (const [member, score] of Object.entries(zset)) {
        if (score >= min && score <= max) {
          delete zset[member]
          removed++
        }
      }
      mockStore['set'](zsetKey, JSON.stringify(zset))
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
    on: () => {},
    off: () => {},
    emit: () => false,
  } as RedisClient
}

/**
 * Create Redis client with appropriate configuration (lazy)
 * Returns a real Redis client if credentials are present, otherwise a mock client.
 */
function createRedisClient(): RedisClient {
  const { connectionUrl, restToken } = getRedisConfig()

  if (connectionUrl?.startsWith('redis')) {
    try {
      const parsed = new URL(connectionUrl)
      if (!parsed.hostname) {
        throw new Error('Missing Redis host')
      }
      // Initialize ioredis client with credentials
      const client = new Redis(connectionUrl, {
        password: restToken,
        // Add any additional options here if needed
      })
      return client as RedisClient
    } catch (error: unknown) {
      if (isTestEnvironment()) {
        console.warn('Invalid REDIS_URL; using mock Redis client for tests.')
        return createMockRedisClient()
      }
      console.error(
        'Invalid REDIS_URL configuration in non-test environment:',
        error,
      )
      throw error
    }
  }

  if (isTestEnvironment()) {
    return createMockRedisClient()
  }

  // Log appropriate warnings in production
  if (isProduction()) {
    console.error(
      'CRITICAL: Missing Redis credentials in production environment',
    )
  }
  return createMockRedisClient()
}

export const redis: RedisClient = createRedisClient()
if (typeof redis['on'] === 'function') {
  redis['on']('error', (error: unknown) => {
    console.warn('Redis connection warning:', error)
  })
}

// Backward-compatible helper for modules expecting a getter
export function getRedisClient() {
  return redis
}

/**
 * Wrapper function for Redis get with error handling
 */
export async function getFromCache<T = unknown>(
  key: string,
): Promise<T | null> {
  try {
    const raw: string | null = await redis['get'](key)
    if (raw === null) {
      return null
    }
    try {
      const parsed: unknown = JSON.parse(raw)
      if (
        typeof parsed === 'string' ||
        typeof parsed === 'number' ||
        typeof parsed === 'boolean' ||
        parsed === null ||
        Array.isArray(parsed) ||
        typeof parsed === 'object'
      ) {
        return parsed as T
      }
      return null as unknown as T
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
      await redis['set'](key, serialized, 'EX', expirationSeconds)
    } else {
      await redis['set'](key, serialized)
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
    const deletedCount = await redis['del'](key)
    return Number(deletedCount) > 0
  } catch (error: unknown) {
    console.error(`Error removing key ${key} from Redis:`, error)
    return false
  }
}

/**
 * Attach safe error handling to the redis client to avoid unhandled error events.
 */
function attachRedisErrorHandling() {
  const redisWithEvents = redis as
    | {
        on: (event: string, handler: (...args: unknown[]) => void) => void
      }
    | undefined
  if (typeof redisWithEvents?.['on'] === 'function') {
    redisWithEvents['on']('error', (err: unknown) => {
      console.warn('Redis connection warning:', err)
    })
  }
}

attachRedisErrorHandling()

/**
 * Check Redis connectivity
 */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const pingResult = await redis['ping']()
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
