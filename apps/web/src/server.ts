import { createServer } from 'http'

import cors from 'cors'
import express from 'express'
import Redis, { type RedisOptions } from 'ioredis'
import { Pool } from 'pg'

import {
  closeSentry,
  Sentry,
  sentryMiddleware,
} from '../../../config/instrument.mjs'
import authRoutes from './api/routes/auth'
import projectsRoutes from './api/routes/projects'
import { setPostgresPool, setRedisClient } from './lib/db/connection'
import { GovernanceBridge } from './lib/governance/governance-bridge'
import {
  getSentryExpressHandlers,
  hasSentryExpressErrorHandler,
  registerSentryExpressErrorHandler,
} from './lib/sentry/express'
import { SocketService } from './lib/services/socketService'
import { createSessionMiddleware } from './lib/session'

import 'dotenv/config'

type RedisLike = {
  on: (event: string, listener: (...args: unknown[]) => void) => RedisLike
  connect: () => Promise<unknown>
  quit: () => Promise<unknown>
}

const app = express()
const server = createServer(app)

const sentryHandlers = getSentryExpressHandlers(Sentry)
const hasSentryErrorHandler = hasSentryExpressErrorHandler(sentryHandlers)

app.use(sentryMiddleware)

// Environment variables
const PORT = process.env['WS_PORT'] ?? 3001
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://postgres:postgres@localhost:5432/pixelated'

// Database connection
const db = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env['NODE_ENV'] === 'production'
      ? { rejectUnauthorized: false }
      : false,
})
setPostgresPool(db)

// Redis connection
const redisOptions = REDIS_URL.startsWith('rediss://')
  ? ({
      lazyConnect: true,
      tls: {
        rejectUnauthorized: false,
      },
    } as RedisOptions)
  : ({ lazyConnect: true } as RedisOptions)

let redis: RedisLike | Redis = new Redis(REDIS_URL, redisOptions)
setRedisClient(redis as unknown as Parameters<typeof setRedisClient>[0])

redis.on('error', (err: unknown) => {
  // We handle connection errors in the connect().catch() block below
  // This listener prevents the "Unhandled error event" warning
  const message = err instanceof Error ? err.message : String(err)
  console.debug('Redis connection error (handled):', message)
})

// Attempt connection with fallback for development
if (typeof redis.connect === 'function') {
  redis.connect().catch((err) => {
    if (process.env['NODE_ENV'] === 'development') {
      console.warn(
        'Failed to connect to Redis in development, using mock:',
        err instanceof Error ? err.message : String(err),
      )
      // Create a simple mock compatible with ioredis interface
      const redisMock: RedisLike = {
        connect: async () => undefined,
        quit: async () => 'OK',
        on: (event: string, listener: (...args: unknown[]) => void) => {
          if (event === 'connect' || event === 'ready') listener()
          // Return this to allow chaining
          return redisMock
        },
      }
      redis = redisMock
      setRedisClient(
        redisMock as unknown as Parameters<typeof setRedisClient>[0],
      )
    } else {
      console.error('Failed to connect to Redis:', err)
    }
  })
} else {
  if (process.env['NODE_ENV'] === 'development') {
    console.warn(
      'Redis client does not expose connect(), skipping eager connection fallback.',
    )
  }
}

// GovernanceBridge — FHE/audit/secrets event aggregation
const governanceBridge = GovernanceBridge.getInstance()
if (process.env['SLACK_WEBHOOK_URL']) {
  governanceBridge.configureSlackWebhook(process.env['SLACK_WEBHOOK_URL'])
}

// Middleware
app.use(
  cors({
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
    credentials: true,
  }),
)
app.use(express.json())

// Session middleware (PIX-3755: Redis-backed sessions for horizontal scaling)
app.use(createSessionMiddleware())

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectsRoutes)

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

registerSentryExpressErrorHandler(app, sentryHandlers)

app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('Unhandled server error:', error)
    if (!hasSentryErrorHandler) {
      Sentry.captureException(error)
    }
    if (res.headersSent) {
      return
    }
    res.status(500).json({
      error: 'Internal server error',
      message:
        process.env['NODE_ENV'] === 'production'
          ? 'Something went wrong'
          : error.message,
    })
  },
)

// Create Socket.IO service
const socketService = new SocketService(server, redis, db)

// Global error handlers for unhandled rejections and exceptions
process.on('unhandledRejection', (reason: unknown) => {
  console.warn(
    'Unhandled Rejection:',
    reason instanceof Error ? reason.message : String(reason),
  )
  if (!hasSentryErrorHandler) {
    Sentry.captureException(
      reason instanceof Error ? reason : new Error(String(reason)),
    )
  }
})

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error.message)
  if (!hasSentryErrorHandler) {
    Sentry.captureException(error)
  }
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')

  await redis.quit()
  await db.end()
  await closeSentry()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

// Start server only if not in test mode
const isTest = process.env['NODE_ENV'] === 'test' || process.env['VITEST']

if (!isTest) {
  server.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`)
    console.log(`Health check available at http://localhost:${PORT}/health`)
  })
}

export { app, socketService, db, redis }
