/**
 * Intelligent Caching System for Bias Detection Results
 * Implements multi-tier caching with compression and smart invalidation
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type { TherapeuticSession } from './types'

const logger = createBuildSafeLogger('IntelligentCache')

export interface CacheConfig {
  memoryTtl: number // Memory cache TTL in ms
  redisTtl: number // Redis cache TTL in ms
  maxMemorySize: number // Max memory cache size in MB
  compressionThreshold: number // Compress items larger than this (bytes)
  enableCompression: boolean
  enableRedis: boolean
}

export interface CacheEntry<T = unknown> {
  key: string
  value: T
  timestamp: Date
  expiresAt: Date
  accessCount: number
  lastAccessed: Date
  size: number // Size in bytes
  compressed: boolean
  tags: string[]
}

export interface CacheStats {
  memoryHits: number
  memoryMisses: number
  redisHits: number
  redisMisses: number
  totalSize: number
  entryCount: number
  compressionRatio: number
  hitRate: number
}

export class IntelligentCache {
  private memoryCache = new Map<string, CacheEntry>()
  private stats: CacheStats = {
    memoryHits: 0,
    memoryMisses: 0,
    redisHits: 0,
    redisMisses: 0,
    totalSize: 0,
    entryCount: 0,
    compressionRatio: 1,
    hitRate: 0,
  }
  private config: CacheConfig
  private redis?: { get(key: string): Promise<string | null>; setex(key: string, seconds: number, value: string): Promise<void> } // Minimal Redis client typing

  constructor(config: Partial<CacheConfig> = {}, redisClient?: { get(key: string): Promise<string | null>; setex(key: string, seconds: number, value: string): Promise<void> }) {
    this.config = {
      memoryTtl: 300000, // 5 minutes
      redisTtl: 3600000, // 1 hour
      maxMemorySize: 100, // 100MB
      compressionThreshold: 1024, // 1KB
      enableCompression: true,
      enableRedis: false,
      ...config,
    }
    this.redis = redisClient

    // Cleanup expired entries periodically
    setInterval(() => this.cleanup(), 60000)
  }

  async get<T>(key: string): Promise<T | null> {
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key)
    if (memoryEntry && memoryEntry.expiresAt > new Date()) {
      memoryEntry.accessCount++
      memoryEntry.lastAccessed = new Date()
      this.stats.memoryHits++
      this.updateHitRate()
      
      logger.debug(`Memory cache hit for key: ${key}`)
      return this.deserializeValue(memoryEntry.value, memoryEntry.compressed) as T
    }

    if (memoryEntry) {
      this.memoryCache.delete(key)
    }

    // Try Redis cache if enabled
    if (this.config.enableRedis && this.redis) {
      try {
        const redisValue = await this.redis.get(key)
        if (redisValue) {
          const parsed = JSON.parse(redisValue) as any
          const value = this.deserializeValue(parsed.value, parsed.compressed)
          
          // Store back in memory cache
          this.setMemoryCache(key, value, parsed.tags || [])
          
          this.stats.redisHits++
          this.updateHitRate()
          
          logger.debug(`Redis cache hit for key: ${key}`)
          return value as T
        }
      } catch (error: unknown) {
        logger.warn(`Redis cache error for key ${key}:`, error)
      }
    }

    // Cache miss
    this.stats.memoryMisses++
    if (this.config.enableRedis) {
      this.stats.redisMisses++
    }
    this.updateHitRate()
    
    logger.debug(`Cache miss for key: ${key}`)
    return null
  }

  async set<T>(key: string, value: T, tags: string[] = []): Promise<void> {
    // Store in memory cache
    this.setMemoryCache(key, value, tags)

    // Store in Redis if enabled
    if (this.config.enableRedis && this.redis) {
      try {
        const serialized = this.serializeValue(value)
        const cacheData = {
          value: serialized.value,
          compressed: serialized.compressed,
          tags,
          timestamp: new Date().toISOString(),
        }
        
        await this.redis.setex(
          key,
          Math.floor(this.config.redisTtl / 1000),
          JSON.stringify(cacheData)
        )
        
        logger.debug(`Stored in Redis cache: ${key}`)
      } catch (error: unknown) {
        logger.warn(`Redis cache set error for key ${key}:`, error)
      }
    }
  }

  private setMemoryCache<T>(key: string, value: T, tags: string[]): void {
    const serialized = this.serializeValue(value)
    const now = new Date()
    
    const entry: CacheEntry<T> = {
      key,
      value: serialized.value as T,
      timestamp: now,
      expiresAt: new Date(now.getTime() + this.config.memoryTtl),
      accessCount: 1,
      lastAccessed: now,
      size: serialized.size,
      compressed: serialized.compressed,
      tags,
    }

    // Check memory limit
    this.enforceMemoryLimit()
    
    this.memoryCache.set(key, entry)
    this.stats.entryCount++
    this.stats.totalSize += entry.size
    
    logger.debug(`Stored in memory cache: ${key} (${entry.size} bytes, compressed: ${entry.compressed})`)
  }

  private serializeValue<T>(value: T): { value: T | string; size: number; compressed: boolean } {
    const jsonString = JSON.stringify(value)
    const size = new Blob([jsonString]).size

    if (this.config.enableCompression && size > this.config.compressionThreshold) {
      try {
        // In a real implementation, you'd use a compression library like pako
        // For now, we'll simulate compression
        const compressed = this.compress(jsonString)
        const compressedSize = new Blob([compressed]).size
        
        this.stats.compressionRatio = size / compressedSize
        
        return {
          value: compressed,
          size: compressedSize,
          compressed: true,
        }
      } catch (error: unknown) {
        logger.warn('Compression failed, storing uncompressed:', error)
      }
    }

    return {
      value,
      size,
      compressed: false,
    }
  }

  private deserializeValue<T>(value: T | string, compressed: boolean): T {
    if (compressed && typeof value === 'string') {
      try {
        const decompressed = this.decompress(value)
        return JSON.parse(decompressed) as any
      } catch (error: unknown) {
        logger.warn('Decompression failed:', error)
        throw error
      }
    }
    return value as T
  }

  private compress(data: string): string {
    // Placeholder for actual compression (e.g., using pako)
    // In production, you'd use: pako.deflate(data, { to: 'string' })
    return btoa(data) // Simple base64 encoding as placeholder
  }

  private decompress(data: string): string {
    // Placeholder for actual decompression
    // In production, you'd use: pako.inflate(data, { to: 'string' })
    return atob(data) // Simple base64 decoding as placeholder
  }

  private enforceMemoryLimit() {
    const maxSizeBytes = this.config.maxMemorySize * 1024 * 1024
    
    while (this.stats.totalSize > maxSizeBytes && this.memoryCache.size > 0) {
      // Remove least recently used entry
      let oldestKey = ''
      let oldestTime = new Date()
      
      for (const [key, entry] of this.memoryCache) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed
          oldestKey = key
        }
      }
      
      if (oldestKey) {
        const entry = this.memoryCache.get(oldestKey)!
        this.memoryCache.delete(oldestKey)
        this.stats.totalSize -= entry.size
        this.stats.entryCount--
        
        logger.debug(`Evicted cache entry: ${oldestKey}`)
      }
    }
  }

  private cleanup() {
    const now = new Date()
    const toDelete: string[] = []
    
    for (const [key, entry] of this.memoryCache) {
      if (entry.expiresAt <= now) {
        toDelete.push(key)
        this.stats.totalSize -= entry.size
        this.stats.entryCount--
      }
    }
    
    toDelete.forEach(key => {
      this.memoryCache.delete(key)
      logger.debug(`Cleaned up expired cache entry: ${key}`)
    })
  }

  private updateHitRate() {
    const totalRequests = this.stats.memoryHits + this.stats.memoryMisses + 
                         this.stats.redisHits + this.stats.redisMisses
    const totalHits = this.stats.memoryHits + this.stats.redisHits
    
    this.stats.hitRate = totalRequests > 0 ? totalHits / totalRequests : 0
  }

  // Generate cache key for session analysis
  generateSessionKey(session: TherapeuticSession): string {
    const demographics = JSON.stringify(session.participantDemographics)
    const content = JSON.stringify(session.content)
    const scenario = JSON.stringify(session.scenario)
    
    // Create hash of the content for consistent keys
    const hash = this.simpleHash(demographics + content + scenario)
    return `session_analysis:${hash}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  // Invalidate cache entries by tags
  async invalidateByTags(tags: string[]): Promise<void> {
    const toDelete: string[] = []
    
    for (const [key, entry] of this.memoryCache) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        toDelete.push(key)
        this.stats.totalSize -= entry.size
        this.stats.entryCount--
      }
    }
    
    toDelete.forEach(key => {
      this.memoryCache.delete(key)
      logger.debug(`Invalidated cache entry by tag: ${key}`)
    })

    // Also invalidate in Redis if enabled
    if (this.config.enableRedis && this.redis) {
      // This would require a more sophisticated Redis setup with tag indexing
      logger.debug(`Tag-based invalidation in Redis not implemented`)
    }
  }

  getStats(): CacheStats {
    return { ...this.stats }
  }

  clear() {
    this.memoryCache.clear()
    this.stats = {
      memoryHits: 0,
      memoryMisses: 0,
      redisHits: 0,
      redisMisses: 0,
      totalSize: 0,
      entryCount: 0,
      compressionRatio: 1,
      hitRate: 0,
    }
    
    logger.info('Cache cleared')
  }
}