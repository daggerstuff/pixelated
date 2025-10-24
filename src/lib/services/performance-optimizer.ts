/**
 * Performance Optimization Module for Phase 3
 *
 * Provides comprehensive performance optimization tools including:
 * - Connection pooling
 * - Caching strategies
 * - Memory management
 * - Request batching
 * - Circuit breakers
 * - Performance monitoring
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('performance-optimizer')

export interface PerformanceMetrics {
  requestsPerSecond: number
  averageResponseTime: number
  errorRate: number
  memoryUsage: number
  cpuUsage: number
  activeConnections: number
  cacheHitRate: number
}

export interface OptimizationConfig {
  connectionPool: {
    maxConnections: number
    minConnections: number
    acquireTimeout: number
    idleTimeout: number
  }
  cache: {
    maxSize: number
    ttl: number
    strategy: 'LRU' | 'LFU' | 'FIFO'
  }
  circuitBreaker: {
    failureThreshold: number
    resetTimeout: number
    monitoringPeriod: number
  }
  batching: {
    maxBatchSize: number
    batchTimeout: number
  }
  monitoring: {
    metricsInterval: number
    alertThresholds: {
      responseTime: number
      errorRate: number
      memoryUsage: number
    }
  }
}

export class PerformanceOptimizer {
  private metricsIntervalId: NodeJS.Timeout | null
  private config: OptimizationConfig
  private metrics: PerformanceMetrics
  private connectionPool: Map<string, unknown[]>
  private cache: Map<
    string,
    { value: unknown; timestamp: number; accessCount: number }
  >
  private circuitBreakers: Map<
    string,
    {
      failures: number
      lastFailure: number
      state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
    }
  >
  private batchQueues: Map<
    string,
    { items: unknown[]; timer: NodeJS.Timeout | null }
  >
  private metricsHistory: PerformanceMetrics[]
  private activeCounts: Map<string, number>

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      connectionPool: {
        maxConnections: 100,
        minConnections: 5,
        acquireTimeout: 5000,
        idleTimeout: 30000,
        ...config.connectionPool,
      },
      cache: {
        maxSize: 10000,
        ttl: 300000, // 5 minutes
        strategy: 'LRU',
        ...config.cache,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 10000,
        ...config.circuitBreaker,
      },
      batching: {
        maxBatchSize: 100,
        batchTimeout: 100,
        ...config.batching,
      },
      monitoring: {
        metricsInterval: 5000,
        alertThresholds: {
          responseTime: 1000,
          errorRate: 0.05,
          memoryUsage: 0.8,
        },
        ...config.monitoring,
      },
    }

    this.metrics = {
      requestsPerSecond: 0,
      averageResponseTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      activeConnections: 0,
      cacheHitRate: 0,
    }

    this.connectionPool = new Map()
    this.cache = new Map()
    this.circuitBreakers = new Map()
    this.batchQueues = new Map()
    this.metricsHistory = []
    this.activeCounts = new Map()
    this.metricsIntervalId = null

    this.startMonitoring()
  }

  /**
   * Connection Pool Management
   */
  async acquireConnection(
    poolName: string,
    factory: () => Promise<unknown>,
  ): Promise<unknown> {
    if (!this.connectionPool.has(poolName)) {
      this.connectionPool.set(poolName, [])
    }
    if (!this.activeCounts.has(poolName)) {
      this.activeCounts.set(poolName, 0)
    }
    const pool = this.connectionPool.get(poolName)!
    const getActive = () => this.activeCounts.get(poolName) ?? 0
    // Return existing connection if available
    if (pool.length > 0) {
      this.activeCounts.set(poolName, getActive() + 1)
      return pool.pop()
    }
    // Create new connection if under limit
    if (getActive() + pool.length < this.config.connectionPool.maxConnections) {
      try {
        const connection = await factory()
        logger.debug(`Created new connection for pool: ${poolName}`)
        this.activeCounts.set(poolName, getActive() + 1)
        return connection
      } catch (error: unknown) {
        logger.error(`Failed to create connection for pool: ${poolName}`, {
          error,
        })
        throw error
      }
    }
    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection acquire timeout for pool: ${poolName}`))
      }, this.config.connectionPool.acquireTimeout)
      const checkForConnection = () => {
        if (pool.length > 0) {
          clearTimeout(timeout)
          this.activeCounts.set(poolName, getActive() + 1)
          resolve(pool.pop())
        } else {
          setTimeout(checkForConnection, 10)
        }
      }
      checkForConnection()
    })
  }

  releaseConnection(poolName: string, connection: unknown): void {
    if (!this.connectionPool.has(poolName)) {
      return
    }

    const pool = this.connectionPool.get(poolName)!
    const active = this.activeCounts.get(poolName) ?? 0
    if (active > 0) {
      this.activeCounts.set(poolName, active - 1)
    }
    if (pool.length < this.config.connectionPool.maxConnections) {
      pool.push(connection)
    }
  }

  /**
   * Intelligent Caching
   */
  set(key: string, value: unknown): void {
    const now = Date.now()

    // Evict expired entries
    this.evictExpired()

    // Evict based on strategy if cache is full
    if (this.cache.size >= this.config.cache.maxSize) {
      this.evictByStrategy()
    }

    this.cache.set(key, {
      value,
      timestamp: now,
      accessCount: 1,
    })
  }

  get(key: string): unknown | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    const now = Date.now()
    if (now - entry.timestamp > this.config.cache.ttl) {
      this.cache.delete(key)
      return null
    }

    entry.accessCount++
    return entry.value
  }

  private evictExpired() {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.cache.ttl) {
        this.cache.delete(key)
      }
    }
  }

  private evictByStrategy() {
    if (this.cache.size === 0) {
      return
    }

    let keyToEvict: string | undefined

    switch (this.config.cache.strategy) {
      case 'LRU':
        keyToEvict = this.findLRUKey()
        break
      case 'LFU':
        keyToEvict = this.findLFUKey()
        break
      case 'FIFO':
        keyToEvict = this.cache.keys().next().value
        break
      default:
        keyToEvict = this.cache.keys().next().value
    }

    if (!keyToEvict) {
      return
    }
    this.cache.delete(keyToEvict)
  }

  private findLRUKey(): string {
    let oldestKey = ''
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    return oldestKey
  }

  private findLFUKey(): string {
    let leastUsedKey = ''
    let leastCount = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < leastCount) {
        leastCount = entry.accessCount
        leastUsedKey = key
      }
    }

    return leastUsedKey
  }

  /**
   * Circuit Breaker Pattern
   */
  async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(serviceName)

    if (breaker.state === 'OPEN') {
      const now = Date.now()
      if (now - breaker.lastFailure > this.config.circuitBreaker.resetTimeout) {
        breaker.state = 'HALF_OPEN'
      } else {
        if (fallback) {
          return await fallback()
        }
        throw new Error(`Circuit breaker is OPEN for service: ${serviceName}`)
      }
    }

    try {
      const result = await operation()

      if (breaker.state === 'HALF_OPEN') {
        breaker.state = 'CLOSED'
        breaker.failures = 0
      }

      return result
    } catch (error: unknown) {
      breaker.failures++
      breaker.lastFailure = Date.now()

      if (breaker.failures >= this.config.circuitBreaker.failureThreshold) {
        breaker.state = 'OPEN'
      }

      if (fallback) {
        return await fallback()
      }

      throw error
    }
  }

  private getCircuitBreaker(serviceName: string): {
    failures: number
    lastFailure: number
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  } {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, {
        failures: 0,
        lastFailure: 0,
        state: 'CLOSED',
      })
    }
    return this.circuitBreakers.get(serviceName)!
  }

  /**
   * Request Batching
   */
  async addToBatch<T>(
    batchName: string,
    item: T,
    processor: (items: T[]) => Promise<void>,
  ): Promise<void> {
    if (!this.batchQueues.has(batchName)) {
      this.batchQueues.set(batchName, {
        items: [],
        timer: null,
      })
    }

    const batch = this.batchQueues.get(batchName)!
    batch.items.push(item)

    // Process immediately if batch is full
    if (batch.items.length >= this.config.batching.maxBatchSize) {
      await this.processBatch(batchName, processor)
      return
    }

    // Set timer for batch processing if not already set
    if (!batch.timer) {
      batch.timer = setTimeout(async () => {
        await this.processBatch(batchName, processor)
      }, this.config.batching.batchTimeout)
    }
  }

  private async processBatch<T>(
    batchName: string,
    processor: (items: T[]) => Promise<void>,
  ): Promise<void> {
    const batch = this.batchQueues.get(batchName)
    if (!batch || batch.items.length === 0) {
      return
    }

    // stored items are any[]; cast to T[] for the processor
    const items = [...batch.items] as unknown as T[]
    batch.items = []

    if (batch.timer) {
      clearTimeout(batch.timer)
      batch.timer = null
    }

    try {
      await processor(items)
    } catch (error: unknown) {
      logger.error(`Batch processing failed for: ${batchName}`, {
        error,
        itemCount: items.length,
      })
    }
  }

  /**
   * Performance Monitoring
   */
  private startMonitoring() {
    this.metricsIntervalId = setInterval(() => {
      this.updateMetrics()
      this.checkAlerts()
    }, this.config.monitoring.metricsInterval)
  }

  private updateMetrics() {
    // Update cache hit rate
    const totalCacheAccesses = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + entry.accessCount,
      0,
    )
    const cacheHits = this.cache.size
    this.metrics.cacheHitRate =
      totalCacheAccesses > 0 ? cacheHits / totalCacheAccesses : 0

    // Update active connections
    this.metrics.activeConnections = Array.from(
      this.connectionPool.values(),
    ).reduce((sum, pool) => sum + pool.length, 0)

    // Update memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage()
      this.metrics.memoryUsage = memUsage.heapUsed / memUsage.heapTotal
    }

    // Store metrics history
    this.metricsHistory.push({ ...this.metrics })
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift()
    }
  }

  private checkAlerts() {
    const thresholds = this.config.monitoring.alertThresholds

    if (this.metrics.averageResponseTime > thresholds.responseTime) {
      logger.warn('High response time detected', {
        current: this.metrics.averageResponseTime,
        threshold: thresholds.responseTime,
      })
    }

    if (this.metrics.errorRate > thresholds.errorRate) {
      logger.warn('High error rate detected', {
        current: this.metrics.errorRate,
        threshold: thresholds.errorRate,
      })
    }

    if (this.metrics.memoryUsage > thresholds.memoryUsage) {
      logger.warn('High memory usage detected', {
        current: this.metrics.memoryUsage,
        threshold: thresholds.memoryUsage,
      })
    }
  }

  /**
   * Performance Optimization Recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.metrics.cacheHitRate < 0.7) {
      recommendations.push(
        'Cache hit rate is low. Consider increasing cache size or TTL.',
      )
    }

    if (this.metrics.averageResponseTime > 500) {
      recommendations.push(
        'Response times are high. Consider connection pooling or request batching.',
      )
    }

    if (this.metrics.memoryUsage > 0.8) {
      recommendations.push(
        'Memory usage is high. Implement garbage collection or reduce cache size.',
      )
    }

    if (this.metrics.errorRate > 0.02) {
      recommendations.push(
        'Error rate is elevated. Check circuit breaker configuration.',
      )
    }

    const openCircuitBreakers = Array.from(
      this.circuitBreakers.entries(),
    ).filter(([_, breaker]) => breaker.state === 'OPEN')

    if (openCircuitBreakers.length > 0) {
      recommendations.push(
        `Circuit breakers are open for: ${openCircuitBreakers.map(([name]) => name).join(', ')}`,
      )
    }

    return recommendations
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory]
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Clear all timers
    for (const batch of this.batchQueues.values()) {
      if (batch.timer) {
        clearTimeout(batch.timer)
      }
    }

    if (this.metricsIntervalId) {
      clearInterval(this.metricsIntervalId)
      this.metricsIntervalId = null
    }

    // Clear caches
    this.cache.clear()
    this.batchQueues.clear()
    this.metricsHistory.length = 0
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer()
