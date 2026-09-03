/**
 * Performance optimizer type definitions.
 * Extracted from performance-optimizer.ts.
 */

import type { ConnectionPoolConfig } from './connection-pool'

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

