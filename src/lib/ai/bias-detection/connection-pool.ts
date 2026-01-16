/**
 * HTTP Connection Pool for Python Bias Detection Service
 * Optimizes performance by reusing connections and managing concurrent requests
 */

import { getBiasDetectionLogger } from '../../logging/standardized-logger'

const logger = getBiasDetectionLogger('connection-pool')

export interface ConnectionPoolConfig {
  maxConnections: number
  connectionTimeout: number
  idleTimeout: number
  retryAttempts: number
  retryDelay: number
}

export interface PooledConnection {
  id: string
  inUse: boolean
  lastUsed: Date
  requests: number
  controller: AbortController
}

export class ConnectionPool {
  private connections: Map<string, PooledConnection> = new Map()
  private queue: Array<{
    resolve: (connection: PooledConnection) => void
    reject: (error: Error) => void
  }> = []
  private config: ConnectionPoolConfig
  private cleanupIntervalId?: ReturnType<typeof setInterval>
  private disposed: boolean = false

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = {
      maxConnections: 10,
      connectionTimeout: 30000,
      idleTimeout: 300000, // 5 minutes
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    }

    // Cleanup idle connections periodically
    this.cleanupIntervalId = setInterval(
      () => this.cleanupIdleConnections(),
      60000,
    )
  }

  async acquireConnection(): Promise<PooledConnection> {
    // Check if the pool has been disposed
    if (this.disposed) {
      throw new Error('Connection pool disposed')
    }

    // Try to find an available connection
    for (const [_id, connection] of Array.from(this.connections)) {
      if (!connection.inUse) {
        connection.inUse = true
        connection.lastUsed = new Date()
        connection.requests++
        return connection
      }
    }

    // Create new connection if under limit
    if (this.connections.size < this.config.maxConnections) {
      const connection = this.createConnection()
      connection.requests++
      this.connections.set(connection.id, connection)
      return connection
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject })

      // Timeout if waiting too long
      setTimeout(() => {
        const index = this.queue.findIndex((item) => item.resolve === resolve)
        if (index !== -1) {
          this.queue.splice(index, 1)
          reject(new Error('Connection pool timeout'))
        }
      }, this.config.connectionTimeout)
    })
  }

  releaseConnection(connection: PooledConnection): void {
    if (this.disposed) {
      return
    }

    connection.inUse = false
    connection.lastUsed = new Date()

    // Process queue if available
    if (this.queue.length > 0) {
      const { resolve } = this.queue.shift()!
      connection.inUse = true
      connection.requests++
      resolve(connection)
    }
  }

  private createConnection(): PooledConnection {
    if (this.disposed) {
      throw new Error('Connection pool disposed')
    }

    const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return {
      id,
      inUse: true,
      lastUsed: new Date(),
      requests: 0,
      controller: new AbortController(),
    }
  }

  private cleanupIdleConnections() {
    if (this.disposed) {
      return
    }

    const now = new Date()
    const toRemove: string[] = []

    for (const [id, connection] of Array.from(this.connections)) {
      if (
        !connection.inUse &&
        now.getTime() - connection.lastUsed.getTime() > this.config.idleTimeout
      ) {
        connection.controller.abort()
        toRemove.push(id)
      }
    }

    toRemove.forEach((id) => {
      this.connections.delete(id)
      logger.debug(`Cleaned up idle connection: ${id}`)
    })
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      activeConnections: Array.from(this.connections.values()).filter(
        (c) => c.inUse,
      ).length,
      queueLength: this.queue.length,
      totalRequests: Array.from(this.connections.values()).reduce(
        (sum, c) => sum + c.requests,
        0,
      ),
      maxConnections: this.config.maxConnections,
      idleTimeout: this.config.idleTimeout,
      connectionTimeout: this.config.connectionTimeout,
    }
  }

  /**
   * Health check for the connection pool.
   * Returns true if the pool is operating within safe limits.
   */
  isHealthy(): boolean {
    const stats = this.getStats()
    // Consider healthy if not at max connections and queue is not overloaded
    const queueThreshold = 2 * stats.maxConnections
    return (
      stats.totalConnections < stats.maxConnections &&
      stats.queueLength < queueThreshold
    )
  }

  async dispose(): Promise<void> {
    this.disposed = true

    // Clear cleanup interval
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = undefined
    }

    // Abort all connections
    for (const connection of Array.from(this.connections.values())) {
      connection.controller.abort()
    }

    // Reject all queued requests
    this.queue.forEach(({ reject }) => {
      reject(new Error('Connection pool disposed'))
    })

    this.connections.clear()
    this.queue.length = 0

    logger.info('Connection pool disposed')
  }
}
