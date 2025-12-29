// Health Check Routes
// Service status and connectivity monitoring

import express, { Router, Request, Response } from 'express'
import { getMongoConnection, getPostgresPool, getRedisClient } from '../../lib/database/connection'

const router: Router = express.Router()

// ============================================================================
// BASIC HEALTH CHECK
// ============================================================================

router.get('/', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    })
})

// ============================================================================
// DETAILED HEALTH CHECK
// ============================================================================

router.get('/detailed', async (req: Request, res: Response) => {
    const health: any = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {}
    }

    // Check MongoDB
    try {
        const mongoConn = getMongoConnection()
        const adminDb = mongoConn.connection.db.admin()
        const serverStatus = await adminDb.serverStatus()
        health.services.mongodb = {
            status: 'connected',
            uptime: serverStatus.uptime
        }
    } catch (error) {
        health.services.mongodb = {
            status: 'disconnected',
            error: (error as Error).message
        }
        health.status = 'degraded'
    }

    // Check PostgreSQL
    try {
        const pool = getPostgresPool()
        const client = await pool.connect()
        const result = await client.query('SELECT NOW()')
        client.release()
        health.services.postgresql = {
            status: 'connected',
            timestamp: result.rows[0].now
        }
    } catch (error) {
        health.services.postgresql = {
            status: 'disconnected',
            error: (error as Error).message
        }
        health.status = 'degraded'
    }

    // Check Redis
    try {
        const redis = getRedisClient()
        const pong = await redis.ping()
        health.services.redis = {
            status: 'connected',
            response: pong
        }
    } catch (error) {
        health.services.redis = {
            status: 'disconnected',
            error: (error as Error).message
        }
        health.status = 'degraded'
    }

    const statusCode = health.status === 'ok' ? 200 : 503
    res.status(statusCode).json(health)
})

// ============================================================================
// READINESS CHECK (for Kubernetes)
// ============================================================================

router.get('/ready', async (req: Request, res: Response) => {
    try {
        // Check all critical services
        const mongo = getMongoConnection()
        const postgres = getPostgresPool()

        if (!mongo || !postgres) {
            return res.status(503).json({
                ready: false,
                reason: 'Database connections not initialized'
            })
        }

        // Test PostgreSQL
        const client = await postgres.connect()
        await client.query('SELECT 1')
        client.release()

        res.json({
            ready: true,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        res.status(503).json({
            ready: false,
            error: (error as Error).message
        })
    }
})

// ============================================================================
// LIVENESS CHECK (for Kubernetes)
// ============================================================================

router.get('/live', (req: Request, res: Response) => {
    res.json({
        alive: true,
        timestamp: new Date().toISOString()
    })
})

export default router
