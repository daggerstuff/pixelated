// Health Check Routes
// Service status and connectivity monitoring

import express, { Router, Request, Response } from 'express'

import {
  getMongoConnection,
  getPostgresPool,
  getRedisClient,
} from '../../lib/database/connection'

const router: Router = express.Router()

router.get('/health', (req: Request, res: Response) => {
  const health = {
    mongo: getMongoConnection().readyState === 1,
    postgres: getPostgresPool().totalCount > 0,
    redis: getRedisClient().isReady,
  }
  const statusCode = health.status === 'ok' ? 200 : 503
  res.status(statusCode).json(health)
})

router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] ?? 'development',
  })
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

})

})

})

export default router