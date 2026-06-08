// Health Check Routes
// Service status and connectivity monitoring

import express, { Router, Request, Response } from 'express'

import {
  getMongoConnection,
  getPostgresPool,
  getRedisClient,
} from '../../lib/database/connection'

const router: Router = express.Router()

  const statusCode = health.status === 'ok' ? 200 : 503
  res.status(statusCode).json(health)
})


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

