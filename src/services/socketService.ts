import { Server, Socket } from 'socket.io'
import { Server as HttpServer } from 'http'
import Redis from 'ioredis'
import { Pool } from 'pg'
import jwt from 'jsonwebtoken'
import { DocumentService } from './DocumentService.js'

interface AuthenticatedSocket extends Socket {
  userId?: string
  sessionId?: string
}

interface SocketAuth {
  token: string
}

export interface DocumentChangeEvent {
  type: 'insert' | 'delete' | 'format'
  position: { line: number; column: number }
  content?: string
  length?: number
  userId: string
}

export interface CursorUpdate {
  line: number
  column: number
  userId: string
}

export class SocketService {
  private io: Server
  private redis: Redis
  private db: Pool
  private documentService: DocumentService

  constructor(server: HttpServer, redis: Redis, db: Pool) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    })
    this.redis = redis
    this.db = db
    this.documentService = new DocumentService(db, redis)

    this.setupMiddleware()
    this.setupEventHandlers()
  }

  private setupMiddleware(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const auth = socket.handshake.auth as SocketAuth
        if (!auth.token) {
          return next(new Error('Authentication token required'))
        }

        const decoded = jwt.verify(auth.token, process.env.JWT_SECRET!) as {
          userId: string
        }
        socket.userId = decoded.userId
        next()
      } catch (error) {
        next(new Error('Invalid authentication token'))
      }
    })
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.userId} connected`)

      socket.on('join-document', async (data: { documentId: string }) => {
        try {
          const document = await this.documentService.getDocument(
            data.documentId,
            socket.userId!,
          )
          if (!document) {
            socket.emit('error', {
              message: 'Document not found or access denied',
            })
            return
          }

          socket.join(data.documentId)

          const session = await this.documentService.createCollaborationSession(
            {
              documentId: data.documentId,
              userId: socket.userId!,
              socketId: socket.id,
            },
          )

          socket.sessionId = session.id

          const activeCollaborators =
            await this.documentService.getActiveCollaborators(data.documentId)

          socket.to(data.documentId).emit('user-joined', {
            userId: socket.userId,
            collaborators: activeCollaborators,
          })

          socket.emit('document-joined', {
            document,
            collaborators: activeCollaborators,
          })
        } catch (error) {
          console.error('Error joining document:', error)
          socket.emit('error', { message: 'Failed to join document' })
        }
      })

      socket.on(
        'document-change',
        async (data: {
          documentId: string
          change: DocumentChangeEvent
          version: number
        }) => {
          try {
            const document = await this.documentService.getDocument(
              data.documentId,
              socket.userId!,
            )
            if (!document) {
              socket.emit('error', { message: 'Document not found' })
              return
            }

            await this.documentService.recordChange(
              data.documentId,
              socket.userId!,
              data.change,
            )

            socket.to(data.documentId).emit('remote-change', {
              change: data.change,
              version: data.version + 1,
              userId: socket.userId,
            })
          } catch (error) {
            console.error('Error processing document change:', error)
            socket.emit('error', { message: 'Failed to apply change' })
          }
        },
      )

      socket.on(
        'cursor-update',
        async (data: {
          documentId: string
          cursor: { line: number; column: number }
        }) => {
          try {
            if (socket.sessionId) {
              await this.documentService.updateCursor(
                socket.sessionId,
                data.cursor,
              )

              socket.to(data.documentId).emit('cursor-updated', {
                userId: socket.userId,
                cursor: data.cursor,
              })
            }
          } catch (error) {
            console.error('Error updating cursor:', error)
          }
        },
      )

      socket.on(
        'save-document',
        async (data: {
          documentId: string
          content: string
          version: number
        }) => {
          try {
            const updated = await this.documentService.updateDocument(
              data.documentId,
              socket.userId!,
              { content: data.content },
            )

            if (updated) {
              socket.to(data.documentId).emit('document-saved', {
                version: updated.version,
                updatedAt: updated.updatedAt,
              })
            }
          } catch (error) {
            console.error('Error saving document:', error)
            socket.emit('error', { message: 'Failed to save document' })
          }
        },
      )

      socket.on('disconnect', async () => {
        console.log(`User ${socket.userId} disconnected`)

        if (socket.sessionId) {
          const sessionData = await this.redis.get(
            `session:${socket.sessionId}`,
          )
          if (sessionData) {
            const session = JSON.parse(sessionData)
            await this.documentService.removeCollaborationSession(
              socket.sessionId,
            )

            const remainingCollaborators =
              await this.documentService.getActiveCollaborators(
                session.documentId,
              )
            socket.to(session.documentId).emit('user-left', {
              userId: socket.userId,
              collaborators: remainingCollaborators,
            })
          }
        }
      })
    })
  }

  public getSocketIO(): Server {
    return this.io
  }
}
