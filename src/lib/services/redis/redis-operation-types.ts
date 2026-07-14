export interface RedisZSetMember {
  value: string
  score: number
}

export interface RedisPipelineOperation {
  cmd: string
  args: unknown[]
}

export interface RedisPipeline {
  del(...keys: string[]): this
  setex(key: string, seconds: number, value: string): this
  sadd(key: string, member: string): this
  expire(key: string, seconds: number): this
  get(key: string): this
  ttl(key: string): this
  exec(): Promise<[Error | null, unknown][]>
}

export interface RedisInfo {
  connected_clients?: number
  blocked_clients?: number
}

export type RedisEventHandler = (
  event: string,
  callback: (...args: unknown[]) => void,
) => RedisMockClient | void

export interface RedisMockClient {
  [key: string]: unknown

  get(key: string): Promise<string | null>
  set(key: string, value: string, ...options: unknown[]): Promise<unknown>
  del(...keys: string[]): Promise<number>
  multi(...commands: unknown[]): RedisPipeline
  expire(key: string, seconds: number): Promise<number>
  setex(key: string, seconds: number, value: string): Promise<unknown>
  exists(key: string): Promise<number>
  lpush(key: string, ...elements: string[]): Promise<number>
  rpoplpush(source: string, destination: string): Promise<string | null>
  lrem(key: string, count: number, value: string): Promise<number>
  llen(key: string): Promise<number>
  sadd(key: string, member: string): Promise<number>
  srem(key: string, member: string): Promise<number>
  smembers(key: string): Promise<string[]>
  keys(pattern: string): Promise<string[]>
  hset(key: string, field: string, value: string): Promise<number>
  hget(key: string, field: string): Promise<string | null>
  hgetall(key: string): Promise<Record<string, string>>
  hdel(key: string, field: string): Promise<number>
  hlen(key: string): Promise<number>
  lrange(key: string, start: number, stop: number): Promise<string[]>
  ping(): Promise<string>
  incr(key: string): Promise<number>
  pttl(key: string): Promise<number>
  ttl(key: string): Promise<number>
  scan(cursor: string, ...args: unknown[]): Promise<[string, string[]]>
  subscribe(channel: string): Promise<number>
  publish(channel: string, message: string): Promise<number>
  unsubscribe(channel: string): Promise<number>
  quit(): Promise<unknown>
  disconnect(): void | Promise<void>
  connect(): Promise<void>
  on: RedisEventHandler
  pipeline(): RedisPipeline
  zadd(key: string, score: number, member: string): Promise<number>
  zrem(key: string, member: string): Promise<number>
  zrange(key: string, start: number, stop: number): Promise<string[]>
  zrange(
    key: string,
    start: number,
    stop: number,
    withScores: 'WITHSCORES',
  ): Promise<string[]>
  zpopmin(key: string): Promise<RedisZSetMember[]>
  zcard(key: string): Promise<number>
  zrangebyscore(
    key: string,
    min: string | number,
    max: string | number,
    withscores?: string,
    offset?: number,
    count?: number,
  ): Promise<string[]>
  zremrangebyscore(
    key: string,
    min: string | number,
    max: string | number,
  ): Promise<number>
  info(section?: string): Promise<string>
  deletePattern(pattern: string): Promise<number>
}
