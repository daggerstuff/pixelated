import type { RedisServiceConfig, IRedisService } from './types.js'
import type {
  RedisZSetMember,
  RedisPipeline,
  RedisPipelineOperation,
} from './redis-operation-types'
import { EventEmitter } from 'events'
import { getHipaaCompliantLogger } from '../../logging/standardized-logger'
import { Redis } from 'ioredis'
import { RedisErrorCode, RedisServiceError } from './types.js'
import * as fs from 'fs'


const logger = getHipaaCompliantLogger('general')

/**
 * Redis service implementation with connection pooling and health checks
 */
export class RedisService extends EventEmitter implements IRedisService {
  getClient(): Redis | null {
    return this.client
  }
  private client: Redis | null = null
  private subscribers: Map<string, Redis> = new Map()
  private healthCheckInterval: NodeJS.Timeout | null = null
  private readonly config: RedisServiceConfig

  constructor(config: RedisServiceConfig = { url: '' }) {
    super()
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      maxConnections: 10,
      url: '',
    }
    this.validateConfig(config)
  }

  private validateConfig(config: RedisServiceConfig): void {
    // Merge the provided config with defaults
    Object.assign(this.config, config)

    // Check if we have either UPSTASH_REDIS_REST_URL or traditional Redis URL
    const hasUpstashUrl = Boolean(process.env['UPSTASH_REDIS_REST_URL'])
    const hasRedisUrl = Boolean(process.env['REDIS_URL'])

    console.error(`[RedisService] Config check: hasUpstashUrl=${hasUpstashUrl}, hasRedisUrl=${hasRedisUrl}`)

    // If environment variables exist, use them regardless of what was in config
    if (hasUpstashUrl) {
      this.config.url = process.env['UPSTASH_REDIS_REST_URL'] as string
    } else if (hasRedisUrl) {
      this.config.url = process.env['REDIS_URL'] as string

      // Support for Docker Secrets (/run/secrets/*) or any *_FILE env var
      const redisPasswordFile = process.env['REDIS_PASSWORD_FILE']
      if (redisPasswordFile && fs.existsSync(redisPasswordFile)) {
        try {
          const password = fs.readFileSync(redisPasswordFile, 'utf8').trim()
          if (password) {
            console.error(`[RedisService] Loaded password from file: ${redisPasswordFile} (len=${password.length})`)
            // Reconstruct URL with password if it doesn't already have one
            const urlObj = new URL(this.config.url)
            if (!urlObj.password) {
              urlObj.password = password
              urlObj.password = password
              this.config.url = urlObj.toString()
            }
            // Explicitly set password in config for reliability
            this.config.password = password
          }
        } catch (error) {
          logger.error('Failed to read Redis password file:', {
            file: redisPasswordFile,
            error: String(error),
          })
        }
      }
    }


    // After all resolution, if we still don't have a URL and we're not in development
    if (!this.config.url && !hasUpstashUrl && !hasRedisUrl) {
      // If we're in development mode, we can use mock services
      if (process.env['NODE_ENV'] === 'development') {
        // Just log a warning
        logger.warn('No Redis URL configured, using mock Redis in development')
        return
      }

      logger.error('No Redis URL available, service may not function properly')
      // Don't throw during build, just warn heavily
      if (process.env['NODE_ENV'] !== 'production') {
        return
      }
    }

    // Successfully validated
    console.error(`[RedisService] Final config: url=${this.config.url.replace(/:[^:@]*@/, ':****@')}, password=${this.config.password ? 'SET' : 'undefined'}`)
  }

  async connect(): Promise<void> {
    try {
      if (this.client) {
        return
      }

      // If no URL is configured and we're in development, return early
      if (!this.config.url && process.env['NODE_ENV'] === 'development') {
        logger.warn(
          'No Redis URL configured, skipping connection in development',
        )
        // Don't create a client - we'll use the mock client when needed
        return
      }

      const redisOptions: Record<string, unknown> = {
        maxRetriesPerRequest: this.config.maxRetries,
        retryStrategy: (times: number) => {
          if (times > (this.config.maxRetries || 3)) {
            return null
          }
          return this.config.retryDelay || 100
        },
      }

      if (this.config.password) {
        redisOptions['password'] = this.config.password
      }

      if (this.config.keyPrefix) {
        redisOptions['keyPrefix'] = this.config.keyPrefix
      }

      if (this.config.connectTimeout) {
        redisOptions['connectTimeout'] = this.config.connectTimeout
      }

      this.client = new Redis(this.config.url, redisOptions)

      // Set up event handlers
      this.client.on('error', (error: unknown) => {
        logger.error('Redis error:', { error: String(error) })
      })

      this.client.on('connect', () => {
        logger.info('Connected to Redis')
      })

      this.client.on('close', () => {
        logger.warn('Redis connection closed')
      })

      await this.client.connect()

      // Start health checks
      this.startHealthCheck()
    } catch (error: unknown) {
      // In development, we can continue without Redis
      if (process.env['NODE_ENV'] === 'development') {
        logger.warn(
          'Failed to connect to Redis in development, will use mock:',
          {
            error: error instanceof Error ? String(error) : String(error),
          },
        )
        // Clear the client so we'll use the mock
        this.client = null
        return
      }

      throw new RedisServiceError(
        RedisErrorCode.CONNECTION_FAILED,
        'Failed to connect to Redis',
        error,
      )
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = null
      }

      if (this.client) {
        await this.client.quit()
        this.client = null
      }

      await Promise.all(
        Array.from(this.subscribers.values()).map((sub) => sub.quit()),
      )
      this.subscribers.clear()
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.CONNECTION_CLOSED,
        'Error disconnecting from Redis',
        error,
      )
    }
  }

  private async ensureConnection(): Promise<Redis> {
    if (!this.client) {
      await this.connect()
    }

    if (!this.client) {
      // If we're in development, return a mock client
      if (process.env['NODE_ENV'] === 'development') {
        logger.warn('Using mock Redis client in development')
        // Create a mock client that implements basic Redis methods
        return this.createMockClient() as Redis
      }

      throw new RedisServiceError(
        RedisErrorCode.CONNECTION_FAILED,
        'Redis client is not initialized',
      )
    }

    return this.client
  }

  /**
   * Mock client for development when no Redis URL is available
   * Return type changed to unknown to avoid type errors with the mock implementation
   */
  private createMockClient(): unknown {
    // Create a simple in-memory store
    const store = new Map<string, string>()
    const setStore = new Map<string, Set<string>>()
    const hashStore = new Map<string, Map<string, string>>()
    const zsetStore = new Map<string, Map<string, number>>()

    // Create a mock client implementing RedisMockClient interface
    // Cast to any to avoid type errors in development mock
    const mockClient: unknown = {
      get: async (key: string) => store.get(key) || null,
      set: async (key: string, value: string) => {
        store.set(key, value)
        return 'OK'
      },
      del: async (key: string) => {
        const deleted = store.delete(key)
        return deleted ? 1 : 0
      },
      exists: async (key: string) => (store.has(key) ? 1 : 0),
      sadd: async (key: string, member: string) => {
        if (!setStore.has(key)) {
          setStore.set(key, new Set())
        }
        const set = setStore.get(key)!
        const existed = set.has(member)
        set.add(member)
        return existed ? 0 : 1
      },
      srem: async (key: string, member: string) => {
        if (!setStore.has(key)) {
          return 0
        }
        const set = setStore.get(key)!
        const deleted = set.delete(member)
        return deleted ? 1 : 0
      },
      smembers: async (key: string) => {
        if (!setStore.has(key)) {
          return []
        }
        return Array.from(setStore.get(key)!)
      },
      keys: async (pattern: string) => {
        // Simple glob pattern matching
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
        return Array.from(store.keys()).filter((key) => regex.test(key))
      },
      // Hash operations
      hset: async (key: string, field: string, value: string) => {
        if (!hashStore.has(key)) {
          hashStore.set(key, new Map())
        }
        const hash = hashStore.get(key)!
        const existed = hash.has(field)
        hash.set(field, value)
        return existed ? 0 : 1
      },
      hget: async (key: string, field: string) => {
        const hash = hashStore.get(key)
        return hash ? hash.get(field) || null : null
      },
      hgetall: async (key: string) => {
        const hash = hashStore.get(key)
        if (!hash) {
          return {}
        }
        const result: Record<string, string> = {}
        hash.forEach((value, field) => {
          result[field] = value
        })
        return result
      },
      hdel: async (key: string, field: string) => {
        const hash = hashStore.get(key)
        if (!hash) {
          return 0
        }
        const deleted = hash.delete(field)
        return deleted ? 1 : 0
      },
      hlen: async (key: string) => {
        const hash = hashStore.get(key)
        return hash ? hash.size : 0
      },
      // Sorted set operations
      zadd: async (key: string, score: number, member: string) => {
        if (!zsetStore.has(key)) {
          zsetStore.set(key, new Map())
        }
        const zset = zsetStore.get(key)!
        const existed = zset.has(member)
        zset.set(member, score)
        return existed ? 0 : 1
      },
      zrem: async (key: string, member: string) => {
        const zset = zsetStore.get(key)
        if (!zset) {
          return 0
        }
        const deleted = zset.delete(member)
        return deleted ? 1 : 0
      },
      zrange: async (
        key: string,
        start: number,
        stop: number,
        withScores?: string,
      ) => {
        const zset = zsetStore.get(key)
        if (!zset) {
          return []
        }
        const sorted = Array.from(zset.entries()).sort((a, b) => a[1] - b[1])
        const slice =
          stop === -1 ? sorted.slice(start) : sorted.slice(start, stop + 1)

        if (withScores === 'WITHSCORES') {
          return slice.flatMap(([member, score]) => [{ value: member, score }])
        }
        return slice.map(([member]) => member)
      },
      zpopmin: async (key: string) => {
        const zset = zsetStore.get(key)
        if (!zset || zset.size === 0) {
          logger.debug(
            `[RedisService Mock] zpopmin called on empty or missing zset for key: ${key}`,
          )
          return []
        }
        const sorted = Array.from(zset.entries()).sort((a, b) => a[1] - b[1])
        if (sorted.length === 0) {
          logger.debug(
            `[RedisService Mock] zpopmin found no elements after sorting for key: ${key}`,
          )
          return []
        }
        const first = sorted[0]
        if (!first) {
          logger.debug(
            `[RedisService Mock] zpopmin: sorted[0] is undefined for key: ${key}`,
          )
          return []
        }
        const [member, score] = first
        zset.delete(member)
        return [{ value: member, score }]
      },
      zcard: async (key: string) => {
        const zset = zsetStore.get(key)
        return zset ? zset.size : 0
      },
      // Add mock deletePattern method for development
      deletePattern: async (pattern: string) => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
        const keysToDelete = Array.from(store.keys()).filter((key) =>
          regex.test(key),
        )
        keysToDelete.forEach((key) => store.delete(key))
        return keysToDelete.length
      },
      ping: async () => 'PONG',
      incr: async (key: string) => {
        const value = store.get(key)
        const num = value ? parseInt(value, 10) + 1 : 1
        store.set(key, num.toString())
        return num
      },
      pttl: async () => -1,
      info: async () => 'connected_clients:1\nblocked_clients:0',
      publish: async () => 0,
      quit: async () => 'OK',
      connect: async () => { },
      on: (event: string, callback: (...args: unknown[]) => void) => {
        // Emit the event immediately to simulate connection events
        if (['connect', 'ready'].includes(event)) {
          setTimeout(() => callback(), 0)
        }
        return this as unknown as Redis
      }, // Basic event handling for mock
      pipeline: () => {
        const commands: RedisPipelineOperation[] = []
        const pipeline: RedisPipeline = {
          del: (key: string) => {
            commands.push({ cmd: 'del', args: [key] })
            return mockClient as unknown as Redis
          },
          exec: async () => {
            return commands.map((cmd) => {
              if (cmd.cmd === 'del') {
                const deleted = store.delete(cmd.args[0] as string)
                return [null, deleted ? 1 : 0]
              }
              return [null, null]
            })
          },
        }
        return pipeline
      },
    } as unknown as Redis

    return mockClient
  }

  private createClient(): Redis {
    const redisOptions: RedisServiceConfig = {
      url: this.config.url,
      maxRetriesPerRequest: this.config.maxRetries,
      retryStrategy: (times: number) => {
        if (times > (this.config.maxRetries || 3)) {
          return null
        }
        return this.config.retryDelay || 100
      },
      keyPrefix: this.config.keyPrefix,
      connectTimeout: this.config.connectTimeout,
    }

    return new Redis(this.config.url, redisOptions)
  }

  private startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.isHealthy()
      } catch (error: unknown) {
        logger.error('Health check failed:', { error: String(error) })
      }
    }, this.config.healthCheckInterval || 5000)
  }

  async isHealthy(): Promise<boolean> {
    try {
      const client = await this.ensureConnection()
      await client.ping()
      return true
    } catch (error: unknown) {
      logger.error('Redis health check failed:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const client = await this.ensureConnection()
      return await client.get(key)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to get key: ${key}`,
        error,
      )
    }
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    try {
      const client = await this.ensureConnection()
      if (ttlMs) {
        await client.set(key, value, 'PX', ttlMs)
      } else {
        await client.set(key, value)
      }
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to set key: ${key}`,
        error,
      )
    }
  }

  async del(key: string): Promise<void> {
    try {
      const client = await this.ensureConnection()
      await client.del(key)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to delete key: ${key}`,
        error,
      )
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const client = await this.ensureConnection()
      const result = await client.exists(key)
      return result === 1
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to check existence of key: ${key}`,
        error,
      )
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.pttl(key)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to get TTL for key: ${key}`,
        error,
      )
    }
  }

  async incr(key: string): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.incr(key)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to increment key: ${key}`,
        error,
      )
    }
  }

  async sadd(key: string, member: string): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.sadd(key, member)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to add member to set: ${key}`,
        error,
      )
    }
  }

  async srem(key: string, member: string): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.srem(key, member)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to remove member from set: ${key}`,
        error,
      )
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      const client = await this.ensureConnection()
      return await client.smembers(key)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to get members of set: ${key}`,
        error,
      )
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      const client = await this.ensureConnection()
      return await client.keys(pattern)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to get keys matching pattern: ${pattern}`,
        error,
      )
    }
  }

  async getPoolStats(): Promise<{
    totalConnections: number
    activeConnections: number
    idleConnections: number
    waitingClients: number
  }> {
    try {
      const client = await this.ensureConnection()
      const info = await client.info('clients')
      const stats = {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingClients: 0,
      }

      // Parse Redis INFO output
      info.split('\n').forEach((line: string) => {
        if (line.startsWith('connected_clients:')) {
          const value = line.split(':')[1]
          if (value !== undefined) {
            stats.totalConnections = Number.parseInt(value, 10)
          }
        }
        if (line.startsWith('blocked_clients:')) {
          const value = line.split(':')[1]
          if (value !== undefined) {
            stats.waitingClients = Number.parseInt(value, 10)
          }
        }
      })

      stats.activeConnections = stats.totalConnections - stats.waitingClients
      stats.idleConnections = Math.max(
        0,
        stats.totalConnections - stats.activeConnections,
      )

      return stats
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        'Failed to get pool stats',
        error,
      )
    }
  }

  async subscribe(
    channel: string,
    callback: (message: string) => void,
  ): Promise<void> {
    if (!this.subscribers.has(channel)) {
      const subscriber = this.createClient()
      this.subscribers.set(channel, subscriber)

      subscriber.on('message', (ch: string, message: string) => {
        if (ch === channel) {
          callback(message)
        }
      })

      await subscriber.subscribe(channel)
    }
  }

  async publish(channel: string, message: string): Promise<number> {
    try {
      if (!this.client) {
        await this.connect()
      }

      if (!this.client) {
        throw new RedisServiceError(
          RedisErrorCode.CONNECTION_FAILED,
          'Redis client is not initialized',
        )
      }

      return await this.client.publish(channel, message)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to publish to channel: ${channel}`,
        error,
      )
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    const subscriber = this.subscribers.get(channel)
    if (subscriber) {
      await subscriber.unsubscribe(channel)
      subscriber.disconnect()
      this.subscribers.delete(channel)
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const client = await this.ensureConnection()

      // Get all keys matching the pattern
      const keys = await client.keys(pattern)

      if (keys.length === 0) {
        return
      }

      // Delete all keys in a pipeline
      if (keys.length > 0) {
        const pipeline = client.pipeline()
        keys.forEach((key: string) => pipeline.del(key))
        await pipeline.exec()
      }

      logger.debug(`Deleted ${keys.length} keys matching pattern: ${pattern}`)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to delete keys matching pattern: ${pattern}`,
        error,
      )
    }
  }

  // Hash operations
  async hset(key: string, field: string, value: string): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.hset(key, field, value)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to set hash field: ${key}[${field}]`,
        error,
      )
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      const client = await this.ensureConnection()
      return await client.hget(key, field)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to get hash field: ${key}[${field}]`,
        error,
      )
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      const client = await this.ensureConnection()
      const result = await client.hgetall(key)
      return result || {}
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to get all hash fields: ${key}`,
        error,
      )
    }
  }

  async hdel(key: string, field: string): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.hdel(key, field)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to delete hash field: ${key}[${field}]`,
        error,
      )
    }
  }

  async hlen(key: string): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.hlen(key)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to get hash length: ${key}`,
        error,
      )
    }
  }

  // Sorted set operations
  async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.zadd(key, score, member)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to add to sorted set: ${key}`,
        error,
      )
    }
  }

  async zrem(key: string, member: string): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.zrem(key, member)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to remove from sorted set: ${key}`,
        error,
      )
    }
  }

  async zrange(
    key: string,
    start: number,
    stop: number,
    withScores?: string,
  ): Promise<string[] | RedisZSetMember[]> {
    try {
      const client = await this.ensureConnection()
      if (withScores === 'WITHSCORES') {
        // ioredis returns [member1, score1, member2, score2, ...]
        const result = await client.zrange(key, start, stop, 'WITHSCORES')
        const arr: RedisZSetMember[] = []
        for (let i = 0; i < result.length; i += 2) {
          if (
            typeof result[i] === 'string' &&
            typeof result[i + 1] !== 'undefined'
          ) {
            arr.push({
              value: result[i] as string,
              score: Number(result[i + 1]),
            })
          } else {
            logger.debug(
              `[RedisService] zrange WITHSCORES: Skipping invalid pair at index ${i}: value=${String(result[i])}, score=${String(result[i + 1])}`,
            )
          }
        }
        return arr
      }
      return await client.zrange(key, start, stop)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to get range from sorted set: ${key}`,
        error,
      )
    }
  }

  async zpopmin(key: string): Promise<RedisZSetMember[]> {
    try {
      const client = await this.ensureConnection()
      // ioredis returns [member, score] or [] if empty
      const result = await client.zpopmin(key)
      if (
        Array.isArray(result) &&
        result.length === 2 &&
        typeof result[0] === 'string' &&
        typeof result[1] !== 'undefined'
      ) {
        return [{ value: result[0], score: Number(result[1]) }]
      } else {
        logger.debug(
          `[RedisService] zpopmin: Unexpected result format for key ${key}:`,
          result,
        )
      }
      return []
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to pop min from sorted set: ${key}`,
        error,
      )
    }
  }

  async zcard(key: string): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.zcard(key)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to get sorted set cardinality: ${key}`,
        error,
      )
    }
  }

  // List operations
  async lpush(key: string, ...elements: string[]): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.lpush(key, ...elements)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to push to list: ${key}`,
        error,
      )
    }
  }

  async rpoplpush(source: string, destination: string): Promise<string | null> {
    try {
      const client = await this.ensureConnection()
      return await client.rpoplpush(source, destination)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to move element from ${source} to ${destination}`,
        error,
      )
    }
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.lrem(key, count, value)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to remove elements from list: ${key}`,
        error,
      )
    }
  }

  async llen(key: string): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.llen(key)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to get list length: ${key}`,
        error,
      )
    }
  }
}
