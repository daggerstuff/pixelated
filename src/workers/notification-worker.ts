import { NotificationService } from '@/lib/services/notification/NotificationService'
import { WebSocketServer } from '@/lib/services/notification/WebSocketServer'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

// Create logger
const logger = createBuildSafeLogger('notification-worker')

const WORKER_ID = crypto.randomUUID()
const PROCESSING_INTERVAL = 1000 // 1 second

// State
let wsServer: WebSocketServer | undefined

async function startWorker() {
  logger.info('Starting notification worker', { workerId: WORKER_ID })

  // Create notification service
  const notificationService = new NotificationService()

  // Create WebSocket server
  wsServer = new WebSocketServer()

  // Handle WebSocket errors
  wsServer.on('error', (error: Error) => {
    logger.error('WebSocket server error', {
      workerId: WORKER_ID,
      error: error instanceof Error ? error.message : String(error),
    })
  })

  try {
    // Start processing notifications
    await notificationService.startProcessing(PROCESSING_INTERVAL)
  } catch (error: unknown) {
    logger.error('Notification worker failed', {
      workerId: WORKER_ID,
      error: error instanceof Error ? String(error) : String(error),
    })

    // Clean up
    if (wsServer) wsServer.close()
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down notification worker', {
    workerId: WORKER_ID,
  })
  if (wsServer) wsServer.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down notification worker', {
    workerId: WORKER_ID,
  })
  if (wsServer) wsServer.close()
  process.exit(0)
})

// Start the worker
startWorker().catch((error) => {
  logger.error('Failed to start notification worker', {
    workerId: WORKER_ID,
    error: error instanceof Error ? String(error) : String(error),
  })
  process.exit(1)
})
