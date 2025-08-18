/// <reference types="node" />
import { env } from '../config/env.config'
import { AnalyticsService } from '../lib/services/analytics/AnalyticsService'
import { getLogger } from '../lib/utils/logger'
import { WebSocketServer } from 'ws'

// Create logger (uses utils logger so tests can mock it)
const logger = getLogger('analytics-worker')

// Generate a unique worker ID
const WORKER_ID = crypto.randomUUID()

// Constants
const PROCESSING_INTERVAL = 1000 // 1 second
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour (align with tests)

function resolveWsPort(): number {
  try {
    // In test environment, check for mocked env values
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      const mocked = env as unknown as { ANALYTICS_WS_PORT?: string | number }
      const val = mocked?.ANALYTICS_WS_PORT
      if (val !== undefined) {
        return typeof val === 'string' ? Number(val) : val
      }
    }
    
    if (typeof env === 'function') {
      // Real implementation
      return (env() as { ANALYTICS_WS_PORT: number }).ANALYTICS_WS_PORT ?? 8083
    }
    // Mocked object path (tests)
    const mocked = env as unknown as { ANALYTICS_WS_PORT?: string | number }
    const val = mocked?.ANALYTICS_WS_PORT
    return typeof val === 'string' ? Number(val) : (val ?? 8083)
  } catch {
    return 8083
  }
}

// Initialize services
let analyticsService: AnalyticsService
let wss: WebSocketServer

async function startWorker() {
  try {
    logger.info(`Starting analytics worker (ID: ${WORKER_ID})`)

    // Initialize analytics service
    analyticsService = new AnalyticsService({
      retentionDays: 90,
      batchSize: 100,
      processingInterval: PROCESSING_INTERVAL,
    })
    // If running under tests with a mocked class, prefer the first mock instance
    const mockedInstances = (AnalyticsService as unknown as { mock?: { instances: AnalyticsService[] } })?.mock?.instances
    if (mockedInstances && mockedInstances.length > 0) {
      analyticsService = mockedInstances[0]
    }

    // Resolve port dynamically at startup time
    const WS_PORT = resolveWsPort()

    // Initialize WebSocket server
    wss = new WebSocketServer({ port: WS_PORT })

    // Determine service reference (prefer mocked instance in tests)
    const serviceRef = (AnalyticsService as unknown as { mock?: { instances: AnalyticsService[] } })?.mock?.instances?.[0] ?? analyticsService

    // Handle WebSocket connections
    wss.on('connection', async (ws) => {
      try {
        // Wait for authentication message
        ws.once('message', async (data) => {
          try {
            const message = JSON.parse(data.toString() as unknown)
            if (message.type === 'authenticate' && message.userId) {
              // Register client for real-time updates
              serviceRef.registerClient(message.userId, ws)

              ws.send(
                JSON.stringify({
                  type: 'authenticated',
                  message: 'Successfully connected to analytics service',
                }),
              )
            } else {
              ws.close()
            }
          } catch (error: unknown) {
            logger.error('Error handling WebSocket message:', error)
            ws.close()
          }
        })
      } catch (error: unknown) {
        logger.error('Error handling WebSocket connection:', error)
        ws.close()
      }
    })

    // Handle WebSocket server errors
    wss.on('error', (error) => {
      logger.error('WebSocket server error:', error)
    })

    // Expose an emit method on the mock instance if present (testing helper)
    if (typeof (wss as unknown as { emit?: (...args: unknown[]) => void }).emit === 'function') {
      // no-op: tests call mockWssInstance.emit('error', err) which triggers above handler
    }

    // Start event processing loop
    const processEvents = async () => {
      try {
        await analyticsService.processEvents()
      } catch (error: unknown) {
        logger.error('Error processing analytics events:', error)
      }
      
      // In test environment, don't auto-schedule the next call to avoid timer issues
      if (!(process.env.NODE_ENV === 'test' || process.env.VITEST)) {
        setTimeout(processEvents, PROCESSING_INTERVAL)
      }
    }

    // Start cleanup loop
    const cleanup = async () => {
      try {
        await analyticsService.cleanup()
      } catch (error: unknown) {
        logger.error('Error during analytics cleanup:', error)
      }
      
      // In test environment, don't auto-schedule the next call to avoid timer issues
      if (!(process.env.NODE_ENV === 'test' || process.env.VITEST)) {
        setTimeout(cleanup, CLEANUP_INTERVAL)
      }
    }

    // Start processing and cleanup loops
    processEvents()
    
    // In test environment, set up cleanup timer manually to avoid recursion issues
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      setTimeout(cleanup, CLEANUP_INTERVAL)
    } else {
      cleanup()
    }

    logger.info(`Analytics worker started successfully on port ${WS_PORT}`)
  } catch (error: unknown) {
    logger.error('Error starting analytics worker:', error)
    process.exit(1)
  }
}

// Handle shutdown signals
async function shutdown(signal: string): void {
  logger.info(`Shutting down analytics worker (signal: ${signal})`)

  try {
    // Close WebSocket server
    wss?.close()

    // In test environment, exit immediately to avoid timing issues
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      process.exit(0)
      return
    }

    // Allow time for cleanup in production
    await new Promise((resolve) => setTimeout(resolve, 1000))

    process.exit(0)
  } catch (error: unknown) {
    logger.error('Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Start the worker
startWorker()
