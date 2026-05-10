import '../config/instrument.mjs'
import { EventEmitter } from 'events'
import { createServer } from 'http'

import cors from 'cors'
import express from 'express'
import Redis from 'ioredis'
import { Pool } from 'pg'

import authRoutes from './api/routes/auth'
import projectsRoutes from './api/routes/projects'
import { SocketService } from './services/socketService'

import 'dotenv/config'

const app = express()
const server = createServer(app)
import { sentryMiddleware } from '../config/instrument.mjs'

// The Sentry request handler must be the first middleware on the app
app.use(sentryMiddleware)

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
  ? {
      tls: {
        rejectUnauthorized: false,
      },
      lazyConnect: true,
    }
  : { lazyConnect: true }

let redis = new Redis(REDIS_URL, redisOptions)

redis.on('error', (err: unknown) => {
  // We handle connection errors in the connect().catch() block below
  // This listener prevents the "Unhandled error event" warning
  const message = err instanceof Error ? err.message : String(err)
  console.debug('Redis connection error (handled):', message)
})

// Attempt connection with fallback for development
redis.connect().catch((err) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      'Failed to connect to Redis in development, using mock:',
      err instanceof Error ? err.message : String(err),
    )
    // Create a simple mock compatible with ioredis interface
    const redisMock = new EventEmitter()
    Object.assign(redisMock, {
      status: 'ready',
      connect: async () => {},
      disconnect: () => {},
      quit: async () => 'OK' as const,
      get: async () => null,
      set: async () => 'OK' as const,
      del: async () => 1,
      on: (event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'connect' || event === 'ready') cb()
        return redisMock
      },
      off: () => redisMock,
      once: () => redisMock,
      emit: () => true,
    })
    redis = redisMock as unknown as Redis
  } else {
    console.error('Failed to connect to Redis:', err)
  }
})

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

// Create Socket.IO service
const socketService = new SocketService(server, redis, db)

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')

  await redis.quit()
  await db.end()
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
