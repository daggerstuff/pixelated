import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { randomUUID } from 'crypto'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { validateToken } from '../../auth/jwt-service'
import type { UserRole } from '../../auth/roles'
import { AIRepository } from '../../db/ai/repository'

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
 * TODO: Additional security enhancements:
 * 1. Rate limiting and abuse prevention
 * 2. Audit logging for all authentication and authorization events
 *
 * Clients authenticate via:
 * - Query string: ?token=<jwt>
 * - First message: { type: 'authenticate', token: '<jwt>' }
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
  | { type: 'session_message', payload: { content: string, role: string } }
  | { type: 'coaching_note', payload: { content: string } }

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

    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data) as WebSocketMessage
        if (message.type === 'authenticate') {
          clearTimeout(timeout)
          this.handleAuthenticate(ws, clientId, message.payload)
        } else {
          this.handleMessage(ws, clientId, message)
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

  private handleAuthenticate(ws: WebSocket, clientId: string, payload: { token: string }) {
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

    this.attemptAuthentication(clientId, payload.token)
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
   * 
   * @param token - Authentication token (JWT access token)
   * @returns ClientAuthResult if valid, null otherwise
   */
  private async validateClient(token: string): Promise<ClientAuthResult | null> {
    const isDevelopment = process.env.NODE_ENV === 'development'

    // Development mode: Allow authentication with any token (or no token)
    // This bypasses authentication for local development/testing
    if (isDevelopment) {
      logger.warn('Development mode: Authentication bypassed', {
        tokenLength: token.length,
        warning: 'This should NEVER be enabled in production'
      })

      // In development, extract userId from token if it looks like a JWT or use a default
      // For now, use a simple default for development
      return {
        userId: token || 'dev-user',
        role: 'trainee' // Default role, can be overridden by client in development
      }
    }

    // Production mode: Validate JWT token
    try {
      const validationResult = await validateToken(token, 'access')

      if (!validationResult.valid || !validationResult.userId) {
        logger.warn('Token validation failed', {
          error: validationResult.error,
          tokenLength: token.length
        })
        return null
      }

      // Map auth role to training role
      const trainingRole = this.mapAuthRoleToTrainingRole(validationResult.role)

      logger.info('Token validated successfully', {
        userId: validationResult.userId,
        authRole: validationResult.role,
        trainingRole
      })

      return {
        userId: validationResult.userId,
        role: trainingRole
      }
    } catch (err) {
      logger.error('Token validation error', {
        error: err instanceof Error ? err.message : String(err),
        tokenLength: token.length
      })
      return null
    }
  }

  /**
   * Map authentication UserRole to training session role
   * 
   * @param authRole - User role from authentication system
   * @returns Training session role (trainee, observer, or supervisor)
   */
  private mapAuthRoleToTrainingRole(authRole?: UserRole): 'trainee' | 'observer' | 'supervisor' {
    // Admin and therapist can supervise training sessions
    if (authRole === 'admin' || authRole === 'therapist') {
      return 'supervisor'
    }

    // Researchers and support staff can observe but not supervise
    if (authRole === 'researcher' || authRole === 'support') {
      return 'observer'
    }

    // Patients and guests participate as trainees
    // Default to trainee for unknown roles
    return 'trainee'
  }

  /**
   * Send error message to client
   */
  private sendError(ws: WebSocket, message: string) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message }
      }))
    }
  }

  private handleMessage(ws: WebSocket, clientId: string, message: WebSocketMessage) {
    switch (message.type) {
      case 'join_session':
        this.handleJoinSession(ws, clientId, message.payload)
        break
      case 'session_message':
        this.handleSessionMessage(clientId, message.payload)
        break
      case 'coaching_note':
        this.handleCoachingNote(clientId, message.payload)
        break
      default:
        logger.warn('Unknown message type', { type: message.type })
    }
  }

  private async handleJoinSession(ws: WebSocket, clientId: string, payload: { sessionId: string, role: 'trainee' | 'observer' | 'supervisor', userId: string }) {
    const client = this.clients.get(clientId)

    // Require authentication before joining session
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
      const sessions = await this.repository.getSessionsByIds([payload.sessionId])
      const session = sessions[0]

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
        client.role === 'supervisor' || // Supervisors (Admins/Therapists) can join for training
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

      // In development mode, allow role to be set from payload (for testing different roles)
      if (isDevelopment && payload.role) {
        client.role = payload.role
      } else if (!isDevelopment) {
        // In production, use the more restrictive of (assigned role, requested role)
        // This allows a supervisor to join as an observer if they choose
        client.role = requestedRole
      }

      // Use authenticated user info, but allow userId from payload in development
      if (isDevelopment && payload.userId) {
        client.userId = payload.userId
      }

      // Use authenticated user info, not payload (prevent role spoofing)
      client.sessionId = payload.sessionId
    } catch (err) {
      logger.error('Error validating session access', {
        clientId,
        sessionId: payload.sessionId,
        error: err instanceof Error ? err.message : String(err)
      })
      this.sendError(ws, 'Internal error validating session access')
      return
    }

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
  }

  private handleSessionMessage(clientId: string, payload: { content: string, role: string }) {
    const client = this.clients.get(clientId)
    if (!client || !client.sessionId || !client.isAuthenticated) {
      return
    }

    // Broadcast chat message to everyone in the session
    // Note: client.sessionId and client.role are already validated during join_session
    this.broadcastToSession(client.sessionId, {
      type: 'session_message',
      payload: {
        userId: client.userId,
        role: payload.role, // 'client' (AI) or 'therapist' (User)
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

    // Only supervisors and observers should be able to send coaching notes
    if (client.role !== 'supervisor' && client.role !== 'observer') {
      logger.warn('Unauthorized coaching note attempt', {
        clientId,
        userId: client.userId,
        role: client.role
      })
      return
    }

    // Coaching notes are "hidden" from trainees - only observers and supervisors receive them
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

  /**
   * Check if the requested role is allowed given the maximum allowed role
   *
   * @param maxRole - Maximum role permitted for the user
   * @param requestedRole - Role requested for the session
   * @returns true if allowed, false otherwise
   */
  private isRoleAllowed(
    maxRole: 'trainee' | 'observer' | 'supervisor',
    requestedRole: 'trainee' | 'observer' | 'supervisor'
  ): boolean {
    const hierarchy = {
      'trainee': 0,
      'observer': 1,
      'supervisor': 2
    }
    return hierarchy[requestedRole] <= hierarchy[maxRole]
  }

  /**
   * Broadcast message to clients in a session, filtered by role
   * 
   * @param sessionId - Session ID to broadcast to
   * @param allowedRoles - Array of roles that should receive the message
   * @param message - Message to broadcast
   */
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
