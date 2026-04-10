import type { Redis } from 'ioredis'

export interface RedisZSetMember {
  value: string
  score: number
}

export interface RedisPipelineOperation {
  cmd: string
  args: unknown[]
}

export interface RedisPipeline {
  del(key: string): Redis
  exec(): Promise<[Error | null, unknown][]>
}

export interface RedisInfo {
  connected_clients?: number
  blocked_clients?: number
}

export interface RedisEventHandler {
  (event: string, callback: (...args: unknown[]) => void): Redis
}

export interface RedisMockClient {
  get(key: string): Promise<string | null>
  set(
    key: string,
    value: string,
    mode?: string,
    duration?: number,
  ): Promise<'OK'>
  del(key: string): Promise<number>
  exists(key: string): Promise<number>
  sadd(key: string, member: string): Promise<number>
  srem(key: string, member: string): Promise<number>
  smembers(key: string): Promise<string[]>
  keys(pattern: string): Promise<string[]>
  hset(key: string, field: string, value: string): Promise<number>
  hget(key: string, field: string): Promise<string | null>
  hgetall(key: string): Promise<Record<string, string>>
  hdel(key: string, field: string): Promise<number>
  hlen(key: string): Promise<number>
  zadd(key: string, score: number, member: string): Promise<number>
  zrem(key: string, member: string): Promise<number>
  zrange(
    key: string,
    start: number,
    stop: number,
    withScores?: string,
  ): Promise<string[] | RedisZSetMember[]>
  zpopmin(key: string): Promise<RedisZSetMember[]>
  zcard(key: string): Promise<number>
  ping(): Promise<string>
  incr(key: string): Promise<number>
  pttl(key: string): Promise<number>
  info(section?: string): Promise<string>
  publish(channel: string, message: string): Promise<number>
  quit(): Promise<'OK'>
  connect(): Promise<void>
  on: RedisEventHandler
  pipeline(): RedisPipeline
}
