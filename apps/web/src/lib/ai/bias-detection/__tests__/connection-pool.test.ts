/**
 * Unit tests for ConnectionPool
 *
 * Covers: acquireConnection, releaseConnection, getStats, isHealthy, dispose
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { ConnectionPool } from '../connection-pool'
import type { ConnectionPoolConfig } from '../connection-pool'

// Mock logger
vi.mock('../../../logging/standardized-logger', () => ({
  getBiasDetectionLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

const defaultPoolConfig: Partial<ConnectionPoolConfig> = {
  maxConnections: 3,
  connectionTimeout: 5000,
  idleTimeout: 30000,
  retryAttempts: 2,
  retryDelay: 100,
}

describe('ConnectionPool', () => {
  let pool: ConnectionPool

  beforeEach(() => {
    pool = new ConnectionPool(defaultPoolConfig)
  })

  afterEach(async () => {
    await pool.dispose()
  })

  describe('cleanup interval via fake timers', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('should trigger cleanupIdleConnections via the periodic interval', () => {
      vi.useFakeTimers()
      const fpPool = new ConnectionPool(defaultPoolConfig)

      const cleanupSpy = vi.spyOn(fpPool as any, 'cleanupIdleConnections')

      // Advance past the 60s interval
      vi.advanceTimersByTime(60000)

      expect(cleanupSpy).toHaveBeenCalledTimes(1)

      void fpPool.dispose()
      vi.useRealTimers()
    })
  })

  describe('acquireConnection', () => {
    it('should return a connection when pool is not full', async () => {
      const conn = await pool.acquireConnection()
      expect(conn).toBeDefined()
      expect(conn.id).toBeTruthy()
      expect(conn.inUse).toBe(true)
      expect(conn.requests).toBe(1)
    })

    it('should reuse idle connections', async () => {
      const conn1 = await pool.acquireConnection()
      pool.releaseConnection(conn1)

      const conn2 = await pool.acquireConnection()
      // Should be the same underlying connection
      expect(conn2.id).toBe(conn1.id)
      expect(conn2.inUse).toBe(true)
      expect(conn2.requests).toBe(2) // Incremented on reuse
    })

    it('should create multiple connections up to maxConnections', async () => {
      const conn1 = await pool.acquireConnection()
      const conn2 = await pool.acquireConnection()
      const conn3 = await pool.acquireConnection()

      expect(conn1.id).not.toBe(conn2.id)
      expect(conn2.id).not.toBe(conn3.id)
    })

    it('should queue requests when pool is full', async () => {
      // Exhaust all connections
      const conn1 = await pool.acquireConnection()
      const conn2 = await pool.acquireConnection()
      const conn3 = await pool.acquireConnection()

      // Try to acquire a 4th - should queue
      const acquirePromise = pool.acquireConnection()

      // Verify it's queued by checking stats
      const stats = pool.getStats()
      expect(stats.queueLength).toBe(1)

      // Release one connection to unblock
      pool.releaseConnection(conn1)

      const conn4 = await acquirePromise
      expect(conn4).toBeDefined()
      expect(conn4.inUse).toBe(true)
    })

    it('should reject with timeout when queue times out', async () => {
      // Create pool with very short timeout
      const fastTimeoutPool = new ConnectionPool({
        ...defaultPoolConfig,
        connectionTimeout: 10, // 10ms timeout
      })

      // Exhaust all connections
      await fastTimeoutPool.acquireConnection()
      await fastTimeoutPool.acquireConnection()
      await fastTimeoutPool.acquireConnection()

      // 4th should timeout
      await expect(fastTimeoutPool.acquireConnection()).rejects.toThrow('Connection pool timeout')

      await fastTimeoutPool.dispose()
    })

    it('should handle timeout when connection was acquired before timeout fires', async () => {
      const earlyPool = new ConnectionPool({
        ...defaultPoolConfig,
        connectionTimeout: 100, // 100ms timeout
      })

      // Exhaust all connections
      const c1 = await earlyPool.acquireConnection()
      await earlyPool.acquireConnection()
      await earlyPool.acquireConnection()

      // Queue a request
      const acquirePromise = earlyPool.acquireConnection()

      // Release a connection quickly — the queued request gets fulfilled
      earlyPool.releaseConnection(c1)

      // The queued request should succeed
      const c4 = await acquirePromise
      expect(c4).toBeDefined()
      expect(c4.inUse).toBe(true)

      // Wait for the timeout to fire (it should find index === -1)
      await new Promise((r) => setTimeout(r, 150))

      // Pool should still be in valid state
      expect(earlyPool.getStats().totalConnections).toBe(3)

      await earlyPool.dispose()
    })

    it('should throw when pool is disposed', async () => {
      await pool.dispose()
      await expect(pool.acquireConnection()).rejects.toThrow('Connection pool disposed')
    })
  })

  describe('releaseConnection', () => {
    it('should mark connection as not in use', async () => {
      const conn = await pool.acquireConnection()
      expect(conn.inUse).toBe(true)

      pool.releaseConnection(conn)
      // After release, the connection is available for reuse
      expect(conn.inUse).toBe(false)
    })

    it('should not throw when pool is disposed', async () => {
      const conn = await pool.acquireConnection()
      await pool.dispose()

      // Should not throw
      expect(() => pool.releaseConnection(conn)).not.toThrow()
    })

    it('should process queued requests on release', async () => {
      const conn1 = await pool.acquireConnection()
      await pool.acquireConnection() // conn3 - exhaust pool

      // Queue a request
      const acquirePromise = pool.acquireConnection()

      // Release conn1 - should be handed to queued request
      pool.releaseConnection(conn1)

      const conn4 = await acquirePromise
      expect(conn4).toBeDefined()
      expect(conn4.inUse).toBe(true)
    })
  })

  describe('getStats', () => {
    it('should return correct stats', async () => {
      const conn1 = await pool.acquireConnection()
      const conn2 = await pool.acquireConnection()

      pool.releaseConnection(conn1)

      const stats = pool.getStats()
      expect(stats.totalConnections).toBe(2)
      expect(stats.activeConnections).toBe(1) // conn2 still in use
      expect(stats.queueLength).toBe(0)
      expect(stats.totalRequests).toBe(2)
      expect(stats.maxConnections).toBe(3)
    })
  })

  describe('createConnection', () => {
    it('should throw when creating a connection after pool is disposed', async () => {
      await pool.dispose()
      expect(() => (pool as any).createConnection()).toThrow(
        'Connection pool disposed',
      )
    })
  })

  describe('cleanupIdleConnections', () => {
    it('should clean up idle connections that exceed idle timeout', async () => {
      // Create pool with very short idle timeout
      const shortIdlePool = new ConnectionPool({
        ...defaultPoolConfig,
        idleTimeout: 1, // 1ms idle timeout
      })

      const conn = await shortIdlePool.acquireConnection()
      expect(shortIdlePool.getStats().totalConnections).toBe(1)

      // Release it so it becomes idle
      shortIdlePool.releaseConnection(conn)

      // Wait for the idle timeout to expire
      await new Promise((r) => setTimeout(r, 10))

      // Trigger cleanup via private method access
      ;(shortIdlePool as any).cleanupIdleConnections()

      // The idle connection should have been cleaned up
      expect(shortIdlePool.getStats().totalConnections).toBe(0)

      await shortIdlePool.dispose()
    })

    it('should not clean up in-use connections', async () => {
      const shortIdlePool = new ConnectionPool({
        ...defaultPoolConfig,
        idleTimeout: 1, // 1ms idle timeout
      })

      const conn = await shortIdlePool.acquireConnection()

      // Don't release — connection is still in use
      ;(shortIdlePool as any).cleanupIdleConnections()

      // In-use connection should not be cleaned up
      expect(shortIdlePool.getStats().totalConnections).toBe(1)
      expect(conn.inUse).toBe(true)

      await shortIdlePool.dispose()
    })

    it('should be a no-op when the pool is disposed', async () => {
      ;(pool as any).disposed = true

      // Should not throw
      expect(() => {
        ;(pool as any).cleanupIdleConnections()
      }).not.toThrow()
    })
  })

  describe('isHealthy', () => {
    it('should return true when pool is not full', () => {
      expect(pool.isHealthy()).toBe(true)
    })

    it('should return false when pool is at max connections with queued requests', async () => {
      await pool.acquireConnection()
      await pool.acquireConnection()
      await pool.acquireConnection()

      // Pool is at max capacity
      expect(pool.isHealthy()).toBe(false)
    })
  })

  describe('dispose', () => {
    it('should clean up all connections', async () => {
      await pool.acquireConnection()
      await pool.dispose()

      const stats = pool.getStats()
      expect(stats.totalConnections).toBe(0)
      expect(stats.queueLength).toBe(0)
    })

    it('should be idempotent', async () => {
      await pool.dispose()
      await expect(pool.dispose()).resolves.not.toThrow()
    })

    it('should reject queued requests when disposed', async () => {
      const qPool = new ConnectionPool({ ...defaultPoolConfig, connectionTimeout: 5000 })

      // Exhaust all connections
      await qPool.acquireConnection()
      await qPool.acquireConnection()
      await qPool.acquireConnection()

      // Queue two requests
      const req1 = qPool.acquireConnection()
      const req2 = qPool.acquireConnection()

      // Verify queued
      expect(qPool.getStats().queueLength).toBe(2)

      // Dispose — should reject queued requests
      await qPool.dispose()

      // Both queued promises should reject
      await expect(req1).rejects.toThrow('Connection pool disposed')
      await expect(req2).rejects.toThrow('Connection pool disposed')

      // Stats should show no connections or queue
      expect(qPool.getStats().totalConnections).toBe(0)
      expect(qPool.getStats().queueLength).toBe(0)
    })
  })
})
