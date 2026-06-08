// Health Check Routes
// Service status and connectivity monitoring

import express, { Router, Request, Response } from 'express'

import {
  getMongoConnectionSafe,
  getPostgresPoolSafe,
  getRedisClientSafe,
} from '../../lib/database/connection'

const router: Router = express.Router()

// ============================================================================
// BASIC HEALTH CHECK
// ============================================================================

router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] ?? 'development',
  })
})

// ============================================================================
// DETAILED HEALTH CHECK
// ============================================================================

router.get('/detailed', async (req: Request, res: Response) => {
  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {},
  }

  // Check MongoDB
  const mongoConn = getMongoConnectionSafe()
  if (mongoConn) {
    try {
      const adminDbConnection = mongoConn.db
      if (!adminDbConnection) {
        throw new Error('MongoDB admin database is not initialized')
      }
      const adminDb = adminDbConnection.admin()
      const serverStatus = await adminDb.serverStatus()
      health.services.mongodb = {
        status: 'connected',
        uptime: serverStatus['uptime'] as number,
      }
    } catch (error: unknown) {
      health.services.mongodb = {
        status: 'disconnected',
        error: (error as Error).message,
      }
      health.status = 'degraded'
    }
  } else {
    health.services.mongodb = {
      status: 'not_configured',
    }
  }

  // Check PostgreSQL
  const pool = getPostgresPoolSafe()
  if (pool) {
    try {
      const client = await pool.connect()
      const result = await client.query('SELECT NOW() as now')
      client.release()
      health.services.postgresql = {
        status: 'connected',
        timestamp:
          (result.rows[0] as { now?: unknown } | undefined)?.now ?? new Date(),
      }
    } catch (error: unknown) {
      health.services.postgresql = {
        status: 'disconnected',
        error: (error as Error).message,
      }
      health.status = 'degraded'
    }
  } else {
    health.services.postgresql = {
      status: 'not_configured',
    }
  }

  // Check Redis
  const redis = getRedisClientSafe()
  if (redis) {
    try {
      const pong = await redis.ping()
      health.services.redis = {
        status: 'connected',
        response: pong,
      }
    } catch (error: unknown) {
      health.services.redis = {
        status: 'disconnected',
        error: (error as Error).message,
      }
      health.status = 'degraded'
    }
  } else {
    health.services.redis = {
      status: 'not_configured',
    }
  }

  const statusCode = health.status === 'ok' ? 200 : 503
  res.status(statusCode).json(health)
})

// ============================================================================
// READINESS CHECK (for Kubernetes)
// ============================================================================

router.get('/ready', async (req: Request, res: Response): Promise<Response> => {
  try {
    const mongo = getMongoConnectionSafe()
    const postgres = getPostgresPoolSafe()

    // Test PostgreSQL if configured
    if (postgres) {
      const client = await postgres.connect()
      await client.query('SELECT 1')
      client.release()
    }

    // Test MongoDB if configured
    if (mongo) {
      const adminDbConnection = mongo.db
      if (!adminDbConnection) {
        throw new Error('MongoDB admin database is not initialized')
      }
      await adminDbConnection.admin().ping()
    }

    return res.json({
      ready: true,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    return res.status(503).json({
      ready: false,
      error: (error as Error).message,
    })
  }
})

// ============================================================================
// LIVENESS CHECK (for Kubernetes)
// ============================================================================

router.get('/live', (req: Request, res: Response) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
  })
})

export default router
