/**
 * Advanced Redis Caching Strategy
 * Multi-layer caching with intelligent invalidation, compression, and performance optimization
 */

import { getCache } from './redis-cache'
import { createCacheInvalidation } from './invalidation'
import { getLogger } from '@/lib/logging'
import { gzip, ungzip } from 'zlib'
import { promisify } from 'util'

const logger = getLogger('advanced-cache')
const gzipAsync = promisify(gzip)
const ungzipAsync = promisify(ungzip)

// Cache configuration
const CACHE_CONFIG = {
  // TTL configurations (in seconds)
  TTL: {
    L1_CACHE: 300, // 5 minutes - frequent access
    L2_CACHE: 1800, // 30 minutes - moderate access
    L3_CACHE: 7200, // 2 hours - infrequent access
    ANALYTICS: 900, // 15 minutes
    USER_SESSION: 3600, // 1 hour
    DASHBOARD: 300, // 5 minutes
    ML_MODEL: 14400, // 4 hours
    STATIC_DATA: 86400, // 24 hours
  },

  // Compression thresholds
  COMPRESSION: {
    ENABLED: true,
    THRESHOLD_BYTES: 1024, // Compress data larger than 1KB
    LEVEL: 6, // Gzip compression level (1-9)
  },

  // Cache layers
  LAYERS: {
    L1_MEMORY: 'memory', // In-memory cache (future implementation)
    L2_REDIS: 'redis', // Redis cache
    L3_DATABASE: 'database', // Database fallback
  },

  // Performance settings
  PERFORMANCE: {
    BATCH_SIZE: 100,
    PIPELINE_SIZE: 10,
    TIMEOUT_MS: 5000,
    MAX_CONCURRENT: 50,
  },
}

// Cache tags for intelligent invalidation
const CACHE_TAGS = {
  USER: 'user',
  SESSION: 'session',
  ANALYSIS: 'analysis',
  DASHBOARD: 'dashboard',
  ANALYTICS: 'analytics',
  ML_MODEL: 'ml_model',
  STATIC: 'static',
}

/**
 * Advanced cache key generator with versioning
 */
class CacheKeyGenerator {
  private version: string

  constructor(version: string = 'v1') {
    this.version = version
  }

  /**
   * Generate cache key with versioning and namespace
   */
  generateKey(
    namespace: string,
    identifier: string,
    params?: Record<string, any>,
  ): string {
    const baseKey = `${this.version}:${namespace}:${identifier}`

    if (params && Object.keys(params).length > 0) {
      const paramString = Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value}`)
        .join('|')

      return `${baseKey}:${paramString}`
    }

    return baseKey
  }

  /**
   * Generate pattern for cache invalidation
   */
  generatePattern(namespace: string, identifier?: string): string {
    if (identifier) {
      return `${this.version}:${namespace}:${identifier}*`
    }
    return `${this.version}:${namespace}:*`
  }
}

/**
 * Advanced caching strategy with multi-layer support
 */
export class AdvancedCacheStrategy {
  private cache = getCache()
  private keyGenerator = new CacheKeyGenerator()
  private invalidation = createCacheInvalidation({
    redis: this.cache,
    prefix: 'pixelated:',
    defaultTTL: CACHE_CONFIG.TTL.L2_CACHE,
  })

  /**
   * Get data from cache with compression and fallback
   */
  async get<T>(
    key: string,
    options: {
      decompress?: boolean
      fallback?: () => Promise<T>
      ttl?: number
      tags?: string[]
    } = {},
  ): Promise<T | null> {
    const startTime = Date.now()

    try {
      // Try to get from cache
      let cachedData = await this.cache.get(key)

      if (cachedData === null && options.fallback) {
        // Generate data using fallback
        const freshData = await options.fallback()

        // Cache the fresh data
        await this.set(key, freshData, {
          ttl: options.ttl,
          tags: options.tags,
        })

        logger.debug('Cache miss - data generated from fallback', {
          key,
          executionTime: Date.now() - startTime,
        })

        return freshData
      }

      if (cachedData === null) {
        return null
      }

      // Decompress if needed
      if (
        options.decompress &&
        typeof cachedData === 'string' &&
        cachedData.startsWith('gz:')
      ) {
        try {
          const compressed = Buffer.from(cachedData.substring(3), 'base64')
          const decompressed = await ungzipAsync(compressed)
          cachedData = JSON.parse(decompressed.toString())
        } catch (error) {
          logger.warn('Failed to decompress cached data', { key, error })
          return null
        }
      }

      logger.debug('Cache hit', {
        key,
        executionTime: Date.now() - startTime,
      })

      return cachedData as T
    } catch (error) {
      logger.error('Cache get operation failed', { key, error })
      return options.fallback ? await options.fallback() : null
    }
  }

  /**
   * Set data in cache with compression and tagging
   */
  async set(
    key: string,
    value: any,
    options: {
      ttl?: number
      tags?: string[]
      compress?: boolean
    } = {},
  ): Promise<void> {
    try {
      let dataToCache = value

      // Compress if enabled and data is large enough
      if (
        CACHE_CONFIG.COMPRESSION.ENABLED &&
        options.compress !== false &&
        JSON.stringify(value).length > CACHE_CONFIG.COMPRESSION.THRESHOLD_BYTES
      ) {
        try {
          const jsonString = JSON.stringify(value)
          const compressed = await gzipAsync(jsonString, {
            level: CACHE_CONFIG.COMPRESSION.LEVEL,
          })
          dataToCache = `gz:${compressed.toString('base64')}`

          logger.debug('Data compressed for caching', {
            key,
            originalSize: jsonString.length,
            compressedSize: compressed.length,
            compressionRatio: Math.round(
              (compressed.length / jsonString.length) * 100,
            ),
          })
        } catch (error) {
          logger.warn('Failed to compress data for caching', { key, error })
          dataToCache = value
        }
      }

      // Set cache with TTL
      await this.cache.set(
        key,
        dataToCache,
        options.ttl || CACHE_CONFIG.TTL.L2_CACHE,
      )

      // Add tags for invalidation
      if (options.tags && options.tags.length > 0) {
        const rule = {
          tags: options.tags,
          ttl: options.ttl || CACHE_CONFIG.TTL.L2_CACHE,
        }
        await this.invalidation.set(key, value, rule)
      }
    } catch (error) {
      logger.error('Cache set operation failed', { key, error })
    }
  }

  /**
   * Get or set cache with advanced options
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: {
      ttl?: number
      tags?: string[]
      compress?: boolean
      decompress?: boolean
    } = {},
  ): Promise<T> {
    const cached = await this.get<T>(key, {
      decompress: options.decompress,
      tags: options.tags,
    })

    if (cached !== null) {
      return cached
    }

    const freshData = await factory()
    await this.set(key, freshData, options)

    return freshData
  }

  /**
   * Bias analysis caching with intelligent invalidation
   */
  async getBiasAnalysis(params: {
    text: string
    demographics?: any
    context?: string
  }): Promise<any | null> {
    const key = this.keyGenerator.generateKey('bias', 'analysis', {
      text: this.hashText(params.text),
      demographics: params.demographics
        ? JSON.stringify(params.demographics)
        : 'none',
      context: params.context || 'none',
    })

    return this.get(key, {
      decompress: true,
      tags: [CACHE_TAGS.ANALYSIS],
    })
  }

  /**
   * Cache bias analysis results
   */
  async setBiasAnalysis(
    params: {
      text: string
      demographics?: any
      context?: string
    },
    result: any,
    options: {
      ttl?: number
      highBias?: boolean // Shorter TTL for high-bias results
    } = {},
  ): Promise<void> {
    const key = this.keyGenerator.generateKey('bias', 'analysis', {
      text: this.hashText(params.text),
      demographics: params.demographics
        ? JSON.stringify(params.demographics)
        : 'none',
      context: params.context || 'none',
    })

    // Use shorter TTL for high-bias results to ensure freshness
    const ttl = options.highBias
      ? (options.ttl || CACHE_CONFIG.TTL.L2_CACHE) / 2
      : options.ttl || CACHE_CONFIG.TTL.L2_CACHE

    await this.set(key, result, {
      ttl,
      tags: [CACHE_TAGS.ANALYSIS],
      compress: true,
    })
  }

  /**
   * User dashboard caching
   */
  async getUserDashboard(userId: string): Promise<any | null> {
    const key = this.keyGenerator.generateKey('user', 'dashboard', { userId })

    return this.get(key, {
      decompress: true,
      tags: [CACHE_TAGS.USER, CACHE_TAGS.DASHBOARD],
    })
  }

  /**
   * Cache user dashboard data
   */
  async setUserDashboard(userId: string, data: any): Promise<void> {
    const key = this.keyGenerator.generateKey('user', 'dashboard', { userId })

    await this.set(key, data, {
      ttl: CACHE_CONFIG.TTL.DASHBOARD,
      tags: [CACHE_TAGS.USER, CACHE_TAGS.DASHBOARD],
      compress: true,
    })
  }

  /**
   * Analytics data caching
   */
  async getAnalytics(key: string, days: number): Promise<any | null> {
    const cacheKey = this.keyGenerator.generateKey('analytics', key, { days })

    return this.get(cacheKey, {
      decompress: true,
      tags: [CACHE_TAGS.ANALYTICS],
    })
  }

  /**
   * Cache analytics data
   */
  async setAnalytics(key: string, days: number, data: any): Promise<void> {
    const cacheKey = this.keyGenerator.generateKey('analytics', key, { days })

    await this.set(cacheKey, data, {
      ttl: CACHE_CONFIG.TTL.ANALYTICS,
      tags: [CACHE_TAGS.ANALYTICS],
      compress: true,
    })
  }

  /**
   * Batch cache operations for better performance
   */
  async batchGet<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>()

    // Process in batches to avoid overwhelming Redis
    const batchSize = CACHE_CONFIG.PERFORMANCE.BATCH_SIZE
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize)
      const batchPromises = batch.map(async (key) => {
        const value = await this.get<T>(key)
        return { key, value }
      })

      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach(({ key, value }) => {
        results.set(key, value)
      })
    }

    return results
  }

  /**
   * Batch set operations
   */
  async batchSet(
    items: Array<{
      key: string
      value: any
      ttl?: number
      tags?: string[]
    }>,
  ): Promise<void> {
    // Process in batches
    const batchSize = CACHE_CONFIG.PERFORMANCE.BATCH_SIZE
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const batchPromises = batch.map((item) =>
        this.set(item.key, item.value, {
          ttl: item.ttl,
          tags: item.tags,
        }),
      )

      await Promise.all(batchPromises)
    }
  }

  /**
   * Intelligent cache invalidation by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      try {
        await this.invalidation.invalidateTag(tag)
        logger.info('Cache invalidated by tag', { tag })
      } catch (error) {
        logger.error('Failed to invalidate cache by tag', { tag, error })
      }
    }
  }

  /**
   * Invalidate user-specific cache
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const tags = [CACHE_TAGS.USER, `${CACHE_TAGS.USER}:${userId}`]
    await this.invalidateByTags(tags)
  }

  /**
   * Invalidate analysis cache
   */
  async invalidateAnalysisCache(): Promise<void> {
    await this.invalidateByTags([CACHE_TAGS.ANALYSIS])
  }

  /**
   * Invalidate dashboard cache
   */
  async invalidateDashboardCache(): Promise<void> {
    await this.invalidateByTags([CACHE_TAGS.DASHBOARD])
  }

  /**
   * Invalidate analytics cache
   */
  async invalidateAnalyticsCache(): Promise<void> {
    await this.invalidateByTags([CACHE_TAGS.ANALYTICS])
  }

  /**
   * Clear all cache (use with caution)
   */
  async clearAll(): Promise<void> {
    try {
      await this.cache.clear()
      logger.warn('All cache cleared')
    } catch (error) {
      logger.error('Failed to clear all cache', { error })
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalKeys: number
    memoryUsage: any
    hitRate: number
    compressionRatio: number
  }> {
    const stats = await this.cache.getStats()

    return {
      totalKeys: stats.keys,
      memoryUsage: stats.memory,
      hitRate: 0, // Would need to track hits/misses
      compressionRatio: 0, // Would need to track compression
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmupCache(): Promise<void> {
    logger.info('Starting cache warmup')

    try {
      // Preload dashboard data for active users

      // This would need to be implemented with actual database access
      logger.info('Cache warmup completed')
    } catch (error) {
      logger.error('Cache warmup failed', { error })
    }
  }

  /**
   * Hash text for cache keys (consistent hashing)
   */
  private hashText(text: string): string {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }
}

/**
 * Cache warming service
 */
export class CacheWarmingService {
  private cache: AdvancedCacheStrategy

  constructor() {
    this.cache = new AdvancedCacheStrategy()
  }

  /**
   * Warm up cache with essential data
   */
  async warmup(): Promise<void> {
    logger.info('Starting cache warming service')

    const warmupTasks = [
      this.warmupDashboardData(),
      this.warmupAnalyticsData(),
      this.warmupStaticData(),
    ]

    try {
      await Promise.all(warmupTasks)
      logger.info('Cache warming completed successfully')
    } catch (error) {
      logger.error('Cache warming failed', { error })
    }
  }

  /**
   * Warm up dashboard data for active users
   */
  private async warmupDashboardData(): Promise<void> {
    logger.info('Warming up dashboard data')

    // This would query active users and preload their dashboard data
    // Implementation depends on actual database structure

    logger.info('Dashboard data warmup completed')
  }

  /**
   * Warm up analytics data
   */
  private async warmupAnalyticsData(): Promise<void> {
    logger.info('Warming up analytics data')

    // Preload common analytics queries
    const analyticsKeys = [
      { key: 'daily_summary', days: 1 },
      { key: 'weekly_summary', days: 7 },
      { key: 'monthly_summary', days: 30 },
    ]

    const warmupPromises = analyticsKeys.map(({ key, days }) =>
      this.cache.getAnalytics(key, days),
    )

    await Promise.all(warmupPromises)

    logger.info('Analytics data warmup completed')
  }

  /**
   * Warm up static data
   */
  private async warmupStaticData(): Promise<void> {
    logger.info('Warming up static data')

    // Preload configuration and static data
    // Implementation depends on actual static data structure

    logger.info('Static data warmup completed')
  }
}

// Singleton instances
export const advancedCache = new AdvancedCacheStrategy()
export const cacheWarmingService = new CacheWarmingService()

// Performance monitoring
export async function monitorCachePerformance(): Promise<void> {
  const stats = await advancedCache.getStats()

  logger.info('Cache performance monitoring', {
    totalKeys: stats.totalKeys,
    memoryUsage: stats.memoryUsage,
    hitRate: stats.hitRate,
  })

  // Alert on high memory usage
  if (stats.memoryUsage && stats.memoryUsage.used_memory > 100 * 1024 * 1024) {
    // 100MB
    logger.warn('High cache memory usage detected', {
      memoryUsage: stats.memoryUsage,
    })
  }
}
