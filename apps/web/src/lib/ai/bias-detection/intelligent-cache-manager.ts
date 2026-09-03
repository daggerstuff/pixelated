/**
 * Intelligent cache manager with compression and TTL.
 */

import { getCacheService } from '../../services/cacheService'
import type { PerformanceOptimizerConfig } from './performance-optimizer.types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
const logger = createBuildSafeLogger('PerformanceOptimizer')

/**
 * Intelligent Cache Manager with Compression
 */
export class IntelligentCacheManager {
  private readonly cacheService = getCacheService()
  private readonly config: PerformanceOptimizerConfig['cache']
  private readonly stats = {
    hits: 0,
    misses: 0,
    compressionSaved: 0,
    totalSize: 0,
  }

  constructor(config: PerformanceOptimizerConfig['cache']) {
    this.config = config
  }

  /**
   * Get value from cache with automatic decompression
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.cacheService.get(key)

      if (cached === null) {
        this.stats.misses++
        return null
      }

      this.stats.hits++

      // Check if data is compressed
      if (this.isCompressed(cached)) {
        return this.decompress(cached) as T
      }

      return JSON.parse(cached) as T
    } catch (error: unknown) {
      logger.error('Cache get error', { key, error })
      this.stats.misses++
      return null
    }
  }

  /**
   * Set value in cache with automatic compression
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      const size = Buffer.byteLength(serialized, 'utf8')

      let dataToStore = serialized

      // Compress if enabled and data exceeds threshold
      if (
        this.config.enableCompression &&
        size > this.config.compressionThreshold
      ) {
        const compressed = await this.compress(serialized)
        if (compressed.length < size) {
          dataToStore = compressed
          this.stats.compressionSaved += size - compressed.length
        }
      }

      await this.cacheService.set(
        key,
        dataToStore,
        ttl ?? this.config.defaultTtl,
      )
      this.stats.totalSize += Buffer.byteLength(dataToStore, 'utf8')
    } catch (error: unknown) {
      logger.error('Cache set error', { key, error })
    }
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<Record<string, T | null>> {
    try {
      const results = await this.cacheService.mget(keys)
      const processed: Record<string, T | null> = {}

      for (const [key, value] of Object.entries(results)) {
        if (value === null) {
          this.stats.misses++
          processed[key] = null
        } else {
          this.stats.hits++
          try {
            if (this.isCompressed(value)) {
              processed[key] = this.decompress(value) as T
            } else {
              processed[key] = JSON.parse(value) as T
            }
          } catch {
            processed[key] = null
          }
        }
      }

      return processed
    } catch (error: unknown) {
      logger.error('Cache mget error', { keys, error })
      return keys.reduce((acc, key) => ({ ...acc, [key]: null }), {})
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0

    return {
      hitRate,
      missRate: 100 - hitRate,
      hits: this.stats.hits,
      misses: this.stats.misses,
      compressionSaved: this.stats.compressionSaved,
      totalSize: this.stats.totalSize,
      compressionRatio:
        this.stats.compressionSaved > 0
          ? (this.stats.compressionSaved / this.stats.totalSize) * 100
          : 0,
    }
  }

  private isCompressed(data: string): boolean {
    return data.startsWith('GZIP:')
  }

  private async compress(data: string): Promise<string> {
    // Simple compression simulation - in production use zlib
    const compressed = Buffer.from(data).toString('base64')
    return `GZIP:${compressed}`
  }

  private decompress(data: string): unknown {
    // Simple decompression simulation - in production use zlib
    const compressed = data.replace('GZIP:', '')
    const decompressed = Buffer.from(compressed, 'base64').toString('utf8')
    return JSON.parse(decompressed) as unknown
  }
}
