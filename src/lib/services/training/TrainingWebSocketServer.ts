import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { randomUUID } from 'crypto'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { validateToken } from '../../auth/jwt-service'
import type { UserRole } from '../../auth/roles'
import { AIRepository } from '../../db/ai/repository'
import type { TherapySession } from '../../ai/models/ai-types'

const logger = createBuildSafeLogger('TrainingWebSocketServer')

/**
 * Training WebSocket Server - Real-time collaboration for clinical training sessions
 *
 * Authentication & Authorization:
 * - Production: Validates JWT access tokens using the platform's auth system
 * - Development: Bypasses authentication for local development/testing (use with caution)
 * - Role mapping: Maps platform UserRole (admin, therapist, etc.) to training roles
 *   - admin/therapist -> supervisor (can supervise and provide coaching notes)
 *   - researcher -> observer (can observe sessions)
 *   - patient/support/guest -> trainee (can participate in training)
 *
 * Security Features:
 * - Token validation with expiration and revocation checks
 * - Role-based access control for coaching notes (supervisor/observer only)
 * - Authentication timeout (10 seconds) to prevent unauthenticated connections
 * - Session-level message broadcasting with role filtering
 *
 * Security enhancements implemented:
 * 1. Verify user has permission to access the requested sessionId
 * 2. Implement session-level access control (only session owner + authorized supervisors)
 * 3. Enforce role-based access hierarchy
 * 4. Audit logging for all authentication and authorization events
 */

interface TrainingSessionClient {
  id: string
  ws: WebSocket
  sessionId?: string
  role: 'trainee' | 'observer' | 'supervisor'
  userId: string
  isAuthenticated: boolean
  authenticatedAt?: Date
}

interface ClientAuthResult {
  userId: string
  role: 'trainee' | 'observer' | 'supervisor'
}

type WebSocketMessage =
  | { type: 'authenticate', payload: { token: string } }
  | { type: 'join_session', payload: { sessionId: string, role: 'trainee' | 'observer' | 'supervisor', userId: string } }
  | { type: 'session_message', payload: { content: string, role: string, userId?: string, timestamp?: string } }
  | { type: 'coaching_note', payload: { content: string, authorId?: string, timestamp?: string } }
  | { type: 'authenticated', payload: { userId: string, role: string } }
  | { type: 'session_joined', payload: { sessionId: string, role: string, userId: string } }
  | { type: 'participant_joined', payload: { userId: string, role: string } }
  | { type: 'participant_left', payload: { userId: string } }
  | { type: 'error', payload: { message: string } }

export class TrainingWebSocketServer {
  private wss: WebSocketServer
  private clients: Map<string, TrainingSessionClient> = new Map()
  private repository: AIRepository
  private readonly AUTH_TIMEOUT = 10000 // 10 seconds to authenticate

  constructor(port: number) {
    this.wss = new WebSocketServer({ port })
    this.wss.on('connection', this.handleConnection.bind(this))
    this.repository = new AIRepository()
    logger.info('Training WebSocket Server started', { port })
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const clientId = randomUUID()
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const token = url.searchParams.get('token')

    const client: TrainingSessionClient = {
      id: clientId,
      ws,
      role: 'trainee', // Default role until authenticated
      userId: '',
      isAuthenticated: false
    }

    this.clients.set(clientId, client)

    // Set authentication timeout
    const timeout = setTimeout(() => {
      const c = this.clients.get(clientId)
      if (c && !c.isAuthenticated) {
        logger.warn('Authentication timeout', { clientId })
        this.sendError(ws, 'Authentication timeout')
        ws.close(1008, 'Authentication timeout')
        this.clients.delete(clientId)
      }
    }, this.AUTH_TIMEOUT)

    ws.on('message', async (data: string) => {
      try {
        const message = JSON.parse(data) as WebSocketMessage
        if (message.type === 'authenticate') {
          clearTimeout(timeout)
          await this.handleAuthenticate(ws, clientId, message.payload)
        } else {
          await this.handleMessage(ws, clientId, message)
        }
      } catch (err) {
        logger.error('Failed to parse message', { clientId, error: err })
        this.sendError(ws, 'Invalid message format')
      }
    })

    ws.on('close', () => {
      clearTimeout(timeout)
      this.handleDisconnect(clientId)
    })

    // If token provided in URL, authenticate immediately
    if (token) {
      clearTimeout(timeout)
      this.attemptAuthentication(clientId, token)
    }
  }

  private async handleAuthenticate(ws: WebSocket, clientId: string, payload: { token: string }) {
    const client = this.clients.get(clientId)
    if (!client) return

    if (client.isAuthenticated) {
      this.sendError(ws, 'Already authenticated')
      return
    }

    if (!payload.token) {
      this.sendError(client.ws, 'Authentication failed: token required')
      return
    }

    await this.attemptAuthentication(clientId, payload.token)
  }

  /**
   * Attempt to authenticate a client with the provided token
   */
  private async attemptAuthentication(clientId: string, token: string) {
    const client = this.clients.get(clientId)
    if (!client) return

    try {
      const authResult = await this.validateClient(token)

      if (authResult) {
        client.userId = authResult.userId
        client.role = authResult.role
        client.isAuthenticated = true
        client.authenticatedAt = new Date()

        logger.info('Client authenticated', {
          clientId,
          userId: authResult.userId,
          role: authResult.role
        })

        client.ws.send(JSON.stringify({
          type: 'authenticated',
          payload: {
            userId: authResult.userId,
            role: authResult.role
          }
        }))
      } else {
        logger.warn('Client authentication failed', { clientId })
        this.sendError(client.ws, 'Authentication failed: invalid token')
        client.ws.close(1008, 'Authentication failed')
        this.clients.delete(clientId)
      }
    } catch (err) {
      logger.error('Authentication error', { clientId, error: err })
      this.sendError(client.ws, 'Authentication error')
      client.ws.close(1008, 'Authentication error')
      this.clients.delete(clientId)
    }
  }

  /**
   * Validate client authentication token and return user info
   */
  private async validateClient(token: string): Promise<ClientAuthResult | null> {
    const isDevelopment = process.env.NODE_ENV === 'development'

    if (isDevelopment) {
      logger.warn('Development mode: Authentication bypassed')
      return {
        userId: token || 'dev-user',
        role: 'trainee'
      }
    }

    try {
      const validationResult = await validateToken(token, 'access')

      if (!validationResult.valid || !validationResult.userId) {
        logger.warn('Token validation failed', { error: validationResult.error })
        return null
      }

      const trainingRole = this.mapAuthRoleToTrainingRole(validationResult.role)

      return {
        userId: validationResult.userId,
        role: trainingRole
      }
    } catch (err) {
      logger.error('Token validation error', { error: err })
      return null
    }
  }

  /**
   * Map authentication UserRole to training session role
   */
  private mapAuthRoleToTrainingRole(authRole?: UserRole): 'trainee' | 'observer' | 'supervisor' {
    if (authRole === 'admin' || authRole === 'therapist') {
      return 'supervisor'
    }
    if (authRole === 'researcher' || authRole === 'support') {
      return 'observer'
    }
    return 'trainee'
  }

  private sendError(ws: WebSocket, message: string) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message }
      }))
    }
  }

  private async handleMessage(ws: WebSocket, clientId: string, message: WebSocketMessage) {
    switch (message.type) {
      case 'join_session':
        await this.handleJoinSession(ws, clientId, message.payload)
        break
      case 'session_message':
        this.handleSessionMessage(clientId, message.payload)
        break
      case 'coaching_note':
        this.handleCoachingNote(clientId, message.payload)
        break
      default:
        // Ignore other message types (server-to-client)
        if (!['authenticated', 'session_joined', 'participant_joined', 'participant_left', 'error'].includes(message.type)) {
            logger.warn('Unknown message type', { type: message.type })
        }
    }
  }

  private async handleJoinSession(ws: WebSocket, clientId: string, payload: { sessionId: string, role: 'trainee' | 'observer' | 'supervisor', userId: string }) {
    const client = this.clients.get(clientId)

    if (!client || !client.isAuthenticated) {
      logger.warn('Unauthenticated client attempted to join session', {
        clientId,
        sessionId: payload.sessionId
      })
      this.sendError(ws, 'Authentication required to join session')
      return
    }

    try {
      // Validate session access permissions
      // We try searching by ID first, then by sessionId field if it's a string identifier
      let session: TherapySession | null = null
      const sessionsById = await this.repository.getSessionsByIds([payload.sessionId])
      if (sessionsById && sessionsById.length > 0) {
          session = sessionsById[0]
      } else {
          // Fallback: search for sessions where we can find a matching sessionId
          // This is a bit of a workaround since getSessions doesn't support sessionId filtering directly
          // but we can look for it in recent sessions
          const recentSessions = await this.repository.getSessions({ limit: 100 } as any)
          session = recentSessions.find((s: TherapySession) => s.sessionId === payload.sessionId) || null
      }

      if (!session) {
        logger.warn('Client attempted to join non-existent session', {
          clientId,
          sessionId: payload.sessionId,
          userId: client.userId
        })
        this.sendError(ws, 'Session not found')
        return
      }

      // Check if session is active
      if (session.status !== 'active') {
        logger.warn('Client attempted to join inactive session', {
          clientId,
          sessionId: payload.sessionId,
          status: session.status
        })
        this.sendError(ws, 'Session is not active')
        return
      }

      // Verify user has permission to access this sessionId
      const isAuthorized =
        client.role === 'supervisor' ||
        session.therapistId === client.userId ||
        session.clientId === client.userId

      if (!isAuthorized) {
        logger.warn('Unauthorized session access attempt', {
          clientId,
          sessionId: payload.sessionId,
          userId: client.userId,
          role: client.role
        })
        this.sendError(ws, 'You do not have permission to access this session')
        return
      }

      // Verify requested role matches user's actual permissions
      const isDevelopment = process.env.NODE_ENV === 'development'
      const maxAllowedRole = client.role
      const requestedRole = payload.role || 'trainee'

      if (!isDevelopment && !this.isRoleAllowed(maxAllowedRole, requestedRole)) {
        logger.warn('Unauthorized role requested', {
          clientId,
          userId: client.userId,
          maxAllowedRole,
          requestedRole
        })
        this.sendError(ws, `Role '${requestedRole}' is not permitted for your account level`)
        return
      }

      // Finalize client state
      if (isDevelopment && payload.role) {
        client.role = payload.role
      } else if (!isDevelopment) {
        client.role = requestedRole
      }

      if (isDevelopment && payload.userId) {
        client.userId = payload.userId
      }

      client.sessionId = payload.sessionId

      logger.info('Client joined session', {
        clientId,
        sessionId: payload.sessionId,
        role: client.role,
        userId: client.userId
      })

      // Notify others in the session
      this.broadcastToSession(payload.sessionId, {
        type: 'participant_joined',
        payload: { userId: client.userId, role: client.role }
      })

      // Send confirmation to the client
      ws.send(JSON.stringify({
        type: 'session_joined',
        payload: {
          sessionId: payload.sessionId,
          role: client.role,
          userId: client.userId
        }
      }))
    } catch (err) {
      logger.error('Error validating session access', {
        clientId,
        sessionId: payload.sessionId,
        error: err instanceof Error ? err.message : String(err)
      })
      this.sendError(ws, 'Internal error validating session access')
    }
  }

  private handleSessionMessage(clientId: string, payload: { content: string, role: string }) {
    const client = this.clients.get(clientId)
    if (!client || !client.sessionId || !client.isAuthenticated) {
      return
    }

    this.broadcastToSession(client.sessionId, {
      type: 'session_message',
      payload: {
        userId: client.userId,
        role: payload.role,
        content: payload.content,
        timestamp: new Date().toISOString()
      }
    })
  }

  private handleCoachingNote(clientId: string, payload: { content: string }) {
    const client = this.clients.get(clientId)
    if (!client || !client.sessionId || !client.isAuthenticated) {
      return
    }

    if (client.role !== 'supervisor' && client.role !== 'observer') {
      logger.warn('Unauthorized coaching note attempt', {
        clientId,
        userId: client.userId,
        role: client.role
      })
      return
    }

    this.broadcastToSessionRoles(
      client.sessionId,
      ['observer', 'supervisor'],
      {
        type: 'coaching_note',
        payload: {
          authorId: client.userId,
          content: payload.content,
          timestamp: new Date().toISOString()
        }
      }
    )
  }

  private handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId)
    if (client && client.sessionId) {
      this.broadcastToSession(client.sessionId, {
        type: 'participant_left',
        payload: { userId: client.userId }
      })
    }
    this.clients.delete(clientId)
  }

  private broadcastToSession(sessionId: string, message: WebSocketMessage) {
    for (const client of this.clients.values()) {
      if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message))
      }
    }
  }

  private isRoleAllowed(
    maxRole: 'trainee' | 'observer' | 'supervisor',
    requestedRole: 'trainee' | 'observer' | 'supervisor'
  ): boolean {
    const hierarchy = {
      'trainee': 0,
      'observer': 1,
      'supervisor': 2
    }
    if (!(requestedRole in hierarchy) || !(maxRole in hierarchy)) return false
    return hierarchy[requestedRole] <= hierarchy[maxRole]
  }

  private broadcastToSessionRoles(
    sessionId: string,
    allowedRoles: Array<'trainee' | 'observer' | 'supervisor'>,
    message: WebSocketMessage
  ) {
    for (const client of this.clients.values()) {
      if (
        client.sessionId === sessionId &&
        client.ws.readyState === WebSocket.OPEN &&
        allowedRoles.includes(client.role)
      ) {
        client.ws.send(JSON.stringify(message))
      }
    }
  }

  public close() {
    this.wss.close()
  }
}
