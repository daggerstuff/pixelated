/**
 * Redis Client Interface
 * Defines the minimum required Redis functionality for our cache service
 */
export interface RedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, options?: { ex?: number }): Promise<void>
  del(...keys: string[]): Promise<void>
  keys(pattern: string): Promise<string[]>
  mget(...keys: string[]): Promise<(string | null)[]>
}
