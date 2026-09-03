/**
 * FHE Caching Layer
 *
 * Provides performance optimization for FHE operations through intelligent
 * caching of encrypted computations, key management, and result memoization.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { getFHEService } from './fhe-factory'
import { type FHEService, type EncryptedData, FHEOperation } from './types'

const logger = createBuildSafeLogger('fhe-cache')

/**
 * Cache entry for encrypted computation results
 */
interface CacheEntry {
  key: string
  encryptedResult: EncryptedData
  timestamp: number
  operation: FHEOperation
  metadata: {
    inputSize: number
    outputSize: number
    durationMs: number
  }
}

/**
 * Cache entry for encrypted session data
 */
interface SessionCacheEntry {
  sessionId: string
  encryptedMessages: EncryptedData[]
  emotionalState: EncryptedData | null
  crisisAssessment: EncryptedData | null
  lastAccessed: number
  createdAt: number
}

/**
 * Cache configuration
 */
interface CacheConfig {
  maxEntries: number
  maxSessionEntries: number
  ttlMs: number // Time-to-live for cache entries
  sessionTtlMs: number // TTL for session cache entries
  enableCompression: boolean
  maxEntrySize: number
}

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 1000,
  maxSessionEntries: 100,
  ttlMs: 5 * 60 * 1000, // 5 minutes
  sessionTtlMs: 30 * 60 * 1000, // 30 minutes
  enableCompression: false,
  maxEntrySize: 1024 * 1024, // 1MB
}

/**
 * FHE cache service for optimizing homomorphic encryption performance
 */
export class FHECacheService {
  private static instance: FHECacheService | null = null
  private fheService: FHEService | null = null
  private initialized = false

  // Computation cache: operation hash -> encrypted result
  private readonly computationCache = new Map<string, CacheEntry>()

  // Session cache: sessionId -> session data
  private readonly sessionCache = new Map<string, SessionCacheEntry>()

  // Key cache: keyId -> encryption key (for key rotation)
  private readonly keyCache = new Map<string, EncryptedData>()

  // Configuration
  private readonly config: CacheConfig

  // Cache statistics
  private hits = 0
  private misses = 0
  private evictions = 0

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<CacheConfig>): FHECacheService {
    FHECacheService.instance ??= new FHECacheService(config)
    return FHECacheService.instance
  }

  /**
   * Initialize the cache service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      this.fheService = await getFHEService({
        implementation: process.env['NODE_ENV'] === 'test' ? 'mock' : 'seal',
      } as Record<string, unknown>)

      await this.fheService.initialize()
      this.initialized = true

      // Start cache cleanup interval
      this.startCleanupInterval()

      logger.info('FHE cache service initialized', {
        maxEntries: this.config.maxEntries,
        maxSessionEntries: this.config.maxSessionEntries,
      })
    } catch (error) {
      logger.error('Failed to initialize FHE cache service', { error })
      throw error
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * Start background cache cleanup
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanup()
    }, this.config.ttlMs / 2)
  }

  /**
   * Clean up expired cache entries
   */
  public cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    // Clean computation cache
    for (const [key, entry] of this.computationCache.entries()) {
      if (now - entry.timestamp > this.config.ttlMs) {
        this.computationCache.delete(key)
        cleaned++
      }
    }

    // Clean session cache
    for (const [key, entry] of this.sessionCache.entries()) {
      if (now - entry.lastAccessed > this.config.sessionTtlMs) {
        this.sessionCache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned ${cleaned} expired cache entries`)
    }
  }

  /**
   * Get cached computation result
   */
  public async getCachedResult(
    operation: FHEOperation,
    inputHash: string,
  ): Promise<EncryptedData | null> {
    const cacheKey = `${operation}:${inputHash}`
    const entry = this.computationCache.get(cacheKey)

    if (!entry) {
      this.misses++
      return null
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttlMs) {
      this.computationCache.delete(cacheKey)
      this.misses++
      return null
    }

    this.hits++
    logger.debug('Cache hit for computation', { operation, inputHash })
    return entry.encryptedResult
  }

  /**
   * Cache computation result
   */
  public async cacheResult(
    operation: FHEOperation,
    inputHash: string,
    encryptedResult: EncryptedData,
    metadata: CacheEntry['metadata'],
  ): Promise<void> {
    await this.ensureInitialized()

    // Check size limit
    const dataSize =
      typeof encryptedResult.data === 'string'
        ? Buffer.byteLength(encryptedResult.data)
        : 0

    if (dataSize > this.config.maxEntrySize) {
      logger.warn(`Cache entry too large (${dataSize} bytes), skipping`, {
        operation,
        inputHash,
      })
      return
    }

    // Evict if at capacity
    if (this.computationCache.size >= this.config.maxEntries) {
      this.evictLRU()
    }

    const entry: CacheEntry = {
      key: `${operation}:${inputHash}`,
      encryptedResult,
      timestamp: Date.now(),
      operation,
      metadata,
    }

    this.computationCache.set(entry.key, entry)
    logger.debug('Cached computation result', { operation, inputHash })
  }

  /**
   * Get cached session data
   */
  public getCachedSession(sessionId: string): SessionCacheEntry | null {
    const entry = this.sessionCache.get(sessionId)

    if (!entry) {
      return null
    }

    // Update last accessed
    entry.lastAccessed = Date.now()
    return entry
  }

  /**
   * Cache session data
   */
  public async cacheSession(
    sessionId: string,
    encryptedMessages: EncryptedData[],
    emotionalState: EncryptedData | null = null,
    crisisAssessment: EncryptedData | null = null,
  ): Promise<void> {
    await this.ensureInitialized()

    // Evict if at capacity
    if (this.sessionCache.size >= this.config.maxSessionEntries) {
      this.evictSessionLRU()
    }

    const entry: SessionCacheEntry = {
      sessionId,
      encryptedMessages,
      emotionalState,
      crisisAssessment,
      lastAccessed: Date.now(),
      createdAt: Date.now(),
    }

    this.sessionCache.set(sessionId, entry)
    logger.debug('Cached session data', { sessionId })
  }

  /**
   * Get cached encryption key
   */
  public getCachedKey(keyId: string): EncryptedData | null {
    return this.keyCache.get(keyId) ?? null
  }

  /**
   * Cache encryption key
   */
  public cacheKey(keyId: string, keyData: EncryptedData): void {
    // Check capacity
    if (this.keyCache.size >= this.config.maxEntries * 0.1) {
      this.evictKeyLRU()
    }

    this.keyCache.set(keyId, keyData)
  }

  /**
   * Evict least recently used computation cache entry
   */
  private evictLRU(): void {
    let oldestKey: string | undefined
    let oldestTime = Infinity

    for (const [key, entry] of this.computationCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.computationCache.delete(oldestKey)
      this.evictions++
      logger.debug('Evicted LRU cache entry', { key: oldestKey.slice(-20) })
    }
  }

  /**
   * Evict least recently used session cache entry
   */
  private evictSessionLRU(): void {
    let oldestKey: string | undefined
    let oldestTime = Infinity

    for (const [key, entry] of this.sessionCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.sessionCache.delete(oldestKey)
      this.evictions++
      logger.debug('Evicted LRU session cache', {
        sessionId: oldestKey.slice(-20),
      })
    }
  }

  /**
   * Evict least recently used key cache entry
   */
  private evictKeyLRU(): void {
    let oldestKey: string | undefined
    let oldestTime = Infinity

    for (const [key, entry] of this.keyCache.entries()) {
      const metadata = entry.metadata
      if (
        metadata &&
        typeof metadata['timestamp'] === 'number' &&
        metadata['timestamp'] < oldestTime
      ) {
        oldestTime = metadata['timestamp']
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.keyCache.delete(oldestKey)
      this.evictions++
      logger.debug('Evicted LRU key cache', { keyId: oldestKey.slice(-20) })
    }
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.computationCache.clear()
    this.sessionCache.clear()
    this.keyCache.clear()
    this.hits = 0
    this.misses = 0
    this.evictions = 0
    logger.info('FHE cache cleared')
  }

  /**
   * Get cache statistics
   */
  public getStats(): {
    computationCacheSize: number
    sessionCacheSize: number
    keyCacheSize: number
    hits: number
    misses: number
    hitRate: number
    evictions: number
  } {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? this.hits / total : 0

    return {
      computationCacheSize: this.computationCache.size,
      sessionCacheSize: this.sessionCache.size,
      keyCacheSize: this.keyCache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      evictions: this.evictions,
    }
  }

  /**
   * Generate hash for encrypted input
   */
  public async generateInputHash(
    operation: FHEOperation,
    inputData: unknown,
  ): Promise<string> {
    // Simple hash generation (in production: use cryptographic hash)
    const dataStr = JSON.stringify(inputData)
    let hash = 0

    for (let i = 0; i < dataStr.length; i++) {
      const char = dataStr.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }

    return `${operation}-${Math.abs(hash).toString(36)}`
  }

  /**
   * Pre-warm cache with common operations
   */
  public async prewarmCache(): Promise<void> {
    await this.ensureInitialized()

    // Pre-compute common encryption patterns
    const commonPatterns = [
      'hello',
      'test message',
      'emotional data',
      'sentiment analysis',
    ]

    for (const pattern of commonPatterns) {
      const encrypted = await this.fheService!.encrypt(pattern)
      const hash = await this.generateInputHash(FHEOperation.SENTIMENT, pattern)
      await this.cacheResult(FHEOperation.SENTIMENT, hash, encrypted, {
        inputSize: pattern.length,
        outputSize:
          typeof encrypted.data === 'string' ? encrypted.data.length : 0,
        durationMs: 0,
      })
    }

    logger.info('Cache pre-warmed with common patterns')
  }
}

// Export singleton instance
export const fheCache = FHECacheService.getInstance()
export default fheCache
