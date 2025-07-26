import { Redis as IORedis } from 'ioredis'

declare module 'ioredis' {
  interface Redis extends IORedis {
    // List methods
    lpush(key: string, ...values: (string | number | Buffer)[]): Promise<number>
    lrange(key: string, start: number, stop: number): Promise<string[]>
    lrem(key: string, count: number, value: string): Promise<number>

    // Sorted set methods
    zadd(key: string, ...args: (number | string | Buffer)[]): Promise<number>
    zrangebyscore(
      key: string,
      min: number | string,
      max: number | string,
      withScores?: 'WITHSCORES',
    ): Promise<string[]>
    zremrangebyscore(
      key: string,
      min: number | string,
      max: number | string,
    ): Promise<number>

    // Hash methods
    hset(key: string, field: string, value: string): Promise<number>
    hset(key: string, ...args: (string | number | Buffer)[]): Promise<number>

    // Key methods
    keys(pattern: string): Promise<string[]>
  }
}
