import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { TrainingWebSocketServer } from './TrainingWebSocketServer.ts'
const logger = createBuildSafeLogger('server')

const PORT = process.env['TRAINING_WS_PORT']
  ? parseInt(process.env['TRAINING_WS_PORT'])
  : 8084

const server = new TrainingWebSocketServer(PORT)

process.on('SIGTERM', () => {
  server.close()
  process.exit(0)
})

logger.info(`Training WebSocket Server running on port ${PORT}`)
