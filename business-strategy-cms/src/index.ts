import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import type { Request, Response } from 'express'

import { config } from '@/config/app'
import {
  initializeDatabases,
  closeDatabaseConnections,
} from '@/config/database'
import { apiRouter } from '@/routes'
import { errorHandler } from '@/middleware/errorHandler'
import { SocketService } from '@/services/socketService'
import { logger } from '@/utils/logger'

const app = express()
const server = createServer(app)

// Initialize Socket.IO service if real-time collaboration is enabled
let socketService: SocketService | null = null
if (config.enableRealTimeCollaboration) {
  socketService = new SocketService(server)
}

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
)

// CORS configuration
app.use(
  cors({
    origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1)

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: process.env['npm_package_version'] || '1.0.0',
  })
})

// API routes
app.use(config.apiPrefix, apiRouter)

// 404 handler for API routes
app.use(`${config.apiPrefix}/*`, (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'API endpoint not found',
    },
  })
})

// Global error handling middleware
app.use(errorHandler)

// Start server function
const startServer = async () => {
  try {
    logger.info('Starting Business Strategy CMS server...')

    // Initialize all database connections
    await initializeDatabases()
    logger.info('All database connections established')

    // Start the HTTP server
    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`)
      logger.info(`Environment: ${config.nodeEnv}`)
      logger.info(`API prefix: ${config.apiPrefix}`)
      logger.info(
        `Real-time collaboration: ${config.enableRealTimeCollaboration ? 'enabled' : 'disabled'}`,
      )
      logger.info(
        `Workflow approval: ${config.enableWorkflowApproval ? 'enabled' : 'disabled'}`,
      )
      logger.info(
        `Analytics: ${config.enableAnalytics ? 'enabled' : 'disabled'}`,
      )
      logger.info(
        `Export functionality: ${config.enableExport ? 'enabled' : 'disabled'}`,
      )
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown function
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`)

  try {
    // Close server first to stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed')

      // Close Socket.IO connections
      if (socketService && config.enableRealTimeCollaboration) {
        ;(socketService as any).io.close()
        logger.info('Socket.IO service closed')
      }

      // Close database connections
      await closeDatabaseConnections()

      logger.info('Graceful shutdown completed')
      process.exit(0)
    })

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout')
      process.exit(1)
    }, 30000)
  } catch (error) {
    logger.error('Error during graceful shutdown:', error)
    process.exit(1)
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the server if this file is run directly
if (require.main === module) {
  startServer()
}

// Export app and server for testing
export { app, server, socketService }
export default app
