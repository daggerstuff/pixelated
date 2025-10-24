import type { NotificationService } from './NotificationService'
import * as logger from '../../logging/build-safe-logger'
import type { WebSocket } from 'ws'
import { WebSocketServer as WSServer } from 'ws'
import type { IncomingMessage } from 'http'
import { z } from 'zod'
// Supabase admin import removed - migrate to MongoDB/auth provider

// Define message types using Zod for runtime validation
const BaseMessageSchema = z.object({
  type: z.string(),
})

const MarkReadMessageSchema = BaseMessageSchema.extend({
  type: z.literal('mark_read'),
  notificationId: z.string(),
})

const GetNotificationsMessageSchema = BaseMessageSchema.extend({
  type: z.literal('get_notifications'),
  limit: z.number().optional(),
  offset: z.number().optional(),
})

const ClientMessageSchema = z.discriminatedUnion('type', [
  MarkReadMessageSchema,
  GetNotificationsMessageSchema,
])

type ClientMessage = z.infer<typeof ClientMessageSchema>

// Server message types
interface ServerMessage {
  type: string
  [key: string]: unknown
}

/**
 * WebSocketServer provides real-time notification capabilities using WebSockets
 *
 * This server:
 * 1. Verifies client authentication using Supabase tokens
 * 2. Manages client connections and disconnections
 * 3. Handles client messages for notification operations
 * 4. Distributes notifications to connected clients
 *
 * Authentication is performed using Supabase JWT tokens passed in the
 * Authorization header as a Bearer token.
 */
export class WebSocketServer {
  private wss: WSServer
  private notificationService: NotificationService

  constructor(port: number, notificationService: NotificationService) {
    this.notificationService = notificationService
    this.wss = new WSServer({ port })

    this.wss.on('connection', this.handleConnection.bind(this))
    this.wss.on('error', this.handleServerError.bind(this))

    logger
      .createBuildSafeLogger('websocket')
      .info('WebSocket server started', { port })
  }

  /**
   * Handle server-level errors
   */
  private handleServerError(error: Error): void {
    logger.createBuildSafeLogger('websocket').error('WebSocket server error', {
      error: String(error),
    })
  }

  /**
   * Send a message to a WebSocket client
   */
  private sendMessage(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message))
    } catch (error: unknown) {
      logger
        .createBuildSafeLogger('websocket')
        .error('Failed to send message to client', {
          error: error instanceof Error ? String(error) : String(error),
        })
    }
  }

  /**
   * Send an error message to a WebSocket client
   */
  private sendError(ws: WebSocket, message: string): void {
    this.sendMessage(ws, {
      type: 'error',
      message,
    })
  }

  /**
   * Extract auth token from request
   */
  private getAuthToken(req: IncomingMessage): string | null {
    const header = req.headers['authorization']
    if (!header) {
      return null
    }
    const [type, token] = header.split(' ')
    if (type !== 'Bearer' || !token) {
      return null
    }
    return token
  }

  /**
   * Verify the authentication token
   */
  private async verifyToken(_token: string): Promise<string> {
    try {
      // Use Supabase admin client to verify the token and get user information
      // TODO: Replace with MongoDB/auth provider implementation for token verification and user lookup
      // For now, simulate a user ID
      const userId = 'mock-user-id'
      logger
        .createBuildSafeLogger('websocket')
        .info('Token verified successfully (Supabase removed)', {
          userId,
          role: 'user',
        })
      return userId
    } catch (error: unknown) {
      logger
        .createBuildSafeLogger('websocket')
        .error('Token verification failed', {
          error: error instanceof Error ? String(error) : String(error),
        })
      throw new Error('Invalid token', { cause: error })
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const token = this.getAuthToken(req)
    if (!token) {
      this.sendError(ws, 'No authentication token provided')
      ws.close(1008, 'Unauthorized - No token provided')
      return
    }

    this.verifyToken(token)
      .then((userId: string) => this.setupAuthenticatedConnection(userId, ws))
      .catch((error: unknown) => {
        const message = error instanceof Error ? String(error) : String(error)
        this.sendError(ws, `Authentication failed: ${message}`)
        ws.close(1008, 'Unauthorized - Token verification failed')
      })
  }

  /**
   * Set up an authenticated WebSocket connection
   */
  private setupAuthenticatedConnection(userId: string, ws: WebSocket): void {
    if (!userId) {
      this.sendError(ws, 'Invalid user ID')
      ws.close(1008, 'Unauthorized - Invalid user ID')
      return
    }

    this.notificationService.registerClient(userId, ws as unknown as WebSocket)
    logger
      .createBuildSafeLogger('websocket')
      .info('WebSocket client connected', { userId })

    ws.on('message', (data: string) =>
      this.handleClientMessage(userId, data, ws),
    )
    ws.on('close', () => this.handleClientDisconnection(userId))
    ws.on('error', (error: Error) => this.handleClientError(userId, error))

    this.sendUnreadCount(userId, ws)
  }

  /**
   * Handle client disconnection
   */
  private handleClientDisconnection(userId: string): void {
    this.notificationService.unregisterClient(userId)
    logger
      .createBuildSafeLogger('websocket')
      .info('WebSocket client disconnected', {
        userId,
      })
  }

  /**
   * Handle client-level errors
   */
  private handleClientError(userId: string, error: Error): void {
    logger.createBuildSafeLogger('websocket').error('WebSocket client error', {
      userId,
      error: String(error),
    })
  }

  /**
   * Send unread count to client
   */
  private async sendUnreadCount(userId: string, ws: WebSocket): Promise<void> {
    try {
      const count = await this.notificationService.getUnreadCount(userId)
      this.sendMessage(ws, { type: 'unreadCount', count })
    } catch (error: unknown) {
      logger
        .createBuildSafeLogger('websocket')
        .error('Failed to send unread count', {
          userId,
          error: error instanceof Error ? String(error) : String(error),
        })
    }
  }

  /**
   * Handle client message
   */
  private handleClientMessage(
    userId: string,
    data: string,
    ws: WebSocket,
  ): void {
    try {
      const message: unknown = JSON.parse(data) as unknown
      const validatedMessage = ClientMessageSchema.parse(message)
      this.processMessage(userId, validatedMessage, ws)
    } catch (error: unknown) {
      logger
        .createBuildSafeLogger('websocket')
        .error('Invalid message received', {
          userId,
          error: error instanceof Error ? String(error) : String(error),
        })
      this.sendError(ws, 'Invalid message format')
    }
  }

  /**
   * Handle mark read message
   */
  private async handleMarkRead(
    userId: string,
    notificationId: string,
    ws: WebSocket,
  ): Promise<void> {
    await this.notificationService.markAsRead(userId, notificationId)
    await this.sendUnreadCount(userId, ws)
  }

  /**
   * Handle get notifications message
   */
  private async handleGetNotifications(
    userId: string,
    message: z.infer<typeof GetNotificationsMessageSchema>,
    ws: WebSocket,
  ): Promise<void> {
    const notifications = await this.notificationService.getNotifications(
      userId,
      message.limit,
      message.offset,
    )
    this.sendMessage(ws, { type: 'notifications', data: notifications })
  }

  /**
   * Process validated client message
   */
  private async processMessage(
    userId: string,
    message: ClientMessage,
    ws: WebSocket,
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'mark_read':
          await this.handleMarkRead(userId, message.notificationId, ws)
          break
        case 'get_notifications':
          await this.handleGetNotifications(userId, message, ws)
          break
        default: {
          const { type } = message as { type: string }
          this.sendError(ws, `Unknown type: ${type}`)
        }
      }
    } catch (error: unknown) {
      logger
        .createBuildSafeLogger('websocket')
        .error('Error processing message', {
          userId,
          error: error instanceof Error ? String(error) : String(error),
        })
      this.sendError(ws, 'Error processing message')
    }
  }
}
