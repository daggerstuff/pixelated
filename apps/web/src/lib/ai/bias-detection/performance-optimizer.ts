/**
 * Performance optimizer facade — wires the managers together.
 * Manager classes extracted to dedicated modules.
 */

import { ConnectionPoolManager } from './connection-pool-manager'
import { IntelligentCacheManager } from './intelligent-cache-manager'
import { BatchProcessor } from './batch-processor'
import { BackgroundJobQueue } from './background-job-queue'
import { MemoryOptimizer } from './memory-optimizer'

import type { ConnectionPool } from './connection-pool'
import type { PerformanceOptimizerConfig, BatchProcessingOptions, PerformanceStats } from './performance-optimizer.types'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('PerformanceOptimizer')


/**
 * Main Performance Optimizer Class
 */
export class PerformanceOptimizer {
  private readonly config: PerformanceOptimizerConfig
  private readonly connectionManager: ConnectionPoolManager
  private readonly cacheManager: IntelligentCacheManager
  private readonly batchProcessor: BatchProcessor
  private readonly jobQueue: BackgroundJobQueue
  private readonly memoryOptimizer: MemoryOptimizer
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
  async addBackgroundJob(
    type: string,
    data: unknown,
    options?: { priority?: number; timeout?: number; maxAttempts?: number },
  ): Promise<string> {
    return this.jobQueue.addJob(type, data, options)
  }

  /**
   * Get comprehensive performance statistics
   */
  async getPerformanceStats(): Promise<PerformanceStats> {
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
      } catch (error: unknown) {
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
  performanceOptimizer ??= new PerformanceOptimizer(config);
  return performanceOptimizer
}

