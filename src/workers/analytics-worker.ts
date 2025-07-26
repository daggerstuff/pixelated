/// <reference types="node" />
import { config } from '../config/env.config'
import { AnalyticsService } from '../lib/services/analytics/AnalyticsService.mock'
import { createBuildSafeLogger } from '../lib/logging/build-safe-logger.mock'
import { WebSocketServer } from 'ws'

// Create logger
const logger = createBuildSafeLogger('analytics-worker')

// Generate a unique worker ID
const WORKER_ID = crypto.randomUUID()

// Constants
const PROCESSING_INTERVAL = 1000 // 1 second
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours
const WS_PORT = config.workers.analytics.wsPort()

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

    // Initialize WebSocket server
    wss = new WebSocketServer({ port: WS_PORT })

    // Handle WebSocket connections
    wss.on('connection', async (ws) => {
      try {
        // Wait for authentication message
        ws.once('message', async (data) => {
          try {
            const message = JSON.parse(data.toString())
            if (message.type === 'authenticate' && message.userId) {
              // Register client for real-time updates
              analyticsService.registerClient(message.userId, ws)

              ws.send(
                JSON.stringify({
                  type: 'authenticated',
                  message: 'Successfully connected to analytics service',
                }),
              )
            } else {
              ws.close()
            }
          } catch (error) {
            logger.error('Error handling WebSocket message:', error)
            ws.close()
          }
        })
      } catch (error) {
        logger.error('Error handling WebSocket connection:', error)
        ws.close()
      }
    })

    // Handle WebSocket server errors
    wss.on('error', (error) => {
      logger.error('WebSocket server error:', error)
    })

    // Start event processing loop
    const processEvents = async () => {
      try {
        await analyticsService.processEvents()
      } catch (error) {
        logger.error('Error processing analytics events:', error)
      }
      setTimeout(processEvents, PROCESSING_INTERVAL)
    }

    // Start cleanup loop
    const cleanup = async () => {
      try {
        await analyticsService.cleanup()
      } catch (error) {
        logger.error('Error cleaning up analytics data:', error)
      }
      setTimeout(cleanup, CLEANUP_INTERVAL)
    }

    // Start processing and cleanup loops
    processEvents()
    cleanup()

    logger.info(`Analytics worker started successfully on port ${WS_PORT}`)
  } catch (error) {
    logger.error('Error starting analytics worker:', error)
    process.exit(1)
  }
}

// Handle shutdown signals
async function shutdown(signal: string) {
  logger.info(`Shutting down analytics worker (signal: ${signal})`)

  try {
    // Close WebSocket server
    wss?.close()

    // Allow time for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000))

    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Start the worker
startWorker()
