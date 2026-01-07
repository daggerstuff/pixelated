/**
 * Caching Layer for Pixelated Empathy Bias Detection Engine
 *
 * This module provides a comprehensive caching system to optimize performance
 * for bias detection operations, analysis results, and frequently accessed data.
 * Enhanced with Redis integration for distributed caching.
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { getCacheService } from '../../services/cacheService'
import {
  CacheEntry,
  CacheStats,
  BiasReport,
  BiasAnalysisResult,
  TherapeuticSession,
  ParticipantDemographics,
  DashboardData,
} from './types'

import * as zlib from 'zlib'
import { promisify } from 'util'

const deflate = promisify(zlib.deflate)
const inflate = promisify(zlib.inflate)

// Prefix for compressed data to easily identify it
const COMPRESSION_PREFIX = 'COMPRESSED:'

const logger = createBuildSafeLogger('BiasDetectionCache')

// =============================================================================
// CACHE CONFIGURATION
// =============================================================================

export interface CacheConfig {
  maxSize: number // Maximum number of entries
  defaultTtl: number // Default TTL in milliseconds
  cleanupInterval: number // Cleanup interval in milliseconds
  enableCompression: boolean // Enable data compression
  enablePersistence: boolean // Enable disk persistence
  persistencePath?: string // Path for persistence file
  memoryThreshold: number // Memory usage threshold (0-1)
  useRedis: boolean // Use Redis for distributed caching
  redisKeyPrefix: string // Prefix for Redis keys
  hybridMode: boolean // Use both Redis and memory for performance
}

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  tags?: string[] // Tags for cache invalidation
  compress?: boolean // Compress this entry
  priority?: 'low' | 'medium' | 'high' // Cache priority
  useRedisOnly?: boolean // Store only in Redis, not memory
  skipMemoryCache?: boolean // Skip memory cache for this entry
  strategy?: string // Cache strategy name
}

// =============================================================================
// ENHANCED REDIS-BACKED CACHE IMPLEMENTATION
// =============================================================================

export class BiasDetectionCache {
  private memoryCache = new Map<string, CacheEntry>()
  private config: CacheConfig
  private stats: CacheStats
  private cleanupTimer?: ReturnType<typeof setInterval> | undefined
  private cacheService: {
    get(key: string): Promise<string | null>
    set(key: string, value: string, ttl?: number): Promise<void>
    delete(key: string): Promise<void>
    keys?(pattern: string): Promise<string[]>
    clearByPrefix?(prefix: string): Promise<void>
  } | null = null
  private redisAvailable = false

  // Public accessors for specialized cache classes
  public getMemoryCacheEntries(): [string, CacheEntry][] {
    return Array.from(this.memoryCache.entries())
  }

  public isRedisConfigured(): boolean {
    return this.config.useRedis && this.redisAvailable
  }

  public getRedisKeyPrefix(): string {
    return this.config.redisKeyPrefix
  }

  public async getRedisKeys(): Promise<string[]> {
    if (!this.cacheService) {
      return []
    }
    return (
      (await this.cacheService.keys?.(`${this.config.redisKeyPrefix}*`)) || []
    )
  }

  public async getFromRedisCache(key: string): Promise<string | null> {
    if (!this.cacheService) {
      return null
    }
    return (await this.cacheService.get(key)) || null
  }

  public async deleteFromRedisCache(key: string): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.delete(key)
    }
  }

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      defaultTtl: 30 * 60 * 1000, // 30 minutes
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      enableCompression: true,
      enablePersistence: false,
      memoryThreshold: 0.8,
      useRedis: true,
      redisKeyPrefix: 'bias:cache:',
      hybridMode: true,
      ...config,
    }

    this.stats = {
      totalEntries: 0,
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      memoryUsage: 0,
      oldestEntry: new Date(),
      newestEntry: new Date(),
      redisHits: 0,
      redisMisses: 0,
      memoryHits: 0,
      memoryMisses: 0,
    }

    this.cacheService = null // Initialize as null
    this.initializeRedis()
    this.startCleanupTimer()
    logger.info('BiasDetectionCache initialized', { config: this.config })
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      const service = getCacheService()
      // CacheService now always implements CacheClient interface
      this.cacheService = service
      this.redisAvailable = true
      logger.info('Redis cache service connected for bias detection')
    } catch (error: unknown) {
      logger.warn('Redis cache service unavailable, using memory-only mode', {
        error,
      })
      this.redisAvailable = false
      this.config.useRedis = false
    }
  }

  /**
   * Generate Redis key with prefix
   */
  private getRedisKey(key: string): string {
    return `${this.config.redisKeyPrefix}${key}`
  }

  /**
   * Store a value in the cache (Redis + Memory)
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {},
  ): Promise<void> {
    try {
      const now = new Date()
      const ttl = options.ttl || this.config.defaultTtl
      const ttlSeconds = Math.floor(ttl / 1000)
      const expiresAt = new Date(now.getTime() + ttl)

      // Compress data if enabled
      let processedValue = value
      if (this.config.enableCompression && options.compress !== false) {
        processedValue = (await this.compressData(value)) as T
      }

      // Store in Redis first (distributed cache)
      if (
        this.config.useRedis &&
        this.redisAvailable &&
        !options.skipMemoryCache
      ) {
        try {
          const redisKey = this.getRedisKey(key)
          const cacheData = {
            value: processedValue,
            timestamp: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            tags: options.tags || [],
            metadata: {
              biasCache: true,
              version: '1.0',
              priority: options.priority || 'medium',
            },
          }

          if (this.cacheService) {
            await this.cacheService.set(
              redisKey,
              JSON.stringify(cacheData),
              ttlSeconds,
            )
          }
          logger.debug('Stored in Redis cache', {
            key: redisKey,
            ttl: ttlSeconds,
          })
        } catch (redisError) {
          logger.warn('Failed to store in Redis, falling back to memory', {
            key,
            error: redisError,
          })
        }
      }

      // Store in memory cache for fast access (if hybrid mode or Redis unavailable)
      if (
        (this.config.hybridMode ||
          !this.config.useRedis ||
          !this.redisAvailable) &&
        !options.useRedisOnly
      ) {
        if (this.memoryCache.size >= this.config.maxSize) {
          await this.evictLeastRecentlyUsed()
        }

        const entry: CacheEntry<T> = {
          key,
          value: processedValue,
          timestamp: now,
          expiresAt,
          accessCount: 0,
          lastAccessed: now,
          tags: options.tags || [],
        }

        this.memoryCache.set(key, entry)
        logger.debug('Stored in memory cache', {
          key,
          size: this.memoryCache.size,
        })
      }

      this.updateStats()

      logger.debug('Cache entry stored', {
        key,
        ttl,
        tags: options.tags,
        redis: this.redisAvailable && this.config.useRedis,
        memory: this.config.hybridMode || !this.config.useRedis,
      })
    } catch (error: unknown) {
      logger.error('Failed to store cache entry', { key, error })
      throw error
    }
  }

  /**
   * Retrieve a value from the cache (Memory first, then Redis)
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Try memory cache first for speed (if hybrid mode)
      if (this.config.hybridMode || !this.config.useRedis) {
        const memoryResult = await this.getFromMemory<T>(key)
        logger.debug('get: checked memory', {
          key,
          found: memoryResult !== null,
        })
        if (memoryResult !== null) {
          this.stats.memoryHits++
          this.stats.hitRate++
          return memoryResult
        }
        this.stats.memoryMisses++
      }

      // Try Redis cache
      if (this.config.useRedis && this.redisAvailable) {
        const redisResult = await this.getFromRedis<T>(key)
        logger.debug('get: checked Redis', { key, found: redisResult !== null })
        if (redisResult !== null) {
          this.stats.redisHits++
          this.stats.hitRate++

          // Store in memory cache for future fast access (if hybrid mode)
          if (this.config.hybridMode) {
            await this.storeInMemoryFromRedis(key, redisResult)
          }

          return redisResult
        }
        this.stats.redisMisses++
      }

      this.stats.missRate++
      logger.debug('Cache miss (both memory and Redis)', { key })
      return null
    } catch (error: unknown) {
      logger.error('Failed to retrieve cache entry', { key, error })
      this.stats.missRate++
      return null
    }
  }

  /**
   * Get value from memory cache
   */
  private async getFromMemory<T>(key: string): Promise<T | null> {
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined

    if (!entry) {
      return null
    }

    // Check if entry has expired
    if (entry.expiresAt < new Date()) {
      this.memoryCache.delete(key)
      return null
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = new Date()

    // Decompress data if needed
    let { value } = entry
    if (this.isCompressed(value)) {
      value = await this.decompressData(value)
    }

    logger.debug('Memory cache hit', { key, accessCount: entry.accessCount })
    return value as T
  }

  /**
   * Get value from Redis cache
   */
  private async getFromRedis<T>(key: string): Promise<T | null> {
    try {
      const redisKey = this.getRedisKey(key)
      const cached = this.cacheService
        ? await this.cacheService.get(redisKey)
        : null

      if (!cached) {
        return null
      }

      // Parse with Date revival
      const cacheData = JSON.parse(cached, (_key, value): any => {
        // Revive Date objects from ISO strings
        if (
          typeof value === 'string' &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value)
        ) {
          return new Date(value)
        }
        return value
      })

      // Check expiration
      if (new Date(cacheData.expiresAt) < new Date()) {
        await this.cacheService?.delete(redisKey)
        return null
      }

      // Decompress if needed
      let { value } = cacheData
      if (this.isCompressed(value)) {
        value = await this.decompressData(value)
      }

      logger.debug('Redis cache hit', { key: redisKey })
      return value
    } catch (error: unknown) {
      logger.warn('Error retrieving from Redis cache', { key, error })
      return null
    }
  }

  /**
   * Store Redis result in memory cache for fast future access
   */
  private async storeInMemoryFromRedis<T>(
    key: string,
    value: T,
  ): Promise<void> {
    try {
      if (this.memoryCache.size >= this.config.maxSize) {
        await this.evictLeastRecentlyUsed()
      }

      const now = new Date()
      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: now,
        expiresAt: new Date(now.getTime() + this.config.defaultTtl),
        accessCount: 1,
        lastAccessed: now,
        tags: [],
      }

      this.memoryCache.set(key, entry)
      logger.debug('Stored Redis result in memory cache', { key })
    } catch (error: unknown) {
      logger.warn('Failed to store Redis result in memory', { key, error })
    }
  }

  /**
   * Check if a key exists in the cache (checks both memory and Redis)
   */
  async has(key: string): Promise<boolean> {
    // Check memory first
    if (this.config.hybridMode || !this.config.useRedis) {
      const entry = this.memoryCache.get(key)
      if (entry && entry.expiresAt >= new Date()) {
        return true
      }
    }

    // Check Redis
    if (this.config.useRedis && this.redisAvailable) {
      try {
        const redisKey = this.getRedisKey(key)
        const cached = this.cacheService
          ? await this.cacheService.get(redisKey)
          : null
        if (cached) {
          const cacheData = JSON.parse(cached) as { expiresAt: string }
          return new Date(cacheData.expiresAt) >= new Date()
        }
      } catch (error: unknown) {
        logger.warn('Error checking Redis cache existence', { key, error })
      }
    }

    return false
  }

  /**
   * Delete a specific cache entry (from both memory and Redis)
   */
  async delete(key: string): Promise<boolean> {
    let deleted = false

    // Delete from memory
    if (this.memoryCache.has(key)) {
      this.memoryCache.delete(key)
      deleted = true
      console.log('[DEBUG] delete: deleted from memory', { key })
    }

    // Delete from Redis
    if (this.config.useRedis && this.redisAvailable) {
      try {
        const redisKey = this.getRedisKey(key)
        if (this.cacheService) {
          await this.cacheService.delete(redisKey)
        }
        deleted = true
        console.log('[DEBUG] delete: deleted from Redis cache', { redisKey })
      } catch (error: unknown) {
        logger.warn('Failed to delete from Redis cache', { key, error })
      }
    }

    if (deleted) {
      this.updateStats()
    }

    return deleted
  }

  /**
   * Clear all cache entries (both memory and Redis)
   */
  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear()

    // Clear Redis cache by prefix
    if (this.config.useRedis && this.redisAvailable) {
      try {
        if (this.cacheService?.clearByPrefix) {
          await this.cacheService.clearByPrefix(this.config.redisKeyPrefix)
        }
        logger.info('Cleared Redis cache with prefix', {
          prefix: this.config.redisKeyPrefix,
        })
      } catch (error: unknown) {
        logger.warn('Failed to clear Redis cache', { error })
      }
    }

    this.updateStats()
    logger.info('Cache cleared')
  }

  /**
   * Invalidate cache entries by tags (memory and Redis)
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    const invalidatedKeys = new Set<string>()

    // Invalidate in-memory cache
    for (const [key, entry] of Array.from(this.memoryCache.entries())) {
      if (entry.tags && entry.tags.some((tag) => tags.includes(tag))) {
        this.memoryCache.delete(key)
        invalidatedKeys.add(key)
      }
    }

    // Invalidate in Redis
    if (this.config.useRedis && this.redisAvailable) {
      try {
        const keys = this.cacheService?.keys
          ? await this.cacheService.keys(`${this.config.redisKeyPrefix}*`)
          : []
        for (const redisKey of keys) {
          const cached = this.cacheService
            ? await this.cacheService.get(redisKey)
            : null
          if (!cached) continue

          let cacheData
          try {
            cacheData = JSON.parse(cached)
          } catch {
            continue
          }

          if (
            cacheData.tags &&
            cacheData.tags.some((tag: string) => tags.includes(tag))
          ) {
            const logicalKey = redisKey.startsWith(this.config.redisKeyPrefix)
              ? redisKey.slice(this.config.redisKeyPrefix.length)
              : redisKey

            if (this.cacheService) {
              await this.cacheService.delete(redisKey)
            }
            invalidatedKeys.add(logicalKey)
          }
        }
      } catch (error: unknown) {
        logger.warn('Failed to invalidate Redis cache by tags', { tags, error })
      }
    }

    const invalidated = invalidatedKeys.size
    if (invalidated > 0) {
      this.updateStats()
      logger.info('Cache entries invalidated by tags', {
        tags,
        count: invalidated,
      })
    }

    return invalidated
  }

  /**
   * Get cache statistics (includes Redis metrics)
   */
  getStats(): CacheStats {
    this.updateStats()
    return {
      ...this.stats,
    }
  }

  /**
   * Get all cache keys
   */
  getKeys(): string[] {
    return Array.from(this.memoryCache.keys())
  }

  /**
   * Get cache entries by pattern
   */
  getKeysByPattern(pattern: RegExp): string[] {
    return this.getKeys().filter((key) => pattern.test(key))
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = new Date()
    let cleaned = 0

    for (const [key, entry] of Array.from(this.memoryCache.entries())) {
      if (entry.expiresAt < now) {
        this.memoryCache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.updateStats()
      logger.debug('Expired cache entries cleaned', { count: cleaned })
    }

    return cleaned
  }

  /**
   * Evict least recently used entries
   */
  private async evictLeastRecentlyUsed(): Promise<void> {
    const entries = Array.from(this.memoryCache.entries())

    // Sort by last accessed time (oldest first)
    entries.sort(
      ([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime(),
    )

    // Remove only 1 entry to make room for the new one
    const toRemove = 1

    if (entries.length > 0) {
      const entry = entries[0]
      if (entry) {
        const [key] = entry
        this.memoryCache.delete(key)
        this.stats.evictionCount++
        logger.debug('LRU eviction completed', {
          evicted: toRemove,
          evictedKey: key,
        })
      }
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats() {
    const entries = Array.from(this.memoryCache.values())

    this.stats.totalEntries = entries.length

    if (entries.length > 0) {
      const timestamps = entries.map((e) => e.timestamp.getTime())
      this.stats.oldestEntry = new Date(Math.min(...timestamps))
      this.stats.newestEntry = new Date(Math.max(...timestamps))
    }

    // Calculate hit rate percentage
    const totalRequests = this.stats.hitRate + this.stats.missRate
    if (totalRequests > 0) {
      this.stats.hitRate = (this.stats.hitRate / totalRequests) * 100
      this.stats.missRate = (this.stats.missRate / totalRequests) * 100
    }

    // Estimate memory usage (rough calculation)
    this.stats.memoryUsage = this.estimateMemoryUsage()
  }

  /**
   * Estimate memory usage of cache
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0

    for (const entry of Array.from(this.memoryCache.values())) {
      // Rough estimation: JSON string length * 2 (for UTF-16)
      totalSize += JSON.stringify(entry).length * 2
    }

    return totalSize
  }

  /**
   * Compress data using zlib (Deflate)
   */

  private async compressData<T>(data: T): Promise<string | T> {
    try {
      const stringData = JSON.stringify(data)
      const compressed = await deflate(stringData)
      return COMPRESSION_PREFIX + compressed.toString('base64')
    } catch (error: unknown) {
      logger.error('Failed to compress data', { error })
      return data // Return original data if compression fails
    }
  }

  /**
   * Decompress data using zlib (Inflate)
   */
  private async decompressData<T>(data: string | T): Promise<T> {
    if (typeof data !== 'string' || !data.startsWith(COMPRESSION_PREFIX)) {
      return data as T // Not compressed or invalid format
    }

    try {
      const base64Data = data.substring(COMPRESSION_PREFIX.length)
      const buffer = Buffer.from(base64Data, 'base64')
      const decompressed = await inflate(buffer)
      return JSON.parse(decompressed.toString()) as T
    } catch (error: unknown) {
      logger.error('Failed to decompress data', { error })
      return data as T // Return original (potentially still compressed) data if decompression fails
    }
  }

  /**
   * Check if data is compressed by looking for the prefix
   */
  private isCompressed(data: unknown): boolean {
    return typeof data === 'string' && data.startsWith(COMPRESSION_PREFIX)
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }

  /**
   * Destroy the cache instance
   */
  async destroy(): Promise<void> {
    this.stopCleanupTimer()
    await this.clear()
    logger.info('BiasDetectionCache destroyed')
  }
}

// =============================================================================
// SPECIALIZED CACHE MANAGERS
// =============================================================================

/**
 * Cache manager for bias analysis results
 */
export class BiasAnalysisCache {
  private cache: BiasDetectionCache

  constructor(config?: Partial<CacheConfig>) {
    this.cache = new BiasDetectionCache({
      maxSize: 500,
      defaultTtl: 60 * 60 * 1000, // 1 hour
      ...config,
    })
  }

  /**
   * Cache bias analysis result
   */
  async cacheAnalysisResult(
    sessionId: string,
    result: BiasAnalysisResult,
  ): Promise<void> {
    const key = `analysis:${sessionId}`
    const tags = [
      'bias-analysis',
      `session:${sessionId}`,
      `alert:${result.alertLevel}`,
    ]

    await this.cache.set(key, result, {
      tags,
      ttl: 2 * 60 * 60 * 1000, // 2 hours for analysis results
    })
  }

  /**
   * Get cached analysis result
   */
  async getAnalysisResult(
    sessionId: string,
  ): Promise<BiasAnalysisResult | null> {
    const key = `analysis:${sessionId}`
    return await this.cache.get<BiasAnalysisResult>(key)
  }

  /**
   * Cache session data for quick access
   */
  async cacheSession(session: TherapeuticSession): Promise<void> {
    const key = `session:${session.sessionId}`
    const tags = [
      'session-data',
      `participant:${session.participantDemographics.age}:${session.participantDemographics.gender}`,
      `scenario:${session.scenario.type}`,
    ]

    await this.cache.set(key, session, { tags })
  }

  /**
   * Get cached session
   */
  async getSession(sessionId: string): Promise<TherapeuticSession | null> {
    const key = `session:${sessionId}`
    return await this.cache.get<TherapeuticSession>(key)
  }

  /**
   * Invalidate analysis results for specific demographics
   */
  async invalidateByDemographics(
    demographics: Partial<ParticipantDemographics>,
  ): Promise<number> {
    const tags: string[] = []

    // Match the tag format used in cacheSession: "participant:age:gender"
    if (demographics.age && demographics.gender) {
      tags.push(`participant:${demographics.age}:${demographics.gender}`)
    }
    if (demographics.age && demographics.ethnicity) {
      tags.push(`participant:${demographics.age}:${demographics.ethnicity}`)
    }
    if (demographics.gender && demographics.ethnicity) {
      tags.push(`participant:${demographics.gender}:${demographics.ethnicity}`)
    }

    // Also support partial matches by checking if any tag contains the demographic value
    let invalidated = 0

    // Invalidate in-memory cache
    for (const [key, entry] of this.cache.getMemoryCacheEntries()) {
      if (entry && entry.tags) {
        let shouldInvalidate = false
        for (const tag of entry.tags) {
          if (tag.startsWith('participant:')) {
            const parts = tag.split(':')
            if (parts.length >= 2) {
              if (demographics.age && parts.includes(demographics.age)) {
                shouldInvalidate = true
              }
              if (demographics.gender && parts.includes(demographics.gender)) {
                shouldInvalidate = true
              }
              if (
                demographics.ethnicity &&
                parts.includes(demographics.ethnicity)
              ) {
                shouldInvalidate = true
              }
            }
          }
        }
        if (shouldInvalidate) {
          await this.cache.delete(key)
          invalidated++
        }
      }
    }

    // Invalidate in Redis
    if (this.cache.isRedisConfigured()) {
      try {
        const keys = await this.cache.getRedisKeys()
        for (const redisKey of keys) {
          const cached = await this.cache.getFromRedisCache(redisKey)
          if (!cached) {
            continue
          }
          let cacheData
          try {
            cacheData = JSON.parse(cached) as unknown
          } catch {
            continue
          }
          if (cacheData.tags) {
            let shouldInvalidate = false
            for (const tag of cacheData.tags) {
              if (tag.startsWith('participant:')) {
                const parts = tag.split(':')
                if (parts.length >= 2) {
                  if (demographics.age && parts.includes(demographics.age)) {
                    shouldInvalidate = true
                  }
                  if (
                    demographics.gender &&
                    parts.includes(demographics.gender)
                  ) {
                    shouldInvalidate = true
                  }
                  if (
                    demographics.ethnicity &&
                    parts.includes(demographics.ethnicity)
                  ) {
                    shouldInvalidate = true
                  }
                }
              }
            }
            if (shouldInvalidate) {
              await this.cache.deleteFromRedisCache(redisKey)
              invalidated++
            }
          }
        }
      } catch {
        // log error if needed
      }
    }

    return invalidated
  }

  getStats(): CacheStats {
    return this.cache.getStats()
  }

  async destroy(): Promise<void> {
    await this.cache.destroy()
  }
}

/**
 * Cache manager for dashboard data
 */
export class DashboardCache {
  private cache: BiasDetectionCache

  constructor(config?: Partial<CacheConfig>) {
    this.cache = new BiasDetectionCache({
      maxSize: 100,
      defaultTtl: 5 * 60 * 1000, // 5 minutes for dashboard data
      ...config,
    })
  }

  /**
   * Cache dashboard data
   */
  async cacheDashboardData(
    userId: string,
    timeRange: string,
    data: DashboardData,
  ): Promise<void> {
    const key = `dashboard:${userId}:${timeRange}`
    const tags = ['dashboard', `user:${userId}`, `timerange:${timeRange}`]

    await this.cache.set(key, data, { tags })
  }

  /**
   * Get cached dashboard data
   */
  async getDashboardData(
    userId: string,
    timeRange: string,
  ): Promise<DashboardData | null> {
    const key = `dashboard:${userId}:${timeRange}`
    return await this.cache.get<DashboardData>(key)
  }

  /**
   * Invalidate dashboard data for user
   */
  async invalidateUserDashboard(userId: string): Promise<number> {
    return await this.cache.invalidateByTags([`user:${userId}`])
  }

  /**
   * Invalidate all dashboard data
   */
  async invalidateAllDashboards(): Promise<number> {
    return await this.cache.invalidateByTags(['dashboard'])
  }

  getStats(): CacheStats {
    return this.cache.getStats()
  }

  async destroy(): Promise<void> {
    await this.cache.destroy()
  }
}

/**
 * Cache manager for reports
 */
export class ReportCache {
  private cache: BiasDetectionCache

  constructor(config?: Partial<CacheConfig>) {
    this.cache = new BiasDetectionCache({
      maxSize: 50,
      defaultTtl: 24 * 60 * 60 * 1000, // 24 hours for reports
      ...config,
    })
  }

  /**
   * Cache report
   */
  async cacheReport(reportId: string, report: BiasReport): Promise<void> {
    const key = `report:${reportId}`
    const tags = ['report', `report:${reportId}`]

    await this.cache.set(key, report, {
      tags,
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days for reports
    })
  }

  /**
   * Get cached report
   */
  async getReport(reportId: string): Promise<BiasReport | null> {
    const key = `report:${reportId}`
    return await this.cache.get<BiasReport>(key)
  }

  /**
   * Invalidate specific report
   */
  async invalidateReport(reportId: string): Promise<number> {
    return await this.cache.invalidateByTags([`report:${reportId}`])
  }

  getStats(): CacheStats {
    return this.cache.getStats()
  }

  async destroy(): Promise<void> {
    await this.cache.destroy()
  }
}

// =============================================================================
// CACHE MANAGER SINGLETON
// =============================================================================

export class CacheManager {
  private static instance: CacheManager | null

  public readonly analysisCache: BiasAnalysisCache
  public readonly dashboardCache: DashboardCache
  public readonly reportCache: ReportCache

  private constructor() {
    this.analysisCache = new BiasAnalysisCache()
    this.dashboardCache = new DashboardCache()
    this.reportCache = new ReportCache()

    logger.info('CacheManager initialized')
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  /**
   * Get combined cache statistics
   */
  getCombinedStats(): {
    analysis: CacheStats
    dashboard: CacheStats
    report: CacheStats
    total: {
      totalEntries: number
      totalMemoryUsage: number
      averageHitRate: number
    }
  } {
    const analysisStats = this.analysisCache.getStats()
    const dashboardStats = this.dashboardCache.getStats()
    const reportStats = this.reportCache.getStats()

    return {
      analysis: analysisStats,
      dashboard: dashboardStats,
      report: reportStats,
      total: {
        totalEntries:
          analysisStats.totalEntries +
          dashboardStats.totalEntries +
          reportStats.totalEntries,
        totalMemoryUsage:
          analysisStats.memoryUsage +
          dashboardStats.memoryUsage +
          reportStats.memoryUsage,
        averageHitRate:
          (analysisStats.hitRate +
            dashboardStats.hitRate +
            reportStats.hitRate) /
          3,
      },
    }
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    await this.analysisCache.destroy()
    await this.dashboardCache.destroy()
    await this.reportCache.destroy()
    logger.info('All caches cleared')
  }

  /**
   * Destroy cache manager
   */
  async destroy(): Promise<void> {
    await this.analysisCache.destroy()
    await this.dashboardCache.destroy()
    await this.reportCache.destroy()
    CacheManager.instance = null
    logger.info('CacheManager destroyed')
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Get the global cache manager instance
 */
export function getCacheManager(): CacheManager {
  return CacheManager.getInstance()
}

/**
 * Reset cache manager (for testing)
 */
export async function resetCacheManager(): Promise<void> {
  const instance = CacheManager.getInstance()
  if (instance) {
    await instance.destroy()
  }
}
/**
 * Cache a bias analysis result
 */
export async function cacheAnalysisResult(
  sessionId: string,
  result: BiasAnalysisResult,
): Promise<void> {
  const cacheManager = getCacheManager()
  await cacheManager.analysisCache.cacheAnalysisResult(sessionId, result)
}

/**
 * Get cached bias analysis result
 */
export async function getCachedAnalysisResult(
  sessionId: string,
): Promise<BiasAnalysisResult | null> {
  const cacheManager = getCacheManager()
  return await cacheManager.analysisCache.getAnalysisResult(sessionId)
}

/**
 * Cache dashboard data
 */
export async function cacheDashboardData(
  userId: string,
  timeRange: string,
  data: DashboardData,
): Promise<void> {
  const cacheManager = getCacheManager()
  await cacheManager.dashboardCache.cacheDashboardData(userId, timeRange, data)
}

/**
 * Get cached dashboard data
 */
export async function getCachedDashboardData(
  userId: string,
  timeRange: string,
): Promise<DashboardData | null> {
  const cacheManager = getCacheManager()
  return await cacheManager.dashboardCache.getDashboardData(userId, timeRange)
}

/**
 * Cache a report
 */
export async function cacheReport(
  reportId: string,
  report: BiasReport,
): Promise<void> {
  const cacheManager = getCacheManager()
  await cacheManager.reportCache.cacheReport(reportId, report)
}

/**
 * Get cached report
 */
export async function getCachedReport(
  reportId: string,
): Promise<BiasReport | null> {
  const cacheManager = getCacheManager()
  return await cacheManager.reportCache.getReport(reportId)
}
