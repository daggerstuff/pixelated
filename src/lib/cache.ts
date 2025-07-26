/**
 * Generic caching implementation with TTL support
 */

interface CacheOptions {
  ttl: number // Time to live in seconds
  maxSize?: number // Maximum number of items to store
}

interface CacheEntry<T> {
  value: T
  expires: number
}

export class Cache {
  private store: Map<string, CacheEntry<unknown>>
  private readonly ttl: number
  private readonly maxSize: number

  constructor(options: CacheOptions) {
    this.store = new Map()
    this.ttl = options.ttl * 1000 // Convert to milliseconds
    this.maxSize = options.maxSize || 1000
  }

  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns The cached value or undefined if not found/expired
   */
  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined

    if (!entry) {
      return undefined
    }

    // Check if entry has expired
    if (Date.now() > entry.expires) {
      this.store.delete(key)
      return undefined
    }

    return entry.value
  }

  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Optional TTL override
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Enforce max size limit
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value
      this.store.delete(oldestKey)
    }

    this.store.set(key, {
      value,
      expires: Date.now() + (ttl ? ttl * 1000 : this.ttl),
    })
  }

  /**
   * Delete a value from the cache
   * @param key Cache key
   */
  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  /**
   * Clear all entries from the cache
   */
  async clear(): Promise<void> {
    this.store.clear()
  }

  /**
   * Get the number of entries in the cache
   */
  get size(): number {
    return this.store.size
  }
}
