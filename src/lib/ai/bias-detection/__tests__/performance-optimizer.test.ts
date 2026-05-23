/**
 * Unit tests for Performance Optimizer
 *
 * Covers: ConnectionPoolManager, IntelligentCacheManager, BatchProcessor,
 * BackgroundJobQueue, MemoryOptimizer, and PerformanceOptimizer
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import {
  ConnectionPoolManager,
  IntelligentCacheManager,
  BatchProcessor,
  BackgroundJobQueue,
  MemoryOptimizer,
  PerformanceOptimizer,
  getPerformanceOptimizer,
  type PerformanceOptimizerConfig,
} from '../performance-optimizer'
import type { PerformanceStats } from '../performance-optimizer'

// Mock cache service
vi.mock('../../../services/cacheService', () => ({
  getCacheService: () => ({
    get: vi.fn().mockImplementation(async (key: string) => {
      if (key === 'existing-key') {
        return JSON.stringify({ data: 'cached-value' })
      }
      if (key === 'compressed-key') {
        return 'GZIP:' + Buffer.from(JSON.stringify({ data: 'compressed' })).toString('base64')
      }
      return null
    }),
    set: vi.fn().mockResolvedValue(undefined),
    mget: vi.fn().mockImplementation(async (keys: string[]) => {
      const result: Record<string, string | null> = {}
      for (const key of keys) {
        if (key === 'key1') {
          result[key] = JSON.stringify({ val: 1 })
        } else {
          result[key] = null
        }
      }
      return result
    }),
  }),
}))

// Mock logger
vi.mock('../../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

const defaultOptimizerConfig: PerformanceOptimizerConfig = {
  httpPool: {
    maxConnections: 5,
    connectionTimeout: 5000,
    idleTimeout: 30000,
    retryAttempts: 2,
    retryDelay: 100,
  },
  redisPool: {
    maxConnections: 5,
    idleTimeout: 30000,
    connectionTimeout: 5000,
  },
  cache: {
    enableCompression: true,
    compressionThreshold: 100,
    defaultTtl: 300,
    maxCacheSize: 100,
    enableDistributedCache: false,
  },
  batchProcessing: {
    defaultBatchSize: 5,
    maxConcurrency: 3,
    timeoutMs: 5000,
    retryAttempts: 1,
    enablePrioritization: true,
  },
  backgroundJobs: {
    enabled: false, // Disable for unit tests
    maxWorkers: 2,
    jobTimeout: 5000,
    retryDelay: 100,
    queueMaxSize: 100,
  },
  memory: {
    gcInterval: 60000,
    memoryThreshold: 90,
    enableMemoryMonitoring: false, // Disable for tests
    maxHeapSize: 512,
  },
  monitoring: {
    enableMetrics: false,
    metricsInterval: 60000,
    enableProfiling: false,
    slowQueryThreshold: 1000,
  },
}

describe('ConnectionPoolManager', () => {
  let manager: ConnectionPoolManager

  beforeEach(() => {
    manager = new ConnectionPoolManager(defaultOptimizerConfig)
  })

  afterEach(async () => {
    await manager.dispose()
  })

  describe('getHttpPool', () => {
    it('should create a new pool for unknown URLs', () => {
      const pool = manager.getHttpPool('http://service-a:5000')
      expect(pool).toBeDefined()
      const stats = pool.getStats()
      expect(stats.maxConnections).toBe(5)
    })

    it('should reuse existing pool for same URL', () => {
      const pool1 = manager.getHttpPool('http://service-a:5000')
      const pool2 = manager.getHttpPool('http://service-a:5000')
      expect(pool1).toBe(pool2)
    })

    it('should create separate pools for different URLs', () => {
      const pool1 = manager.getHttpPool('http://service-a:5000')
      const pool2 = manager.getHttpPool('http://service-b:5000')
      expect(pool1).not.toBe(pool2)
    })
  })

  describe('getPoolStats', () => {
    it('should return stats for all created pools', () => {
      manager.getHttpPool('http://service-a:5000')
      manager.getHttpPool('http://service-b:5000')
      const stats = manager.getPoolStats()
      expect(Object.keys(stats).length).toBe(2)
      expect(stats['http://service-a:5000']).toHaveProperty('totalConnections')
      expect(stats['http://service-b:5000']).toHaveProperty('totalConnections')
    })
  })

  describe('healthCheck', () => {
    it('should return healthy when no pools exist', async () => {
      const result = await manager.healthCheck()
      expect(result.healthy).toBe(true)
      expect(result.details).toEqual({})
    })

    it('should report pool health status', async () => {
      manager.getHttpPool('http://service-a:5000')
      const result = await manager.healthCheck()
      expect(result.healthy).toBe(true)
      expect(result.details['http://service-a:5000']).toBe(true)
    })
  })

  describe('dispose', () => {
    it('should clear all pools', async () => {
      manager.getHttpPool('http://service-a:5000')
      await manager.dispose()
      expect(manager.getPoolStats()).toEqual({})
    })
  })
})

describe('IntelligentCacheManager', () => {
  let cache: IntelligentCacheManager

  beforeEach(() => {
    cache = new IntelligentCacheManager(defaultOptimizerConfig.cache)
  })

  describe('get', () => {
    it('should retrieve cached values', async () => {
      const value = await cache.get<any>('existing-key')
      expect(value).toEqual({ data: 'cached-value' })
    })

    it('should return null for missing keys', async () => {
      const value = await cache.get('non-existent')
      expect(value).toBeNull()
    })

    it('should handle compressed data', async () => {
      const value = await cache.get<any>('compressed-key')
      expect(value).toEqual({ data: 'compressed' })
    })
  })

  describe('set', () => {
    it('should store values without error', async () => {
      await expect(
        cache.set('test-key', { hello: 'world' }),
      ).resolves.not.toThrow()
    })

    it('should store with custom TTL', async () => {
      await expect(
        cache.set('test-key', { data: 'test' }, 600),
      ).resolves.not.toThrow()
    })

    it('should compress data above threshold', async () => {
      const largeData = 'x'.repeat(200)
      await expect(cache.set('large-key', { data: largeData })).resolves.not.toThrow()
    })
  })

  describe('mget', () => {
    it('should retrieve multiple keys', async () => {
      const results = await cache.mget<any>(['key1', 'missing-key'])
      expect(results['key1']).toEqual({ val: 1 })
      expect(results['missing-key']).toBeNull()
    })

    it('should handle empty key list', async () => {
      const results = await cache.mget([])
      expect(results).toEqual({})
    })
  })

  describe('getStats', () => {
    it('should return initial zero stats', () => {
      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.hitRate).toBe(0)
    })

    it('should update stats after operations', async () => {
      await cache.get('existing-key') // hit
      await cache.get('missing-key') // miss

      const stats = cache.getStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(50)
    })
  })
})

describe('BatchProcessor', () => {
  let processor: BatchProcessor

  beforeEach(() => {
    processor = new BatchProcessor(defaultOptimizerConfig.batchProcessing)
  })

  describe('processBatch', () => {
    it('should process all items successfully', async () => {
      const items = [1, 2, 3, 4, 5]
      const processorFn = vi.fn(async (n: number) => n * 2)

      const { results, errors } = await processor.processBatch(items, processorFn)

      expect(results).toEqual([2, 4, 6, 8, 10])
      expect(errors).toHaveLength(0)
      expect(processorFn).toHaveBeenCalledTimes(5)
    })

    it('should handle empty items array', async () => {
      const { results, errors } = await processor.processBatch([], async (n: number) => n)
      expect(results).toHaveLength(0)
      expect(errors).toHaveLength(0)
    })

    it('should report errors for failed items', async () => {
      const items = [1, 2, 3]
      const processorFn = vi.fn(async (n: number) => {
        if (n === 2) throw new Error('Item failed')
        return n * 2
      })

      const { results, errors } = await processor.processBatch(items, processorFn)

      expect(results).toHaveLength(2)
      expect(errors).toHaveLength(1)
      expect(errors[0].item).toBe(2)
    })

    it('should respect batch size option', async () => {
      const items = [1, 2, 3, 4, 5]
      const processorFn = vi.fn(async (n: number) => n * 2)

      const { results } = await processor.processBatch(items, processorFn, { batchSize: 2 })
      expect(results).toEqual([2, 4, 6, 8, 10])
    })

    it('should call onProgress callback', async () => {
      const items = [1, 2, 3]
      const onProgress = vi.fn()
      const processorFn = vi.fn(async (n: number) => n * 2)

      await processor.processBatch(items, processorFn, { onProgress })

      expect(onProgress).toHaveBeenCalled()
      // Should be called for each completed item
      expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(3)
    })

    it('should retry failed items up to retry count', async () => {
      let attempts = 0
      const processorFn = vi.fn(async (n: number) => {
        attempts++
        if (attempts < 2) throw new Error('Retry needed')
        return n
      })

      const { results, errors } = await processor.processBatch(
        [1],
        processorFn,
        { retries: 2 },
      )

      expect(results).toEqual([1])
      expect(errors).toHaveLength(0)
    })

    it('should fail after max retries exceeded', async () => {
      const failingFn = vi.fn(async (n: number) => {
        throw new Error('Always fails')
      })

      const { results, errors } = await processor.processBatch(
        [1],
        failingFn,
        { retries: 1 },
      )

      expect(results).toHaveLength(0)
      expect(errors).toHaveLength(1)
      expect(failingFn).toHaveBeenCalledTimes(2) // Initial + 1 retry
    })
  })

  describe('getStats', () => {
    it('should return initial zero stats', () => {
      const stats = processor.getStats()
      expect(stats.completed).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.activeJobs).toBe(0)
      expect(stats.averageProcessingTime).toBe(0)
    })

    it('should update after processing', async () => {
      await processor.processBatch([1, 2], async (n) => n * 2)
      const stats = processor.getStats()
      expect(stats.completed).toBe(2)
    })
  })
})

describe('BackgroundJobQueue', () => {
  let queue: BackgroundJobQueue

  beforeEach(() => {
    queue = new BackgroundJobQueue({
      ...defaultOptimizerConfig.backgroundJobs,
      enabled: false,
    })
  })

  afterEach(async () => {
    await queue.stop()
  })

  describe('addJob', () => {
    it('should add a job to the queue', async () => {
      const jobId = await queue.addJob('test-job', { data: 'test' })
      expect(jobId).toBeTruthy()
      expect(jobId).toContain('job_')
    })

    it('should throw when queue is full', async () => {
      // Create a queue with max size 1
      const smallQueue = new BackgroundJobQueue({
        ...defaultOptimizerConfig.backgroundJobs,
        enabled: false,
        queueMaxSize: 1,
      })

      await smallQueue.addJob('job1', { data: 1 })

      await expect(
        smallQueue.addJob('job2', { data: 2 }),
      ).rejects.toThrow('Job queue is full')

      await smallQueue.stop()
    })
  })

  describe('getJobStatus', () => {
    it('should return null for unknown jobs', () => {
      const status = queue.getJobStatus('non-existent')
      expect(status).toBeNull()
    })

    it('should return pending status for newly added jobs', async () => {
      const jobId = await queue.addJob('test-job', { data: 'test' })
      const status = queue.getJobStatus(jobId)
      expect(status).not.toBeNull()
      expect(status?.status).toBe('pending')
      expect(status?.type).toBe('test-job')
    })
  })

  describe('getStats', () => {
    it('should return correct stats', async () => {
      await queue.addJob('job1', { data: 1 })
      await queue.addJob('job2', { data: 2 })

      const stats = queue.getStats()
      expect(stats.total).toBe(2)
      expect(stats.pending).toBe(2)
    })
  })
})

describe('MemoryOptimizer', () => {
  let optimizer: MemoryOptimizer

  afterEach(() => {
    optimizer.stop()
  })

  describe('getMemoryUsage', () => {
    it('should return current memory stats', () => {
      optimizer = new MemoryOptimizer({
        ...defaultOptimizerConfig.memory,
        enableMemoryMonitoring: false,
      })
      const usage = optimizer.getMemoryUsage()
      expect(usage).toHaveProperty('heapUsed')
      expect(usage).toHaveProperty('heapTotal')
      expect(usage).toHaveProperty('rss')
      expect(usage).toHaveProperty('heapUsedMB')
      expect(usage).toHaveProperty('heapTotalMB')
      expect(usage).toHaveProperty('heapUsagePercent')
    })
  })

  describe('forceGC', () => {
    it('should not throw when global.gc is unavailable', () => {
      optimizer = new MemoryOptimizer({
        ...defaultOptimizerConfig.memory,
        enableMemoryMonitoring: false,
      })
      // Should return false when gc is not exposed
      expect(optimizer.forceGC()).toBe(false)
    })
  })

  describe('isMemoryPressure', () => {
    it('should detect memory pressure based on threshold', () => {
      optimizer = new MemoryOptimizer({
        ...defaultOptimizerConfig.memory,
        memoryThreshold: 100, // Set very high threshold
        enableMemoryMonitoring: false,
      })
      // With threshold at 100%, heap usage should be below it
      expect(optimizer.isMemoryPressure()).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return current stats', () => {
      optimizer = new MemoryOptimizer({
        ...defaultOptimizerConfig.memory,
        enableMemoryMonitoring: false,
      })
      const stats = optimizer.getStats()
      expect(stats).toHaveProperty('gcCount')
      expect(stats).toHaveProperty('currentUsage')
      expect(stats).toHaveProperty('isUnderPressure')
    })
  })
})

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer

  afterEach(async () => {
    await optimizer.dispose()
  })

  describe('initialization', () => {
    it('should initialize with default config', () => {
      optimizer = new PerformanceOptimizer()
      expect(optimizer).toBeDefined()
    })

    it('should initialize with custom config', () => {
      optimizer = new PerformanceOptimizer(defaultOptimizerConfig)
      expect(optimizer).toBeDefined()
    })

    it('should create connection pool on demand', () => {
      optimizer = new PerformanceOptimizer(defaultOptimizerConfig)
      const pool = optimizer.getConnectionPool('http://service:5000')
      expect(pool).toBeDefined()
    })
  })

  describe('getCache', () => {
    it('should return the cache manager', () => {
      optimizer = new PerformanceOptimizer(defaultOptimizerConfig)
      const cache = optimizer.getCache()
      expect(cache).toBeInstanceOf(IntelligentCacheManager)
    })
  })

  describe('processBatch', () => {
    it('should delegate to batch processor', async () => {
      optimizer = new PerformanceOptimizer(defaultOptimizerConfig)
      const { results } = await optimizer.processBatch(
        [1, 2, 3],
        async (n: number) => n * 2,
      )
      expect(results).toEqual([2, 4, 6])
    })
  })

  describe('addBackgroundJob', () => {
    it('should add a background job', async () => {
      optimizer = new PerformanceOptimizer(defaultOptimizerConfig)
      const jobId = await optimizer.addBackgroundJob('test', { data: 'test' })
      expect(jobId).toBeTruthy()
    })
  })

  describe('getPerformanceStats', () => {
    it('should return comprehensive stats', async () => {
      optimizer = new PerformanceOptimizer(defaultOptimizerConfig)
      const stats = await optimizer.getPerformanceStats()
      expect(stats).toHaveProperty('connections')
      expect(stats).toHaveProperty('cache')
      expect(stats).toHaveProperty('batch')
      expect(stats).toHaveProperty('memory')
      expect(stats).toHaveProperty('performance')
      expect(stats.cache).toHaveProperty('hitRate')
      expect(stats.cache).toHaveProperty('missRate')
    })
  })

  describe('healthCheck', () => {
    it('should return healthy when all components are OK', async () => {
      optimizer = new PerformanceOptimizer(defaultOptimizerConfig)
      const result = await optimizer.healthCheck()
      expect(result).toHaveProperty('healthy')
      expect(result).toHaveProperty('components')
      expect(result.components).toHaveProperty('connections')
      expect(result.components).toHaveProperty('memory')
      expect(result.components).toHaveProperty('cache')
    })
  })

  describe('dispose', () => {
    it('should clean up resources', async () => {
      optimizer = new PerformanceOptimizer(defaultOptimizerConfig)
      await expect(optimizer.dispose()).resolves.not.toThrow()
    })

    it('should be idempotent', async () => {
      optimizer = new PerformanceOptimizer(defaultOptimizerConfig)
      await optimizer.dispose()
      await expect(optimizer.dispose()).resolves.not.toThrow()
    })
  })
})

describe('getPerformanceOptimizer', () => {
  it('should return the same singleton instance', () => {
    const instance1 = getPerformanceOptimizer()
    const instance2 = getPerformanceOptimizer()
    expect(instance1).toBe(instance2)
  })
})
