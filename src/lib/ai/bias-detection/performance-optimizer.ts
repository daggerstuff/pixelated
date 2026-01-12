/**
 * Performance Optimizer for Bias Detection Engine
 *
 * Implements comprehensive performance optimization strategies including:
 * - Enhanced connection pooling for all external services
 * - Intelligent caching with compression and TTL management
 * - Batch processing with configurable concurrency
 * - Background job processing for long-running analyses
 * - Memory optimization and resource management
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { ConnectionPool, type ConnectionPoolConfig } from './connection-pool'
import { getCacheService } from '../../services/cacheService'

const logger = createBuildSafeLogger('PerformanceOptimizer')

export interface PerformanceOptimizerConfig {
  // Connection pooling configuration
  httpPool: Partial<ConnectionPoolConfig>
  redisPool: {
    maxConnections: number
    idleTimeout: number
    connectionTimeout: number
  }

  // Caching configuration
  cache: {
    enableCompression: boolean
    compressionThreshold: number // bytes
    defaultTtl: number // seconds
    maxCacheSize: number // entries
    enableDistributedCache: boolean
  }

  // Batch processing configuration
  batchProcessing: {
    defaultBatchSize: number
    maxConcurrency: number
    timeoutMs: number
    retryAttempts: number
    enablePrioritization: boolean
  }

  // Background job configuration
  backgroundJobs: {
    enabled: boolean
    maxWorkers: number
    jobTimeout: number
    retryDelay: number
    queueMaxSize: number
  }

  // Memory optimization
  memory: {
    gcInterval: number // ms
    memoryThreshold: number // percentage (0-100)
    enableMemoryMonitoring: boolean
    maxHeapSize: number // MB
  }

  // Performance monitoring
  monitoring: {
    enableMetrics: boolean
    metricsInterval: number // ms
    enableProfiling: boolean
    slowQueryThreshold: number // ms
  }
}

export interface BatchProcessingOptions {
  batchSize?: number
  concurrency?: number
  priority?: 'low' | 'medium' | 'high'
  timeout?: number
  retries?: number
  onProgress?: (completed: number, total: number) => void
  onError?: (error: Error, item: unknown) => void
}

export interface BackgroundJob<T = unknown> {
  id: string
  type: string
  data: T
  priority: number
  createdAt: Date
  attempts: number
  maxAttempts: number
  timeout: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

export interface PerformanceStats {
  connections: {
    http: {
      total: number
      active: number
      idle: number
      queue: number
    }
    redis: {
      total: number
      active: number
      idle: number
    }
  }
  cache: {
    hitRate: number
    missRate: number
    size: number
    memoryUsage: number
    compressionRatio: number
  }
  batch: {
    activeJobs: number
    completedJobs: number
    failedJobs: number
    averageProcessingTime: number
  }
  memory: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
    gcCount: number
  }
  performance: {
    averageResponseTime: number
    throughput: number
    errorRate: number
    slowQueries: number
  }
}

/**
 * Enhanced Connection Pool Manager
 * Manages multiple connection pools for different services
 */
export class ConnectionPoolManager {
  private httpPools = new Map<string, ConnectionPool>()
  private config: PerformanceOptimizerConfig

  constructor(config: PerformanceOptimizerConfig) {
    this.config = config
  }

  /**
   * Get or create HTTP connection pool for a service
   */
  getHttpPool(serviceUrl: string): ConnectionPool {
    if (!this.httpPools.has(serviceUrl)) {
      const pool = new ConnectionPool(this.config.httpPool)
      this.httpPools.set(serviceUrl, pool)
      logger.info('Created HTTP connection pool', { serviceUrl })
    }
    return this.httpPools.get(serviceUrl)!
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats() {
    const stats: Record<string, unknown> = {}

    for (const [url, pool] of Array.from(this.httpPools)) {
      stats[url] = pool.getStats()
    }

    return stats
  }

  /**
   * Health check for all connection pools
   */
  async healthCheck(): Promise<{
    healthy: boolean
    details: Record<string, boolean>
  }> {
    const details: Record<string, boolean> = {}
    let allHealthy = true

    for (const [url, pool] of Array.from(this.httpPools)) {
      const healthy = pool.isHealthy()
      details[url] = healthy
      if (!healthy) {
        allHealthy = false
      }
    }

    return { healthy: allHealthy, details }
  }

  /**
   * Dispose all connection pools
   */
  async dispose(): Promise<void> {
    await Promise.all(
      Array.from(this.httpPools.values()).map((pool) => pool.dispose()),
    )
    this.httpPools.clear()
    logger.info('All connection pools disposed')
  }
}

/**
 * Intelligent Cache Manager with Compression
 */
export class IntelligentCacheManager {
  private cacheService = getCacheService()
  private config: PerformanceOptimizerConfig['cache']
  private stats = {
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
        return this.decompress(cached)
      }

      return JSON.parse(cached) as T
    } catch (error) {
      logger.error('Cache get error', { key, error })
      this.stats.misses++
      return null
    }
  }

  /**
   * Set value in cache with automatic compression
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
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
        ttl || this.config.defaultTtl,
      )
      this.stats.totalSize += Buffer.byteLength(dataToStore, 'utf8')
    } catch (error) {
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
              processed[key] = this.decompress(value)
            } else {
              processed[key] = JSON.parse(value) as T
            }
          } catch {
            processed[key] = null
          }
        }
      }

      return processed
    } catch (error) {
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

  private decompress<T>(data: string): T {
    // Simple decompression simulation - in production use zlib
    const compressed = data.replace('GZIP:', '')
    const decompressed = Buffer.from(compressed, 'base64').toString('utf8')
    return JSON.parse(decompressed) as T
  }
}

/**
 * Batch Processing Engine with Concurrency Control
 */
export class BatchProcessor {
  private config: PerformanceOptimizerConfig['batchProcessing']
  private activeJobs = new Map<string, Promise<unknown>>()
  private stats = {
    completed: 0,
    failed: 0,
    totalProcessingTime: 0,
  }

  constructor(config: PerformanceOptimizerConfig['batchProcessing']) {
    this.config = config
  }

  /**
   * Process items in batches with concurrency control
   */
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: BatchProcessingOptions = {},
  ): Promise<{ results: R[]; errors: Array<{ item: T; error: Error }> }> {
    const {
      batchSize = this.config.defaultBatchSize,
      concurrency = this.config.maxConcurrency,
      timeout = this.config.timeoutMs,
      retries = this.config.retryAttempts,
      onProgress,
      onError,
    } = options

    const results: R[] = []
    const errors: Array<{ item: T; error: Error }> = []
    let completed = 0

    // Create batches
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    // Process batches with concurrency control
    const semaphore = new Semaphore(concurrency)

    const batchPromises = batches.map(async (batch) => {
      await semaphore.acquire()

      try {
        const batchResults = await Promise.allSettled(
          batch.map((item) =>
            this.processItemWithRetry(item, processor, retries, timeout),
          ),
        )

        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i]
          const item = batch[i]

          // Guard against undefined "result" or "item"
          if (!result || typeof item === 'undefined') {
            continue
          }

          if (result.status === 'fulfilled') {
            // TypeScript type guard: safe to access "value"
            results.push(result.value)
            this.stats.completed++
          } else if (result.status === 'rejected') {
            // TypeScript type guard: safe to access "reason"
            const error =
              result.reason instanceof Error
                ? result.reason
                : new Error(String(result.reason))
            errors.push({ item, error })
            this.stats.failed++

            if (onError) {
              onError(error, item)
            }
          }

          completed++
          if (onProgress) {
            onProgress(completed, items.length)
          }
        }
      } finally {
        semaphore.release()
      }
    })

    await Promise.all(batchPromises)

    return { results, errors }
  }

  private async processItemWithRetry<T, R>(
    item: T,
    processor: (item: T) => Promise<R>,
    retries: number,
    timeout: number,
  ): Promise<R> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const startTime = Date.now()

        const result = await Promise.race([
          processor(item),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeout),
          ),
        ])

        this.stats.totalProcessingTime += Date.now() - startTime
        return result
      } catch (error) {
        lastError = error as Error

        if (attempt < retries) {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000),
          )
        }
      }
    }

    if (!lastError) {
      lastError = new Error('Unknown error occurred during processing')
    }
    throw lastError
  }

  getStats() {
    return {
      ...this.stats,
      averageProcessingTime:
        this.stats.completed > 0
          ? this.stats.totalProcessingTime / this.stats.completed
          : 0,
      activeJobs: this.activeJobs.size,
    }
  }
}

/**
 * Background Job Queue for Long-Running Tasks
 */
export class BackgroundJobQueue {
  private jobs = new Map<string, BackgroundJob>()
  private workers: Array<Promise<void>> = []
  private config: PerformanceOptimizerConfig['backgroundJobs']
  private isRunning = false

  constructor(config: PerformanceOptimizerConfig['backgroundJobs']) {
    this.config = config

    if (config.enabled) {
      this.start()
    }
  }

  /**
   * Add job to queue
   */
  async addJob<T>(
    type: string,
    data: T,
    options: {
      priority?: number
      timeout?: number
      maxAttempts?: number
    } = {},
  ): Promise<string> {
    if (this.jobs.size >= this.config.queueMaxSize) {
      throw new Error('Job queue is full')
    }

    const job: BackgroundJob<T> = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      priority: options.priority || 1,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      timeout: options.timeout || this.config.jobTimeout,
      status: 'pending',
    }

    this.jobs.set(job.id, job)
    logger.debug('Job added to queue', { jobId: job.id, type })

    return job.id
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): BackgroundJob | null {
    return this.jobs.get(jobId) || null
  }

  /**
   * Start background workers
   */
  private start(): void {
    if (this.isRunning) {
      return
    }

    this.isRunning = true

    for (let i = 0; i < this.config.maxWorkers; i++) {
      this.workers.push(this.worker())
    }

    logger.info('Background job queue started', {
      workers: this.config.maxWorkers,
    })
  }

  /**
   * Stop background workers
   */
  async stop(): Promise<void> {
    this.isRunning = false
    await Promise.all(this.workers)
    this.workers = []
    logger.info('Background job queue stopped')
  }

  private async worker(): Promise<void> {
    while (this.isRunning) {
      try {
        const job = this.getNextJob()

        if (!job) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          continue
        }

        await this.processJob(job)
      } catch (error) {
        logger.error('Worker error', { error })
      }
    }
  }

  private getNextJob(): BackgroundJob | null {
    const pendingJobs = Array.from(this.jobs.values())
      .filter((job) => job.status === 'pending')
      .sort(
        (a, b) =>
          b.priority - a.priority ||
          a.createdAt.getTime() - b.createdAt.getTime(),
      )

    return pendingJobs[0] || null
  }

  private async processJob(job: BackgroundJob): Promise<void> {
    job.status = 'processing'
    job.attempts++

    try {
      // Simulate job processing - in production, this would dispatch to actual handlers
      await new Promise((resolve) => setTimeout(resolve, 100))

      job.status = 'completed'
      logger.debug('Job completed', { jobId: job.id })
    } catch (error) {
      logger.error('Job failed', { jobId: job.id, error })

      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed'
      } else {
        job.status = 'pending'
        // Add delay before retry
        setTimeout(() => { }, this.config.retryDelay)
      }
    }
  }

  getStats() {
    const jobs = Array.from(this.jobs.values())

    return {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === 'pending').length,
      processing: jobs.filter((j) => j.status === 'processing').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
      workers: this.workers.length,
    }
  }
}

/**
 * Memory Monitor and Optimizer
 */
export class MemoryOptimizer {
  private config: PerformanceOptimizerConfig['memory']
  private gcInterval?: ReturnType<typeof setInterval>
  private stats = {
    gcCount: 0,
    lastGcTime: Date.now(),
    peakMemory: 0,
  }

  constructor(config: PerformanceOptimizerConfig['memory']) {
    this.config = config

    if (config.enableMemoryMonitoring) {
      this.startMonitoring()
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    const usage = process.memoryUsage()

    // Update peak memory
    if (usage.heapUsed > this.stats.peakMemory) {
      this.stats.peakMemory = usage.heapUsed
    }

    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsagePercent: Math.round((usage.heapUsed / usage.heapTotal) * 100),
    }
  }

  /**
   * Force garbage collection if available
   */
  forceGC(): boolean {
    if (global.gc) {
      global.gc()
      this.stats.gcCount++
      this.stats.lastGcTime = Date.now()
      logger.debug('Forced garbage collection')
      return true
    }
    return false
  }

  /**
   * Check if memory usage is above threshold
   */
  isMemoryPressure(): boolean {
    const usage = this.getMemoryUsage()
    return usage.heapUsagePercent > this.config.memoryThreshold
  }

  private startMonitoring(): void {
    this.gcInterval = setInterval(() => {
      const usage = this.getMemoryUsage()

      // Log memory stats
      logger.debug('Memory usage', usage)

      // Force GC if memory pressure is high
      if (this.isMemoryPressure()) {
        logger.warn('High memory usage detected', {
          usage: usage.heapUsagePercent,
          threshold: this.config.memoryThreshold,
        })

        this.forceGC()
      }
    }, this.config.gcInterval)
  }

  stop(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval)
      this.gcInterval = undefined
    }
  }

  getStats() {
    return {
      ...this.stats,
      currentUsage: this.getMemoryUsage(),
      isUnderPressure: this.isMemoryPressure(),
    }
  }
}

/**
 * Semaphore for concurrency control
 */
class Semaphore {
  private permits: number
  private waitQueue: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }

    return new Promise((resolve) => {
      this.waitQueue.push(resolve)
    })
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!
      resolve()
    } else {
      this.permits++
    }
  }
}

/**
 * Main Performance Optimizer Class
 */
export class PerformanceOptimizer {
  private config: PerformanceOptimizerConfig
  private connectionManager: ConnectionPoolManager
  private cacheManager: IntelligentCacheManager
  private batchProcessor: BatchProcessor
  private jobQueue: BackgroundJobQueue
  private memoryOptimizer: MemoryOptimizer
  private metricsInterval?: ReturnType<typeof setInterval>

  constructor(config: Partial<PerformanceOptimizerConfig> = {}) {
    this.config = this.mergeWithDefaults(config)

    this.connectionManager = new ConnectionPoolManager(this.config)
    this.cacheManager = new IntelligentCacheManager(this.config.cache)
    this.batchProcessor = new BatchProcessor(this.config.batchProcessing)
    this.jobQueue = new BackgroundJobQueue(this.config.backgroundJobs)
    this.memoryOptimizer = new MemoryOptimizer(this.config.memory)

    if (this.config.monitoring.enableMetrics) {
      this.startMetricsCollection()
    }

    logger.info('Performance optimizer initialized', { config: this.config })
  }

  /**
   * Get HTTP connection pool for a service
   */
  getConnectionPool(serviceUrl: string): ConnectionPool {
    return this.connectionManager.getHttpPool(serviceUrl)
  }

  /**
   * Get intelligent cache manager
   */
  getCache(): IntelligentCacheManager {
    return this.cacheManager
  }

  /**
   * Process items in optimized batches
   */
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options?: BatchProcessingOptions,
  ): Promise<{ results: R[]; errors: Array<{ item: T; error: Error }> }> {
    return this.batchProcessor.processBatch(items, processor, options)
  }

  /**
   * Add background job
   */
  async addBackgroundJob<T>(
    type: string,
    data: T,
    options?: { priority?: number; timeout?: number; maxAttempts?: number },
  ): Promise<string> {
    return this.jobQueue.addJob(type, data, options)
  }

  /**
   * Get comprehensive performance statistics
   */
  async getPerformanceStats(): Promise<PerformanceStats> {
    // const connectionHealth = await this.connectionManager.healthCheck() // Removed unused variable
    const memoryStats = this.memoryOptimizer.getStats()
    const cacheStats = this.cacheManager.getStats()
    const batchStats = this.batchProcessor.getStats()
    const jobStats = this.jobQueue.getStats()

    return {
      connections: {
        http: {
          total: 0, // Will be populated from actual pool stats
          active: 0,
          idle: 0,
          queue: 0,
        },
        redis: {
          total: 0,
          active: 0,
          idle: 0,
        },
      },
      cache: {
        hitRate: cacheStats.hitRate,
        missRate: cacheStats.missRate,
        size: cacheStats.totalSize,
        memoryUsage: cacheStats.totalSize,
        compressionRatio: cacheStats.compressionRatio,
      },
      batch: {
        activeJobs: batchStats.activeJobs,
        completedJobs: batchStats.completed,
        failedJobs: batchStats.failed,
        averageProcessingTime: batchStats.averageProcessingTime,
      },
      memory: {
        heapUsed: memoryStats.currentUsage?.heapUsed ?? 0,
        heapTotal: memoryStats.currentUsage?.heapTotal ?? 0,
        external: memoryStats.currentUsage?.external ?? 0,
        rss: memoryStats.currentUsage?.rss ?? 0,
        gcCount: memoryStats.gcCount,
      },
      performance: {
        averageResponseTime: batchStats.averageProcessingTime,
        throughput: jobStats.completed || 0,
        errorRate:
          jobStats.failed > 0
            ? (jobStats.failed / (jobStats.completed + jobStats.failed)) * 100
            : 0,
        slowQueries: 0, // Not implemented yet
      },
    }
  }

  /**
   * Health check for all performance components
   */
  async healthCheck(): Promise<{
    healthy: boolean
    components: Record<string, boolean>
  }> {
    const connectionHealth = await this.connectionManager.healthCheck()
    const memoryPressure = this.memoryOptimizer.isMemoryPressure()

    const components = {
      connections: connectionHealth.healthy,
      memory: !memoryPressure,
      cache: true, // Cache is always healthy in this implementation
      backgroundJobs: this.config.backgroundJobs.enabled,
    }

    const healthy = Object.values(components).every(Boolean)

    return { healthy, components }
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        const stats = await this.getPerformanceStats()
        logger.debug('Performance metrics', stats)

        // Note: Custom event emission removed to avoid TypeScript errors
        // If external monitoring is needed, use the logger output or implement a proper event system
      } catch (error) {
        logger.error('Error collecting performance metrics', { error })
      }
    }, this.config.monitoring.metricsInterval)
  }

  /**
   * Dispose all resources
   */
  async dispose(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }

    await this.connectionManager.dispose()
    await this.jobQueue.stop()
    this.memoryOptimizer.stop()

    logger.info('Performance optimizer disposed')
  }

  private mergeWithDefaults(
    config: Partial<PerformanceOptimizerConfig>,
  ): PerformanceOptimizerConfig {
    return {
      httpPool: {
        maxConnections: 20,
        connectionTimeout: 30000,
        idleTimeout: 300000,
        retryAttempts: 3,
        retryDelay: 1000,
        ...config.httpPool,
      },
      redisPool: {
        maxConnections: 10,
        idleTimeout: 300000,
        connectionTimeout: 5000,
        ...config.redisPool,
      },
      cache: {
        enableCompression: true,
        compressionThreshold: 1024, // 1KB
        defaultTtl: 300, // 5 minutes
        maxCacheSize: 10000,
        enableDistributedCache: true,
        ...config.cache,
      },
      batchProcessing: {
        defaultBatchSize: 10,
        maxConcurrency: 5,
        timeoutMs: 30000,
        retryAttempts: 2,
        enablePrioritization: true,
        ...config.batchProcessing,
      },
      backgroundJobs: {
        enabled: true,
        maxWorkers: 3,
        jobTimeout: 60000,
        retryDelay: 5000,
        queueMaxSize: 1000,
        ...config.backgroundJobs,
      },
      memory: {
        gcInterval: 30000, // 30 seconds
        memoryThreshold: 80, // 80%
        enableMemoryMonitoring: true,
        maxHeapSize: 512, // 512MB
        ...config.memory,
      },
      monitoring: {
        enableMetrics: true,
        metricsInterval: 60000, // 1 minute
        enableProfiling: false,
        slowQueryThreshold: 1000, // 1 second
        ...config.monitoring,
      },
    }
  }
}

// Export singleton instance
let performanceOptimizer: PerformanceOptimizer | null = null

export function getPerformanceOptimizer(
  config?: Partial<PerformanceOptimizerConfig>,
): PerformanceOptimizer {
  if (!performanceOptimizer) {
    performanceOptimizer = new PerformanceOptimizer(config)
  }
  return performanceOptimizer
}
