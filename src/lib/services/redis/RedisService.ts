import { EventEmitter } from 'events'

import Redis from 'ioredis'

import { getHipaaCompliantLogger } from '../../logging/standardized-logger'
import type {
  RedisPipelineOperation,
  RedisZSetMember,
  RedisMockClient,
} from './redis-operation-types'
import type { IRedisService, RedisServiceConfig } from './types.js'
import { RedisErrorCode, RedisServiceError } from './types.js'

const logger = getHipaaCompliantLogger('general')
type RedisClient = RedisMockClient

/**
 * Redis service implementation with connection pooling and health checks
 */
export class RedisService extends EventEmitter implements IRedisService {
  getClient(): RedisClient | null {
    return this.client
  }
  private client: RedisClient | null = null
  private readonly subscribers: Map<string, RedisClient> = new Map()
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

    const upstashRedisUrl = process.env['UPSTASH_REDIS_REST_URL']
    const redisUrl = process.env['REDIS_URL']
    const hasExplicitUrl = Boolean(config.url)

    // Check if we have either UPSTASH_REDIS_REST_URL or traditional Redis URL
    const hasUpstashUrl = Boolean(upstashRedisUrl)
    const hasRedisUrl = Boolean(redisUrl)

    logger.debug(
      `[RedisService] Config check: hasUpstashUrl=${hasUpstashUrl}, hasRedisUrl=${hasRedisUrl}`,
    )

    // Use explicitly provided URL first, then env vars.
    if (hasExplicitUrl) {
      this.config.url = config.url ? config.url : ''
    } else if (hasUpstashUrl) {
      this.config.url = upstashRedisUrl ?? ''
    } else if (hasRedisUrl) {
      this.config.url = redisUrl ?? ''
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
    logger.debug(`[RedisService] Config validated`)
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
        lazyConnect: true,
        retryStrategy: (times: number) => {
          if (times > (this.config.maxRetries ?? 3)) {
            return 0
          }
          return this.config.retryDelay ?? 100
        },
      }

      if (this.config['password']) {
        redisOptions['password'] = this.config['password']
      }

      if (this.config.keyPrefix) {
        redisOptions['keyPrefix'] = this.config.keyPrefix
      }

      if (this.config.connectTimeout) {
        redisOptions['connectTimeout'] = this.config.connectTimeout
      }

      const rawClient = new Redis(this.config.url, redisOptions)
      const commandClient = this.createCommandClient(rawClient)
      this.client = commandClient

      // Set up event handlers
      rawClient.on('error', (error: unknown) => {
        logger.error('Redis error:', { error: String(error) })
      })

      rawClient.on('connect', () => {
        logger.info('Connected to Redis')
      })

      rawClient.on('close', () => {
        logger.warn('Redis connection closed')
      })

      await rawClient.connect()

      // Start health checks
      this.startHealthCheck()
    } catch (error: unknown) {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = null
      }

      await this.client?.quit().catch(() => undefined)
      this.client = null

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
        try {
          await this.client.quit()
        } catch (error: unknown) {
          logger.warn('Ignoring Redis quit error during disconnect', {
            error: error instanceof Error ? String(error) : String(error),
          })
        }
        this.client = null
      }

      if (this.subscribers.size > 0) {
        await Promise.all(
          Array.from(this.subscribers.values(), async (subscriber) =>
            subscriber.quit().catch((error) => {
              logger.warn('Ignoring subscriber quit error', {
                error: error instanceof Error ? String(error) : String(error),
              })
            }),
          ),
        )
      }
      this.subscribers.clear()
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.CONNECTION_CLOSED,
        'Error disconnecting from Redis',
        error,
      )
    }
  }

  private async ensureConnection(): Promise<RedisClient> {
    if (!this.client) {
      // If we're in development and no Redis is available, return a mock client
      if (process.env['NODE_ENV'] === 'development') {
        logger.warn('Using mock Redis client in development')
        // Create a mock client that implements basic Redis methods
        return this.createMockClient()
      }

      throw new RedisServiceError(
        RedisErrorCode.CONNECTION_FAILED,
        'Redis client is not connected',
      )
    }

    return this.client
  }

  private createCommandClient(rawClient: Redis): RedisClient {
    let client!: RedisClient

    const normalizeCommandArg = (value: unknown): string | number | Buffer => {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        Buffer.isBuffer(value)
      ) {
        return value
      }
      if (typeof value === 'boolean') {
        return value ? 1 : 0
      }
      if (typeof value === 'bigint') {
        return value > Number.MAX_SAFE_INTEGER ? 0 : Number(value)
      }
      if (typeof value === 'symbol') {
        return value.description ?? 0
      }
      if (typeof value === 'function') {
        return value.name || 0
      }
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value)
        } catch {
          return '[unserializable]'
        }
      }
      return value === undefined ? '' : 0
    }

    const invoke = async (
      command: string,
      ...args: unknown[]
    ): Promise<unknown> => {
      return rawClient.call(command, ...args.map(normalizeCommandArg))
    }

    const toNumber = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
      }
      return 0
    }

    const toStringArray = (value: unknown): string[] => {
      if (!Array.isArray(value)) {
        return []
      }

      return value
        .map((item) => {
          if (typeof item === 'string') {
            return item
          }
          if (typeof item === 'number') {
            return String(item)
          }
          return ''
        })
        .filter((item) => item !== '')
    }

    const toStringTuple = (value: unknown): Array<[string, string]> => {
      if (!Array.isArray(value)) {
        return []
      }

      const tuples = value.filter(
        (entry): entry is [string, string | number] =>
          Array.isArray(entry) &&
          entry.length >= 2 &&
          typeof entry[0] === 'string' &&
          (typeof entry[1] === 'string' || typeof entry[1] === 'number'),
      )

      return tuples.map(([first, second]) => [first, String(second)])
    }

    const createPipeline = () => {
      const commands: Array<{ command: string; args: unknown[] }> = []
      const addCommand = (command: string, args: unknown[]) => {
        commands.push({ command, args })
        return pipeline
      }

      const pipeline = {
        setex: (key: string, seconds: number, value: string) =>
          addCommand('setex', [key, seconds, value]),
        sadd: (key: string, member: string) =>
          addCommand('sadd', [key, member]),
        expire: (key: string, seconds: number) =>
          addCommand('expire', [key, seconds]),
        del: (...keys: string[]) => {
          if (keys.length > 0) {
            addCommand('del', keys)
          }
          return pipeline
        },
        get: (key: string) => addCommand('get', [key]),
        ttl: (key: string) => addCommand('ttl', [key]),
        exec: async () => {
          const results: [Error | null, unknown][] = []
          for (const item of commands) {
            try {
              const executed = await invoke(item.command, ...item.args)
              results.push([null, executed])
            } catch (error: unknown) {
              const pipelineError =
                error instanceof Error ? error : new Error(String(error))
              results.push([pipelineError, null])
            }
          }
          return results
        },
      }

      return pipeline
    }

    client = {
      get: async (key: string) => {
        const value = await invoke('get', key)
        return typeof value === 'string' ? value : null
      },
      set: async (key: string, value: string, ...options: unknown[]) =>
        invoke('set', key, value, ...options),
      del: async (...keys: string[]) => toNumber(await invoke('del', ...keys)),
      exists: async (key: string) => toNumber(await invoke('exists', key)),
      setex: async (key: string, seconds: number, value: string) =>
        invoke('setex', key, seconds, value),
      expire: async (key: string, seconds: number) =>
        toNumber(await invoke('expire', key, seconds)),
      sadd: async (key: string, member: string) =>
        toNumber(await invoke('sadd', key, member)),
      srem: async (key: string, member: string) =>
        toNumber(await invoke('srem', key, member)),
      smembers: async (key: string) =>
        toStringArray(await invoke('smembers', key)),
      lpush: async (key: string, ...elements: string[]) =>
        toNumber(await invoke('lpush', key, ...elements)),
      rpoplpush: async (source: string, destination: string) => {
        const value = await invoke('rpoplpush', source, destination)
        return typeof value === 'string' ? value : null
      },
      lrem: async (key: string, count: number, value: string) =>
        toNumber(await invoke('lrem', key, count, value)),
      llen: async (key: string) => toNumber(await invoke('llen', key)),
      keys: async (pattern: string) =>
        toStringArray(await invoke('keys', pattern)),
      hset: async (key: string, field: string, value: string) =>
        toNumber(await invoke('hset', key, field, value)),
      hget: async (key: string, field: string) => {
        const value = await invoke('hget', key, field)
        return typeof value === 'string' ? value : null
      },
      hgetall: async (key: string) => {
        const value = await invoke('hgetall', key)
        if (
          value === null ||
          typeof value !== 'object' ||
          Array.isArray(value)
        ) {
          return {}
        }

        const entries = Object.entries(value)
        const result: Record<string, string> = {}
        entries.forEach(([field, data]) => {
          if (typeof field === 'string') {
            if (typeof data === 'string') {
              result[field] = data
            } else if (typeof data === 'number' || typeof data === 'boolean') {
              result[field] = String(data)
            }
          }
        })
        return result
      },
      hdel: async (key: string, field: string) =>
        toNumber(await invoke('hdel', key, field)),
      hlen: async (key: string) => toNumber(await invoke('hlen', key)),
      lrange: async (key: string, start: number, stop: number) =>
        toStringArray(await invoke('lrange', key, start, stop)),
      ping: async () => {
        const value = await invoke('ping')
        return typeof value === 'string' ? value : 'PONG'
      },
      incr: async (key: string) => toNumber(await invoke('incr', key)),
      pttl: async (key: string) => toNumber(await invoke('pttl', key)),
      ttl: async (key: string) => toNumber(await invoke('ttl', key)),
      scan: async (cursor: string, ...args: unknown[]) => {
        const value = await invoke('scan', cursor, ...args)
        if (!Array.isArray(value) || value.length < 2) {
          return ['0', []]
        }

        const nextCursor =
          typeof value[0] === 'string' ? value[0] : String(value[0])
        const keys = Array.isArray(value[1]) ? toStringArray(value[1]) : []
        return [nextCursor, keys]
      },
      subscribe: async (channel: string) =>
        toNumber(await rawClient.subscribe(channel)),
      publish: async (channel: string, message: string) =>
        toNumber(await rawClient.publish(channel, message)),
      unsubscribe: async (channel: string) =>
        toNumber(await rawClient.unsubscribe(channel)),
      quit: async () => rawClient.quit(),
      disconnect: () => rawClient.disconnect(),
      connect: async () => {
        await rawClient.connect()
      },
      on: (event: string, callback: (...args: unknown[]) => void) => {
        rawClient.on(event, callback)
        return client
      },
      pipeline: () => createPipeline(),
      zadd: async (key: string, score: number, member: string) =>
        toNumber(await invoke('zadd', key, score, member)),
      zrem: async (key: string, member: string) =>
        toNumber(await invoke('zrem', key, member)),
      zrange: async (
        key: string,
        start: number,
        stop: number,
        withScores?: 'WITHSCORES',
      ) =>
        toStringArray(
          await invoke(
            'zrange',
            ...(withScores === 'WITHSCORES'
              ? [key, start, stop, withScores]
              : [key, start, stop]),
          ),
        ),
      zpopmin: async (key: string) => {
        const raw = await invoke('zpopmin', key)
        const tuple = toStringTuple(raw)
        return tuple
          .map(([value, score]) => ({
            value,
            score: toNumber(score),
          }))
          .filter((entry) => entry.value !== '')
      },
      zcard: async (key: string) => toNumber(await invoke('zcard', key)),
      zrangebyscore: async (
        key: string,
        min: string | number,
        max: string | number,
        withscores?: string,
        offset?: number,
        count?: number,
      ) => {
        const args: unknown[] = [key, min, max]
        if (
          withscores === 'LIMIT' &&
          typeof offset === 'number' &&
          typeof count === 'number'
        ) {
          args.push('LIMIT', offset, count)
        }
        return toStringArray(await invoke('zrangebyscore', ...args))
      },
      zremrangebyscore: async (
        key: string,
        min: string | number,
        max: string | number,
      ) => toNumber(await invoke('zremrangebyscore', key, min, max)),
      info: async (section?: string) => {
        const info = await invoke('info', ...(section ? [section] : []))
        return typeof info === 'string' ? info : ''
      },
      multi: () => createPipeline(),
      deletePattern: async (pattern: string) => {
        const keys = await client.keys(pattern)
        if (keys.length === 0) {
          return 0
        }

        await client.del(...keys)
        return keys.length
      },
    }

    return client
  }

  /**
   * Mock client for development when no Redis URL is available
   * Return type implements Redis for compatibility with the service contract
   */
  private createMockClient(): RedisMockClient {
    // Create a simple in-memory store
    const store = new Map<string, string>()
    const setStore = new Map<string, Set<string>>()
    const hashStore = new Map<string, Map<string, string>>()
    const zsetStore = new Map<string, Map<string, number>>()

    const readStringList = (key: string): string[] => {
      const raw = store.get(key)
      if (!raw) {
        return []
      }
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : []
    }

    const createMockPipeline = () => {
      const commands: RedisPipelineOperation[] = []
      const addCommand = (cmd: string, args: unknown[]) => {
        commands.push({ cmd, args })
        return pipeline
      }

      const pipeline = {
        setex: (key: string, _seconds: number, value: string) =>
          addCommand('setex', [key, value]),
        sadd: (key: string, member: string) =>
          addCommand('sadd', [key, member]),
        expire: (key: string, _seconds: number) => addCommand('expire', [key]),
        del: (...keys: string[]) => {
          if (keys.length > 0) {
            addCommand('del', keys)
          }
          return pipeline
        },
        get: (key: string) => addCommand('get', [key]),
        ttl: (key: string) => addCommand('ttl', [key]),
        exec: async () => {
          const commandsToResolve = commands.map(
            async (command): Promise<[Error | null, unknown]> => {
              try {
                if (command.cmd === 'setex') {
                  const [key, value] = command.args
                  if (typeof key === 'string' && typeof value === 'string') {
                    store.set(key, value)
                    return [null, 'OK']
                  }
                  return [null, null]
                }

                if (command.cmd === 'sadd') {
                  const [key, member] = command.args
                  if (typeof key === 'string' && typeof member === 'string') {
                    if (!setStore.has(key)) {
                      setStore.set(key, new Set())
                    }
                    const set = setStore.get(key)
                    if (!set) {
                      return [null, 0]
                    }
                    const existed = set.has(member)
                    set.add(member)
                    return [null, existed ? 0 : 1]
                  }
                  return [null, 0]
                }

                if (command.cmd === 'expire') {
                  return [null, 1]
                }

                if (command.cmd === 'del') {
                  const keys = command.args.filter(
                    (arg): arg is string => typeof arg === 'string',
                  )
                  const deletedCount = keys.reduce(
                    (count, key) => (store.delete(key) ? count + 1 : count),
                    0,
                  )
                  return [null, deletedCount]
                }

                if (command.cmd === 'get') {
                  const key = command.args[0]
                  return [
                    null,
                    typeof key === 'string' ? (store.get(key) ?? null) : null,
                  ]
                }

                if (command.cmd === 'ttl') {
                  return [null, -1]
                }

                return [null, null]
              } catch (error: unknown) {
                return [
                  error instanceof Error ? error : new Error(String(error)),
                  null,
                ]
              }
            },
          )

          return Promise.all(commandsToResolve)
        },
      }

      return pipeline
    }

    // Create a mock client implementing the Redis interface
    const mockClient: RedisMockClient = {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: string, ..._options: unknown[]) => {
        store.set(key, value)
        return 'OK'
      },
      setex: async (key: string, _seconds: number, value: string) => {
        store.set(key, value)
        return 'OK'
      },
      expire: async (_key: string, _seconds: number) => 1,
      multi: () => createMockPipeline(),
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
        return hash?.get(field) ?? null
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
      // List operations
      lpush: async (key: string, ...elements: string[]) => {
        const listKey = `list:${key}`
        const list = readStringList(listKey)
        const nextList = Array.isArray(list)
          ? [...elements, ...list]
          : [...elements]
        store.set(listKey, JSON.stringify(nextList))
        return nextList.length
      },
      lrange: async (key: string, start: number, stop: number) => {
        const listKey = `list:${key}`
        const list = readStringList(listKey)
        if (!Array.isArray(list)) {
          return []
        }
        const normalizedStart = start < 0 ? list.length + start : start
        const normalizedStop = stop < 0 ? list.length + stop + 1 : stop + 1
        return list.slice(normalizedStart, normalizedStop)
      },
      rpoplpush: async (source: string, destination: string) => {
        const sourceKey = `list:${source}`
        const destKey = `list:${destination}`
        const sourceList = readStringList(sourceKey)
        if (sourceList.length === 0) {
          return null
        }
        const value = sourceList.pop()
        if (value === undefined) {
          return null
        }
        store.set(sourceKey, JSON.stringify(sourceList))
        const destinationList = readStringList(destKey)
        destinationList.unshift(value)
        store.set(destKey, JSON.stringify(destinationList))
        return value
      },
      lrem: async (key: string, _count: number, value: string) => {
        const listKey = `list:${key}`
        const list = readStringList(listKey)
        const nextList = Array.isArray(list)
          ? list.filter((item) => item !== value)
          : []
        store.set(listKey, JSON.stringify(nextList))
        return Array.isArray(list) ? list.length - nextList.length : 0
      },
      llen: async (key: string) => {
        const listKey = `list:${key}`
        const list = readStringList(listKey)
        return Array.isArray(list) ? list.length : 0
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
          return slice.flatMap(([member, score]) => [member, String(score)])
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
        const [member, score] = sorted[0] ?? ['', 0]
        zset.delete(member)
        return [{ value: member, score }]
      },
      zcard: async (key: string) => {
        const zset = zsetStore.get(key)
        return zset ? zset.size : 0
      },
      zrangebyscore: async (
        key: string,
        min: string | number,
        max: string | number,
        limitStr?: string,
        offset?: number,
        limit?: number,
      ) => {
        const zset = zsetStore.get(key)
        if (!zset) {
          return []
        }
        const parseScore = (score: string | number): number => {
          if (typeof score === 'number') {
            return score
          }
          if (score === '-inf') {
            return Number.NEGATIVE_INFINITY
          }
          if (score === '+inf') {
            return Number.POSITIVE_INFINITY
          }
          return Number.parseFloat(score)
        }
        const minScore = parseScore(min)
        const maxScore = parseScore(max)
        const inRange = Array.from(zset.entries())
          .filter(([, score]) => score >= minScore && score <= maxScore)
          .sort((a, b) => a[1] - b[1])
        let members = inRange.map(([member]) => member)
        if (
          typeof limitStr === 'string' &&
          limitStr.toUpperCase() === 'LIMIT'
        ) {
          const start = offset ?? 0
          const end =
            typeof limit === 'number' && limit >= 0 ? start + limit : undefined
          members = members.slice(start, end)
        }
        return members
      },
      zremrangebyscore: async (
        key: string,
        min: string | number,
        max: string | number,
      ) => {
        const zset = zsetStore.get(key)
        if (!zset) {
          return 0
        }
        const parseScore = (score: string | number): number => {
          if (typeof score === 'number') {
            return score
          }
          if (score === '-inf') {
            return Number.NEGATIVE_INFINITY
          }
          if (score === '+inf') {
            return Number.POSITIVE_INFINITY
          }
          return Number.parseFloat(score)
        }
        const minScore = parseScore(min)
        const maxScore = parseScore(max)
        let removed = 0
        for (const [member, score] of zset.entries()) {
          if (score >= minScore && score <= maxScore) {
            zset.delete(member)
            removed += 1
          }
        }
        return removed
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
      ttl: async (_key: string) => -1,
      pttl: async (_key: string) => -1,
      info: async (_section?: string) =>
        'connected_clients:1\nblocked_clients:0',
      publish: async (_channel: string, _message: string) => 0,
      subscribe: async (_channel: string) => 0,
      unsubscribe: async (_channel: string) => 0,
      scan: async (_cursor: string) => ['0', []] as [string, string[]],
      disconnect: async () => undefined,
      quit: async () => 'OK',
      connect: async () => {},
      on: (event: string, callback: (...args: unknown[]) => void) => {
        // Emit the event immediately to simulate connection events
        if (['connect', 'ready'].includes(event)) {
          setTimeout(() => callback(), 0)
        }
        return mockClient
      }, // Basic event handling for mock
      pipeline: () => createMockPipeline(),
    }

    return mockClient
  }

  private createClient(): RedisClient {
    const redisOptions: RedisServiceConfig = {
      url: this.config.url,
      maxRetriesPerRequest: this.config.maxRetries,
      retryStrategy: (times: number) => {
        if (times > (this.config.maxRetries ?? 3)) {
          return 0
        }
        return this.config.retryDelay ?? 100
      },
      keyPrefix: this.config.keyPrefix,
      connectTimeout: this.config.connectTimeout,
    }

    return this.createCommandClient(new Redis(this.config.url, redisOptions))
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
    }, this.config.healthCheckInterval ?? 5000)
  }

  async isHealthy(): Promise<boolean> {
    try {
      const client = await this.ensureConnection()
      const result = await client.ping()
      if (result !== 'PONG') {
        throw new RedisServiceError(
          RedisErrorCode.OPERATION_FAILED,
          'Ping failed or returned unexpected response',
        )
      }
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
      try {
        return await client.keys(pattern)
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error.message.includes('ERR KEYS command is disabled')
        ) {
          const results: string[] = []
          let cursor = '0'

          do {
            const scanResult = await client.scan(
              cursor,
              'MATCH',
              pattern,
              'COUNT',
              1000,
            )
            const nextCursor = scanResult[0]
            const keys = scanResult[1]
            results.push(...keys)
            cursor = nextCursor
          } while (cursor !== '0')

          return results
        }

        throw error
      }
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
          stats.totalConnections = Number.parseInt(value ?? '', 10)
        }
        if (line.startsWith('blocked_clients:')) {
          const value = line.split(':')[1]
          stats.waitingClients = Number.parseInt(value ?? '', 10)
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

      subscriber.on('message', (...args: unknown[]) => {
        const [ch, message] = args
        if (typeof ch === 'string' && typeof message === 'string') {
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
      await subscriber.disconnect()
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
      const keys = await this.keys(pattern)

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
      return result
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
            typeof result[i + 1] === 'string'
          ) {
            arr.push({
              value: result[i],
              score: Number(result[i + 1]),
            })
          } else {
            logger.debug(
              `[RedisService] zrange WITHSCORES: Skipping invalid pair at index ${i}: value=${result[i]}, score=${result[i + 1]}`,
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
      if (Array.isArray(result)) {
        return result
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

  async zrangebyscore(
    key: string,
    min: string | number,
    max: string | number,
    limitStr?: string,
    offset?: number,
    limit?: number,
  ): Promise<string[]> {
    try {
      const client = await this.ensureConnection()
      if (typeof limitStr === 'string' && limitStr.toUpperCase() === 'LIMIT') {
        return await client.zrangebyscore(key, min, max, 'LIMIT', offset, limit)
      }
      return await client.zrangebyscore(key, min, max)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to get range from sorted set by score: ${key}`,
        error,
      )
    }
  }

  async zremrangebyscore(
    key: string,
    min: string | number,
    max: string | number,
  ): Promise<number> {
    try {
      const client = await this.ensureConnection()
      return await client.zremrangebyscore(key, min, max)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to remove range from sorted set by score: ${key}`,
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

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      const client = await this.ensureConnection()
      return await client.lrange(key, start, stop)
    } catch (error: unknown) {
      throw new RedisServiceError(
        RedisErrorCode.OPERATION_FAILED,
        `Failed to get list range: ${key}`,
        error,
      )
    }
  }

  async lRange(key: string, start: number, stop: number): Promise<string[]> {
    return this.lrange(key, start, stop)
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
