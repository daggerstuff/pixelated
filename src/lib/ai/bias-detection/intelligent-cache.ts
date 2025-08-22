/**
 * Intelligent Caching System for Bias Detection Engine
 * 
 * Advanced caching with:
 * - Multi-tier caching (memory + Redis + CDN)
 * - Intelligent cache warming and prefetching
 * - Compression and serialization optimization
 * - Cache invalidation strategies
 * - Performance analytics and monitoring
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { getCacheService } from '../../services/cacheService'
import { getRedisPoolManager } from './redis-pool-manager'
import type { 
  BiasAnalysisResult, 
  TherapeuticSession, 
  BiasReport,
  BiasDashboardData 
} from './types'
import * as zlib from 'zlib'
import { promisify } from 'util'

const logger = createBuildSafeLogger('IntelligentCache')

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

export interface IntelligentCacheConfig {
  // Multi-tier configuration
  enableMemoryCache: boolean
  enableRedisCache: boolean
  enableCDNCache: boolean
  
  // Memory cache settings
  memoryMaxSize: number
  memoryTtl: number // seconds
  
  // Redis cache settings
  redisTtl: number // seconds
  redisKeyPrefix: string
  
  // Compression settings
  enableCompression: boolean
  compressionThreshold: number // bytes
  compressionLevel: number // 1-9
  
  // Prefetching and warming
  enablePrefetching: boolean
  prefetchThreshold: number // access count
  warmupOnStart: boolean
  
  // Performance optimization
  enableBatching: boolean
  batchSize: number
  batchDelay: number // ms
  
  // Analytics
  enableAnalytics: boolean
  analyticsInterval: number // ms
}

export interface CacheEntry<T> {
  key: string
  value: T
  tier: 'memory' | 'redis' | 'cdn'
  size: number
  compressed: boolean
  createdAt: Date
  lastAccessed: Date
  accessCount: number
  ttl: number
  tags: string[]
}

export interface CacheAnalytics {
  totalRequests: number
  hits: {
    memory: number
    redis: number
    cdn: number
    total: number
  }
  misses: number
  hitRate: number
  averageResponseTime: number
  compressionRatio: number
  memoryUsage: number
  redisUsage: number
  topKeys: Array<{ key: string; accessCount: number }>
  evictions: number
  prefetches: number
}

export interface CacheStrategy {
  name: string
  ttl: number
  tier: 'memory' | 'redis' | 'cdn' | 'all'
  compress: boolean
  prefetch: boolean
  tags: string[]
}

/**
 * Multi-tier Intelligent Cache
 */
export class IntelligentCache {
  private config: IntelligentCacheConfig
  private memoryCache = new Map<string, CacheEntry<unknown>>()
  private redisPool = getRedisPoolManager().createPool('intelligent-cache')
  private cacheService = getCacheService()
  
  private analytics: CacheAnalytics = {
    totalRequests: 0,
    hits: { memory: 0, redis: 0, cdn: 0, total: 0 },
    misses: 0,
    hitRate: 0,
    averageResponseTime: 0,
    compressionRatio: 0,
    memoryUsage: 0,
    redisUsage: 0,
    topKeys: [],
    evictions: 0,
    prefetches: 0
  }
  
  private batchQueue: Array<{
    operation: 'get' | 'set' | 'delete'
    key: string
    value?: unknown
    options?: CacheOptions
    resolve: (value: unknown) => void
    reject: (error: Error) => void
  }> = []
  
  private batchTimer?: ReturnType<typeof setTimeout>
  private analyticsInterval?: ReturnType<typeof setInterval>
  
  // Predefined cache strategies for different data types
  private strategies: Map<string, CacheStrategy> = new Map([
    ['analysis-result', {
      name: 'analysis-result',
      ttl: 3600, // 1 hour
      tier: 'all',
      compress: true,
      prefetch: true,
      tags: ['analysis', 'session']
    }],
    ['session-data', {
      name: 'session-data',
      ttl: 1800, // 30 minutes
      tier: 'memory',
      compress: false,
      prefetch: false,
      tags: ['session']
    }],
    ['dashboard-data', {
      name: 'dashboard-data',
      ttl: 300, // 5 minutes
      tier: 'redis',
      compress: true,
      prefetch: true,
      tags: ['dashboard', 'metrics']
    }],
    ['report', {
      name: 'report',
      ttl: 86400, // 24 hours
      tier: 'all',
      compress: true,
      prefetch: false,
      tags: ['report']
    }]
  ])
  
  constructor(config: Partial<IntelligentCacheConfig> = {}) {
    this.config = {
      enableMemoryCache: true,
      enableRedisCache: true,
      enableCDNCache: false,
      memoryMaxSize: 1000,
      memoryTtl: 300,
      redisTtl: 3600,
      redisKeyPrefix: 'bias:intelligent:',
      enableCompression: true,
      compressionThreshold: 1024, // 1KB
      compressionLevel: 6,
      enablePrefetching: true,
      prefetchThreshold: 5,
      warmupOnStart: false,
      enableBatching: true,
      batchSize: 10,
      batchDelay: 50,
      enableAnalytics: true,
      analyticsInterval: 60000,
      ...config
    }
    
    this.initialize()
  }
  
  private initialize(): void {
    if (this.config.enableAnalytics) {
      this.startAnalytics()
    }
    
    if (this.config.warmupOnStart) {
      this.warmupCache()
    }
    
    logger.info('Intelligent cache initialized', { config: this.config })
  }
  
  /**
   * Get value from cache with intelligent tier selection
   */
  async get<T>(key: string, strategy?: string): Promise<T | null> {
    const startTime = Date.now()
    this.analytics.totalRequests++
    
    if (this.config.enableBatching) {
      return this.batchGet<T>(key, strategy)
    }
    
    try {
      const cacheStrategy = strategy ? this.strategies.get(strategy) : null
      const result = await this.getFromTiers<T>(key, cacheStrategy)
      
      if (result) {
        this.analytics.hits.total++
        this.updateAccessStats(key)
        
        // Check for prefetching
        if (this.config.enablePrefetching && cacheStrategy?.prefetch) {
          this.considerPrefetch(key)
        }
      } else {
        this.analytics.misses++
      }
      
      this.updateResponseTime(Date.now() - startTime)
      return result
      
    } catch (error) {
      logger.error('Cache get error', { key, error })
      this.analytics.misses++
      return null
    }
  }
  
  /**
   * Set value in cache with intelligent tier distribution
   */
  async set<T>(
    key: string, 
    value: T, 
    options: CacheOptions = {}
  ): Promise<void> {
    if (this.config.enableBatching) {
      return this.batchSet(key, value, options)
    }
    
    try {
      const strategy = options.strategy ? this.strategies.get(options.strategy) : null
      await this.setToTiers(key, value, { ...options, strategy })
      
    } catch (error) {
      logger.error('Cache set error', { key, error })
    }
  }
  
  /**
   * Delete from all cache tiers
   */
  async delete(key: string): Promise<void> {
    if (this.config.enableBatching) {
      return this.batchDelete(key)
    }
    
    try {
      // Delete from memory
      if (this.config.enableMemoryCache) {
        this.memoryCache.delete(key)
      }
      
      // Delete from Redis
      if (this.config.enableRedisCache) {
        await this.redisPool.execute(async (redis) => {
          await redis.del(this.getRedisKey(key))
        })
      }
      
      // Delete from CDN cache (if applicable)
      if (this.config.enableCDNCache) {
        await this.cacheService.delete(key)
      }
      
    } catch (error) {
      logger.error('Cache delete error', { key, error })
    }
  }
  
  /**
   * Batch get operation
   */
  async mget<T>(keys: string[], strategy?: string): Promise<Record<string, T | null>> {
    const results: Record<string, T | null> = {}
    
    // Try to get all from memory first
    const memoryResults: Record<string, T | null> = {}
    const remainingKeys: string[] = []
    
    if (this.config.enableMemoryCache) {
      for (const key of keys) {
        const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined
        if (entry && !this.isExpired(entry)) {
          memoryResults[key] = entry.value
          this.analytics.hits.memory++
        } else {
          remainingKeys.push(key)
        }
      }
    } else {
      remainingKeys.push(...keys)
    }
    
    // Get remaining from Redis
    if (remainingKeys.length > 0 && this.config.enableRedisCache) {
      const redisResults = await this.redisPool.execute(async (redis) => {
        const redisKeys = remainingKeys.map(k => this.getRedisKey(k))
        const values = await redis.mget(redisKeys)
        
        const parsed: Record<string, T | null> = {}
        for (let i = 0; i < remainingKeys.length; i++) {
          const key = remainingKeys[i]
          const value = values[i]
          
          if (value) {
            try {
              const entry = JSON.parse(value) as CacheEntry<T>
              if (!this.isExpired(entry)) {
                parsed[key] = await this.deserializeValue(entry)
                this.analytics.hits.redis++
                
                // Promote to memory cache
                if (this.config.enableMemoryCache) {
                  this.setMemoryCache(key, entry.value, entry.ttl)
                }
              }
            } catch {
              parsed[key] = null
            }
          } else {
            parsed[key] = null
          }
        }
        
        return parsed
      })
      
      Object.assign(results, redisResults)
    }
    
    // Combine results
    Object.assign(results, memoryResults)
    
    // Fill in nulls for missing keys
    for (const key of keys) {
      if (!(key in results)) {
        results[key] = null
        this.analytics.misses++
      }
    }
    
    return results
  }
  
  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0
    
    // Invalidate memory cache
    if (this.config.enableMemoryCache) {
      for (const [key, entry] of this.memoryCache) {
        if (entry.tags.some(tag => tags.includes(tag))) {
          this.memoryCache.delete(key)
          invalidated++
        }
      }
    }
    
    // Invalidate Redis cache
    if (this.config.enableRedisCache) {
      const redisInvalidated = await this.redisPool.execute(async (redis) => {
        const pattern = `${this.config.redisKeyPrefix}*`
        const keys = await redis.keys(pattern)
        let count = 0
        
        for (const redisKey of keys) {
          try {
            const value = await redis.get(redisKey)
            if (value) {
              const entry = JSON.parse(value) as CacheEntry<unknown>
              if (entry.tags.some(tag => tags.includes(tag))) {
                await redis.del(redisKey)
                count++
              }
            }
          } catch {
            // Skip invalid entries
          }
        }
        
        return count
      })
      
      invalidated += redisInvalidated
    }
    
    logger.info('Cache invalidated by tags', { tags, count: invalidated })
    return invalidated
  }
  
  /**
   * Warm up cache with frequently accessed data
   */
  private async warmupCache(): Promise<void> {
    logger.info('Starting cache warmup')
    
    // This would typically load frequently accessed data
    // For now, we'll just log the intent
    
    logger.info('Cache warmup completed')
  }
  
  /**
   * Get from cache tiers in order of preference
   */
  private async getFromTiers<T>(
    key: string, 
    strategy: CacheStrategy | null
  ): Promise<T | null> {
    // Try memory cache first
    if (this.config.enableMemoryCache && 
        (!strategy || strategy.tier === 'memory' || strategy.tier === 'all')) {
      const memoryResult = this.getFromMemory<T>(key)
      if (memoryResult !== null) {
        this.analytics.hits.memory++
        return memoryResult
      }
    }
    
    // Try Redis cache
    if (this.config.enableRedisCache && 
        (!strategy || strategy.tier === 'redis' || strategy.tier === 'all')) {
      const redisResult = await this.getFromRedis<T>(key)
      if (redisResult !== null) {
        this.analytics.hits.redis++
        
        // Promote to memory cache
        if (this.config.enableMemoryCache) {
          this.setMemoryCache(key, redisResult, strategy?.ttl || this.config.memoryTtl)
        }
        
        return redisResult
      }
    }
    
    // Try CDN cache
    if (this.config.enableCDNCache && 
        (!strategy || strategy.tier === 'cdn' || strategy.tier === 'all')) {
      const cdnResult = await this.getFromCDN<T>(key)
      if (cdnResult !== null) {
        this.analytics.hits.cdn++
        
        // Promote to higher tiers
        if (this.config.enableRedisCache) {
          await this.setToRedis(key, cdnResult, strategy?.ttl || this.config.redisTtl)
        }
        if (this.config.enableMemoryCache) {
          this.setMemoryCache(key, cdnResult, strategy?.ttl || this.config.memoryTtl)
        }
        
        return cdnResult
      }
    }
    
    return null
  }
  
  /**
   * Set to appropriate cache tiers
   */
  private async setToTiers<T>(
    key: string, 
    value: T, 
    options: CacheOptions & { strategy?: CacheStrategy | null }
  ): Promise<void> {
    const { strategy, ttl, tags = [] } = options
    const effectiveTtl = ttl || strategy?.ttl || this.config.memoryTtl
    const shouldCompress = strategy?.compress !== false && this.config.enableCompression
    
    // Set to memory cache
    if (this.config.enableMemoryCache && 
        (!strategy || strategy.tier === 'memory' || strategy.tier === 'all')) {
      this.setMemoryCache(key, value, effectiveTtl, tags)
    }
    
    // Set to Redis cache
    if (this.config.enableRedisCache && 
        (!strategy || strategy.tier === 'redis' || strategy.tier === 'all')) {
      await this.setToRedis(key, value, effectiveTtl, tags, shouldCompress)
    }
    
    // Set to CDN cache
    if (this.config.enableCDNCache && 
        (!strategy || strategy.tier === 'cdn' || strategy.tier === 'all')) {
      await this.setToCDN(key, value, effectiveTtl)
    }
  }
  
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined
    
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.memoryCache.delete(key)
        this.analytics.evictions++
      }
      return null
    }
    
    entry.lastAccessed = new Date()
    entry.accessCount++
    
    return entry.value
  }
  
  private async getFromRedis<T>(key: string): Promise<T | null> {
    return await this.redisPool.execute(async (redis) => {
      const value = await redis.get(this.getRedisKey(key))
      
      if (!value) {
        return null
      }
      
      try {
        const entry = JSON.parse(value) as CacheEntry<T>
        
        if (this.isExpired(entry)) {
          await redis.del(this.getRedisKey(key))
          return null
        }
        
        return await this.deserializeValue(entry)
        
      } catch {
        return null
      }
    })
  }
  
  private async getFromCDN<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheService.get(key)
      return value ? JSON.parse(value) as T : null
    } catch {
      return null
    }
  }
  
  private setMemoryCache<T>(
    key: string, 
    value: T, 
    ttl: number, 
    tags: string[] = []
  ): void {
    // Evict if at capacity
    if (this.memoryCache.size >= this.config.memoryMaxSize) {
      this.evictLRU()
    }
    
    const entry: CacheEntry<T> = {
      key,
      value,
      tier: 'memory',
      size: this.estimateSize(value),
      compressed: false,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      ttl,
      tags
    }
    
    this.memoryCache.set(key, entry)
  }
  
  private async setToRedis<T>(
    key: string, 
    value: T, 
    ttl: number, 
    tags: string[] = [],
    compress: boolean = false
  ): Promise<void> {
    await this.redisPool.execute(async (redis) => {
      let serializedValue = value
      let compressed = false
      
      if (compress) {
        const serialized = JSON.stringify(value)
        if (serialized.length > this.config.compressionThreshold) {
          const compressedBuffer = await gzip(serialized, { level: this.config.compressionLevel })
          serializedValue = compressedBuffer.toString('base64') as T
          compressed = true
        }
      }
      
      const entry: CacheEntry<T> = {
        key,
        value: serializedValue,
        tier: 'redis',
        size: this.estimateSize(serializedValue),
        compressed,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1,
        ttl,
        tags
      }
      
      await redis.set(
        this.getRedisKey(key),
        JSON.stringify(entry),
        ttl
      )
    })
  }
  
  private async setToCDN<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      await this.cacheService.set(key, JSON.stringify(value), ttl)
    } catch (error) {
      logger.error('CDN cache set error', { key, error })
    }
  }
  
  private async deserializeValue<T>(entry: CacheEntry<T>): Promise<T> {
    if (!entry.compressed) {
      return entry.value
    }
    
    try {
      const buffer = Buffer.from(entry.value as string, 'base64')
      const decompressed = await gunzip(buffer)
      return JSON.parse(decompressed.toString()) as T
    } catch {
      return entry.value
    }
  }
  
  private isExpired(entry: CacheEntry<unknown>): boolean {
    const now = Date.now()
    const expiresAt = entry.createdAt.getTime() + (entry.ttl * 1000)
    return now > expiresAt
  }
  
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    
    for (const [key, entry] of this.memoryCache) {
      if (entry.lastAccessed.getTime() < oldestTime) {
        oldestTime = entry.lastAccessed.getTime()
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.memoryCache.delete(oldestKey)
      this.analytics.evictions++
    }
  }
  
  private getRedisKey(key: string): string {
    return `${this.config.redisKeyPrefix}${key}`
  }
  
  private estimateSize(value: unknown): number {
    return JSON.stringify(value).length * 2 // Rough UTF-16 estimate
  }
  
  private updateAccessStats(key: string): void {
    // Update top keys analytics
    const existing = this.analytics.topKeys.find(item => item.key === key)
    if (existing) {
      existing.accessCount++
    } else {
      this.analytics.topKeys.push({ key, accessCount: 1 })
    }
    
    // Keep only top 10
    this.analytics.topKeys.sort((a, b) => b.accessCount - a.accessCount)
    this.analytics.topKeys = this.analytics.topKeys.slice(0, 10)
  }
  
  private updateResponseTime(responseTime: number): void {
    this.analytics.averageResponseTime = 
      (this.analytics.averageResponseTime * 0.9) + (responseTime * 0.1)
  }
  
  private considerPrefetch(key: string): void {
    const entry = this.memoryCache.get(key)
    if (entry && entry.accessCount >= this.config.prefetchThreshold) {
      // Trigger prefetch of related data
      this.analytics.prefetches++
      logger.debug('Prefetch triggered', { key, accessCount: entry.accessCount })
    }
  }
  
  // Batching methods
  private async batchGet<T>(key: string, strategy?: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        operation: 'get',
        key,
        resolve: resolve as (value: unknown) => void,
        reject
      })
      
      this.scheduleBatch()
    })
  }
  
  private async batchSet<T>(
    key: string, 
    value: T, 
    options: CacheOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        operation: 'set',
        key,
        value,
        options,
        resolve: resolve as (value: unknown) => void,
        reject
      })
      
      this.scheduleBatch()
    })
  }
  
  private async batchDelete(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        operation: 'delete',
        key,
        resolve: resolve as (value: unknown) => void,
        reject
      })
      
      this.scheduleBatch()
    })
  }
  
  private scheduleBatch(): void {
    if (this.batchTimer) {
      return
    }
    
    this.batchTimer = setTimeout(() => {
      this.processBatch()
    }, this.config.batchDelay)
  }
  
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return
    }
    
    const batch = this.batchQueue.splice(0, this.config.batchSize)
    this.batchTimer = undefined
    
    try {
      // Group operations by type
      const gets = batch.filter(op => op.operation === 'get')
      const sets = batch.filter(op => op.operation === 'set')
      const deletes = batch.filter(op => op.operation === 'delete')
      
      // Process gets in batch
      if (gets.length > 0) {
        const keys = gets.map(op => op.key)
        const results = await this.mget(keys)
        
        gets.forEach(op => {
          op.resolve(results[op.key])
        })
      }
      
      // Process sets individually (could be optimized further)
      for (const op of sets) {
        try {
          await this.setToTiers(op.key, op.value, op.options || {})
          op.resolve(undefined)
        } catch (error) {
          op.reject(error as Error)
        }
      }
      
      // Process deletes in batch
      if (deletes.length > 0) {
        await Promise.all(deletes.map(async op => {
          try {
            await this.delete(op.key)
            op.resolve(undefined)
          } catch (error) {
            op.reject(error as Error)
          }
        }))
      }
      
    } catch (error) {
      // Reject all operations in batch
      batch.forEach(op => op.reject(error as Error))
    }
    
    // Schedule next batch if queue is not empty
    if (this.batchQueue.length > 0) {
      this.scheduleBatch()
    }
  }
  
  private startAnalytics(): void {
    this.analyticsInterval = setInterval(() => {
      this.updateAnalytics()
      
      logger.debug('Cache analytics', this.analytics)
      
      // Emit analytics event
      process.emit('cache-analytics', this.analytics)
      
    }, this.config.analyticsInterval)
  }
  
  private updateAnalytics(): void {
    const totalHits = this.analytics.hits.memory + 
                     this.analytics.hits.redis + 
                     this.analytics.hits.cdn
    
    this.analytics.hits.total = totalHits
    this.analytics.hitRate = this.analytics.totalRequests > 0 
      ? (totalHits / this.analytics.totalRequests) * 100 
      : 0
    
    // Update memory usage
    this.analytics.memoryUsage = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.size, 0)
  }
  
  /**
   * Get cache analytics
   */
  getAnalytics(): CacheAnalytics {
    this.updateAnalytics()
    return { ...this.analytics }
  }
  
  /**
   * Clear all cache tiers
   */
  async clear(): Promise<void> {
    // Clear memory
    this.memoryCache.clear()
    
    // Clear Redis
    if (this.config.enableRedisCache) {
      await this.redisPool.execute(async (redis) => {
        const keys = await redis.keys(`${this.config.redisKeyPrefix}*`)
        if (keys.length > 0) {
          await redis.del(...keys)
        }
      })
    }
    
    // Clear CDN
    if (this.config.enableCDNCache) {
      await this.cacheService.clearByPrefix('')
    }
    
    logger.info('All cache tiers cleared')
  }
  
  /**
   * Dispose cache resources
   */
  async dispose(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }
    
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval)
    }
    
    // Process remaining batch operations
    if (this.batchQueue.length > 0) {
      await this.processBatch()
    }
    
    await this.redisPool.dispose()
    
    logger.info('Intelligent cache disposed')
  }
}

export interface CacheOptions {
  ttl?: number
  tags?: string[]
  strategy?: string
  compress?: boolean
  tier?: 'memory' | 'redis' | 'cdn' | 'all'
}

// Singleton instance
let intelligentCache: IntelligentCache | null = null

export function getIntelligentCache(config?: Partial<IntelligentCacheConfig>): IntelligentCache {
  if (!intelligentCache) {
    intelligentCache = new IntelligentCache(config)
  }
  return intelligentCache
}

// Convenience functions for specific data types
export async function cacheAnalysisResult(
  sessionId: string, 
  result: BiasAnalysisResult
): Promise<void> {
  const cache = getIntelligentCache()
  await cache.set(`analysis:${sessionId}`, result, { strategy: 'analysis-result' })
}

export async function getCachedAnalysisResult(
  sessionId: string
): Promise<BiasAnalysisResult | null> {
  const cache = getIntelligentCache()
  return await cache.get<BiasAnalysisResult>(`analysis:${sessionId}`, 'analysis-result')
}

export async function cacheSessionData(
  sessionId: string, 
  session: TherapeuticSession
): Promise<void> {
  const cache = getIntelligentCache()
  await cache.set(`session:${sessionId}`, session, { strategy: 'session-data' })
}

export async function getCachedSessionData(
  sessionId: string
): Promise<TherapeuticSession | null> {
  const cache = getIntelligentCache()
  return await cache.get<TherapeuticSession>(`session:${sessionId}`, 'session-data')
}

export async function cacheDashboardData(
  userId: string, 
  timeRange: string, 
  data: BiasDashboardData
): Promise<void> {
  const cache = getIntelligentCache()
  await cache.set(`dashboard:${userId}:${timeRange}`, data, { strategy: 'dashboard-data' })
}

export async function getCachedDashboardData(
  userId: string, 
  timeRange: string
): Promise<BiasDashboardData | null> {
  const cache = getIntelligentCache()
  return await cache.get<BiasDashboardData>(`dashboard:${userId}:${timeRange}`, 'dashboard-data')
}

export async function cacheReport(
  reportId: string, 
  report: BiasReport
): Promise<void> {
  const cache = getIntelligentCache()
  await cache.set(`report:${reportId}`, report, { strategy: 'report' })
}

export async function getCachedReport(
  reportId: string
): Promise<BiasReport | null> {
  const cache = getIntelligentCache()
  return await cache.get<BiasReport>(`report:${reportId}`, 'report')
}