import express from 'express'
import { createServer } from 'https'
import { readFileSync } from 'fs'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import cors from 'cors'
import Redis from 'ioredis'
import { Pool } from 'pg'
import { SocketService } from './services/socketService.js'
import { createFileRoutes } from './routes/fileRoutes.js'
import { createBusinessIntelligenceRoutes } from './routes/businessIntelligenceRoutes.js'
import { productionConfig } from './config/production.js'

const app = express()

// Environment setup
const PORT = productionConfig.port
const isProduction = productionConfig.environment === 'production'

// Database connection
const db = new Pool(productionConfig.database)
const redis = new Redis(productionConfig.redis)

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: productionConfig.environment,
  })
})

// API routes
app.use('/api/files', createFileRoutes(db))
app.use('/api/business-intelligence', createBusinessIntelligenceRoutes(db))

// SSL configuration
let server
if (isProduction) {
  try {
    const options = {
      key: readFileSync('/etc/ssl/private/server.key'),
      cert: readFileSync('/etc/ssl/certs/server.crt'),
    }
    server = createServer(options, app)
    console.log('🔒 HTTPS server configured')
  } catch (error) {
    console.error('❌ SSL certificates not found, falling back to HTTP:', error)
    server = createServer(app)
  }
} else {
  server = createServer(app)
}

// Socket.IO configuration
const socketService = new SocketService(server, redis, db)

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully')

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
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error('❌ Error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: isProduction ? 'Something went wrong' : error.message,
    })
  },
)

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found',
  })
})

server.listen(PORT, () => {
  console.log(`🚀 Business Strategy CMS running on port ${PORT}`)
  console.log(`📊 Environment: ${productionConfig.environment}`)
  console.log(
    `🔧 Health check: http${isProduction ? 's' : ''}://localhost:${PORT}/health`,
  )
})

export { server, db, redis, socketService }
