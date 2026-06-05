import { Server } from 'http'

import { Pool } from 'pg'
import { Server as SocketIOServer, Socket } from 'socket.io'

type RedisLike = {
  on: (event: string, listener: (...args: unknown[]) => void) => RedisLike
  connect?: () => Promise<unknown>
  quit: () => Promise<unknown>
}

export class SocketService {
  private readonly io: SocketIOServer

  // TODO: Integrate redis and db into socket service (PIX-XXXX)
  // @ts-expect-error - Reserved for future integration
  private readonly _redis: RedisLike
  // @ts-expect-error - Reserved for future integration
  private readonly _db: Pool

  constructor(server: Server, redis: RedisLike, db: Pool) {
    // Initialize Socket.IO
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    })
    this._redis = redis
    this._db = db

    this.setupSocketHandlers()
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`)

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`)
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