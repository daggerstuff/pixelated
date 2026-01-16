import { Server } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import Redis from 'ioredis'
import { Pool } from 'pg'

export class SocketService {
    private io: SocketIOServer
    private redis: Redis
    private db: Pool

    constructor(server: Server, redis: Redis, db: Pool) {
        this.redis = redis
        this.db = db

        // Initialize Socket.IO
        this.io = new SocketIOServer(server, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:3000',
                methods: ['GET', 'POST'],
                credentials: true,
            },
            transports: ['websocket', 'polling'],
        })

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
