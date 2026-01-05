import { TrainingWebSocketServer } from './TrainingWebSocketServer.ts'

const PORT = process.env.TRAINING_WS_PORT ? parseInt(process.env.TRAINING_WS_PORT) : 8084

const server = new TrainingWebSocketServer(PORT)

process.on('SIGTERM', () => {
  server.close()
  process.exit(0)
})

console.log(`Training WebSocket Server running on port ${PORT}`)
