import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('TrainingWebSocketServer')

interface TrainingSessionClient {
  id: string
  ws: WebSocket
  sessionId?: string
  role: 'trainee' | 'observer' | 'supervisor'
  userId: string
}

interface WebSocketMessage {
  type: string
  payload: any
}

export class TrainingWebSocketServer {
  private wss: WebSocketServer
  private clients: Map<string, TrainingSessionClient> = new Map()

  constructor(port: number) {
    this.wss = new WebSocketServer({ port })

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req)
    })

    logger.info(`Training WebSocket Server started on port ${port}`)
  }

  private handleConnection(ws: WebSocket, _req: IncomingMessage) {
    const id = Math.random().toString(36).substring(7)

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage
        this.handleMessage(ws, id, message)
      } catch (err) {
        logger.error('Failed to parse message', { error: err })
      }
    })

    ws.on('close', () => {
      this.handleDisconnect(id)
    })
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

  private handleJoinSession(ws: WebSocket, clientId: string, payload: { sessionId: string, role: 'trainee' | 'observer' | 'supervisor', userId: string }) {
    this.clients.set(clientId, {
      id: clientId,
      ws,
      sessionId: payload.sessionId,
      role: payload.role,
      userId: payload.userId
    })

    logger.info('Client joined session', { clientId, sessionId: payload.sessionId, role: payload.role })

    // Notify others in the session
    this.broadcastToSession(payload.sessionId, {
      type: 'participant_joined',
      payload: { userId: payload.userId, role: payload.role }
    })
  }

  private handleSessionMessage(clientId: string, payload: { content: string, role: string }) {
    const client = this.clients.get(clientId)
    if (!client || !client.sessionId) return

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
    if (!client || !client.sessionId) return

    this.broadcastToSession(client.sessionId, {
      type: 'coaching_note',
      payload: {
        authorId: client.userId,
        content: payload.content,
        timestamp: new Date().toISOString()
      }
    })
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

  public close() {
    this.wss.close()
  }
}
