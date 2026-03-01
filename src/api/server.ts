// Express.js Server Setup
// Main application entry point with middleware configuration

import compression from 'compression'
import cors from 'cors'
import dotenv from 'dotenv'
import express, { Express } from 'express'
import helmet from 'helmet'
import morgan from 'morgan'

import {
  connectMongoDB,
  connectPostgreSQL,
  connectRedis,
} from '../lib/database/connection'
import { authMiddleware } from './middleware/auth'
import { errorHandler, notFoundHandler } from './middleware/error-handler'
import { requestLogger } from './middleware/logger'
import { rateLimiter } from './middleware/rate-limiter'
import authRoutes from './routes/auth'
import documentRoutes from './routes/documents'
import healthRoutes from './routes/health'
import marketResearchRoutes from './routes/market-research'
import projectRoutes from './routes/projects'
import salesOpportunitiesRoutes from './routes/sales-opportunities'
import strategicPlanRoutes from './routes/strategic-plans'
import userRoutes from './routes/users'

// Load environment variables
dotenv.config()

const app: Express = express()
const PORT = process.env.PORT || 5000
const NODE_ENV = process.env.NODE_ENV || 'development'

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet for security headers
app.use(helmet())

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)

// ============================================================================
// BODY PARSING & COMPRESSION
// ============================================================================

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(compression())

// ============================================================================
// LOGGING
// ============================================================================

// Morgan request logger
const morganFormat = NODE_ENV === 'production' ? 'combined' : 'dev'
app.use(morgan(morganFormat))

// Custom request logger
app.use(requestLogger)

// ============================================================================
// RATE LIMITING
// ============================================================================

app.use(rateLimiter)

// ============================================================================
// PUBLIC ROUTES (NO AUTH REQUIRED)
// ============================================================================

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)

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
app.use('/api/users', userRoutes)

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use(notFoundHandler)

// Global error handler (must be last)
app.use(errorHandler)

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let mongoConnection: any = null
let postgresConnection: any = null
let redisConnection: any = null

async function initializeDatabases() {
  try {
    console.log('🔄 Connecting to MongoDB...')
    mongoConnection = await connectMongoDB()
    console.log('✅ MongoDB connected')

    console.log('🔄 Connecting to PostgreSQL...')
    postgresConnection = await connectPostgreSQL()
    console.log('✅ PostgreSQL connected')

    console.log('🔄 Connecting to Redis...')
    redisConnection = await connectRedis()
    console.log('✅ Redis connected')
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    process.exit(1)
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
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  if (mongoConnection) {
    await mongoConnection.disconnect()
  }
  if (postgresConnection) {
    await postgresConnection.end()
  }
  if (redisConnection) {
    await redisConnection.quit()
  }
  process.exit(0)
})

// Start the server
void startServer()

export default app
