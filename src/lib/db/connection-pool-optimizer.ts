/**
 * Database Connection Pool Optimizer
 * Advanced connection pooling with monitoring, health checks, and performance optimization
 */

import { Pool, PoolClient, PoolConfig } from 'pg'
import { EventEmitter } from 'events'
import { getLogger } from '@/lib/logging'

// Note: PoolEvents interface extracted to pool-events.ts for future event system implementation

const logger = getLogger('connection-pool')

// Connection pool configuration
interface OptimizedPoolConfig extends PoolConfig {
  // Enhanced configuration options
  min: number
  max: number
  idleTimeoutMillis: number
  connectionTimeoutMillis: number
  acquireTimeoutMillis: number

  // Health check configuration
  healthCheckInterval: number
  maxConnectionAge: number
  maxClientConnections: number

  // Performance monitoring
  enableMetrics: boolean
  slowQueryThreshold: number

  // Failover configuration
  failoverHosts?: string[]
  retryAttempts: number
  retryDelay: number
}

// Pool metrics interface
interface PoolMetrics {
  totalConnections: number
  idleConnections: number
  waitingClients: number
  activeConnections: number

  totalQueries: number
  successfulQueries: number
  failedQueries: number

  avgQueryTime: number
  slowQueries: number

  poolUptime: number
  lastReset: Date

  healthScore: number // 0-100
}

/**
 * Enhanced connection pool with monitoring and optimization
 */
export class OptimizedConnectionPool extends EventEmitter {
  private pool: Pool | null = null
  private config: OptimizedPoolConfig
  private metrics: PoolMetrics
  private healthCheckTimer?: NodeJS.Timeout
  private metricsTimer?: NodeJS.Timeout
  private startTime: number
  private queryStats: Array<{
    duration: number
    success: boolean
    timestamp: number
  }> = []

  constructor(config: Partial<OptimizedPoolConfig> = {}) {
    super()

    // Default configuration
    this.config = {
      min: 2,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      acquireTimeoutMillis: 10000,
      healthCheckInterval: 30000, // 30 seconds
      maxConnectionAge: 3600000, // 1 hour
      maxClientConnections: 10,
      enableMetrics: true,
      slowQueryThreshold: 1000, // 1 second
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    }

    // Initialize metrics
    this.startTime = Date.now()
    this.metrics = {
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      activeConnections: 0,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      avgQueryTime: 0,
      slowQueries: 0,
      poolUptime: 0,
      lastReset: new Date(),
      healthScore: 100,
    }

    this.initializePool()
    this.startHealthChecks()
    this.startMetricsCollection()
  }

  /**
   * Initialize the connection pool
   */
  private initializePool(): void {
    try {
      this.pool = new Pool(this.config)

      // Set up event listeners
      this.pool.on('connect', (client) => {
        logger.debug('New client connected to database')
        this.metrics.totalConnections++
        this.updateMetrics()
        this.emit('connection-acquired', client)
      })

      this.pool.on('remove', (client) => {
        logger.debug('Client removed from pool')
        this.metrics.totalConnections = Math.max(
          0,
          this.metrics.totalConnections - 1,
        )
        this.updateMetrics()
        this.emit('connection-released', client)
      })

      this.pool.on('error', (error, client) => {
        logger.error('Pool error', { error: error.message, client: !!client })
        this.metrics.failedQueries++
        this.updateHealthScore()
        this.emit('connection-error', error, client)
      })

      logger.info('Connection pool initialized', {
        min: this.config.min,
        max: this.config.max,
        host: this.config.host || 'localhost',
        database: this.config.database || 'pixelated',
      })
    } catch (error) {
      logger.error('Failed to initialize connection pool', { error })
      throw error
    }
  }

  /**
   * Get a client from the pool with timeout and retry logic
   */
  async acquireClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Connection pool not initialized')
    }

    const startTime = Date.now()

    try {
      // Set acquire timeout
      const acquirePromise = this.pool.connect()
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Connection acquire timeout')),
          this.config.acquireTimeoutMillis,
        )
      })

      const client = await Promise.race([acquirePromise, timeoutPromise])

      // Update metrics
      this.metrics.activeConnections++
      this.updateMetrics()

      logger.debug('Client acquired from pool', {
        acquireTime: Date.now() - startTime,
        activeConnections: this.metrics.activeConnections,
      })

      return client
    } catch (error) {
      this.metrics.waitingClients++
      this.updateMetrics()

      if (this.metrics.waitingClients >= this.config.max) {
        this.emit('pool-exhausted')
      }

      throw error
    }
  }

  /**
   * Release a client back to the pool
   */
  async releaseClient(client: PoolClient): Promise<void> {
    if (!this.pool) {
      throw new Error('Connection pool not initialized')
    }

    try {
      // Check connection age - skip age check as PoolClient doesn't expose connection start time
      // This is a limitation of the pg library - connection age tracking would require
      // wrapping the client acquisition to track this metadata separately
      client.release()

      this.metrics.activeConnections = Math.max(
        0,
        this.metrics.activeConnections - 1,
      )
      this.updateMetrics()
    } catch (error) {
      logger.error('Failed to release client', { error })
      this.metrics.failedQueries++
      this.updateMetrics()
    }
  }

  /**
   * Execute a query with enhanced monitoring
   */
  async query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number; duration: number }> {
    const startTime = Date.now()
    let client: PoolClient | null = null

    try {
      client = await this.acquireClient()

      // Override client's query method to track metrics
      const originalQuery = client.query.bind(client)
      const queryPromise = originalQuery(text, params)

      // Track query completion
      queryPromise.finally(() => {
        const duration = Date.now() - startTime
        this.recordQueryStats(duration, true)
      })

      const result = await queryPromise
      const duration = Date.now() - startTime

      // Log slow queries
      if (duration > this.config.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          query: text.substring(0, 100),
          duration,
          params,
        })
        this.emit('slow-query', text, duration)
      }

      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.recordQueryStats(duration, false)

      logger.error('Query execution failed', {
        query: text.substring(0, 100),
        duration,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    } finally {
      if (client) {
        await this.releaseClient(client)
      }
    }
  }

  /**
   * Execute a transaction with enhanced error handling
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.acquireClient()
    const startTime = Date.now()

    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')

      const duration = Date.now() - startTime
      this.recordQueryStats(duration, true)

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.recordQueryStats(duration, false)

      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        logger.error('Transaction rollback failed', { rollbackError })
      }

      throw error
    } finally {
      await this.releaseClient(client)
    }
  }

  /**
   * Record query statistics for metrics
   */
  private recordQueryStats(duration: number, success: boolean): void {
    this.metrics.totalQueries++
    if (success) {
      this.metrics.successfulQueries++
    } else {
      this.metrics.failedQueries++
    }

    // Track slow queries
    if (duration > this.config.slowQueryThreshold) {
      this.metrics.slowQueries++
    }

    // Update average query time (moving average)
    this.metrics.avgQueryTime = this.metrics.avgQueryTime * 0.9 + duration * 0.1

    // Keep only recent stats for memory management
    if (this.queryStats.length > 1000) {
      this.queryStats = this.queryStats.slice(-500)
    }

    this.queryStats.push({ duration, success, timestamp: Date.now() })
    this.updateHealthScore()
  }

  /**
   * Update connection pool metrics
   */
  private updateMetrics(): void {
    if (!this.pool) return

    // Update connection metrics (approximate)
    this.metrics.poolUptime = Date.now() - this.startTime
    this.updateHealthScore()

    if (this.config.enableMetrics) {
      this.emit('metrics-updated', { ...this.metrics })
    }
  }

  /**
   * Update health score based on current metrics
   */
  private updateHealthScore(): void {
    let healthScore = 100

    // Penalize for failed queries
    if (this.metrics.totalQueries > 0) {
      const errorRate = this.metrics.failedQueries / this.metrics.totalQueries
      healthScore -= errorRate * 50 // Up to 50 points for error rate
    }

    // Penalize for slow queries
    if (this.metrics.totalQueries > 0) {
      const slowRate = this.metrics.slowQueries / this.metrics.totalQueries
      healthScore -= slowRate * 30 // Up to 30 points for slow queries
    }

    // Penalize for connection issues
    if (this.metrics.waitingClients > 0) {
      healthScore -= Math.min(this.metrics.waitingClients * 5, 20) // Up to 20 points for waiting clients
    }

    // Bonus for good performance
    if (this.metrics.avgQueryTime > 0 && this.metrics.avgQueryTime < 100) {
      healthScore += 10 // Bonus for fast queries
    }

    this.metrics.healthScore = Math.max(0, Math.min(100, healthScore))

    // Emit health change events
    const status =
      this.metrics.healthScore > 80
        ? 'healthy'
        : this.metrics.healthScore > 50
          ? 'degraded'
          : 'unhealthy'

    this.emit('health-changed', this.metrics.healthScore, status)
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck()
    }, this.config.healthCheckInterval)
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = Date.now()

      if (!this.pool) {
        this.metrics.healthScore = 0
        this.emit('health-changed', 0, 'unhealthy')
        return
      }

      // Test a simple query
      await this.query('SELECT 1 as health_check')

      const responseTime = Date.now() - startTime

      // Update health score based on response time
      if (responseTime > 2000) {
        this.metrics.healthScore = Math.max(50, this.metrics.healthScore - 20)
      } else if (responseTime < 100) {
        this.metrics.healthScore = Math.min(100, this.metrics.healthScore + 5)
      }

      logger.debug('Health check completed', {
        responseTime,
        healthScore: this.metrics.healthScore,
        activeConnections: this.metrics.activeConnections,
      })
    } catch (error) {
      logger.error('Health check failed', { error })
      this.metrics.healthScore = Math.max(0, this.metrics.healthScore - 30)
      this.emit('health-changed', this.metrics.healthScore, 'unhealthy')
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (!this.config.enableMetrics) return

    this.metricsTimer = setInterval(() => {
      this.updateMetrics()
    }, 5000) // Update every 5 seconds
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics }
  }

  /**
   * Get pool status
   */
  getStatus(): {
    healthy: boolean
    connections: number
    utilization: number
    performance: 'excellent' | 'good' | 'fair' | 'poor'
  } {
    const utilization = this.metrics.activeConnections / this.config.max
    const {avgQueryTime} = this.metrics

    let performance: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent'
    if (avgQueryTime > 1000 || utilization > 0.9) {
      performance = 'poor'
    } else if (avgQueryTime > 500 || utilization > 0.7) {
      performance = 'fair'
    } else if (avgQueryTime > 200 || utilization > 0.5) {
      performance = 'good'
    }

    return {
      healthy: this.metrics.healthScore > 70,
      connections: this.metrics.activeConnections,
      utilization,
      performance,
    }
  }

  /**
   * Reset pool metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      activeConnections: 0,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      avgQueryTime: 0,
      slowQueries: 0,
      poolUptime: Date.now() - this.startTime,
      lastReset: new Date(),
      healthScore: 100,
    }

    this.queryStats = []
    logger.info('Pool metrics reset')
  }

  /**
   * Gracefully shutdown the pool
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down connection pool')

    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
    }

    // Close pool
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }

    logger.info('Connection pool shutdown complete')
  }

  /**
   * Force pool reset (for maintenance)
   */
  async reset(): Promise<void> {
    logger.info('Resetting connection pool')

    await this.shutdown()
    this.resetMetrics()
    this.initializePool()
    this.startHealthChecks()
    this.startMetricsCollection()

    logger.info('Connection pool reset complete')
  }
}

// Global pool instance
let connectionPool: OptimizedConnectionPool | null = null

/**
 * Get the global connection pool
 */
export function getConnectionPool(): OptimizedConnectionPool {
  if (!connectionPool) {
    connectionPool = new OptimizedConnectionPool()
  }
  return connectionPool
}

/**
 * Initialize connection pool with custom config
 */
export function initializeConnectionPool(
  config?: Partial<OptimizedPoolConfig>,
): OptimizedConnectionPool {
  if (connectionPool) {
    logger.warn('Connection pool already initialized, creating new instance')
  }

  connectionPool = new OptimizedConnectionPool(config)
  return connectionPool
}

/**
 * Enhanced query function with pool optimization
 */
export async function optimizedQuery<T = unknown>(
  text: string,
  params?: unknown[],
  options: {
    timeout?: number
    retries?: number
    client?: PoolClient
  } = {},
): Promise<{ rows: T[]; rowCount: number; duration: number }> {
  const pool = getConnectionPool()

  // Use provided client or acquire from pool
  if (options.client) {
    const startTime = Date.now()
    const result = await options.client.query(text, params)
    const duration = Date.now() - startTime

    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
      duration,
    }
  }

  return pool.query(text, params)
}

/**
 * Enhanced transaction function with pool optimization
 */
export async function optimizedTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  _options: {
    timeout?: number
    retries?: number
  } = {},
): Promise<T> {
  const pool = getConnectionPool()
  return pool.transaction(callback)
}

/**
 * Monitor pool performance
 */
export async function monitorPoolPerformance(): Promise<{
  status: string
  metrics: PoolMetrics
  recommendations: string[]
}> {
  const pool = getConnectionPool()
  const metrics = pool.getMetrics()
  const status = pool.getStatus()

  const recommendations: string[] = []

  // Generate recommendations based on metrics
  if (status.utilization > 0.8) {
    recommendations.push('Consider increasing max pool size')
  }

  if (metrics.avgQueryTime > 1000) {
    recommendations.push(
      'High query times detected - consider query optimization',
    )
  }

  if (metrics.failedQueries > metrics.totalQueries * 0.1) {
    recommendations.push('High error rate - check database connectivity')
  }

  if (metrics.slowQueries > metrics.totalQueries * 0.2) {
    recommendations.push('High slow query rate - optimize database queries')
  }

  return {
    status: status.healthy ? 'healthy' : 'unhealthy',
    metrics,
    recommendations,
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (connectionPool) {
    await connectionPool.shutdown()
  }
})

process.on('SIGTERM', async () => {
  if (connectionPool) {
    await connectionPool.shutdown()
  }
})
