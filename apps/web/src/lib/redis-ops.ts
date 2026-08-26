/**
 * Shared typed Redis operations interface and helper.
 *
 * Apply this pattern to eliminate bracket-notation Redis access
 * (no-unsafe-member-access warnings) across the codebase:
 *
 *   import { asRedisOps } from '../redis-ops'
 *   const r = asRedisOps(redisClient)
 *   await r.get('key')          // instead of redis['get']('key')
 *   const p = r.pipeline()       // instead of redis['pipeline']()
 *
 * New Redis commands can be added to the RedisOps interface as needed.
 */

// ── Pipeline / Multi types ──────────────────────────────────────────

export interface PipelineOps {
  incr(key: string): PipelineOps
  expire(key: string, seconds: number): PipelineOps
  hincrby(key: string, field: string, value: number): PipelineOps
  hset(key: string, field: string, value: unknown): PipelineOps
  exec(): Promise<unknown>
}

export interface MultiOps {
  setex(key: string, seconds: number, value: string): MultiOps
  sadd(key: string, member: string): MultiOps
  expire(key: string, seconds: number): MultiOps
  del(...keys: string[]): MultiOps
  exec(): Promise<unknown>
}

// ── Main RedisOps interface ─────────────────────────────────────────

export interface RedisOps {
  // Strings
  get(key: string): Promise<string | null>
  set(
    key: string,
    value: string,
    mode?: string,
    ttl?: number,
  ): Promise<string | null>
  setex(key: string, seconds: number, value: string): Promise<'OK'>
  del(...keys: string[]): Promise<number>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  keys(pattern: string): Promise<string[]>
  ping(): Promise<string>

  // Hashes
  hgetall(key: string): Promise<Record<string, string>>
  hget(key: string, field: string): Promise<string | null>
  hset(key: string, ...fieldValues: string[]): Promise<number>
  hincrby(key: string, field: string, value: number): Promise<number>
  hdel(key: string, ...fields: string[]): Promise<number>

  // Sorted sets
  zadd(key: string, score: number, member: string): Promise<number>
  zremrangebyscore(key: string, min: number, max: number): Promise<number>
  zrangebyscore(key: string, min: number, max: number): Promise<string[]>

  // Lists
  lpush(key: string, ...values: string[]): Promise<number>
  lrange(key: string, start: number, stop: number): Promise<string[]>
  rpoplpush(source: string, destination: string): Promise<string | null>
  lrem(key: string, count: number, value: string): Promise<number>

  // Sets
  smembers(key: string): Promise<string[]>

  // Pub/Sub
  duplicate(): RedisOps

  // Pipeline
  pipeline(): PipelineOps
  multi(): MultiOps

  // Events
  on(event: string, handler: (...args: unknown[]) => void): void
}

// ── Helper ───────────────────────────────────────────────────────────

export function asRedisOps(client: unknown): RedisOps {
  return client as RedisOps
}
