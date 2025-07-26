import { config } from '../config/env.config'
import { NotificationService } from '../lib/services/notification/NotificationService.mock'
import { WebSocketServer } from '../lib/services/notification/WebSocketServer.mock'
import { createBuildSafeLogger } from '../lib/logging/build-safe-logger.mock'

// Create logger
const logger = createBuildSafeLogger('notification-worker')

const WORKER_ID = crypto.randomUUID()
const PROCESSING_INTERVAL = 1000 // 1 second
const WS_PORT = config.workers.notification.wsPort()

async function startWorker() {
  logger.info('Starting notification worker', { workerId: WORKER_ID })

  // Create notification service
  const notificationService = new NotificationService()

  // Create WebSocket server
  const wsServer = new WebSocketServer(WS_PORT, notificationService)

  try {
    // Start processing notifications
    await notificationService.startProcessing(PROCESSING_INTERVAL)
  } catch (error) {
    logger.error('Notification worker failed', {
      workerId: WORKER_ID,
      error: error instanceof Error ? error.message : String(error),
    })

    // Clean up
    wsServer.close()
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down notification worker', {
    workerId: WORKER_ID,
  })
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down notification worker', {
    workerId: WORKER_ID,
  })
  process.exit(0)
})

// Start the worker
startWorker().catch((error) => {
  logger.error('Failed to start notification worker', {
    workerId: WORKER_ID,
    error: error instanceof Error ? error.message : String(error),
  })
  process.exit(1)
})
