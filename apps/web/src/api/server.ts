// Express.js Server Setup
// Main application entry point with middleware configuration

import compression from 'compression'
import cors from 'cors'
import dotenv from 'dotenv'
import express, {
  type ErrorRequestHandler,
  type Express,
  type NextFunction,
} from 'express'
import helmet from 'helmet'
import morgan from 'morgan'

import {
  closeSentry,
  Sentry,
  sentryMiddleware,
} from '../../../../config/instrument.mjs'
import {
  connectMongoDB,
  connectPostgreSQL,
  connectRedis,
  disconnectMongoDB,
  disconnectPostgreSQL,
  disconnectRedis,
} from '../lib/db/connection'
import {
  getSentryExpressHandlers,
  hasSentryExpressErrorHandler,
  registerSentryExpressErrorHandler,
} from '../lib/sentry/express'
import { apiVersionResolver } from './middleware/api-version'
import { authMiddleware } from './middleware/auth'
import { errorHandler, notFoundHandler } from './middleware/error-handler'
import { requestLogger } from './middleware/logger'
import { createTimeoutMiddleware } from './middleware/query-timeout'
import { rateLimiter } from './middleware/rate-limiter'
import authRoutes from './routes/auth'
import documentRoutes from './routes/documents'
import healthRoutes from './routes/health'
import integrationRoutes from './routes/integrations'
import marketResearchRoutes from './routes/market-research'
import projectRoutes from './routes/projects'
import readinessRoutes from './routes/readiness'
import salesOpportunitiesRoutes from './routes/sales-opportunities'
import strategicPlanRoutes from './routes/strategic-plans'
import userRoutes from './routes/users'

// Load environment variables
dotenv.config()

const app: Express = express()
app.set('trust proxy', 1)
const PORT = parseInt(process.env['PORT'] ?? '5000', 10)
const NODE_ENV = process.env['NODE_ENV'] ?? 'development'

const sentryHandlers = getSentryExpressHandlers(Sentry)
const hasSentryErrorHandler = hasSentryExpressErrorHandler(sentryHandlers)
const { captureException } = sentryHandlers

app.use(sentryMiddleware)

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet for security headers
app.use(helmet())

// CORS configuration
app.use(
  cors({
    origin: process.env['CORS_ORIGIN']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)

// ============================================================================
// BODY PARSING & COMPRESSION
// ============================================================================

app.use(express.json({
  limit: '10mb',
  verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
    (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
  },
}))
app.use(express.urlencoded({
  limit: '10mb',
  extended: true,
  verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
    (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
  },
}))
app.use(compression())

// ============================================================================
// API VERSION NEGOTIATION
// ============================================================================

// Resolve API version from URL path (/api/v1/...) or Accept header
app.use(apiVersionResolver())

// ============================================================================
// QUERY TIMEOUT
// ============================================================================

// Apply timeout middleware in non-test environments
if (NODE_ENV !== 'test') {
  app.use(createTimeoutMiddleware())
}

// ============================================================================
// LOGGING
// ============================================================================

// Morgan request logger
const morganFormat = NODE_ENV === 'production' ? 'combined' : 'dev'
app.use(morgan(morganFormat))

// Custom request logger
app.use(requestLogger)

// ============================================================================
// PUBLIC ROUTES (NO AUTH REQUIRED)
// ============================================================================

// Health route must be before rate limiter to avoid being blocked by rate limiting
app.use('/api/health', healthRoutes)

// ============================================================================
// RATE LIMITING
// ============================================================================

app.use(rateLimiter)

// ============================================================================
// PUBLIC ROUTES CONTINUED (NO AUTH REQUIRED)
// ============================================================================

app.use('/api/auth', authRoutes)
app.use('/api/readiness', readinessRoutes)

// ============================================================================
// PROTECTED ROUTES (AUTH REQUIRED)
// ============================================================================

// Apply auth middleware to all routes below this point
app.use(authMiddleware)

// API Routes
app.use('/api/documents', documentRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/strategic-plans', strategicPlanRoutes)
app.use('/api/market-research', marketResearchRoutes)
app.use('/api/sales-opportunities', salesOpportunitiesRoutes)
app.use('/api/integrations', integrationRoutes)
app.use('/api/users', userRoutes)

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
registerSentryExpressErrorHandler(app, sentryHandlers)
app.use(notFoundHandler)

// Global error handler (must be last)
if (!hasSentryErrorHandler) {
  const sentryErrorHandler: ErrorRequestHandler = (
    error: Error,
    _req,
    _res,
    next: NextFunction,
  ) => {
    if (captureException) {
      captureException(error)
    }
    next(error)
  }
  app.use(sentryErrorHandler)
}
app.use(errorHandler)

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

type MongoConnection = Awaited<ReturnType<typeof connectMongoDB>>
type PostgresConnection = Awaited<ReturnType<typeof connectPostgreSQL>>
type RedisConnection = Awaited<ReturnType<typeof connectRedis>>

let mongoConnection: MongoConnection | null = null
let postgresConnection: PostgresConnection | null = null
let redisConnection: RedisConnection | null = null

async function initializeDatabases() {
  try {
    console.log('🔄 Connecting to MongoDB...')
    mongoConnection = await connectMongoDB()
    console.log('✅ MongoDB connected')
  } catch (error: unknown) {
    console.error(
      '⚠️ MongoDB connection failed (continuing without it):',
      error,
    )
  }

  try {
    console.log('🔄 Connecting to PostgreSQL...')
    postgresConnection = await connectPostgreSQL()
    console.log('✅ PostgreSQL connected')
  } catch (error: unknown) {
    console.error(
      '⚠️ PostgreSQL connection failed (continuing without it):',
      error,
    )
  }

  try {
    console.log('🔄 Connecting to Redis...')
    redisConnection = await connectRedis()
    console.log('✅ Redis connected')
  } catch (error: unknown) {
    console.error('⚠️ Redis connection failed (continuing without it):', error)
  }
}

// ============================================================================
// SERVER START
// ============================================================================

async function startServer() {
  try {
    // Initialize databases
    await initializeDatabases()

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 CMS Business Strategy Server Started                 ║
╠═══════════════════════════════════════════════════════════╣
║  Environment: ${NODE_ENV.padEnd(42)}║
║  Port: ${String(PORT).padEnd(50)}║
║  URL: http://localhost:${String(PORT).padEnd(44)}║
╚═══════════════════════════════════════════════════════════╝
      `)
    })
  } catch (error: unknown) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Global error handlers for unhandled rejections and exceptions
process.on('unhandledRejection', (reason: unknown) => {
  console.warn(
    'Unhandled Rejection:',
    reason instanceof Error ? reason.message : String(reason),
  )
  if (captureException) {
    captureException(
      reason instanceof Error ? reason : new Error(String(reason)),
    )
  }
})

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error.message)
  if (captureException) {
    captureException(error)
  }
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  await closeSentry()
  if (mongoConnection) {
    await disconnectMongoDB()
  }
  if (postgresConnection) {
    await disconnectPostgreSQL()
  }
  if (redisConnection) {
    await disconnectRedis()
  }
  process.exit(0)
})

// Start the server
void startServer()

export default app
