/**
 * Key-Value Store Implementation
 * Used for storing and retrieving cognitive models and other structured data
 */

export class KVStore {
  private storagePrefix: string
  private cache: Map<string, unknown> = new Map()
  private useLocalStorage: boolean

  /**
   * Create a new KV Store instance
   * @param storagePrefix Prefix for all keys stored by this instance
   * @param useLocalStorage Whether to use localStorage as fallback (for client-side usage)
   */
  constructor(
    storagePrefix: string = 'gradiant_',
    useLocalStorage: boolean = false,
  ) {
    this.storagePrefix = storagePrefix
    this.useLocalStorage = useLocalStorage
  }

  /**
   * Prepend the storage prefix to a key
   */
  private prefixKey(key: string): string {
    return `${this.storagePrefix}${key}`
  }

  /**
   * Store a value with the given key
   */
  async set<T>(key: string, value: T): Promise<void> {
    const prefixedKey = this.prefixKey(key)

    try {
      // Store in cache
      this.cache.set(prefixedKey, value)

      // If client-side, try to use localStorage as fallback
      if (this.useLocalStorage && typeof window !== 'undefined') {
        try {
          localStorage.setItem(prefixedKey, JSON.stringify(value))
        } catch (error: unknown) {
          console.warn('Failed to store in localStorage:', error)
        }
      }

      // Here we would implement actual database storage
      // For server-side persistence, we'd need to implement this
      // based on the specific database technology being used
      // (e.g., Vercel KV, Redis, Supabase, etc.)

      // For now, we'll just log that we would store the value
      if (process.env['NODE_ENV'] === 'development') {
        console.log(`[KVStore] Would store value for key: ${key}`)
      }
    } catch (error: unknown) {
      console.error(`Failed to store value for key ${key}:`, error)
      throw error
    }
  }

  /**
   * Retrieve a value by key
   */
  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.prefixKey(key)

    try {
      // First check cache
      if (this.cache.has(prefixedKey)) {
        return this.cache.get(prefixedKey) as T
      }

      // If client-side, try to use localStorage as fallback
      if (this.useLocalStorage && typeof window !== 'undefined') {
        const storedValue = localStorage.getItem(prefixedKey)
        if (storedValue) {
          try {
            const parsedValue = JSON.parse(storedValue) as unknown as T
            this.cache.set(prefixedKey, parsedValue)
            return parsedValue
          } catch (error: unknown) {
            console.warn('Failed to parse value from localStorage:', error)
          }
        }
      }

      // Here we would implement actual database retrieval
      // For now, we'll just return null
      if (process.env['NODE_ENV'] === 'development') {
        console.log(`[KVStore] Would retrieve value for key: ${key}`)
      }

      return null
    } catch (error: unknown) {
      console.error(`Failed to retrieve value for key ${key}:`, error)
      return null
    }
  }

  /**
   * Delete a value by key
   */
  async delete(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key)

    try {
      // Remove from cache
      this.cache.delete(prefixedKey)

      // If client-side, remove from localStorage
      if (this.useLocalStorage && typeof window !== 'undefined') {
        try {
          localStorage.removeItem(prefixedKey)
        } catch (error: unknown) {
          console.warn('Failed to remove from localStorage:', error)
        }
      }

      // Here we would implement actual database deletion
      if (process.env['NODE_ENV'] === 'development') {
        console.log(`[KVStore] Would delete value for key: ${key}`)
      }

      return true
    } catch (error: unknown) {
      console.error(`Failed to delete value for key ${key}:`, error)
      return false
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key)

    // Check cache first
    if (this.cache.has(prefixedKey)) {
      return true
    }

    // If client-side, check localStorage
    if (this.useLocalStorage && typeof window !== 'undefined') {
      try {
        return localStorage.getItem(prefixedKey) !== null
      } catch (error: unknown) {
        console.warn('Failed to check localStorage:', error)
      }
    }

    // Here we would implement actual database check
    // For now, just return false
    return false
  }

  /**
   * List all keys with a given prefix
   */
  async keys(prefix: string = ''): Promise<string[]> {
    const fullPrefix = this.prefixKey(prefix)
    const keys: string[] = []

    // Get keys from cache
    for (const key of this.cache.keys()) {
      if (key.startsWith(fullPrefix)) {
        keys.push(key.substring(this.storagePrefix.length))
      }
    }

    // If client-side, get keys from localStorage
    if (this.useLocalStorage && typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith(fullPrefix)) {
            const normalizedKey = key.substring(this.storagePrefix.length)
            if (!keys.includes(normalizedKey)) {
              keys.push(normalizedKey)
            }
          }
        }
      } catch (error: unknown) {
        console.warn('Failed to list keys from localStorage:', error)
      }
    }

    // Here we would implement actual database key listing

    return keys
  }

  /**
   * Clear all values in this store
   */
  async clear(): Promise<void> {
    try {
      // Clear cache
      this.cache.clear()

      // If client-side, clear relevant localStorage items
      if (this.useLocalStorage && typeof window !== 'undefined') {
        try {
          const keysToRemove: string[] = []

          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith(this.storagePrefix)) {
              keysToRemove.push(key)
            }
          }

          keysToRemove.forEach((key) => localStorage.removeItem(key))
        } catch (error: unknown) {
          console.warn('Failed to clear localStorage:', error)
        }
      }

      // Here we would implement actual database clearing logic
      if (process.env['NODE_ENV'] === 'development') {
        console.log(
          `[KVStore] Would clear all values with prefix: ${this.storagePrefix}`,
        )
      }
    } catch (error: unknown) {
      console.error('Failed to clear KV store:', error)
      throw error
    }
  }
}
