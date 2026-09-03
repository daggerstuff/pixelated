/**
 * Memory optimizer and resource management.
 */

import type { PerformanceOptimizerConfig } from './performance-optimizer.types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
const logger = createBuildSafeLogger('PerformanceOptimizer')

/**
 * Memory Monitor and Optimizer
 */
export class MemoryOptimizer {
  private readonly config: PerformanceOptimizerConfig['memory']
  private gcInterval?: ReturnType<typeof setInterval>
  private readonly stats = {
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
