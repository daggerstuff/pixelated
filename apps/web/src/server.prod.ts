import { readFileSync } from 'fs'
import { createServer as createHttpServer, Server as HttpServer } from 'http'
import { createServer as createHttpsServer, Server as HttpsServer } from 'https'

import compression from 'compression'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import Redis from 'ioredis'
import { Pool } from 'pg'

import {
  closeSentry,
  Sentry,
  sentryMiddleware,
} from '../../../config/instrument.mjs'
import healthRoutes from './api/routes/health.js'
import { productionConfig } from './config/production.js'
import {
  getPostgresPool,
  getRedisClient,
  setPostgresPool,
  setRedisClient,
} from './lib/db/connection.js'
import {
  getSentryExpressHandlers,
  hasSentryExpressErrorHandler,
  registerSentryExpressErrorHandler,
} from './lib/sentry/express.js'
import { SocketService } from './lib/services/socketService.js'
import { createBusinessIntelligenceRoutes } from './routes/businessIntelligenceRoutes.js'
import { createFileRoutes } from './routes/fileRoutes.js'

const app = express()
const sentryHandlers = getSentryExpressHandlers(Sentry)
const hasSentryErrorHandler = hasSentryExpressErrorHandler(sentryHandlers)

app.use(sentryMiddleware)

// Environment setup
const PORT = productionConfig.port
const isProduction = productionConfig.environment === 'production'

// Database connection
const db = new Pool(productionConfig.database)
setPostgresPool(db)

const redis = new Redis(productionConfig.redis.url, {
  lazyConnect: true,
  tls: productionConfig.redis.url.startsWith('rediss://')
    ? productionConfig.redis.tls
    : undefined,
})
setRedisClient(redis)

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'https://api.pixelated.com'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
)

// Performance middleware
app.use(compression())

// Rate limiting
const limiter = rateLimit({
  windowMs: productionConfig.security.rateLimit.windowMs,
  max: productionConfig.security.rateLimit.max,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// CORS configuration
app.use(cors(productionConfig.cors))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.get('/health', async (_req, res) => {
  const health = {
    status: 'healthy' as 'healthy' | 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: productionConfig.environment,
    services: {} as Record<string, { status: string; error?: string }>,
  }

  try {
    const pool = getPostgresPool()
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    health.services['postgresql'] = { status: 'connected' }
  } catch (error: unknown) {
    health.services['postgresql'] = {
      status: 'disconnected',
      error: (error as Error).message,
    }
    health.status = 'degraded'
  }

  try {
    const redis = getRedisClient()
    await redis.ping()
    health.services['redis'] = { status: 'connected' }
  } catch (error: unknown) {
    health.services['redis'] = {
      status: 'disconnected',
      error: (error as Error).message,
    }
    health.status = 'degraded'
  }

  const statusCode = health.status === 'healthy' ? 200 : 503
  res.status(statusCode).json(health)
})

// API routes
app.use('/api/files', createFileRoutes(db))
app.use('/api/business-intelligence', createBusinessIntelligenceRoutes(db))
app.use('/api/health', healthRoutes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found',
  })
})

registerSentryExpressErrorHandler(app, sentryHandlers)

// SSL configuration
let server: HttpServer | HttpsServer
if (isProduction) {
  try {
    const options = {
      key: readFileSync('/etc/ssl/private/server.key'),
      cert: readFileSync('/etc/ssl/certs/server.crt'),
    }
    server = createHttpsServer(options, app)
    console.log('🔒 HTTPS server configured')
  } catch (error: unknown) {
    console.error('❌ SSL certificates not found, falling back to HTTP:', error)
    server = createHttpServer(app)
  }
} else {
  server = createHttpServer(app)
}

// Socket.IO configuration
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
  console.log('🔄 SIGTERM received, shutting down gracefully')

  await closeSentry()
  await redis.quit()
  await db.end()
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

// Error handling
app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('❌ Error:', error)
    if (!hasSentryErrorHandler) {
      Sentry.captureException(error)
    }
    res.status(500).json({
      error: 'Internal server error',
      message: isProduction
        ? 'Something went wrong'
        : error instanceof Error
          ? error.message
          : 'Unknown error',
    })
  },
)

const startServer = () => {
  server.listen(PORT, () => {
    console.log(`🚀 Business Strategy CMS running on port ${PORT}`)
    console.log(`📊 Environment: ${productionConfig.environment}`)
    console.log(
      `🔧 Health check: http${isProduction ? 's' : ''}://localhost:${PORT}/health`,
    )
  })
}

// Only start the server if this file is run directly
const isMain =
  process.argv[1]?.includes('server.prod.js') ??
  process.argv[1]?.includes('server.prod.ts')
if (isMain) {
  startServer()
}

export { server, db, redis, socketService, startServer }
