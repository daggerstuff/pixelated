/**
 * Redis client wrapper for ioredis
 * This module provides a consistent interface for Redis operations with proper error handling
 */

import Redis from 'ioredis'


// Lazy load config to avoid initialization order issues
const getConfig = async () => {
  try {
    const configModule = await import('../config/env.config')
    return configModule.config
  } catch {
    return null
  }
}

// Determine if we're in a production environment (lazy)
const isProduction = () => {
  const config = getConfig()
  return config?.isProduction() ?? false
}

// Get Redis credentials from environment (lazy)
const getRedisConfig = () => {
  const config = getConfig()
  return {
    restUrl: config?.redis.url(),
    restToken: config?.redis.token(),
  }
}

// Create a mock Redis client for development
function createMockRedisClient() {
  const message = isProduction()
    ? 'CRITICAL: Using mock Redis client in production. This should never happen.'
    : 'Using mock Redis client for development. This should not be used in production.'

  console.warn(message)

  return {
    get: async (_key: string) => null,
    set: async (_key: string, _value: unknown, _options?: unknown) => 'OK',
    del: async (_key: string) => 1,
    incr: async (_key: string) => 1,
    exists: async (_key: string) => 0,
    expire: async (_key: string, _seconds: number) => 1,
    hset: async (_key: string, _field: string, _value: unknown) => 1,
    hget: async (_key: string, _field: string) => null,
    hgetall: async (_key: string) => ({}),
    hdel: async (_key: string, _field: string) => 1,
    ping: async () => 'PONG',
    disconnect: async () => {},
  }
}

/**
 * Create Redis client with appropriate configuration (lazy)
 * Returns a real Redis client if credentials are present, otherwise a mock client.
 */
function createRedisClient() {
  const { restUrl, restToken } = getRedisConfig()
  const hasValidCredentials = Boolean(restUrl && restToken)

  if (hasValidCredentials) {
    // Initialize ioredis client with credentials
    return new Redis(restUrl, {
          password: restToken,
          // Add any additional options here if needed
        });
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
      return JSON.parse(raw) as T
    } catch {
      // If not JSON, return as-is
      return raw as unknown as T
    }
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        message: 'Redis health check failed',
        error: error instanceof Error ? error.message : String(error),
      },
    }
  }
}
