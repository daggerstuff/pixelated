/**
 * HTTP Connection Pool for Python Bias Detection Service
 * Optimizes performance by reusing connections and managing concurrent requests
 */

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('ConnectionPool')

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
    setInterval(() => this.cleanupIdleConnections(), 60000)
  }

  async acquireConnection(): Promise<PooledConnection> {
    // Try to find an available connection
    for (const [_id, connection] of this.connections) {
      if (!connection.inUse) {
        connection.inUse = true
        connection.lastUsed = new Date()
        return connection
      }
    }

    // Create new connection if under limit
    if (this.connections.size < this.config.maxConnections) {
      const connection = this.createConnection()
      this.connections.set(connection.id, connection)
      return connection
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject })
      
      // Timeout if waiting too long
      setTimeout(() => {
        const index = this.queue.findIndex(item => item.resolve === resolve)
        if (index !== -1) {
          this.queue.splice(index, 1)
          reject(new Error('Connection pool timeout'))
        }
      }, this.config.connectionTimeout)
    })
  }

  releaseConnection(connection: PooledConnection): void {
    connection.inUse = false
    connection.lastUsed = new Date()

    // Process queue if available
    if (this.queue.length > 0) {
      const { resolve } = this.queue.shift()!
      connection.inUse = true
      resolve(connection)
    }
  }

  private createConnection(): PooledConnection {
    const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return {
      id,
      inUse: true,
      lastUsed: new Date(),
      requests: 0,
      controller: new AbortController(),
    }
  }

  private cleanupIdleConnections(): void {
    const now = new Date()
    const toRemove: string[] = []

    for (const [id, connection] of this.connections) {
      if (!connection.inUse && 
          now.getTime() - connection.lastUsed.getTime() > this.config.idleTimeout) {
        connection.controller.abort()
        toRemove.push(id)
      }
    }

    toRemove.forEach(id => {
      this.connections.delete(id)
      logger.debug(`Cleaned up idle connection: ${id}`)
    })
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      activeConnections: Array.from(this.connections.values()).filter(c => c.inUse).length,
      queueLength: this.queue.length,
      totalRequests: Array.from(this.connections.values()).reduce((sum, c) => sum + c.requests, 0),
    }
  }

  async dispose(): Promise<void> {
    // Abort all connections
    for (const connection of this.connections.values()) {
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