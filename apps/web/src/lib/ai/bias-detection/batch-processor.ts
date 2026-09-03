/**
 * Batch processor with concurrency (Semaphore).
 */

import type { PerformanceOptimizerConfig, BatchProcessingOptions } from './performance-optimizer.types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
const logger = createBuildSafeLogger('PerformanceOptimizer')

/**
 * Batch Processing Engine with Concurrency Control
 */
export class BatchProcessor {
  private readonly config: PerformanceOptimizerConfig['batchProcessing']
  private readonly activeJobs = new Map<string, Promise<unknown>>()
  private readonly stats = {
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
          batch.map( async (item) =>
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
      } catch (error: unknown) {
        lastError = error as Error

        if (attempt < retries) {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000),
          )
        }
      }
    }

    lastError ??= new Error('Unknown error occurred during processing');
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
 * Semaphore for concurrency control
 */
class Semaphore {
  private permits: number
  private readonly waitQueue: Array<() => void> = []

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
