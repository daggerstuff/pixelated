import { Server, Socket } from 'socket.io'
import { Server as HttpServer } from 'http'
import { AuthService } from './authService'
import { CollaborationService } from './collaborationService'
import { redisClient } from '@/config/database'
import { logger } from '@/utils/logger'

interface AuthenticatedSocket extends Socket {
  user?: {
    userId: string
    email: string
    role: string
  }
  documentId?: string
}

interface SocketEvents {
  'join-document': { documentId: string }
  'leave-document': { documentId: string }
  'cursor-move': {
    position: number
    selection?: { start: number; end: number }
  }
  'document-change': {
    type: 'insert' | 'delete' | 'format'
    position: number
    content?: string
    length?: number
    format?: string
    value?: any
  }
  'user-typing': { isTyping: boolean }
  'request-sync': { since?: string }
  'document-save': { content: string }
}

export class SocketService {
  private io: Server
  private connectedUsers: Map<string, Set<string>> = new Map()

  constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    })

    this.setupMiddleware()
    this.setupEventHandlers()
    this.startPeriodicCleanup()
  }

  private setupMiddleware(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth?.token
        if (!token) {
          return next(new Error('Authentication token required'))
        }

        const payload = await AuthService.verifyToken(token)
        if (!payload) {
          return next(new Error('Invalid token'))
        }

        socket.user = payload
        next()
      } catch (error) {
        logger.error('Socket authentication error:', error)
        next(new Error('Authentication failed'))
      }
    })
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`User ${socket.user?.userId} connected via socket`)

      socket.on('join-document', async (data: { documentId: string }) => {
        await this.handleJoinDocument(socket, data.documentId)
      })

      socket.on('leave-document', (data: { documentId: string }) => {
        this.handleLeaveDocument(socket, data.documentId)
      })

      socket.on(
        'cursor-move',
        (data: {
          position: number
          selection?: { start: number; end: number }
        }) => {
          this.handleCursorMove(socket, data)
        },
      )

      socket.on('document-change', (data: SocketEvents['document-change']) => {
        this.handleDocumentChange(socket, data)
      })

      socket.on('user-typing', (data: { isTyping: boolean }) => {
        this.handleUserTyping(socket, data.isTyping)
      })

      socket.on('document-save', async (data: { content: string }) => {
        await this.handleDocumentSave(socket, data.content)
      })

      socket.on('disconnect', () => {
        this.handleDisconnect(socket)
      })
    })
  }

  private async handleJoinDocument(
    socket: AuthenticatedSocket,
    documentId: string,
  ): Promise<void> {
    if (!socket.user) return

    try {
      // Join document room
      socket.join(`document:${documentId}`)
      socket.documentId = documentId

      // Add user to connected users
      if (!this.connectedUsers.has(documentId)) {
        this.connectedUsers.set(documentId, new Set())
      }
      this.connectedUsers.get(documentId)?.add(socket.user.userId)

      // Register user in collaboration service
      const session = CollaborationService.joinSession(
        documentId,
        socket.user.userId,
        socket.user.email,
      )

      // Notify other users
      socket.to(`document:${documentId}`).emit('user-joined', {
        userId: socket.user.userId,
        userName: socket.user.email,
        color: session.color,
      })

      // Send current active users to the joining user
      const activeUsers = CollaborationService.getActiveUsers(documentId)
      socket.emit('active-users', activeUsers)

      // Load recent changes
      const recentChanges = CollaborationService.getChanges(
        documentId,
        new Date(Date.now() - 5 * 60 * 1000),
      )
      socket.emit('recent-changes', recentChanges)

      logger.info(`User ${socket.user.userId} joined document ${documentId}`)
    } catch (error) {
      logger.error('Error joining document:', error)
      socket.emit('error', { message: 'Failed to join document' })
    }
  }

  private handleLeaveDocument(
    socket: AuthenticatedSocket,
    documentId: string,
  ): void {
    if (!socket.user) return

    socket.leave(`document:${documentId}`)

    if (socket.documentId === documentId) {
      socket.documentId = undefined
    }

    // Remove user from connected users
    this.connectedUsers.get(documentId)?.delete(socket.user.userId)

    // Remove from collaboration service
    CollaborationService.leaveSession(documentId, socket.user.userId)

    // Notify other users
    socket.to(`document:${documentId}`).emit('user-left', {
      userId: socket.user.userId,
    })

    logger.info(`User ${socket.user.userId} left document ${documentId}`)
  }

  private handleCursorMove(
    socket: AuthenticatedSocket,
    data: { position: number; selection?: { start: number; end: number } },
  ): void {
    if (!socket.user || !socket.documentId) return

    CollaborationService.updateCursor(
      socket.documentId,
      socket.user.userId,
      data.position,
      data.selection,
    )

    // Broadcast cursor position to other users
    socket.to(`document:${socket.documentId}`).emit('cursor-update', {
      userId: socket.user.userId,
      position: data.position,
      selection: data.selection,
    })
  }

  private handleDocumentChange(
    socket: AuthenticatedSocket,
    change: SocketEvents['document-change'],
  ): void {
    if (!socket.user || !socket.documentId) return

    const documentChange = {
      ...change,
      userId: socket.user.userId,
      timestamp: new Date(),
    }

    // Record change
    CollaborationService.recordChange(socket.documentId, documentChange)

    // Broadcast change to other users
    socket
      .to(`document:${socket.documentId}`)
      .emit('document-change', documentChange)

    // Store change in Redis for persistence
    this.storeChange(socket.documentId, documentChange)
  }

  private handleUserTyping(
    socket: AuthenticatedSocket,
    isTyping: boolean,
  ): void {
    if (!socket.user || !socket.documentId) return

    socket.to(`document:${socket.documentId}`).emit('user-typing', {
      userId: socket.user.userId,
      userName: socket.user.email,
      isTyping,
    })
  }

  private async handleDocumentSave(
    socket: AuthenticatedSocket,
    content: string,
  ): Promise<void> {
    if (!socket.user || !socket.documentId) return

    try {
      await CollaborationService.autoSave(
        socket.documentId,
        content,
        socket.user.userId,
      )

      // Broadcast save to other users
      socket.to(`document:${socket.documentId}`).emit('document-saved', {
        userId: socket.user.userId,
        userName: socket.user.email,
        timestamp: new Date(),
      })

      logger.info(
        `Document ${socket.documentId} saved by ${socket.user.userId}`,
      )
    } catch (error) {
      logger.error('Error saving document:', error)
      socket.emit('error', { message: 'Failed to save document' })
    }
  }

  private handleDisconnect(socket: AuthenticatedSocket): void {
    if (socket.user && socket.documentId) {
      this.handleLeaveDocument(socket, socket.documentId)
    }
    logger.info(`User ${socket.user?.userId} disconnected`)
  }

  private async storeChange(documentId: string, change: any): Promise<void> {
    try {
      const key = `changes:${documentId}`
      const existing = await redisClient.get(key)
      const changes = existing ? JSON.parse(existing) : []

      changes.push(change)

      // Keep only last 100 changes in Redis
      if (changes.length > 100) {
        changes.shift()
      }

      await redisClient.setEx(key, 3600, JSON.stringify(changes)) // 1 hour TTL
    } catch (error) {
      logger.error('Error storing change in Redis:', error)
    }
  }

  private startPeriodicCleanup(): void {
    // Clean up inactive sessions every 5 minutes
    setInterval(
      () => {
        CollaborationService.cleanupInactiveSessions()
      },
      5 * 60 * 1000,
    )
  }

  // Public methods for external use
  public emitToDocument(documentId: string, event: string, data: any): void {
    this.io.to(`document:${documentId}`).emit(event, data)
  }

  public emitToUser(userId: string, event: string, data: any): void {
    const { sockets } = this.io.sockets
    for (const [_socketId, socket] of sockets) {
      const authSocket = socket as AuthenticatedSocket
      if (authSocket.user?.userId === userId) {
        authSocket.emit(event, data)
      }
    }
  }

  public getConnectedUsers(documentId: string): string[] {
    const users = this.connectedUsers.get(documentId)
    return users ? Array.from(users) : []
  }

  public getRoomSize(documentId: string): number {
    const room = this.io.sockets.adapter.rooms.get(`document:${documentId}`)
    return room ? room.size : 0
  }
}
