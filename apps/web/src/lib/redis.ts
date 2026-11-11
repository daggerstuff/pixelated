/**
 * Redis client wrapper — delegates to the canonical RedisService at
 * src/lib/services/redis/RedisService.
 *
 * Maintains backward-compatible exports so existing callers (AnalyticsService,
 * NotificationService, breach-analytics) require no changes.
 *
 * ## Consolidation note
 *
 * Previously this module had its own inline mock client and ioredis setup.
 * All that logic now lives in RedisService, which has connection pooling,
 * health checks, and a richer mock client.
 */

import { RedisService } from '@/lib/services/redis/RedisService'
import type { RedisServiceConfig } from '@/lib/services/redis/types'

// ---------------------------------------------------------------------------
// Environment resolution
// ---------------------------------------------------------------------------

function resolveConfig(): RedisServiceConfig {
  const url =
    process.env['REDIS_URL'] ?? process.env['UPSTASH_REDIS_REST_URL'] ?? ''

  return {
    url,
    maxRetries: 3,
    retryDelay: 1000,
    connectTimeout: 5000,
  }
}

// ---------------------------------------------------------------------------
// Singleton service + lazy connection
// ---------------------------------------------------------------------------

const config = resolveConfig()
const service = new RedisService(config)

let connected = false
let connecting: Promise<void> | null = null

/**
 * Upper bound on a single Redis connect attempt.
 *
 * ioredis's own `connectTimeout` (5s) is not a guarantee on every runtime, and
 * a connect that never settles must not become a memoized promise every later
 * request awaits forever.
 */
export const REDIS_CONNECT_DEADLINE_MS = 3_000

class RedisConnectDeadlineExceededError extends Error {
  constructor(deadlineMs: number) {
    super(`Redis connect exceeded its ${deadlineMs}ms deadline`)
    this.name = 'RedisConnectDeadlineExceededError'
  }
}

const connectWithDeadline = (deadlineMs: number): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new RedisConnectDeadlineExceededError(deadlineMs)),
      deadlineMs,
    )
  })
  return Promise.race([service.connect(), deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

async function ensureConnected(): Promise<void> {
  if (connected) return
  if (connecting) return connecting
  // Clear the memo on success, failure, and timeout so a later call retries
  // instead of awaiting a promise that already rejected or never settles.
  connecting = connectWithDeadline(REDIS_CONNECT_DEADLINE_MS)
    .then(() => {
      connected = true
    })
    .finally(() => {
      connecting = null
    })
  return connecting
}

/**
 * Upper bound on a single cache command (`get`, `set`, `del`).
 *
 * Bounding the connect is not enough: on a reconnecting ioredis client the
 * command that follows queues in the offline queue until the reconnect
 * resolves, so a fast `ensureConnected()` still leaves the read waiting. Racing
 * the command against this deadline makes a dead Redis cost milliseconds
 * instead of the route's 8 s deadline — a timed-out read is treated as a cache
 * miss (the in-process fallback below serves it) and a timed-out write as a
 * failed shared write. A reachable Redis answers in single-digit milliseconds,
 * so it never reaches this deadline and its behaviour is unchanged.
 */
export const REDIS_COMMAND_DEADLINE_MS = 250

class RedisCommandDeadlineExceededError extends Error {
  constructor(deadlineMs: number) {
    super(`Redis command exceeded its ${deadlineMs}ms deadline`)
    this.name = 'RedisCommandDeadlineExceededError'
  }
}

const commandWithDeadline = <T>(
  command: Promise<T>,
  deadlineMs: number,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new RedisCommandDeadlineExceededError(deadlineMs)),
      deadlineMs,
    )
  })
  return Promise.race([command, deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

// ---------------------------------------------------------------------------
// Backward-compatible redis client (the exported singleton)
//
// The previous implementation exported a raw ioredis-compatible client. We
// build a facade that delegates to RedisService so existing code like
//   redis.get('foo')
//   redis.ping()
// continues to work unchanged.
// ---------------------------------------------------------------------------

export interface LegacyRedisClient {
  get(key: string): Promise<string | null>
  set(
    key: string,
    value: string,
    ...args: (string | number)[]
  ): Promise<unknown>
  del(key: string): Promise<number>
  exists(key: string): Promise<number>
  setex(key: string, seconds: number, value: string): Promise<unknown>
  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>
  expire(key: string, seconds: number): Promise<number>
  ping(): Promise<string>
  on(event: string, handler: (...args: unknown[]) => void): void
  quit(): Promise<unknown>
  disconnect(): void
  // Extended operations (used by tests / threat detection)
  hset(key: string, field: string, value: string): Promise<number>
  hget(key: string, field: string): Promise<string | null>
  hgetall(key: string): Promise<Record<string, string>>
  hdel(key: string, field: string): Promise<number>
  hincrby(key: string, field: string, increment: number): Promise<number>
  hlen(key: string): Promise<number>
  incr(key: string): Promise<number>
  sadd(key: string, member: string): Promise<number>
  srem(key: string, member: string): Promise<number>
  smembers(key: string): Promise<string[]>
  lpush(key: string, ...elements: string[]): Promise<number>
  lrange(key: string, start: number, stop: number): Promise<string[]>
  rpoplpush(source: string, destination: string): Promise<string | null>
  lrem(key: string, count: number, value: string): Promise<number>
  llen(key: string): Promise<number>
  keys(pattern: string): Promise<string[]>
  zadd(key: string, score: number, member: string): Promise<number>
  zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<number>
  zcard(key: string): Promise<number>
  pipeline(): {
    setex: (key: string, seconds: number, value: string) => { setex: unknown[] }
    sadd: (key: string, member: string) => { sadd: unknown[] }
    expire: (key: string, seconds: number) => { expire: unknown[] }
    incr: (key: string) => { incr: unknown[] }
    hincrby: (
      key: string,
      field: string,
      increment: number,
    ) => { hincrby: unknown[] }
    hset: (
      key: string,
      field: string,
      value: string | number,
    ) => { hset: unknown[] }
    exec: () => Promise<[Error | null, unknown][]>
  }
  multi(): unknown
  // For mock-only methods used by old tests
  flushall?(): Promise<string>
  ttl?(key: string): Promise<number>
}

export const redisClient: LegacyRedisClient = {
  get: async (key: string) => {
    try {
      await ensureConnected()
      return await service.get(key)
    } catch {
      return null
    }
  },

  set: async (key: string, value: string, ...args: (string | number)[]) => {
    try {
      await ensureConnected()
      const ttlArg = args.length >= 2 ? args[1] : undefined
      if (typeof ttlArg === 'number') {
        await service.set(key, value, ttlArg)
      } else {
        await service.set(key, value)
      }
      return 'OK'
    } catch {
      return null
    }
  },

  setNx: async (key: string, value: string, ttlSeconds: number) => {
    try {
      await ensureConnected()
      const client = service.getClient()
      if (!client) return false
      const result = await client.set(key, value, 'EX', ttlSeconds, 'NX')
      return result === 'OK'
    } catch {
      return false
    }
  },

  del: async (key: string) => {
    try {
      await ensureConnected()
      await service.del(key)
      return 1
    } catch {
      return 0
    }
  },

  exists: async (key: string) => {
    try {
      await ensureConnected()
      return (await service.exists(key)) ? 1 : 0
    } catch {
      return 0
    }
  },

  setex: async (key: string, seconds: number, value: string) => {
    try {
      await ensureConnected()
      await service.set(key, value, seconds * 1000)
      return 'OK'
    } catch {
      return null
    }
  },

  expire: async (key: string, seconds: number) => {
    try {
      await ensureConnected()
      return await service
        .set(key, '', seconds * 1000)
        .then(() => 1)
        .catch(() => 0)
    } catch {
      return 0
    }
  },

  ping: async () => {
    try {
      await ensureConnected()
      return (await service.isHealthy()) ? 'PONG' : ''
    } catch {
      return ''
    }
  },

  on: (_event: string, _handler: (...args: unknown[]) => void) => {
    // Noop — RedisService handles its own event listeners
  },

  quit: async () => {
    try {
      await service.disconnect()
      connected = false
      return 'OK'
    } catch {
      return null
    }
  },

  disconnect: () => {
    void service.disconnect().catch(() => {})
    connected = false
  },

  // ── Extended operations ──────────────────────────────────────────────
  // Forwarded through RedisService for full backward compatibility.

  incr: async (key: string) => {
    try {
      await ensureConnected()
      return await service.incr(key)
    } catch {
      return 0
    }
  },

  ttl: async (key: string) => {
    try {
      await ensureConnected()
      return await service.ttl(key)
    } catch {
      return -2
    }
  },

  hset: async (key: string, field: string, value: string) => {
    try {
      await ensureConnected()
      return await service.hset(key, field, value)
    } catch {
      return 0
    }
  },

  hget: async (key: string, field: string) => {
    try {
      await ensureConnected()
      return await service.hget(key, field)
    } catch {
      return null
    }
  },

  hgetall: async (key: string) => {
    try {
      await ensureConnected()
      return await service.hgetall(key)
    } catch {
      return {}
    }
  },

  hdel: async (key: string, field: string) => {
    try {
      await ensureConnected()
      return await service.hdel(key, field)
    } catch {
      return 0
    }
  },

  hincrby: async (key: string, field: string, increment: number) => {
    try {
      await ensureConnected()
      // Fallback if RedisService doesn't have hincrby
      const val = await service.hget(key, field)
      const num = parseInt(val ?? '0', 10) + increment
      await service.hset(key, field, num.toString())
      return num
    } catch {
      return 0
    }
  },

  keys: async (pattern: string) => {
    try {
      await ensureConnected()
      return await service.keys(pattern)
    } catch {
      return []
    }
  },

  sadd: async (key: string, member: string) => {
    try {
      await ensureConnected()
      return await service.sadd(key, member)
    } catch {
      return 0
    }
  },

  srem: async (key: string, member: string) => {
    try {
      await ensureConnected()
      return await service.srem(key, member)
    } catch {
      return 0
    }
  },

  smembers: async (key: string) => {
    try {
      await ensureConnected()
      return await service.smembers(key)
    } catch {
      return []
    }
  },

  lpush: async (key: string, ...elements: string[]) => {
    try {
      await ensureConnected()
      return await service.lpush(key, ...elements)
    } catch {
      return 0
    }
  },

  lrange: async (key: string, start: number, stop: number) => {
    try {
      await ensureConnected()
      return await service.lrange(key, start, stop)
    } catch {
      return []
    }
  },

  rpoplpush: async (source: string, destination: string) => {
    try {
      await ensureConnected()
      return await service.rpoplpush(source, destination)
    } catch {
      return null
    }
  },

  lrem: async (key: string, count: number, value: string) => {
    try {
      await ensureConnected()
      return await service.lrem(key, count, value)
    } catch {
      return 0
    }
  },

  llen: async (key: string) => {
    try {
      await ensureConnected()
      return await service.llen(key)
    } catch {
      return 0
    }
  },

  hlen: async (key: string) => {
    try {
      await ensureConnected()
      return await service.hlen(key)
    } catch {
      return 0
    }
  },

  zadd: async (key: string, score: number, member: string) => {
    try {
      await ensureConnected()
      return await service.zadd(key, score, member)
    } catch {
      return 0
    }
  },

  zremrangebyscore: async (
    key: string,
    min: number | string,
    max: number | string,
  ) => {
    try {
      await ensureConnected()
      return await service.zremrangebyscore(key, min, max)
    } catch {
      return 0
    }
  },

  zcard: async (key: string) => {
    try {
      await ensureConnected()
      return await service.zcard(key)
    } catch {
      return 0
    }
  },

  pipeline: () => ({
    setex: (_key: string, _seconds: number, _value: string) => ({
      setex: [_key, _seconds, _value],
    }),
    sadd: (_key: string, _member: string) => ({ sadd: [_key, _member] }),
    expire: (_key: string, _seconds: number) => ({
      expire: [_key, _seconds],
    }),
    incr: (_key: string) => ({ incr: [_key] }),
    hincrby: (_key: string, _field: string, _increment: number) => ({
      hincrby: [_key, _field, _increment],
    }),
    hset: (_key: string, _field: string, _value: string | number) => ({
      hset: [_key, _field, _value],
    }),
    exec: async () => [['OK']] as unknown as [Error | null, unknown][],
  }),
  multi: () => ({
    setex: (_key: string, _seconds: number, _value: string) => ({
      setex: [_key, _seconds, _value],
    }),
    sadd: (_key: string, _member: string) => ({ sadd: [_key, _member] }),
    expire: (_key: string, _seconds: number) => ({
      expire: [_key, _seconds],
    }),
    incr: (_key: string) => ({ incr: [_key] }),
    hincrby: (_key: string, _field: string, _increment: number) => ({
      hincrby: [_key, _field, _increment],
    }),
    hset: (_key: string, _field: string, _value: string | number) => ({
      hset: [_key, _field, _value],
    }),
    exec: async () => [['OK']] as unknown as [Error | null, unknown][],
  }),
}

// ---------------------------------------------------------------------------
// Exports (backward-compatible)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `redisClient` directly or migrate to `RedisService` from
 * `@/lib/services/redis`. Kept for backward compatibility.
 */
export const redis: LegacyRedisClient = redisClient

// ---------------------------------------------------------------------------
// In-process fallback for the session, identity, and role caches
// ---------------------------------------------------------------------------

/**
 * Key prefixes whose values may also live in this isolate's memory.
 *
 * The configured Redis host is unreachable (NXDOMAIN), so every read of these
 * keys is a guaranteed miss that still pays a connect attempt (~10 ms typical,
 * ~1.5 s worst case; diagnosis D2). Keeping a small per-isolate copy makes them
 * hits within the isolate, which also stops every token validation from paying
 * a Management API round-trip for the role. This is a latency cleanup only: it
 * does not move the 503 count, and Redis stays the first source whenever it is
 * reachable.
 *
 * Deliberately excluded: `rate_limit:` and `session_binding:`. Caching those
 * locally would change their behaviour (the limiter would start counting
 * per-isolate), which is outside this cleanup.
 */
const LOCAL_CACHE_KEY_PREFIXES = [
  'session:token:',
  'identity:sub:',
  'auth0:role:',
] as const

/** Cap so an isolate's fallback cache cannot grow without bound. */
const LOCAL_CACHE_MAX_ENTRIES = 500

interface LocalCacheEntry {
  value: unknown
  expiresAt: number
}

const localCache = new Map<string, LocalCacheEntry>()

function isLocallyCacheable(key: string): boolean {
  return LOCAL_CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
}

function readLocalCache(key: string): unknown {
  const entry = localCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    localCache.delete(key)
    return null
  }
  return entry.value
}

function writeLocalCache(
  key: string,
  value: unknown,
  expirationSeconds?: number,
): void {
  if (!isLocallyCacheable(key)) return
  if (!localCache.has(key) && localCache.size >= LOCAL_CACHE_MAX_ENTRIES) {
    // Drop the oldest insertion (Map preserves insertion order).
    const oldest = localCache.keys().next().value
    if (oldest !== undefined) localCache.delete(oldest)
  }
  localCache.set(key, {
    value,
    expiresAt: expirationSeconds
      ? Date.now() + expirationSeconds * 1000
      : Number.POSITIVE_INFINITY,
  })
}

/**
 * JSON-deserialising get wrapper. Returns `null` on miss/error.
 *
 * Falls back to the isolate's local copy for the prefixes above when Redis
 * misses or is unreachable.
 */
export async function getFromCache<T = unknown>(
  key: string,
): Promise<T | null> {
  try {
    await ensureConnected()
    const raw = await commandWithDeadline(
      service.get(key),
      REDIS_COMMAND_DEADLINE_MS,
    )
    if (raw === null) return readLocalCache(key) as T | null
    // Attempt JSON parse; return raw string if it fails
    try {
      return JSON.parse(raw) as T
    } catch {
      return raw as unknown as T
    }
  } catch {
    return readLocalCache(key) as T | null
  }
}

/**
 * JSON-serialising set wrapper.
 *
 * The isolate's local copy is written first for the prefixes above; the Redis
 * result is still the return value, so callers that treat `false` as "the
 * shared cache did not take the write" keep that meaning.
 */
export async function setInCache(
  key: string,
  value: unknown,
  expirationSeconds?: number,
): Promise<boolean> {
  writeLocalCache(key, value, expirationSeconds)
  try {
    await ensureConnected()
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    await commandWithDeadline(
      expirationSeconds
        ? service.set(key, serialized, expirationSeconds * 1000)
        : service.set(key, serialized),
      REDIS_COMMAND_DEADLINE_MS,
    )
    return true
  } catch {
    return false
  }
}

/**
 * Delete a key. Returns true if the key existed.
 */
export async function removeFromCache(key: string): Promise<boolean> {
  localCache.delete(key)
  try {
    await ensureConnected()
    await commandWithDeadline(service.del(key), REDIS_COMMAND_DEADLINE_MS)
    return true
  } catch {
    return false
  }
}

export function getRedisClient() {
  return redisClient
}

/**
 * Quick connectivity check via PING.
 */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    await ensureConnected()
    return await service.isHealthy()
  } catch {
    return false
  }
}

/**
 * Health check returning a structured result.
 */
export async function getRedisHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  details?: unknown
}> {
  try {
    await ensureConnected()
    const healthy = await service.isHealthy()
    if (healthy) {
      return { status: 'healthy' }
    }
    return { status: 'unhealthy', details: { message: 'PING failed' } }
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
