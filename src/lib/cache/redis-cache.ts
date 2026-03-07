import { createClient, RedisClientType } from 'redis'

export interface CacheConfig {
  host: string
  port: number
  password?: string
  db?: number
  ttl: number
  keyPrefix: string
}

export class RedisCache {
  private client: RedisClientType
  private config: CacheConfig
  private connected: boolean = false

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      password: process.env['REDIS_PASSWORD'],
      db: parseInt(process.env['REDIS_DB'] || '0'),
      ttl: parseInt(process.env['REDIS_TTL'] || '3600'), // 1 hour default
      keyPrefix: process.env['REDIS_KEY_PREFIX'] || 'pixelated:',
      ...config,
    }

    this.client = createClient({
      socket: {
        host: this.config.host,
        port: this.config.port,
      },
      password: this.config.password,
      database: this.config.db,
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('✅ Redis cache connected')
      this.connected = true
    })

    this.client.on('error', (err) => {
      console.error('❌ Redis cache error:', err)
      this.connected = false
    })

    this.client.on('disconnect', () => {
      console.log('📡 Redis cache disconnected')
      this.connected = false
    })
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect()
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit()
      this.connected = false
    }
  }

  private generateKey(key: string): string {
    return `${this.config.keyPrefix}${key}`
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.connected) {
        await this.connect()
      }

      const cached = await this.client.get(this.generateKey(key))
      if (!cached || typeof cached !== 'string' || cached === '') {
        return null
      }

      return JSON.parse(cached) as T
    } catch (error) {
      console.warn('Redis cache get error:', error)
      return null
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      if (!this.connected) {
        await this.connect()
      }

      const serializedValue = JSON.stringify(value)
      const finalTtl = ttl || this.config.ttl

      await this.client.setEx(this.generateKey(key), finalTtl, serializedValue)
    } catch (error) {
      console.warn('Redis cache set error:', error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (!this.connected) {
        await this.connect()
      }

      await this.client.del(this.generateKey(key))
    } catch (error) {
      console.warn('Redis cache delete error:', error)
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.connected) {
        await this.connect()
      }

      const result = await this.client.exists(this.generateKey(key))
      return result === 1
    } catch (error) {
      console.warn('Redis cache exists error:', error)
      return false
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Generate new value
    const value = await factory()

    // Cache the result
    await this.set(key, value, ttl)

    return value
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (!this.connected) {
        await this.connect()
      }

      const keys = await this.client.keys(`${this.config.keyPrefix}${pattern}`)
      if (keys.length > 0) {
        await this.client.del(keys)
      }
    } catch (error) {
      console.warn('Redis cache invalidate pattern error:', error)
    }
  }

  async clear(): Promise<void> {
    try {
      if (!this.connected) {
        await this.connect()
      }

      const keys = await this.client.keys(`${this.config.keyPrefix}*`)
      if (keys.length > 0) {
        await this.client.del(keys)
      }
    } catch (error) {
      console.warn('Redis cache clear error:', error)
    }
  }

  async getStats(): Promise<{
    connected: boolean
    keys: number
    memory: Record<string, string> | null
  }> {
    try {
      if (!this.connected) {
        await this.connect()
      }

      const info = await this.client.info('memory')
      const keys = await this.client.dbSize()

      return {
        connected: this.connected,
        keys,
        memory: this.parseRedisInfo(info),
      }
    } catch (error) {
      console.warn('Redis cache stats error:', error)
      return {
        connected: false,
        keys: 0,
        memory: null,
      }
    }
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const lines = info.split('\n')
    const result: Record<string, string> = {}

    lines.forEach((line) => {
      if (line.includes(':')) {
        const parts = line.split(':')
        if (parts.length >= 2) {
          const key = parts[0]
          if (key) {
            const value = parts.slice(1).join(':')
            result[key] = value
          }
        }
      }
    })

    return result
  }

  // Analytics-specific caching methods
  async getAnalyticsData<T>(key: string, days: number): Promise<T | null> {
    const cacheKey = `analytics:${key}:${days}`
    return this.get<T>(cacheKey)
  }

  async setAnalyticsData<T>(key: string, days: number, data: T): Promise<void> {
    const cacheKey = `analytics:${key}:${days}`
    // Analytics data can be cached for 15 minutes
    await this.set(cacheKey, data, 900)
  }

  async invalidateAnalyticsCache(): Promise<void> {
    await this.invalidatePattern('analytics:*')
  }

  // Dashboard-specific caching
  async getDashboardSummary<T>(): Promise<T | null> {
    return this.get<T>('dashboard:summary')
  }

  async setDashboardSummary<T>(data: T): Promise<void> {
    // Dashboard summary cached for 5 minutes
    await this.set('dashboard:summary', data, 300)
  }

  async invalidateDashboardCache(): Promise<void> {
    await this.invalidatePattern('dashboard:*')
  }
}

// Global cache instance
let cacheInstance: RedisCache | null = null

export function getCache(): RedisCache {
  if (!cacheInstance) {
    cacheInstance = new RedisCache()
  }
  return cacheInstance
}

export function createCache(config?: Partial<CacheConfig>): RedisCache {
  return new RedisCache(config)
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (cacheInstance) {
    await cacheInstance.disconnect()
  }
})

process.on('SIGTERM', async () => {
  if (cacheInstance) {
    await cacheInstance.disconnect()
  }
})
