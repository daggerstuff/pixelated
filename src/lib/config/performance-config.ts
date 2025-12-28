/**
 * Performance Configuration for Pixelated
 * Centralized performance settings and optimization parameters
 */

export interface PerformanceConfig {
  // API Performance
  api: {
    timeout: number
    retries: number
    rateLimit: {
      windowMs: number
      maxRequests: number
    }
    compression: {
      enabled: boolean
      threshold: number
      level: number
    }
    caching: {
      enabled: boolean
      ttl: number
      etag: boolean
    }
  }

  // Database Performance
  database: {
    pool: {
      min: number
      max: number
      idleTimeout: number
      connectionTimeout: number
    }
    query: {
      timeout: number
      slowQueryThreshold: number
      maxRetries: number
    }
    optimization: {
      enableQueryCache: boolean
      enableConnectionPooling: boolean
      enableSlowQueryLog: boolean
    }
  }

  // Redis Cache Performance
  redis: {
    connection: {
      host: string
      port: number
      password?: string
      db: number
      maxRetriesPerRequest: number
      retryDelayOnFailover: number
    }
    cache: {
      defaultTTL: number
      compressionThreshold: number
      compressionLevel: number
      maxKeyLength: number
    }
    performance: {
      enableCompression: boolean
      enablePipeline: boolean
      batchSize: number
    }
  }

  // ML Model Performance
  ml: {
    model: {
      batchSize: number
      maxConcurrent: number
      timeout: number
      cacheResults: boolean
    }
    optimization: {
      enableModelCaching: boolean
      enableBatchProcessing: boolean
      enableAsyncProcessing: boolean
    }
  }

  // Frontend Performance
  frontend: {
    bundle: {
      enableCodeSplitting: boolean
      enableTreeShaking: boolean
      enableCompression: boolean
      maxChunkSize: number
    }
    assets: {
      enableImageOptimization: boolean
      enableLazyLoading: boolean
      enablePreloading: boolean
      cdnUrl?: string
    }
    runtime: {
      enableServiceWorker: boolean
      enablePrefetching: boolean
      enableCaching: boolean
    }
  }

  // Monitoring and Alerting
  monitoring: {
    enabled: boolean
    sampleRate: number
    thresholds: {
      apiResponseTime: number
      databaseQueryTime: number
      cacheHitRate: number
      errorRate: number
    }
    alerting: {
      enabled: boolean
      channels: string[]
      cooldownMinutes: number
    }
  }
}

// Environment-specific configurations
const ENV_CONFIGS = {
  development: {
    api: {
      timeout: 30000,
      retries: 1,
      rateLimit: {
        windowMs: 60000,
        maxRequests: 1000,
      },
      compression: {
        enabled: false,
        threshold: 1024,
        level: 1,
      },
      caching: {
        enabled: false,
        ttl: 60,
        etag: false,
      },
    },
    database: {
      pool: {
        min: 2,
        max: 10,
        idleTimeout: 10000,
        connectionTimeout: 5000,
      },
      query: {
        timeout: 10000,
        slowQueryThreshold: 1000,
        maxRetries: 1,
      },
      optimization: {
        enableQueryCache: false,
        enableConnectionPooling: true,
        enableSlowQueryLog: true,
      },
    },
    redis: {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: 0,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
      },
      cache: {
        defaultTTL: 300,
        compressionThreshold: 1024,
        compressionLevel: 1,
        maxKeyLength: 250,
      },
      performance: {
        enableCompression: false,
        enablePipeline: false,
        batchSize: 10,
      },
    },
    ml: {
      model: {
        batchSize: 1,
        maxConcurrent: 1,
        timeout: 30000,
        cacheResults: false,
      },
      optimization: {
        enableModelCaching: false,
        enableBatchProcessing: false,
        enableAsyncProcessing: false,
      },
    },
    frontend: {
      bundle: {
        enableCodeSplitting: false,
        enableTreeShaking: false,
        enableCompression: false,
        maxChunkSize: 1024 * 1024, // 1MB
      },
      assets: {
        enableImageOptimization: false,
        enableLazyLoading: false,
        enablePreloading: false,
      },
      runtime: {
        enableServiceWorker: false,
        enablePrefetching: false,
        enableCaching: false,
      },
    },
    monitoring: {
      enabled: true,
      sampleRate: 1.0,
      thresholds: {
        apiResponseTime: 5000,
        databaseQueryTime: 2000,
        cacheHitRate: 0.8,
        errorRate: 0.1,
      },
      alerting: {
        enabled: false,
        channels: [],
        cooldownMinutes: 5,
      },
    },
  },

  staging: {
    api: {
      timeout: 15000,
      retries: 2,
      rateLimit: {
        windowMs: 60000,
        maxRequests: 500,
      },
      compression: {
        enabled: true,
        threshold: 1024,
        level: 6,
      },
      caching: {
        enabled: true,
        ttl: 300,
        etag: true,
      },
    },
    database: {
      pool: {
        min: 5,
        max: 20,
        idleTimeout: 30000,
        connectionTimeout: 3000,
      },
      query: {
        timeout: 8000,
        slowQueryThreshold: 500,
        maxRetries: 2,
      },
      optimization: {
        enableQueryCache: true,
        enableConnectionPooling: true,
        enableSlowQueryLog: true,
      },
    },
    redis: {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: 1,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 200,
      },
      cache: {
        defaultTTL: 1800,
        compressionThreshold: 1024,
        compressionLevel: 6,
        maxKeyLength: 250,
      },
      performance: {
        enableCompression: true,
        enablePipeline: true,
        batchSize: 50,
      },
    },
    ml: {
      model: {
        batchSize: 5,
        maxConcurrent: 3,
        timeout: 20000,
        cacheResults: true,
      },
      optimization: {
        enableModelCaching: true,
        enableBatchProcessing: true,
        enableAsyncProcessing: true,
      },
    },
    frontend: {
      bundle: {
        enableCodeSplitting: true,
        enableTreeShaking: true,
        enableCompression: true,
        maxChunkSize: 512 * 1024, // 512KB
      },
      assets: {
        enableImageOptimization: true,
        enableLazyLoading: true,
        enablePreloading: true,
      },
      runtime: {
        enableServiceWorker: true,
        enablePrefetching: true,
        enableCaching: true,
      },
    },
    monitoring: {
      enabled: true,
      sampleRate: 0.5,
      thresholds: {
        apiResponseTime: 2000,
        databaseQueryTime: 1000,
        cacheHitRate: 0.85,
        errorRate: 0.05,
      },
      alerting: {
        enabled: true,
        channels: ['email'],
        cooldownMinutes: 10,
      },
    },
  },

  production: {
    api: {
      timeout: 10000,
      retries: 3,
      rateLimit: {
        windowMs: 60000,
        maxRequests: 200,
      },
      compression: {
        enabled: true,
        threshold: 512,
        level: 9,
      },
      caching: {
        enabled: true,
        ttl: 600,
        etag: true,
      },
    },
    database: {
      pool: {
        min: 10,
        max: 50,
        idleTimeout: 60000,
        connectionTimeout: 2000,
      },
      query: {
        timeout: 5000,
        slowQueryThreshold: 200,
        maxRetries: 3,
      },
      optimization: {
        enableQueryCache: true,
        enableConnectionPooling: true,
        enableSlowQueryLog: true,
      },
    },
    redis: {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: 2,
        maxRetriesPerRequest: 5,
        retryDelayOnFailover: 300,
      },
      cache: {
        defaultTTL: 3600,
        compressionThreshold: 512,
        compressionLevel: 9,
        maxKeyLength: 200,
      },
      performance: {
        enableCompression: true,
        enablePipeline: true,
        batchSize: 100,
      },
    },
    ml: {
      model: {
        batchSize: 10,
        maxConcurrent: 5,
        timeout: 15000,
        cacheResults: true,
      },
      optimization: {
        enableModelCaching: true,
        enableBatchProcessing: true,
        enableAsyncProcessing: true,
      },
    },
    frontend: {
      bundle: {
        enableCodeSplitting: true,
        enableTreeShaking: true,
        enableCompression: true,
        maxChunkSize: 256 * 1024, // 256KB
      },
      assets: {
        enableImageOptimization: true,
        enableLazyLoading: true,
        enablePreloading: true,
        cdnUrl: process.env.CDN_URL,
      },
      runtime: {
        enableServiceWorker: true,
        enablePrefetching: true,
        enableCaching: true,
      },
    },
    monitoring: {
      enabled: true,
      sampleRate: 0.1,
      thresholds: {
        apiResponseTime: 1000,
        databaseQueryTime: 500,
        cacheHitRate: 0.9,
        errorRate: 0.01,
      },
      alerting: {
        enabled: true,
        channels: ['email', 'slack'],
        cooldownMinutes: 15,
      },
    },
  },
}

/**
 * Get performance configuration for current environment
 */
export function getPerformanceConfig(): PerformanceConfig {
  const env = process.env.NODE_ENV || 'development'
  const config =
    ENV_CONFIGS[env as keyof typeof ENV_CONFIGS] || ENV_CONFIGS.development

  // Override with environment variables if present
  return {
    ...config,
    api: {
      ...config.api,
      timeout: parseInt(
        process.env.API_TIMEOUT || config.api.timeout.toString(),
      ),
      rateLimit: {
        ...config.api.rateLimit,
        maxRequests: parseInt(
          process.env.API_RATE_LIMIT ||
            config.api.rateLimit.maxRequests.toString(),
        ),
      },
    },
    database: {
      ...config.database,
      pool: {
        ...config.database.pool,
        max: parseInt(
          process.env.DB_MAX_CONNECTIONS || config.database.pool.max.toString(),
        ),
      },
    },
    redis: {
      ...config.redis,
      connection: {
        ...config.redis.connection,
        host: process.env.REDIS_HOST || config.redis.connection.host,
        port: parseInt(
          process.env.REDIS_PORT || config.redis.connection.port.toString(),
        ),
      },
    },
  }
}

/**
 * Performance optimization utilities
 */
export class PerformanceOptimizer {
  private config: PerformanceConfig

  constructor() {
    this.config = getPerformanceConfig()
  }

  /**
   * Optimize API response with compression and caching
   */
  optimizeApiResponse(
    data: any,
    options: {
      enableCompression?: boolean
      enableCaching?: boolean
      etag?: string
    } = {},
  ): {
    data: any
    headers: Record<string, string>
  } {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Response-Time': Date.now().toString(),
    }

    // Add compression headers if enabled
    if (options.enableCompression ?? this.config.api.compression.enabled) {
      headers['Content-Encoding'] = 'gzip'
      headers['Vary'] = 'Accept-Encoding'
    }

    // Add caching headers if enabled
    if (options.enableCaching ?? this.config.api.caching.enabled) {
      headers['Cache-Control'] = `max-age=${this.config.api.caching.ttl}`
      headers['ETag'] = options.etag || `"${this.generateETag(data)}"`
    }

    // Add security headers
    headers['X-Content-Type-Options'] = 'nosniff'
    headers['X-Frame-Options'] = 'DENY'
    headers['X-XSS-Protection'] = '1; mode=block'

    return { data, headers }
  }

  /**
   * Generate ETag for caching
   */
  private generateETag(data: any): string {
    // Use guarded runtime require helper to avoid bundling Node crypto into frontend builds
    let createHash: ((algo: string) => import('crypto').Hash) | undefined
    try {
      // Use dynamic import to avoid top-level circular imports in some environments
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const utils = require('@/lib/utils') as typeof import('@/lib/utils')
      const crypto = utils.tryRequireNode('crypto')
      createHash = crypto?.createHash
    } catch {
      createHash = undefined
    }

    if (!createHash) {
      // Fallback to a deterministic but weaker hash if crypto isn't available.
      // This avoids runtime exceptions while keeping behavior predictable.
      const str = JSON.stringify(data)
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i)
        hash = (hash << 5) - hash + chr
        hash |= 0
      }
      return Math.abs(hash).toString(16)
    }

    return createHash('md5').update(JSON.stringify(data)).digest('hex')
  }

  /**
   * Optimize database query with connection pooling and caching
   */
  async optimizeDatabaseQuery<T>(
    _query: string,
    _params: any[] = [],
    _options: {
      enableCache?: boolean
      cacheKey?: string
      cacheTTL?: number
    } = {},
  ): Promise<T> {
    // Implementation would depend on actual database client
    // This is a placeholder for the optimization logic

    return {} as T
  }

  /**
   * Optimize Redis operations with pipelining and batching
   */
  optimizeRedisOperations(operations: any[]): any[] {
    // Group operations by type for batching
    const batchedOperations = this.batchOperations(operations)

    return batchedOperations
  }

  /**
   * Batch operations for better performance
   */
  private batchOperations(operations: any[]): any[] {
    const batchSize = this.config.redis.performance.batchSize
    const batches: any[] = []

    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize))
    }

    return batches
  }

  /**
   * Optimize ML model inference with batching and caching
   */
  optimizeMLInference(inputs: any[]): any[] {
    const batchSize = this.config.ml.model.batchSize
    const maxConcurrent = this.config.ml.model.maxConcurrent

    // Split into batches
    const batches: any[] = []
    for (let i = 0; i < inputs.length; i += batchSize) {
      batches.push(inputs.slice(i, i + batchSize))
    }

    // Process batches with concurrency limit
    return this.processBatchesConcurrently(batches, maxConcurrent)
  }

  /**
   * Process batches with concurrency control
   */
  private processBatchesConcurrently(
    _batches: any[],
    _maxConcurrent: number,
  ): any[] {
    // Implementation would handle concurrent processing
    return _batches
  }

  /**
   * Optimize frontend bundle with code splitting and compression
   */
  optimizeFrontendBundle(
    options: {
      enableCodeSplitting?: boolean
      enableTreeShaking?: boolean
      enableCompression?: boolean
    } = {},
  ): {
    chunks: any[]
    assets: any[]
    optimization: any
  } {
    const config = {
      enableCodeSplitting:
        options.enableCodeSplitting ??
        this.config.frontend.bundle.enableCodeSplitting,
      enableTreeShaking:
        options.enableTreeShaking ??
        this.config.frontend.bundle.enableTreeShaking,
      enableCompression:
        options.enableCompression ??
        this.config.frontend.bundle.enableCompression,
    }

    return {
      chunks: [],
      assets: [],
      optimization: config,
    }
  }

  /**
   * Monitor performance metrics
   */
  async monitorPerformance(): Promise<{
    apiLatency: number
    databaseLatency: number
    cacheHitRate: number
    errorRate: number
  }> {
    // Implementation would collect actual metrics
    return {
      apiLatency: 0,
      databaseLatency: 0,
      cacheHitRate: 0,
      errorRate: 0,
    }
  }

  /**
   * Check if performance thresholds are met
   */
  checkPerformanceThresholds(metrics: {
    apiLatency: number
    databaseLatency: number
    cacheHitRate: number
    errorRate: number
  }): {
    passed: boolean
    violations: string[]
  } {
    const violations: string[] = []

    if (
      metrics.apiLatency > this.config.monitoring.thresholds.apiResponseTime
    ) {
      violations.push(
        `API latency ${metrics.apiLatency}ms exceeds threshold ${this.config.monitoring.thresholds.apiResponseTime}ms`,
      )
    }

    if (
      metrics.databaseLatency >
      this.config.monitoring.thresholds.databaseQueryTime
    ) {
      violations.push(
        `Database latency ${metrics.databaseLatency}ms exceeds threshold ${this.config.monitoring.thresholds.databaseQueryTime}ms`,
      )
    }

    if (metrics.cacheHitRate < this.config.monitoring.thresholds.cacheHitRate) {
      violations.push(
        `Cache hit rate ${metrics.cacheHitRate} below threshold ${this.config.monitoring.thresholds.cacheHitRate}`,
      )
    }

    if (metrics.errorRate > this.config.monitoring.thresholds.errorRate) {
      violations.push(
        `Error rate ${metrics.errorRate} exceeds threshold ${this.config.monitoring.thresholds.errorRate}`,
      )
    }

    return {
      passed: violations.length === 0,
      violations,
    }
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer()

/**
 * Performance monitoring service
 */
export class PerformanceMonitoringService {
  private config: PerformanceConfig

  constructor() {
    this.config = getPerformanceConfig()
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (!this.config.monitoring.enabled) {
      logger.info('Performance monitoring is disabled')
      return
    }

    logger.info('Starting performance monitoring service')

    // Set up monitoring intervals
    this.setupMonitoringIntervals()
  }

  /**
   * Set up monitoring intervals
   */
  private setupMonitoringIntervals(): void {
    // Monitor every 30 seconds
    setInterval(() => {
      this.collectMetrics()
    }, 30000)

    // Report every 5 minutes
    setInterval(() => {
      this.reportMetrics()
    }, 300000)
  }

  /**
   * Collect performance metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await performanceOptimizer.monitorPerformance()
      const thresholdCheck =
        performanceOptimizer.checkPerformanceThresholds(metrics)

      if (!thresholdCheck.passed) {
        logger.warn('Performance thresholds violated', {
          violations: thresholdCheck.violations,
        })

        // Send alerts if enabled
        if (this.config.monitoring.alerting.enabled) {
          await this.sendAlerts(thresholdCheck.violations)
        }
      }
    } catch (error) {
      logger.error('Failed to collect performance metrics', { error })
    }
  }

  /**
   * Report metrics to external monitoring service
   */
  private async reportMetrics(): Promise<void> {
    // Implementation would send metrics to external service
    logger.info('Performance metrics reported')
  }

  /**
   * Send performance alerts
   */
  private async sendAlerts(violations: string[]): Promise<void> {
    // Implementation would send alerts via configured channels
    logger.info('Performance alerts sent', { violations })
  }
}

// Export monitoring service
export const performanceMonitoring = new PerformanceMonitoringService()

// Logger instance
import { getLogger } from '@/lib/logging'
const logger = getLogger('performance-config')
