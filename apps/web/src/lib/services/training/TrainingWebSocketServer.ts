/**
 * Training WebSocket Server — Real-time collaboration for clinical training sessions
 *
 * PIX-3935 — Security hardening:
 *   - Origin validation (ALLOWED_ORIGINS env)
 *   - Rate limiting (Redis token bucket, 30 session_message/min/user)
 *   - Session persistence (MongoDB, reconnect with lastEventId resume)
 *   - Audit log (MongoDB, every message type recorded)
 *   - ACL matrix (role-based action enforcement)
 *   - Idle disconnect (ping/pong 30s interval, 90s timeout)
 *   - Per-IP concurrent connection limit
 */

import { randomUUID } from 'crypto'
import { IncomingMessage } from 'http'

import { WebSocket, WebSocketServer } from 'ws'

import { validateToken } from '../../auth/jwt-service'
import type { UserRole } from '../../auth/roles'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { GestaltClient } from '../ai/GestaltClient'
import { AuditLog, type AuditLogEntry } from './audit-log'
import { isOriginAllowed, parseAllowedOrigins } from './origin'
import { RateLimiter } from './ratelimit'
import { SessionStore } from './session-store'

const logger = createBuildSafeLogger('TrainingWebSocketServer')

// ── Types ────────────────────────────────────────────────────────

interface TrainingSessionClient {
  id: string
  ws: WebSocket
  sessionId?: string
  role: 'trainee' | 'observer' | 'supervisor'
  userId: string
  isAuthenticated: boolean
  authenticatedAt?: Date
  /** Remote IP address for per-IP limiting. */
  remoteIp?: string
}

interface ClientAuthResult {
  userId: string
  role: 'trainee' | 'observer' | 'supervisor'
}

interface WebSocketMessage {
  type: string
  payload: any
}

interface SessionState {
  dialogue: Array<{ speaker: string; text: string }>
  plutchikScores: Record<string, number>
  oceanScores: Record<string, number>
}

/** Actions that can be authorised against the ACL matrix. */
type TrainingAction =
  | 'send_message'
  | 'receive_coaching_note'
  | 'write_coaching_note'
  | 'join_session'
  | 'observe'

// ── ACL Matrix ──────────────────────────────────────────────────

/**
 * ACL matrix: which training roles are allowed to perform each action.
 */
const ACL_MATRIX: Record<
  TrainingAction,
  Array<'trainee' | 'observer' | 'supervisor'>
> = {
  send_message: ['trainee', 'supervisor'],
  receive_coaching_note: ['observer', 'supervisor'],
  write_coaching_note: ['supervisor', 'observer'],
  join_session: ['trainee', 'observer', 'supervisor'],
  observe: ['observer', 'supervisor'],
}

function isActionAllowed(
  role: 'trainee' | 'observer' | 'supervisor' | undefined,
  action: TrainingAction,
): boolean {
  if (!role) return false
  return ACL_MATRIX[action]?.includes(role) ?? false
}

// ── Idle-Disconnect Constants ────────────────────────────────────

const PING_INTERVAL_MS = 30_000 // Send ping every 30s
const IDLE_TIMEOUT_MS = 90_000 // Close after 90s of no pong

// ── Per-IP Limit ─────────────────────────────────────────────────

const MAX_CONNECTIONS_PER_IP = parseInt(
  process.env['WS_MAX_CONNECTIONS_PER_IP'] ?? '5',
  10,
)

// ── Server Class ─────────────────────────────────────────────────

export class TrainingWebSocketServer {
  private readonly wss: WebSocketServer
  private readonly clients: Map<string, TrainingSessionClient> = new Map()
  private readonly sessions: Map<string, SessionState> = new Map()
  private readonly AUTH_TIMEOUT_MS = 10000

  /** Per-IP connection counter. */
  private readonly ipConnections: Map<string, Set<string>> = new Map()

  /** Idle-disconnect timers per client. */
  private readonly clientTimers: Map<string, ReturnType<typeof setInterval>> =
    new Map()
  private readonly lastPong: Map<string, number> = new Map()

  // Optional services (injected or lazily created)
  private readonly rateLimiter: RateLimiter | null = null
  private readonly sessionStore: SessionStore | null = null
  private readonly auditLog: AuditLog | null = null

  // Allowed origins cache
  private readonly allowedOrigins: Set<string>

  constructor(
    port: number,
    deps?: {
      rateLimiter?: RateLimiter
      sessionStore?: SessionStore
      auditLog?: AuditLog
    },
  ) {
    this.allowedOrigins = parseAllowedOrigins(
      typeof process !== 'undefined'
        ? process.env['ALLOWED_ORIGINS']
        : undefined,
    )

    this.wss = new WebSocketServer({ port })

    if (deps?.rateLimiter) this.rateLimiter = deps.rateLimiter
    if (deps?.sessionStore) this.sessionStore = deps.sessionStore
    if (deps?.auditLog) this.auditLog = deps.auditLog

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req)
    })

    // Built-in ping/pong from the server
    this.wss.on('connection', (ws) => {
      ws.on('pong', () => {
        // Find which client this ws belongs to and update lastPong
        for (const [id, client] of this.clients) {
          if (client.ws === ws) {
            this.lastPong.set(id, Date.now())
            break
          }
        }
      })
    })

    logger.info(`Training WebSocket Server started on port ${port}`)
  }

  // ── Connection Handler ─────────────────────────────────────────

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const id = randomUUID()

    // ── 1. Origin validation ──────────────────────────────────────
    const origin = req.headers['origin']
    if (!isOriginAllowed(origin, this.allowedOrigins)) {
      logger.warn('Connection rejected: origin not allowed', {
        clientId: id,
        origin,
      })
      this.writeAuditLog({
        sessionId: 'none',
        userId: 'unknown',
        role: 'unknown',
        type: 'origin_rejection',
        ts: new Date().toISOString(),
        payload: { origin },
      })
      ws.close(1008, 'Origin not allowed')
      return
    }

    // ── 2. Per-IP connection limit ────────────────────────────────
    const remoteIp =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.socket.remoteAddress ??
      'unknown'

    if (remoteIp !== 'unknown') {
      const current = this.ipConnections.get(remoteIp)
      if (current && current.size >= MAX_CONNECTIONS_PER_IP) {
        logger.warn('Connection rejected: per-IP limit exceeded', {
          clientId: id,
          remoteIp,
          limit: MAX_CONNECTIONS_PER_IP,
        })
        this.writeAuditLog({
          sessionId: 'none',
          userId: 'unknown',
          role: 'unknown',
          type: 'ip_limit_rejection',
          ts: new Date().toISOString(),
          payload: { remoteIp, limit: MAX_CONNECTIONS_PER_IP },
        })
        ws.close(1008, 'Too many connections from this IP')
        return
      }
      if (!this.ipConnections.has(remoteIp)) {
        this.ipConnections.set(remoteIp, new Set())
      }
      this.ipConnections.get(remoteIp)!.add(id)
    }

    // ── 3. Extract token from query string ────────────────────────
    let initialToken: string | null = null
    try {
      const url = new URL(
        req.url ?? '',
        `http://${req.headers.host ?? 'localhost'}`,
      )
      initialToken = url.searchParams.get('token')
    } catch (err) {
      logger.warn('Failed to parse connection URL', { error: err })
    }

    // ── 4. Initialise client ──────────────────────────────────────
    this.clients.set(id, {
      id,
      ws,
      role: 'trainee',
      userId: '',
      isAuthenticated: false,
      remoteIp,
    })

    // ── 5. Attempt immediate auth if token in query ───────────────
    if (initialToken) {
      void this.attemptAuthentication(id, initialToken)
    }

    // ── 6. Auth timeout ───────────────────────────────────────────
    const authTimeout = setTimeout(() => {
      const client = this.clients.get(id)
      if (client && !client.isAuthenticated) {
        logger.warn('Client failed to authenticate within timeout', {
          clientId: id,
        })
        this.sendError(ws, 'Authentication timeout - connection closed')
        ws.close(1008, 'Authentication timeout')
        this.cleanupClient(id)
      }
    }, this.AUTH_TIMEOUT_MS)

    // ── 7. Message handler ────────────────────────────────────────
    ws.on('message', (data) => {
      try {
        let messageStr: string
        if (data instanceof Buffer) {
          messageStr = data.toString()
        } else if (typeof data === 'string') {
          messageStr = data
        } else if (data instanceof ArrayBuffer) {
          messageStr = Buffer.from(data).toString()
        } else if (ArrayBuffer.isView(data)) {
          messageStr = Buffer.from(data).toString()
        } else {
          messageStr = String(data)
        }
        const message = JSON.parse(messageStr) as WebSocketMessage

        if (message.type === 'authenticate') {
          clearTimeout(authTimeout)
          this.handleAuthenticateMessage(
            id,
            message.payload as { token?: string },
          )
          return
        }

        const client = this.clients.get(id)
        if (!client || !client.isAuthenticated) {
          logger.warn('Unauthenticated client attempted to send message', {
            clientId: id,
            messageType: message.type,
          })
          this.sendError(ws, 'Authentication required')
          return
        }

        this.handleMessage(ws, id, message)
      } catch (err) {
        logger.error('Failed to parse message', { error: err })
      }
    })

    // ── 8. Close handler ──────────────────────────────────────────
    ws.on('close', () => {
      clearTimeout(authTimeout)
      this.writeAuditLog({
        sessionId: this.clients.get(id)?.sessionId ?? 'none',
        userId: this.clients.get(id)?.userId ?? 'unknown',
        role: this.clients.get(id)?.role ?? 'unknown',
        type: 'disconnect',
        ts: new Date().toISOString(),
      })
      this.handleDisconnect(id)
    })

    // ── 9. Error handler ──────────────────────────────────────────
    ws.on('error', (err) => {
      logger.error('WebSocket error', { clientId: id, error: err.message })
      this.cleanupClient(id)
    })

    // ── 10. Start idle-disconnect ping timer ──────────────────────
    this.lastPong.set(id, Date.now())
    const pingTimer = setInterval(() => {
      const last = this.lastPong.get(id) ?? 0
      if (Date.now() - last > IDLE_TIMEOUT_MS) {
        logger.warn('Idle disconnect', { clientId: id })
        this.writeAuditLog({
          sessionId: this.clients.get(id)?.sessionId ?? 'none',
          userId: this.clients.get(id)?.userId ?? 'unknown',
          role: this.clients.get(id)?.role ?? 'unknown',
          type: 'idle_disconnect',
          ts: new Date().toISOString(),
        })
        ws.close(1008, 'Idle timeout')
        this.cleanupClient(id)
        clearInterval(pingTimer)
      } else {
        ws.ping()
      }
    }, PING_INTERVAL_MS)
    this.clientTimers.set(id, pingTimer)
  }

  // ── Authentication ─────────────────────────────────────────────

  private handleAuthenticateMessage(
    clientId: string,
    payload: { token?: string },
  ) {
    const client = this.clients.get(clientId)
    if (!client) return

    if (!payload.token) {
      logger.warn('Authentication message missing token', { clientId })
      this.sendError(client.ws, 'Authentication failed: token required')
      return
    }

    void this.attemptAuthentication(clientId, payload.token)
  }

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
          role: authResult.role,
        })

        this.writeAuditLog({
          sessionId: 'none',
          userId: authResult.userId,
          role: authResult.role,
          type: 'authenticate',
          ts: new Date().toISOString(),
        })

        client.ws.send(
          JSON.stringify({
            type: 'authenticated',
            payload: {
              userId: authResult.userId,
              role: authResult.role,
            },
          }),
        )
      } else {
        logger.warn('Client authentication failed', { clientId })
        this.writeAuditLog({
          sessionId: 'none',
          userId: 'unknown',
          role: 'unknown',
          type: 'auth_failure',
          ts: new Date().toISOString(),
          payload: { clientId },
        })
        this.sendError(client.ws, 'Authentication failed: invalid token')
        client.ws.close(1008, 'Authentication failed')
        this.cleanupClient(clientId)
      }
    } catch (err) {
      logger.error('Authentication error', { clientId, error: err })
      this.sendError(client.ws, 'Authentication error')
      client.ws.close(1008, 'Authentication error')
      this.cleanupClient(clientId)
    }
  }

  private async validateClient(
    token: string,
  ): Promise<ClientAuthResult | null> {
    const isDevelopment = process.env['NODE_ENV'] === 'development'

    if (isDevelopment) {
      logger.warn('Development mode: Authentication bypassed', {
        tokenLength: token.length,
        warning: 'This should NEVER be enabled in production',
      })
      return {
        userId: token || 'dev-user',
        role: 'trainee',
      }
    }

    try {
      const validationResult = await validateToken(token, 'access')

      if (!validationResult.valid || !validationResult.userId) {
        logger.warn('Token validation failed', {
          error: validationResult.error,
          tokenLength: token.length,
        })
        return null
      }

      const trainingRole = this.mapAuthRoleToTrainingRole(validationResult.role)

      logger.info('Token validated successfully', {
        userId: validationResult.userId,
        authRole: validationResult.role,
        trainingRole,
      })

      return {
        userId: validationResult.userId,
        role: trainingRole,
      }
    } catch (err) {
      logger.error('Token validation error', {
        error: err instanceof Error ? err.message : String(err),
        tokenLength: token.length,
      })
      return null
    }
  }

  private mapAuthRoleToTrainingRole(
    authRole?: UserRole,
  ): 'trainee' | 'observer' | 'supervisor' {
    if (authRole === 'admin' || authRole === 'therapist') {
      return 'supervisor'
    }
    if (authRole === 'researcher' || authRole === 'support') {
      return 'observer'
    }
    return 'trainee'
  }

  // ── Message Routing ────────────────────────────────────────────

  private handleMessage(
    ws: WebSocket,
    clientId: string,
    message: WebSocketMessage,
  ) {
    switch (message.type) {
      case 'join_session':
        void this.handleJoinSession(
          ws,
          clientId,
          message.payload as {
            sessionId: string
            role: 'trainee' | 'observer' | 'supervisor'
            userId: string
          },
        )
        break
      case 'session_message':
        void this.handleSessionMessage(
          clientId,
          message.payload as { content: string; role: string },
        )
        break
      case 'coaching_note':
        void this.handleCoachingNote(
          clientId,
          message.payload as { content: string },
        )
        break
      default:
        logger.warn('Unknown message type', { type: message.type })
    }
  }

  // ── Join Session ───────────────────────────────────────────────

  private async handleJoinSession(
    ws: WebSocket,
    clientId: string,
    payload: {
      sessionId: string
      role: 'trainee' | 'observer' | 'supervisor'
      userId: string
    },
  ) {
    const client = this.clients.get(clientId)
    if (!client || !client.isAuthenticated) {
      logger.warn('Unauthenticated client attempted to join session', {
        clientId,
        sessionId: payload.sessionId,
      })
      this.sendError(ws, 'Authentication required to join session')
      return
    }

    // ACL check: verify role is allowed to join sessions
    if (!isActionAllowed(client.role, 'join_session')) {
      logger.warn('Role not allowed to join sessions', {
        clientId,
        role: client.role,
      })
      this.sendError(ws, 'Your role is not permitted to join training sessions')
      return
    }

    // Development mode: allow role override
    const isDevelopment = process.env['NODE_ENV'] === 'development'
    if (isDevelopment && payload.role) {
      client.role = payload.role
    }
    if (isDevelopment && payload.userId) {
      client.userId = payload.userId
    }

    client.sessionId = payload.sessionId

    // Persist session state on join
    if (this.sessionStore) {
      try {
        const { resumeFrom } = await this.sessionStore.reconnect(
          payload.sessionId,
          client.userId,
        )
        logger.info('Session restored/persisted', {
          sessionId: payload.sessionId,
          resumeFrom,
        })
      } catch (err) {
        logger.error('Session store error on join', {
          sessionId: payload.sessionId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    logger.info('Client joined session', {
      clientId,
      sessionId: payload.sessionId,
      role: client.role,
      userId: client.userId,
    })

    this.writeAuditLog({
      sessionId: payload.sessionId,
      userId: client.userId,
      role: client.role,
      type: 'join_session',
      ts: new Date().toISOString(),
    })

    this.broadcastToSession(payload.sessionId, {
      type: 'participant_joined',
      payload: { userId: client.userId, role: client.role },
    })

    ws.send(
      JSON.stringify({
        type: 'session_joined',
        payload: {
          sessionId: payload.sessionId,
          role: client.role,
          userId: client.userId,
        },
      }),
    )
  }

  // ── Session Message ────────────────────────────────────────────

  private async handleSessionMessage(
    clientId: string,
    payload: { content: string; role: string },
  ) {
    const client = this.clients.get(clientId)
    if (!client?.sessionId || !client.isAuthenticated) return

    // ACL: only trainee and supervisor can send messages
    if (!isActionAllowed(client.role, 'send_message')) {
      logger.warn('Role not allowed to send messages', {
        clientId,
        role: client.role,
      })
      this.sendError(
        client.ws,
        'Your role is not permitted to send session messages',
      )
      return
    }

    // Rate limit: check session_message rate
    if (this.rateLimiter) {
      const result = await this.rateLimiter.check(client.userId)
      if (!result.allowed) {
        logger.warn('Rate limit exceeded for session_message', {
          clientId,
          userId: client.userId,
        })
        this.writeAuditLog({
          sessionId: client.sessionId,
          userId: client.userId,
          role: client.role,
          type: 'rate_limit_exceeded',
          ts: new Date().toISOString(),
          payload: { remaining: result.remaining, ttlMs: result.ttlMs },
        })
        client.ws.send(
          JSON.stringify({
            type: 'error',
            payload: {
              message: 'Rate limit exceeded. Please slow down.',
              code: 'RATE_LIMITED',
            },
          }),
        )
        return
      }
    }

    // Audit
    this.writeAuditLog({
      sessionId: client.sessionId,
      userId: client.userId,
      role: client.role,
      type: 'session_message',
      ts: new Date().toISOString(),
      payload: {
        contentLength: payload.content.length,
        messageRole: payload.role,
      },
    })

    // Persist state
    if (this.sessionStore) {
      void this.sessionStore.nextEventId(client.sessionId)
    }

    // Broadcast
    this.broadcastToSession(client.sessionId, {
      type: 'session_message',
      payload: {
        userId: client.userId,
        role: payload.role,
        content: payload.content,
        timestamp: new Date().toISOString(),
      },
    })

    // Gestalt analysis
    if (payload.role === 'client' || payload.role === 'seeker') {
      void this.runGestaltAnalysis(client.sessionId, payload.content)
    }
  }

  // ── Gestalt Analysis ───────────────────────────────────────────

  private async runGestaltAnalysis(sessionId: string, targetUtterance: string) {
    try {
      let state = this.sessions.get(sessionId)
      if (!state) {
        state = {
          dialogue: [],
          plutchikScores: {
            joy: 0.1,
            trust: 0.1,
            fear: 0.1,
            surprise: 0.1,
            sadness: 0.1,
            disgust: 0.1,
            anger: 0.1,
            anticipation: 0.1,
          },
          oceanScores: {
            openness: 0.5,
            conscientiousness: 0.5,
            extraversion: 0.5,
            agreeableness: 0.5,
            neuroticism: 0.5,
          },
        }
        this.sessions.set(sessionId, state)
      }

      state.dialogue.push({ speaker: 'Seeker', text: targetUtterance })
      if (state.dialogue.length > 40) state.dialogue.shift()

      const gestalt = await GestaltClient.analyzeGestalt({
        dialogue: state.dialogue,
        target_utterance: targetUtterance,
        plutchik_scores: state.plutchikScores,
        ocean_scores: state.oceanScores,
      })

      this.writeAuditLog({
        sessionId,
        userId: 'system',
        role: 'supervisor',
        type: 'gestalt_update',
        ts: new Date().toISOString(),
        payload: { defense: gestalt.defense_label_name },
      })

      this.broadcastToSession(sessionId, {
        type: 'gestalt_update',
        payload: gestalt,
      })

      logger.info('Gestalt update broadcasted', {
        sessionId,
        defense: gestalt.defense_label_name,
      })
    } catch (error: unknown) {
      logger.error('Gestalt analysis failed during websocket broadcast', {
        sessionId,
        error,
      })
    }
  }

  // ── Coaching Note ──────────────────────────────────────────────

  private async handleCoachingNote(
    clientId: string,
    payload: { content: string },
  ) {
    const client = this.clients.get(clientId)
    if (!client?.sessionId || !client.isAuthenticated) return

    // ACL: only supervisor/observer can write coaching notes
    if (!isActionAllowed(client.role, 'write_coaching_note')) {
      logger.warn('Unauthorized coaching note attempt', {
        clientId,
        userId: client.userId,
        role: client.role,
      })
      this.sendError(
        client.ws,
        'Your role is not permitted to send coaching notes',
      )
      return
    }

    // Audit
    this.writeAuditLog({
      sessionId: client.sessionId,
      userId: client.userId,
      role: client.role,
      type: 'coaching_note',
      ts: new Date().toISOString(),
      payload: { contentLength: payload.content.length },
    })

    // Persist
    if (this.sessionStore) {
      void this.sessionStore.nextEventId(client.sessionId)
    }

    this.broadcastToSessionRoles(client.sessionId, ['observer', 'supervisor'], {
      type: 'coaching_note',
      payload: {
        authorId: client.userId,
        content: payload.content,
        timestamp: new Date().toISOString(),
      },
    })
  }

  // ── Disconnect ─────────────────────────────────────────────────

  private handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId)
    if (client?.sessionId) {
      this.broadcastToSession(client.sessionId, {
        type: 'participant_left',
        payload: { userId: client.userId },
      })
    }
    this.cleanupClient(clientId)
  }

  // ── Cleanup ────────────────────────────────────────────────────

  private cleanupClient(clientId: string) {
    const client = this.clients.get(clientId)

    // Remove from IP counter
    if (client?.remoteIp) {
      const ipSet = this.ipConnections.get(client.remoteIp)
      if (ipSet) {
        ipSet.delete(clientId)
        if (ipSet.size === 0) this.ipConnections.delete(client.remoteIp)
      }
    }

    // Clear idle timer
    const timer = this.clientTimers.get(clientId)
    if (timer) {
      clearInterval(timer)
      this.clientTimers.delete(clientId)
    }

    this.lastPong.delete(clientId)
    this.clients.delete(clientId)
  }

  // ── Broadcast ──────────────────────────────────────────────────

  private broadcastToSession(sessionId: string, message: WebSocketMessage) {
    for (const client of this.clients.values()) {
      if (
        client.sessionId === sessionId &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(JSON.stringify(message))
      }
    }
  }

  private broadcastToSessionRoles(
    sessionId: string,
    allowedRoles: Array<'trainee' | 'observer' | 'supervisor'>,
    message: WebSocketMessage,
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

  // ── Error Helper ───────────────────────────────────────────────

  private sendError(ws: WebSocket, message: string) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'error',
          payload: { message },
        }),
      )
    }
  }

  // ── Audit Log ──────────────────────────────────────────────────

  private writeAuditLog(entry: Omit<AuditLogEntry, '_id'>): void {
    if (this.auditLog) {
      void this.auditLog.write(entry)
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  public close() {
    for (const [, timer] of this.clientTimers) clearInterval(timer)
    this.clientTimers.clear()
    this.clients.clear()
    this.sessions.clear()
    this.ipConnections.clear()
    this.lastPong.clear()
    this.wss.close()
  }
}
