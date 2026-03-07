/**
 * Enhanced Redis Connection Pool Manager
 *
 * Provides optimized Redis connection pooling with:
 * - Multiple connection pools for different use cases
 * - Automatic failover and health monitoring
 * - Connection lifecycle management
 * - Performance metrics and monitoring
 */

import { getBiasDetectionLogger } from '../../logging/standardized-logger'
import { RedisService } from '../../services/redis/RedisService'
import type { RedisServiceConfig } from '../../services/redis/types'

const logger = getBiasDetectionLogger('redis-pool-manager')

export interface RedisPoolConfig {
  // Pool configuration
  maxConnections: number
  minConnections: number
  idleTimeout: number // ms
  connectionTimeout: number // ms

  // Health monitoring
  healthCheckInterval: number // ms
  maxRetries: number
  retryDelay: number // ms

  // Performance
  enableMetrics: boolean
  metricsInterval: number // ms

  // Redis-specific
  keyPrefix?: string
  enableCompression?: boolean
  compressionThreshold?: number // bytes
}

export interface RedisPoolStats {
  total: number
  active: number
  idle: number
  waiting: number
  created: number
  destroyed: number
  errors: number
  avgResponseTime: number
  hitRate: number
  missRate: number
}

export interface RedisConnection {
  id: string
  service: RedisService
  inUse: boolean
  createdAt: Date
  lastUsed: Date
  requestCount: number
  errorCount: number
}

/**
 * Redis Connection Pool for specific use cases
 */
export class RedisConnectionPool {
  private connections: Map<string, RedisConnection> = new Map()
  private waitQueue: Array<{
    resolve: (connection: RedisConnection) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }> = []

  private config: RedisPoolConfig
  private stats: RedisPoolStats
  private healthCheckInterval?: ReturnType<typeof setInterval>
  private metricsInterval?: ReturnType<typeof setInterval>
  private isDisposed = false

  constructor(
    private name: string,
    private redisConfig: RedisServiceConfig,
    config: Partial<RedisPoolConfig> = {},
  ) {
    this.config = {
      maxConnections: 10,
      minConnections: 2,
      idleTimeout: 300000, // 5 minutes
      connectionTimeout: 5000,
      healthCheckInterval: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000,
      enableMetrics: true,
      metricsInterval: 60000, // 1 minute
      ...config,
    }

    this.stats = {
      total: 0,
      active: 0,
      idle: 0,
      waiting: 0,
      created: 0,
      destroyed: 0,
      errors: 0,
      avgResponseTime: 0,
      hitRate: 0,
      missRate: 0,
    }

    this.initialize()
  }

  private async initialize(): Promise<void> {
    // Create minimum connections
    for (let i = 0; i < this.config.minConnections; i++) {
      try {
        await this.createConnection()
      } catch (error) {
        logger.error(`Failed to create initial connection ${i}`, {
          pool: this.name,
          error,
        })
      }
    }

    // Start health monitoring
    this.startHealthCheck()

    // Start metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection()
    }

    logger.info('Redis connection pool initialized', {
      pool: this.name,
      minConnections: this.config.minConnections,
      maxConnections: this.config.maxConnections,
    })
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<RedisConnection> {
    if (this.isDisposed) {
      throw new Error('Connection pool is disposed')
    }

    // Try to find an available connection
    for (const connection of this.connections.values()) {
      if (!connection.inUse && (await this.isConnectionHealthy(connection))) {
        connection.inUse = true
        connection.lastUsed = new Date()
        connection.requestCount++
        this.updateStats()
        return connection
      }
    }

    // Create new connection if under limit
    if (this.connections.size < this.config.maxConnections) {
      const connection = await this.createConnection()
      connection.inUse = true
      connection.requestCount++
      this.updateStats()
      return connection
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex(
          (item) => item.resolve === resolve,
        )
        if (index !== -1) {
          this.waitQueue.splice(index, 1)
          this.stats.waiting--
        }
        reject(
          new Error(
            `Connection pool timeout after ${this.config.connectionTimeout}ms`,
          ),
        )
      }, this.config.connectionTimeout)

      this.waitQueue.push({ resolve, reject, timeout })
      this.stats.waiting++
    })
  }

  /**
   * Release a connection back to the pool
   */
  release(connection: RedisConnection): void {
    if (this.isDisposed) {
      return
    }

    connection.inUse = false
    connection.lastUsed = new Date()

    // Process waiting queue
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!
      clearTimeout(waiter.timeout)
      this.stats.waiting--

      connection.inUse = true
      connection.requestCount++
      waiter.resolve(connection)
    }

    this.updateStats()
  }

  /**
   * Execute a Redis operation with automatic connection management
   */
  async execute<T>(
    operation: (service: RedisService) => Promise<T>,
    retries: number = this.config.maxRetries,
  ): Promise<T> {
    let connection: RedisConnection | null = null
    let lastError: Error

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        connection = await this.acquire()
        const startTime = Date.now()

        const result = await operation(connection.service)

        // Update response time metrics
        const responseTime = Date.now() - startTime
        this.updateResponseTime(responseTime)

        return result
      } catch (error) {
        lastError = error as Error
        this.stats.errors++

        if (connection) {
          connection.errorCount++

          // Remove unhealthy connections
          if (connection.errorCount > 3) {
            await this.destroyConnection(connection)
            connection = null
          }
        }

        if (attempt < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelay * Math.pow(2, attempt)),
          )
        }
      } finally {
        if (connection) {
          this.release(connection)
        }
      }
    }

    throw lastError!
  }

  private async createConnection(): Promise<RedisConnection> {
    const id = `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const service = new RedisService(this.redisConfig)
    await service.connect()

    const connection: RedisConnection = {
      id,
      service,
      inUse: false,
      createdAt: new Date(),
      lastUsed: new Date(),
      requestCount: 0,
      errorCount: 0,
    }

    this.connections.set(id, connection)
    this.stats.created++
    this.stats.total++

    logger.debug('Created Redis connection', {
      pool: this.name,
      connectionId: id,
    })

    return connection
  }

  private async destroyConnection(connection: RedisConnection): Promise<void> {
    try {
      await connection.service.disconnect()
      this.connections.delete(connection.id)
      this.stats.destroyed++
      this.stats.total--

      logger.debug('Destroyed Redis connection', {
        pool: this.name,
        connectionId: connection.id,
      })
    } catch (error) {
      logger.error('Error destroying connection', {
        pool: this.name,
        connectionId: connection.id,
        error,
      })
    }
  }

  private async isConnectionHealthy(
    connection: RedisConnection,
  ): Promise<boolean> {
    try {
      return await connection.service.isHealthy()
    } catch {
      return false
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      const now = new Date()
      const connectionsToDestroy: RedisConnection[] = []

      for (const connection of this.connections.values()) {
        // Check for idle timeout
        if (
          !connection.inUse &&
          now.getTime() - connection.lastUsed.getTime() >
            this.config.idleTimeout
        ) {
          connectionsToDestroy.push(connection)
          continue
        }

        // Check health for idle connections
        if (
          !connection.inUse &&
          !(await this.isConnectionHealthy(connection))
        ) {
          connectionsToDestroy.push(connection)
        }
      }

      // Destroy unhealthy/idle connections
      for (const connection of connectionsToDestroy) {
        await this.destroyConnection(connection)
      }

      // Ensure minimum connections
      while (this.connections.size < this.config.minConnections) {
        try {
          await this.createConnection()
        } catch (error) {
          logger.error('Failed to create connection during health check', {
            pool: this.name,
            error,
          })
          break
        }
      }

      this.updateStats()
    }, this.config.healthCheckInterval)
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      logger.debug('Redis pool metrics', {
        pool: this.name,
        stats: this.stats,
      })

      // Emit metrics event (using console for now - could be replaced with EventEmitter)
      console.log('redis-pool-metrics', {
        pool: this.name,
        stats: this.stats,
      })
    }, this.config.metricsInterval)
  }

  private updateStats(): void {
    const connections = Array.from(this.connections.values())

    this.stats.total = connections.length
    this.stats.active = connections.filter((c) => c.inUse).length
    this.stats.idle = connections.filter((c) => !c.inUse).length
  }

  private updateResponseTime(responseTime: number): void {
    // Simple moving average
    this.stats.avgResponseTime =
      this.stats.avgResponseTime * 0.9 + responseTime * 0.1
  }

  /**
   * Get pool statistics
   */
  getStats(): RedisPoolStats {
    this.updateStats()
    return { ...this.stats }
  }

  /**
   * Check if pool is healthy
   */
  isHealthy(): boolean {
    return (
      this.stats.total >= this.config.minConnections &&
      this.stats.errors < this.stats.total * 0.1
    ) // Less than 10% error rate
  }

  /**
   * Dispose the connection pool
   */
  async dispose(): Promise<void> {
    if (this.isDisposed) {
      return
    }

    this.isDisposed = true

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }

    // Reject all waiting requests
    for (const waiter of this.waitQueue) {
      clearTimeout(waiter.timeout)
      waiter.reject(new Error('Connection pool disposed'))
    }
    this.waitQueue.length = 0

    // Destroy all connections
    await Promise.all(
      [...this.connections.values()].map((conn) =>
        this.destroyConnection(conn),
      ),
    )

    logger.info('Redis connection pool disposed', { pool: this.name })
  }
}

/**
 * Redis Pool Manager - manages multiple pools for different use cases
 */
export class RedisPoolManager {
  private pools = new Map<string, RedisConnectionPool>()
  private defaultConfig: RedisServiceConfig

  constructor(defaultConfig: RedisServiceConfig) {
    this.defaultConfig = defaultConfig
  }

  /**
   * Create or get a Redis connection pool
   */
  createPool(
    name: string,
    config?: Partial<RedisServiceConfig>,
    poolConfig?: Partial<RedisPoolConfig>,
  ): RedisConnectionPool {
    if (this.pools.has(name)) {
      return this.pools.get(name)!
    }

    const redisConfig = { ...this.defaultConfig, ...config }
    const pool = new RedisConnectionPool(name, redisConfig, poolConfig)

    this.pools.set(name, pool)

    logger.info('Created Redis connection pool', { name })

    return pool
  }

  /**
   * Get existing pool
   */
  getPool(name: string): RedisConnectionPool | null {
    return this.pools.get(name) || null
  }

  /**
   * Get all pool statistics
   */
  getAllStats(): Record<string, RedisPoolStats> {
    const stats: Record<string, RedisPoolStats> = {}

    this.pools.forEach((pool, name) => {
      stats[name] = pool.getStats()
    })

    return stats
  }

  /**
   * Health check for all pools
   */
  async healthCheck(): Promise<{
    healthy: boolean
    pools: Record<string, boolean>
  }> {
    const pools: Record<string, boolean> = {}
    let allHealthy = true

    this.pools.forEach((pool, name) => {
      const healthy = pool.isHealthy()
      pools[name] = healthy
      if (!healthy) {
        allHealthy = false
      }
    })

    return { healthy: allHealthy, pools }
  }

  /**
   * Dispose all pools
   */
  async dispose(): Promise<void> {
    await Promise.all([...this.pools.values()].map((pool) => pool.dispose()))

    this.pools.clear()

    logger.info('All Redis pools disposed')
  }
}

// Singleton instance
let redisPoolManager: RedisPoolManager | null = null

/**
 * Get the global Redis pool manager
 */
export function getRedisPoolManager(
  config?: RedisServiceConfig,
): RedisPoolManager {
  if (!redisPoolManager) {
    const defaultConfig = config || { url: process.env['REDIS_URL'] || '' }
    redisPoolManager = new RedisPoolManager(defaultConfig)
  }
  return redisPoolManager
}

/**
 * Convenience function to execute Redis operations with pooling
 */
export async function executeWithRedisPool<T>(
  poolName: string,
  operation: (service: RedisService) => Promise<T>,
  poolConfig?: Partial<RedisPoolConfig>,
): Promise<T> {
  const manager = getRedisPoolManager()
  const pool = manager.createPool(poolName, undefined, poolConfig)

  return await pool.execute(operation)
}
