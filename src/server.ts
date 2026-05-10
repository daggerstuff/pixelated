import { createServer } from 'http'

import cors from 'cors'
import express from 'express'
import Redis, { type RedisOptions } from 'ioredis'
import { Pool } from 'pg'

import { closeSentry, Sentry, sentryMiddleware } from '../config/instrument.mjs'
import authRoutes from './api/routes/auth'
import projectsRoutes from './api/routes/projects'
import { SocketService } from './services/socketService'

import 'dotenv/config'

type RedisLike = {
  connect?: () => Promise<unknown>
  quit: () => Promise<unknown>
  on: (event: string, listener: (...args: unknown[]) => void) => RedisLike
}

type SentryExpressErrorHandler = (app: express.Application) => void
type SentryErrorHandler = (
  options?: Record<string, string>,
) => express.ErrorRequestHandler

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isSentryExpressErrorHandler = (
  value: unknown,
): value is SentryExpressErrorHandler => typeof value === 'function'

const isSentryExpressErrorRequestHandler = (
  value: unknown,
): value is SentryErrorHandler => typeof value === 'function'

const getSentryHandlers = (
  source: unknown,
): {
  setupExpressErrorHandler?: SentryExpressErrorHandler
  expressErrorHandler?: SentryErrorHandler
} => {
  if (!isRecord(source)) {
    return {}
  }

  const handlers: {
    setupExpressErrorHandler?: SentryExpressErrorHandler
    expressErrorHandler?: SentryErrorHandler
  } = {}

  if (isSentryExpressErrorHandler(source['setupExpressErrorHandler'])) {
    handlers.setupExpressErrorHandler = source['setupExpressErrorHandler']
  }

  if (isSentryExpressErrorRequestHandler(source['expressErrorHandler'])) {
    handlers.expressErrorHandler = source['expressErrorHandler']
  }

  return handlers
}

const app = express()
const server = createServer(app)

const { setupExpressErrorHandler, expressErrorHandler } =
  getSentryHandlers(Sentry)

const hasSentryErrorHandler =
  !!setupExpressErrorHandler || !!expressErrorHandler

// The Sentry request handler must be the first middleware on the app
app.use(sentryMiddleware)
if (typeof setupExpressErrorHandler === 'function') {
  setupExpressErrorHandler(app)
} else if (typeof expressErrorHandler === 'function') {
  app.use(expressErrorHandler())
}

// Environment variables
const PORT = process.env.WS_PORT ?? 3001
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/pixelated'

// Database connection
const db = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
})

// Redis connection
const redisOptions = REDIS_URL.startsWith('rediss://')
  ? ({
      lazyConnect: true,
      tls: {
        rejectUnauthorized: false,
      },
    } as RedisOptions)
  : ({ lazyConnect: true } as RedisOptions)

let redis: RedisLike = new Redis(REDIS_URL, redisOptions)

redis.on('error', (err: unknown) => {
  // We handle connection errors in the connect().catch() block below
  // This listener prevents the "Unhandled error event" warning
  const message = err instanceof Error ? err.message : String(err)
  console.debug('Redis connection error (handled):', message)
})

// Attempt connection with fallback for development
if (typeof redis.connect === 'function') {
  redis.connect().catch((err) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        'Failed to connect to Redis in development, using mock:',
        err instanceof Error ? err.message : String(err),
      )
      // Create a simple mock compatible with ioredis interface
      const redisMock: RedisLike = {
        quit: async () => 'OK',
        on: (event: string, listener: (...args: unknown[]) => void) => {
          if (event === 'connect' || event === 'ready') listener()
          return redisMock
        },
      }
      redis = redisMock
    } else {
      console.error('Failed to connect to Redis:', err)
    }
  })
} else {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      'Redis client does not expose connect(), skipping eager connection fallback.',
    )
  }
}

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  }),
)
app.use(express.json())

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectsRoutes)

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

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
        process.env.NODE_ENV === 'production'
          ? 'Something went wrong'
          : error.message,
    })
  },
)

// Create Socket.IO service
const socketService = new SocketService(server, redis, db)

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
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST

if (!isTest) {
  server.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`)
    console.log(`Health check available at http://localhost:${PORT}/health`)
  })
}

export { app, socketService, db, redis }
