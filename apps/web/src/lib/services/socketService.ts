import { Server } from 'http'

import { Pool } from 'pg'
import { Server as SocketIOServer, Socket } from 'socket.io'

type RedisLike = {
  on: (event: string, listener: (...args: unknown[]) => void) => RedisLike
  connect?: () => Promise<unknown>
  quit: () => Promise<unknown>
}

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const socketLogger = createBuildSafeLogger('socket-service')

export class SocketService {
  private readonly io: SocketIOServer
  private readonly _redis: RedisLike
  private readonly _db: Pool

  constructor(server: Server, redis: RedisLike, db: Pool) {
    this._redis = redis
    this._db = db

    // Wire up redis error handling
    this._redis.on('error', (err: unknown) => {
      socketLogger.error('Socket service redis error', err)
    })

    // Initialize Socket.IO
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    })

    this.setupSocketHandlers()
  }

  /**
   * Verify database connectivity.
   * Used by health-check endpoints to confirm the connection pool is alive.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this._db.query('SELECT 1')
      return true
    } catch {
      return false
    }
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      socketLogger.info(`Client connected: ${socket.id}`)

      socket.on('disconnect', () => {
        socketLogger.info(`Client disconnected: ${socket.id}`)
      })

      // Basic health check for socket
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() })
      })
    })
  }

  public getIO(): SocketIOServer {
    return this.io
  }
}
