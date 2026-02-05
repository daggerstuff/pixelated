import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { randomUUID } from 'crypto'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { validateToken } from '../../auth/jwt-service'
import type { UserRole } from '../../auth/roles'

const logger = createBuildSafeLogger('TrainingWebSocketServer')

/**
 * Training WebSocket Server - Real-time collaboration for clinical training sessions
 *
 * Authentication & Authorization:
 * - Production: Validates JWT access tokens using the platform's auth system
 * - Development: Bypasses authentication for local testing (use with caution)
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
 * 1. Verify user has permission to access the requested sessionId
 * 2. Implement session-level access control (e.g., only session owner + authorized supervisors)
 * 3. Rate limiting and abuse prevention
 * 4. Audit logging for all authentication and authorization events
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

interface WebSocketMessage {
  type: string
  payload: any
}

export class TrainingWebSocketServer {
  private wss: WebSocketServer
  private clients: Map<string, TrainingSessionClient> = new Map()
  private messageRateLimits: Map<string, number[]> = new Map()
  private mutedUsers: Set<string> = new Set()
  private bannedUsers: Set<string> = new Set()
  private sessionOwners: Map<string, string> = new Map()
  private readonly MAX_MESSAGES_PER_MINUTE = 30
  private readonly AUTH_TIMEOUT_MS = 10000 // 10 seconds to authenticate

  constructor(port: number) {
    this.wss = new WebSocketServer({ port })

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req)
    })

    logger.info(`Training WebSocket Server started on port ${port}`)
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const id = randomUUID()

    // Extract token from query string if present
    let initialToken: string | null = null
    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)
      initialToken = url.searchParams.get('token')
    } catch (err) {
      logger.warn('Failed to parse connection URL', { error: err })
    }

    // Initialize client as unauthenticated
    this.clients.set(id, {
      id,
      ws,
      role: 'trainee', // Default, will be validated on join_session
      userId: '', // Will be set after authentication
      isAuthenticated: false
    })

    // If token provided in query string, attempt immediate authentication
    if (initialToken) {
      this.attemptAuthentication(id, initialToken)
    }

    // Set up authentication timeout - close connection if not authenticated
    const authTimeout = setTimeout(() => {
      const client = this.clients.get(id)
      if (client && !client.isAuthenticated) {
        logger.warn('Client failed to authenticate within timeout', { clientId: id })
        this.sendError(ws, 'Authentication timeout - connection closed')
        ws.close(1008, 'Authentication timeout')
        this.clients.delete(id)
      }
    }, this.AUTH_TIMEOUT_MS)

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage

        // Handle authentication message
        if (message.type === 'authenticate') {
          clearTimeout(authTimeout)
          this.handleAuthenticateMessage(id, message.payload)
          return
        }

        // Reject all other messages from unauthenticated clients
        const client = this.clients.get(id)
        if (!client || !client.isAuthenticated) {
          logger.warn('Unauthenticated client attempted to send message', {
            clientId: id,
            messageType: message.type
          })
          this.sendError(ws, 'Authentication required')
          return
        }

        this.handleMessage(ws, id, message)
      } catch (err) {
        logger.error('Failed to parse message', { error: err })
      }
    })

    ws.on('close', () => {
      clearTimeout(authTimeout)
      this.handleDisconnect(id)
    })
  }

  /**
   * Handle authentication message from client
   */
  private handleAuthenticateMessage(clientId: string, payload: { token?: string }) {
    const client = this.clients.get(clientId)
    if (!client) return

    if (!payload.token) {
      logger.warn('Authentication message missing token', { clientId })
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
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now()
    const timestamps = this.messageRateLimits.get(clientId) || []

    // Filter out timestamps older than 60 seconds
    const recentTimestamps = timestamps.filter(ts => now - ts < 60000)

    if (recentTimestamps.length >= this.MAX_MESSAGES_PER_MINUTE) {
      return false
    }

    recentTimestamps.push(now)
    this.messageRateLimits.set(clientId, recentTimestamps)
    return true
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
      case 'mute_user':
        this.handleMuteUser(clientId, message.payload)
        break
      case 'ban_user':
        this.handleBanUser(clientId, message.payload)
        break
      default:
        logger.warn('Unknown message type', { type: message.type })
    }
  }

  private handleMuteUser(clientId: string, payload: { userId: string, mute: boolean }) {
    const client = this.clients.get(clientId)
    if (!client || !client.sessionId || !client.isAuthenticated) return

    if (client.role !== 'supervisor') {
      this.sendError(client.ws, 'Unauthorized: Only supervisors can mute users.')
      return
    }

    const targetKey = `${payload.userId}:${client.sessionId}`
    if (payload.mute) {
      this.mutedUsers.add(targetKey)
      logger.info('User muted', { userId: payload.userId, sessionId: client.sessionId, mutedBy: client.userId })
    } else {
      this.mutedUsers.delete(targetKey)
      logger.info('User unmuted', { userId: payload.userId, sessionId: client.sessionId, unmutedBy: client.userId })
    }

    // Notify session about mute status change
    this.broadcastToSession(client.sessionId, {
      type: 'user_mute_status',
      payload: { userId: payload.userId, isMuted: payload.mute }
    })
  }

  private handleBanUser(clientId: string, payload: { userId: string }) {
    const client = this.clients.get(clientId)
    if (!client || !client.sessionId || !client.isAuthenticated) return

    if (client.role !== 'supervisor') {
      this.sendError(client.ws, 'Unauthorized: Only supervisors can ban users.')
      return
    }

    const targetKey = `${payload.userId}:${client.sessionId}`
    this.bannedUsers.add(targetKey)
    logger.info('User banned from session', { userId: payload.userId, sessionId: client.sessionId, bannedBy: client.userId })

    // Notify session
    this.broadcastToSession(client.sessionId, {
      type: 'user_banned',
      payload: { userId: payload.userId }
    })

    // Find and disconnect the banned user if they are currently connected to this session
    for (const [id, c] of Array.from(this.clients.entries())) {
      if (c.userId === payload.userId && c.sessionId === client.sessionId) {
        this.sendError(c.ws, 'You have been banned from this session.')
        c.ws.close(4003, 'Banned by supervisor')
        this.clients.delete(id)
      }
    }
  }

  private handleJoinSession(ws: WebSocket, clientId: string, payload: { sessionId: string, role: 'trainee' | 'observer' | 'supervisor', userId: string }) {
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

    // Check if banned
    if (this.bannedUsers.has(`${client.userId}:${payload.sessionId}`)) {
      logger.warn('Banned user attempted to join session', {
        userId: client.userId,
        sessionId: payload.sessionId
      })
      this.sendError(ws, 'You have been banned from this session')
      return
    }

    // In development mode, allow role and userId to be set from payload (for testing different roles)
    // In production, role should come from authentication token only
    const isDevelopment = process.env.NODE_ENV === 'development'
    if (isDevelopment) {
      if (payload.role) client.role = payload.role
      if (payload.userId) client.userId = payload.userId
    } else {
      // Production role validation
      if (payload.role === 'supervisor' && client.role !== 'supervisor') {
        this.sendError(ws, 'Unauthorized: You do not have permission to join as supervisor')
        return
      }
      if (payload.role === 'observer' && client.role === 'trainee') {
        this.sendError(ws, 'Unauthorized: Trainees cannot join as observers')
        return
      }
      if (payload.role) {
        const roleHierarchy: Record<string, number> = { 'trainee': 0, 'observer': 1, 'supervisor': 2 }
        if (roleHierarchy[payload.role] <= roleHierarchy[client.role]) {
          client.role = payload.role
        }
      }
    }

    // Use authenticated user info, not payload (prevent role spoofing)
    client.sessionId = payload.sessionId

    // Assign session owner if not already set
    if (!this.sessionOwners.has(payload.sessionId)) {
      if (client.role === 'trainee' || client.role === 'supervisor') {
        this.sessionOwners.set(payload.sessionId, client.userId)
        logger.info('Session owner assigned', {
          sessionId: payload.sessionId,
          userId: client.userId,
          role: client.role
        })
      }
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

    // Rate limiting
    if (!this.checkRateLimit(clientId)) {
      this.sendError(client.ws, 'Rate limit exceeded. Please wait a moment.')
      return
    }

    // Check if muted or banned
    if (this.bannedUsers.has(`${client.userId}:${client.sessionId}`)) {
      this.sendError(client.ws, 'You have been banned from this session')
      client.ws.close(4003, 'Banned from session')
      return
    }

    if (this.mutedUsers.has(`${client.userId}:${client.sessionId}`)) {
      this.sendError(client.ws, 'You are muted and cannot send messages')
      return
    }

    // Verify user has permission to send messages in this session
    // - Verify user is the session owner or has appropriate role
    const isOwner = this.sessionOwners.get(client.sessionId) === client.userId
    const isSupervisor = client.role === 'supervisor'

    // Only owner (trainee) or supervisors can send session messages
    // Observers should only send coaching notes
    if (!isOwner && !isSupervisor) {
      logger.warn('Unauthorized session message attempt', {
        userId: client.userId,
        sessionId: client.sessionId,
        role: client.role
      })
      this.sendError(client.ws, 'Unauthorized: Only the session owner or a supervisor can send messages.')
      return
    }

    // Broadcast chat message to everyone in the session
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

    // Rate limiting
    if (!this.checkRateLimit(clientId)) {
      this.sendError(client.ws, 'Rate limit exceeded. Please wait a moment.')
      return
    }

    // Check if muted or banned
    if (this.bannedUsers.has(`${client.userId}:${client.sessionId}`)) {
      this.sendError(client.ws, 'You have been banned from this session')
      return
    }

    if (this.mutedUsers.has(`${client.userId}:${client.sessionId}`)) {
      this.sendError(client.ws, 'You are muted and cannot send coaching notes')
      return
    }

    // Role-based access control
    if (client.role !== 'supervisor' && client.role !== 'observer') {
      logger.warn('Unauthorized coaching note attempt', {
        clientId,
        userId: client.userId,
        role: client.role
      })
      this.sendError(client.ws, 'Unauthorized: Only supervisors and observers can send coaching notes.')
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
    for (const client of Array.from(this.clients.values())) {
      if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message))
      }
    }
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
    for (const client of Array.from(this.clients.values())) {
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
