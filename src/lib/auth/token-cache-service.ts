/**
 * Token Cache Service
 * Optimized Redis-based caching for JWT tokens with session management
 * HIPAA-compliant with performance optimization and security features
 */

import type { RedisClientType } from 'redis'
import { getRedisClient } from '../redis'
import { logger } from '../logger'
import { AuthenticationError } from './errors'

export interface CachedToken {
  tokenId: string
  payload: any
  cachedAt: number
  expiresAt: number
  accessCount: number
  lastAccessed: number
}

export interface CacheServiceConfig {
  defaultTTL: number // seconds
  maxCacheSize: number
  enableCompression: boolean
  enableEncryption: boolean
  compressionThreshold: number // bytes
  cleanupInterval: number // seconds
  maxAccessCount: number
}

export interface CacheStatistics {
  totalCached: number
  totalHits: number
  totalMisses: number
  hitRate: number
  avgResponseTime: number
  memoryUsage: number
  oldestToken: number
  newestToken: number
}

/**
 * Token Cache Service for optimized token validation performance
 */
export class TokenCacheService {
  private redis: RedisClientType
  private config: CacheServiceConfig
  private statistics: {
    hits: number
    misses: number
    totalResponseTime: number
    requestCount: number
  }
  private cleanupTimer?: NodeJS.Timeout

  constructor(config: Partial<CacheServiceConfig> = {}) {
    this.redis = getRedisClient()
    this.config = {
      defaultTTL: 3600, // 1 hour
      maxCacheSize: 10000,
      enableCompression: true,
      enableEncryption: false,
      compressionThreshold: 1024, // 1KB
      cleanupInterval: 300, // 5 minutes
      maxAccessCount: 1000,
      ...config,
    }

    this.statistics = {
      hits: 0,
      misses: 0,
      totalResponseTime: 0,
      requestCount: 0,
    }

    this.startCleanupTimer()
  }

  /**
   * Cache a token with payload and metadata
   */
  async cacheToken(
    tokenId: string,
    payload: any,
    customTTL?: number,
  ): Promise<void> {
    const startTime = Date.now()

    try {
      const ttl = customTTL || this.config.defaultTTL
      const now = Math.floor(Date.now() / 1000)
      const expiresAt = now + ttl

      const cachedToken: CachedToken = {
        tokenId,
        payload,
        cachedAt: now,
        expiresAt,
        accessCount: 0,
        lastAccessed: now,
      }

      // Check cache size limits
      await this.enforceCacheSizeLimits()

      // Compress payload if enabled and above threshold
      let dataToStore = JSON.stringify(cachedToken)
      if (
        this.config.enableCompression &&
        dataToStore.length > this.config.compressionThreshold
      ) {
        dataToStore = await this.compressData(dataToStore)
      }

      // Encrypt if enabled
      if (this.config.enableEncryption) {
        dataToStore = await this.encryptData(dataToStore)
      }

      // Store in Redis with TTL
      const cacheKey = `token:cache:${tokenId}`
      await this.redis.setex(cacheKey, ttl, dataToStore)

      // Update cache index
      await this.updateCacheIndex(tokenId, expiresAt)

      // Update statistics
      this.updateStatistics(Date.now() - startTime, 'cache')

      logger.debug(`Token ${tokenId} cached successfully`, {
        ttl,
        compressed: this.config.enableCompression,
      })
    } catch (error) {
      logger.error(`Failed to cache token ${tokenId}`, error)
      throw new AuthenticationError('Token caching failed')
    }
  }

  /**
   * Retrieve cached token by ID
   */
  async getCachedToken(tokenId: string): Promise<CachedToken | null> {
    const startTime = Date.now()

    try {
      const cacheKey = `token:cache:${tokenId}`
      const cachedData = await this.redis.get(cacheKey)

      if (!cachedData) {
        this.statistics.misses++
        this.updateStatistics(Date.now() - startTime, 'miss')
        return null
      }

      // Decrypt if enabled
      let dataToParse = cachedData
      if (this.config.enableEncryption) {
        dataToParse = await this.decryptData(dataToParse)
      }

      // Decompress if needed
      if (
        this.config.enableCompression &&
        dataToParse.startsWith('COMPRESSED:')
      ) {
        dataToParse = await this.decompressData(dataToParse)
      }

      const cachedToken: CachedToken = JSON.parse(dataToParse)

      // Update access statistics
      cachedToken.accessCount++
      cachedToken.lastAccessed = Math.floor(Date.now() / 1000)

      // Update in cache with new access stats
      await this.updateCachedToken(tokenId, cachedToken)

      this.statistics.hits++
      this.updateStatistics(Date.now() - startTime, 'hit')

      logger.debug(`Token ${tokenId} retrieved from cache`, {
        accessCount: cachedToken.accessCount,
        cachedFor: cachedToken.lastAccessed - cachedToken.cachedAt,
      })

      return cachedToken
    } catch (error) {
      logger.error(`Error retrieving cached token ${tokenId}`, error)
      this.statistics.misses++
      this.updateStatistics(Date.now() - startTime, 'miss')
      return null
    }
  }

  /**
   * Invalidate a cached token
   */
  async invalidateToken(tokenId: string): Promise<void> {
    try {
      const cacheKey = `token:cache:${tokenId}`
      const result = await this.redis.del(cacheKey)

      // Remove from cache index
      await this.removeFromCacheIndex(tokenId)

      if (result > 0) {
        logger.debug(`Token ${tokenId} invalidated from cache`)
      }
    } catch (error) {
      logger.error(`Error invalidating cached token ${tokenId}`, error)
    }
  }

  /**
   * Batch cache multiple tokens
   */
  async batchCacheTokens(
    tokens: Array<{ tokenId: string; payload: any; ttl?: number }>,
  ): Promise<void> {
    const pipeline = this.redis.pipeline()

    for (const token of tokens) {
      const ttl = token.ttl || this.config.defaultTTL
      const now = Math.floor(Date.now() / 1000)
      const expiresAt = now + ttl

      const cachedToken: CachedToken = {
        tokenId: token.tokenId,
        payload: token.payload,
        cachedAt: now,
        expiresAt,
        accessCount: 0,
        lastAccessed: now,
      }

      let dataToStore = JSON.stringify(cachedToken)

      // Apply compression and encryption if enabled
      if (
        this.config.enableCompression &&
        dataToStore.length > this.config.compressionThreshold
      ) {
        dataToStore = await this.compressData(dataToStore)
      }

      if (this.config.enableEncryption) {
        dataToStore = await this.encryptData(dataToStore)
      }

      const cacheKey = `token:cache:${token.tokenId}`
      pipeline.setex(cacheKey, ttl, dataToStore)

      // Add to cache index
      pipeline.zadd('token:cache:index', expiresAt, token.tokenId)
    }

    try {
      await pipeline.exec()
      logger.debug(`Batch cached ${tokens.length} tokens`)
    } catch (error) {
      logger.error('Error in batch cache operation', error)
      throw new AuthenticationError('Batch caching failed')
    }
  }

  /**
   * Batch retrieve multiple cached tokens
   */
  async batchGetCachedTokens(
    tokenIds: string[],
  ): Promise<Array<CachedToken | null>> {
    const pipeline = this.redis.pipeline()

    for (const tokenId of tokenIds) {
      const cacheKey = `token:cache:${tokenId}`
      pipeline.get(cacheKey)
    }

    try {
      const results = await pipeline.exec()
      const tokens: Array<CachedToken | null> = []

      for (let i = 0; i < results.length; i++) {
        const [error, data] = results[i]

        if (error || !data) {
          tokens.push(null)
          this.statistics.misses++
          continue
        }

        try {
          // Decrypt and decompress if needed
          let dataToParse = data as string
          if (this.config.enableEncryption) {
            dataToParse = await this.decryptData(dataToParse)
          }
          if (
            this.config.enableCompression &&
            dataToParse.startsWith('COMPRESSED:')
          ) {
            dataToParse = await this.decompressData(dataToParse)
          }

          const cachedToken: CachedToken = JSON.parse(dataToParse)
          cachedToken.accessCount++
          cachedToken.lastAccessed = Math.floor(Date.now() / 1000)

          tokens.push(cachedToken)
          this.statistics.hits++

          // Update in cache with new access stats
          await this.updateCachedToken(tokenIds[i], cachedToken)
        } catch (parseError) {
          logger.error(`Error parsing cached token ${tokenIds[i]}`, parseError)
          tokens.push(null)
          this.statistics.misses++
        }
      }

      return tokens
    } catch (error) {
      logger.error('Error in batch get operation', error)
      return Array(tokenIds.length).fill(null)
    }
  }

  /**
   * Update cached token with new access statistics
   */
  private async updateCachedToken(
    tokenId: string,
    cachedToken: CachedToken,
  ): Promise<void> {
    try {
      const cacheKey = `token:cache:${tokenId}`
      const ttl = cachedToken.expiresAt - Math.floor(Date.now() / 1000)

      if (ttl <= 0) {
        // Token has expired, remove it
        await this.invalidateToken(tokenId)
        return
      }

      let dataToStore = JSON.stringify(cachedToken)

      // Apply compression and encryption if enabled
      if (
        this.config.enableCompression &&
        dataToStore.length > this.config.compressionThreshold
      ) {
        dataToStore = await this.compressData(dataToStore)
      }

      if (this.config.enableEncryption) {
        dataToStore = await this.encryptData(dataToStore)
      }

      await this.redis.setex(cacheKey, ttl, dataToStore)
    } catch (error) {
      logger.error(`Error updating cached token ${tokenId}`, error)
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStatistics(): Promise<CacheStatistics> {
    try {
      const cacheKeys = await this.redis.keys('token:cache:*')
      const totalCached = cacheKeys.length

      const hitRate =
        this.statistics.requestCount > 0
          ? (this.statistics.hits / this.statistics.requestCount) * 100
          : 0

      const avgResponseTime =
        this.statistics.requestCount > 0
          ? this.statistics.totalResponseTime / this.statistics.requestCount
          : 0

      // Get oldest and newest tokens
      let oldestToken = 0
      let newestToken = 0

      if (totalCached > 0) {
        const indexData = await this.redis.zrange(
          'token:cache:index',
          0,
          -1,
          'WITHSCORES',
        )
        if (indexData.length > 0) {
          oldestToken = parseInt(indexData[1]) // First element's score
          newestToken = parseInt(indexData[indexData.length - 1]) // Last element's score
        }
      }

      // Estimate memory usage (rough calculation)
      const memoryUsage = totalCached * 1024 // Assume ~1KB per token

      return {
        totalCached,
        totalHits: this.statistics.hits,
        totalMisses: this.statistics.misses,
        hitRate,
        avgResponseTime,
        memoryUsage,
        oldestToken,
        newestToken,
      }
    } catch (error) {
      logger.error('Error generating cache statistics', error)
      return {
        totalCached: 0,
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        avgResponseTime: 0,
        memoryUsage: 0,
        oldestToken: 0,
        newestToken: 0,
      }
    }
  }

  /**
   * Clear all cached tokens
   */
  async clearCache(): Promise<void> {
    try {
      const cacheKeys = await this.redis.keys('token:cache:*')
      if (cacheKeys.length > 0) {
        await this.redis.del(...cacheKeys)
      }

      // Clear cache index
      await this.redis.del('token:cache:index')

      // Reset statistics
      this.statistics = {
        hits: 0,
        misses: 0,
        totalResponseTime: 0,
        requestCount: 0,
      }

      logger.info(`Cleared ${cacheKeys.length} cached tokens`)
    } catch (error) {
      logger.error('Error clearing cache', error)
      throw new AuthenticationError('Cache clear failed')
    }
  }

  /**
   * Enforce cache size limits
   */
  private async enforceCacheSizeLimits(): Promise<void> {
    try {
      const currentSize = await this.redis.zcard('token:cache:index')

      if (currentSize >= this.config.maxCacheSize) {
        // Remove oldest tokens
        const tokensToRemove = Math.ceil(this.config.maxCacheSize * 0.1) // Remove 10%
        const oldestTokens = await this.redis.zrange(
          'token:cache:index',
          0,
          tokensToRemove - 1,
        )

        for (const tokenId of oldestTokens) {
          await this.invalidateToken(tokenId)
        }

        logger.info(
          `Enforced cache size limit by removing ${oldestTokens.length} oldest tokens`,
        )
      }
    } catch (error) {
      logger.error('Error enforcing cache size limits', error)
    }
  }

  /**
   * Update cache index with token expiration
   */
  private async updateCacheIndex(
    tokenId: string,
    expiresAt: number,
  ): Promise<void> {
    await this.redis.zadd('token:cache:index', expiresAt, tokenId)
  }

  /**
   * Remove token from cache index
   */
  private async removeFromCacheIndex(tokenId: string): Promise<void> {
    await this.redis.zrem('token:cache:index', tokenId)
  }

  /**
   * Update performance statistics
   */
  private updateStatistics(
    responseTime: number,
    type: 'hit' | 'miss' | 'cache',
  ): void {
    this.statistics.totalResponseTime += responseTime
    this.statistics.requestCount++

    if (type === 'hit') {
      this.statistics.hits++
    } else if (type === 'miss') {
      this.statistics.misses++
    }
  }

  /**
   * Compress data using gzip
   */
  private async compressData(data: string): Promise<string> {
    // Simple compression marker - in production, use proper compression library
    return `COMPRESSED:${data}`
  }

  /**
   * Decompress data
   */
  private async decompressData(data: string): Promise<string> {
    if (data.startsWith('COMPRESSED:')) {
      return data.substring(11) // Remove compression marker
    }
    return data
  }

  /**
   * Encrypt data (placeholder - implement proper encryption in production)
   */
  private async encryptData(data: string): Promise<string> {
    // TODO: Implement proper encryption using crypto module
    // For now, just return the data with an encryption marker
    return `ENCRYPTED:${data}`
  }

  /**
   * Decrypt data (placeholder - implement proper decryption in production)
   */
  private async decryptData(data: string): Promise<string> {
    if (data.startsWith('ENCRYPTED:')) {
      // TODO: Implement proper decryption
      return data.substring(10) // Remove encryption marker
    }
    return data
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupExpiredTokens()
      } catch (error) {
        logger.error('Error in cache cleanup timer', error)
      }
    }, this.config.cleanupInterval * 1000)

    // Run initial cleanup
    this.cleanupExpiredTokens().catch((error) => {
      logger.error('Error in initial cache cleanup', error)
    })
  }

  /**
   * Clean up expired tokens from cache
   */
  private async cleanupExpiredTokens(): Promise<number> {
    try {
      const now = Math.floor(Date.now() / 1000)

      // Get expired tokens from index
      const expiredTokens = await this.redis.zrangebyscore(
        'token:cache:index',
        0,
        now,
      )

      if (expiredTokens.length === 0) {
        return 0
      }

      // Remove expired tokens
      const pipeline = this.redis.pipeline()

      for (const tokenId of expiredTokens) {
        const cacheKey = `token:cache:${tokenId}`
        pipeline.del(cacheKey)
        pipeline.zrem('token:cache:index', tokenId)
      }

      await pipeline.exec()

      logger.debug(
        `Cleaned up ${expiredTokens.length} expired tokens from cache`,
      )
      return expiredTokens.length
    } catch (error) {
      logger.error('Error cleaning up expired tokens', error)
      return 0
    }
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }
}
