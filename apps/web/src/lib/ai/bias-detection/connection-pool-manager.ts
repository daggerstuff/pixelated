/**
 * Connection pool manager for external service HTTP pools.
 */

import { ConnectionPool } from './connection-pool'
import type { PerformanceOptimizerConfig } from './performance-optimizer.types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
const logger = createBuildSafeLogger('PerformanceOptimizer')

/**
 * Enhanced Connection Pool Manager
 * Manages multiple connection pools for different services
 */
export class ConnectionPoolManager {
  private readonly httpPools = new Map<string, ConnectionPool>()
  private readonly config: PerformanceOptimizerConfig

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

    for (const [url, pool] of this.httpPools) {
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

    for (const [url, pool] of this.httpPools) {
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
      Array.from(this.httpPools.values()).map( async (pool) => pool.dispose()),
    )
    this.httpPools.clear()
    logger.info('All connection pools disposed')
  }
}
