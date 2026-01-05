/**
 * Real-time Bias Detection WebSocket Server
 *
 * Provides real-time communication for bias alerts, dashboard updates,
 * and system monitoring for the Pixelated Empathy platform.
 */

import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  BiasAlert,
  BiasAnalysisResult,
  BiasDashboardData,
  WebSocketMessage,
  BiasAlertWebSocketEvent,
  DashboardUpdateWebSocketEvent,
  SystemStatusWebSocketEvent,
  AnalysisCompleteWebSocketEvent,
} from '../../ai/bias-detection/types'

const logger = createBuildSafeLogger('BiasWebSocketServer')

export interface WebSocketClient {
  id: string
  ws: WebSocket
  subscriptions: Set<string>
  filters: {
    timeRange?: string
    biasScoreFilter?: string
    alertLevelFilter?: string
    demographicFilter?: string
  }
  lastPing: Date
  isAuthenticated: boolean
  userId?: string
  ipAddress: string
  userAgent: string
}

export interface WebSocketServerConfig {
  port: number
  heartbeatInterval: number
  maxConnections: number
  authRequired: boolean
  corsOrigins: string[]
  rateLimitConfig: {
    maxMessagesPerMinute: number
    banDurationMs: number
  }
}

export class BiasWebSocketServer {
  private wss: WebSocketServer | null = null
  private clients: Map<string, WebSocketClient> = new Map()
  private isRunning = false
  private heartbeatInterval?: NodeJS.Timeout
  private metricsInterval?: NodeJS.Timeout
  private bannedIPs: Map<string, Date> = new Map()
  private messageRateLimits: Map<string, Array<Date>> = new Map()

  constructor(private config: WebSocketServerConfig) {}

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('WebSocket server is already running')
      return
    }

    try {
      this.wss = new WebSocketServer({
        port: this.config.port,
        verifyClient: (info: { origin: string; req: IncomingMessage }) =>
          this.verifyClient(info),
      })

      this.wss.on('connection', (ws, request) => {
        this.handleConnection(ws, request)
      })

      this.wss.on('error', (error) => {
        logger.error('WebSocket server error', { error })
      })

      this.startHeartbeat()
      this.startMetricsCollection()

      this.isRunning = true
      logger.info('Bias WebSocket server started', {
        port: this.config.port,
        maxConnections: this.config.maxConnections,
      })
    } catch (error: unknown) {
      logger.error('Failed to start WebSocket server', { error })
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    try {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval)
      }

      if (this.metricsInterval) {
        clearInterval(this.metricsInterval)
      }

      delete this.heartbeatInterval
      delete this.metricsInterval

      for (const [clientId, client] of this.clients) {
        try {
          client.ws.close(1001, 'Server shutting down')
        } catch (error: unknown) {
          logger.warn('Error closing client connection', { clientId, error })
        }
      }

      this.clients.clear()

      if (this.wss) {
        await new Promise<void>((resolve, reject) => {
          this.wss!.close((error) => {
            if (error) {
              reject(error)
            } else {
              resolve()
            }
          })
        })
        this.wss = null
      }

      this.isRunning = false
      logger.info('Bias WebSocket server stopped successfully')
    } catch (error: unknown) {
      logger.error('Error stopping WebSocket server', { error })
      throw error
    }
  }

  /**
   * Verify client connection
   */
  private verifyClient(info: unknown): boolean {
    const { origin, req } = info as { origin?: string; req: IncomingMessage }
    const remoteAddress = req.socket?.remoteAddress

    if (this.bannedIPs.has(remoteAddress || 'unknown')) {
      const banExpiry = this.bannedIPs.get(remoteAddress || 'unknown')!
      if (banExpiry > new Date()) {
        logger.warn('Rejected connection from banned IP', {
          ipAddress: remoteAddress,
        })
        return false
      } else {
        this.bannedIPs.delete(remoteAddress || 'unknown')
      }
    }

    if (this.clients.size >= this.config.maxConnections) {
      logger.warn('Rejected connection due to max connections limit', {
        currentConnections: this.clients.size,
        maxConnections: this.config.maxConnections,
        ipAddress: remoteAddress,
      })
      return false
    }

    // Check CORS origins
    if (
      this.config.corsOrigins.length > 0 &&
      (!origin || !this.config.corsOrigins.includes(origin))
    ) {
      logger.warn('Rejected connection due to CORS policy', {
        origin,
        ipAddress: remoteAddress,
      })
      return false
    }

    return true
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const clientId = this.generateClientId()
    const { socket, headers } = request
    const remoteAddress = socket?.remoteAddress
    const userAgent = headers['user-agent'] || 'unknown'

    const client: WebSocketClient = {
      id: clientId,
      ws,
      subscriptions: new Set(),
      filters: {},
      lastPing: new Date(),
      isAuthenticated: !this.config.authRequired,
      ipAddress: remoteAddress || 'unknown',
      userAgent,
    }

    this.clients.set(clientId, client)

    logger.info('New WebSocket connection', {
      clientId,
      ipAddress: remoteAddress,
      userAgent,
      totalConnections: this.clients.size,
    })

    ws.on('message', (data) => this.handleMessage(clientId, data))
    ws.on('close', (code, reason) =>
      this.handleDisconnection(clientId, code, reason),
    )
    ws.on('error', (error) => {
      logger.error('WebSocket client error', { clientId, error })
      this.handleDisconnection(clientId, 1011, Buffer.from('Internal error'))
    })

    this.sendToClient(clientId, {
      type: 'system-status',
      timestamp: new Date(),
      data: {
        status: {
          status: 'healthy' as const,
          timestamp: new Date(),
          services: {
            pythonService: { status: 'up' as const, lastCheck: new Date() },
            database: { status: 'up' as const, lastCheck: new Date() },
            cache: { status: 'up' as const, lastCheck: new Date() },
            alertSystem: { status: 'up' as const, lastCheck: new Date() },
          },
          version: '1.0.0',
          uptime: 0,
        },
        changedServices: [],
      },
    })
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(clientId: string, data: unknown): void {
    const client = this.clients.get(clientId)
    if (!client) {
      return
    }

    if (!this.checkRateLimit(clientId)) {
      this.banClient(clientId, 'Rate limit exceeded')
      return
    }

    try {
      const message = JSON.parse((data as Buffer).toString())

      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(clientId, message)
          break
        case 'unsubscribe':
          this.handleUnsubscription(clientId, message)
          break
        case 'update_subscription':
          this.handleSubscriptionUpdate(clientId, message)
          break
        case 'heartbeat':
          this.handleHeartbeat(clientId)
          break
        case 'heartbeat_response':
          client.lastPing = new Date()
          break
        case 'authenticate':
          this.handleAuthentication(clientId, message)
          break
        case 'get_dashboard_data':
          this.handleDashboardDataRequest(clientId, message)
          break
        default:
          logger.warn('Unknown message type', { clientId, type: message.type })
      }
    } catch (error: unknown) {
      logger.error('Error parsing WebSocket message', { clientId, error })
      this.sendErrorToClient(clientId, 'Invalid message format')
    }
  }

  /**
   * Handle client subscription
   */
  private handleSubscription(
    clientId: string,
    message: { channels?: string[]; filters?: Record<string, unknown> },
  ): void {
    const client = this.clients.get(clientId)
    if (!client) {
      return
    }

    if (!client.isAuthenticated && this.config.authRequired) {
      this.sendErrorToClient(clientId, 'Authentication required')
      return
    }

    const channels = message.channels || []
    const filters = message.filters || {}

    for (const channel of channels) {
      client.subscriptions.add(channel)
    }

    client.filters = { ...client.filters, ...filters }

    this.sendToClient(clientId, {
      type: 'system-status',
      timestamp: new Date(),
      data: {
        status: {
          status: 'healthy' as const,
          timestamp: new Date(),
          services: {
            pythonService: { status: 'up' as const, lastCheck: new Date() },
            database: { status: 'up' as const, lastCheck: new Date() },
            cache: { status: 'up' as const, lastCheck: new Date() },
            alertSystem: { status: 'up' as const, lastCheck: new Date() },
          },
          version: '1.0.0',
          uptime: 0,
        },
        changedServices: [],
      },
    })
  }

  /**
   * Handle client unsubscription
   */
  private handleUnsubscription(
    clientId: string,
    message: { channels?: string[] },
  ): void {
    const client = this.clients.get(clientId)
    if (!client) {
      return
    }

    const channels = message.channels || []
    for (const channel of channels) {
      client.subscriptions.delete(channel)
    }

    this.sendToClient(clientId, {
      type: 'system-status',
      timestamp: new Date(),
      data: {
        status: {
          status: 'healthy' as const,
          timestamp: new Date(),
          services: {
            pythonService: { status: 'up' as const, lastCheck: new Date() },
            database: { status: 'up' as const, lastCheck: new Date() },
            cache: { status: 'up' as const, lastCheck: new Date() },
            alertSystem: { status: 'up' as const, lastCheck: new Date() },
          },
          version: '1.0.0',
          uptime: 0,
        },
        changedServices: [],
      },
    })
  }

  /**
   * Handle subscription update
   */
  private handleSubscriptionUpdate(
    clientId: string,
    message: { filters?: Record<string, unknown> },
  ): void {
    const client = this.clients.get(clientId)
    if (!client) {
      return
    }

    const filters = message.filters || {}
    client.filters = { ...client.filters, ...filters }

    logger.debug('Client updated subscription filters', {
      clientId,
      filters: client.filters,
    })

    this.sendToClient(clientId, {
      type: 'system-status',
      timestamp: new Date(),
      data: {
        status: {
          status: 'healthy' as const,
          timestamp: new Date(),
          services: {
            pythonService: { status: 'up' as const, lastCheck: new Date() },
            database: { status: 'up' as const, lastCheck: new Date() },
            cache: { status: 'up' as const, lastCheck: new Date() },
            alertSystem: { status: 'up' as const, lastCheck: new Date() },
          },
          version: '1.0.0',
          uptime: 0,
        },
        changedServices: [],
      },
    })
  }

  private handleHeartbeat(clientId: string): void {
    const client = this.clients.get(clientId)
    if (!client) {
      return
    }

    client.lastPing = new Date()
    this.sendToClient(clientId, {
      type: 'system-status',
      timestamp: new Date(),
      data: {},
    })
  }

  /**
   * Handle authentication
   */
  private handleAuthentication(
    clientId: string,
    message: { token?: string; userId?: string },
  ): void {
    const client = this.clients.get(clientId)
    if (!client) {
      return
    }

    // In a real implementation, this would validate the token/credentials
    const { token, userId } = message

    if (token && userId && this.validateAuthToken(token, userId)) {
      client.isAuthenticated = true
      client.userId = userId

      this.sendToClient(clientId, {
        type: 'system-status' as const,
        timestamp: new Date(),
        data: {
          status: 'authenticated',
          userId,
          permissions: this.getUserPermissions(userId),
        },
      })
    } else {
      logger.warn('Client authentication failed', { clientId, userId })

      this.sendToClient(clientId, {
        type: 'system-status' as const,
        timestamp: new Date(),
        data: {
          status: 'authentication_failed',
          error: 'Invalid credentials',
        },
      })
    }
  }

  /**
   * Handle dashboard data request
   */
  private async handleDashboardDataRequest(
    clientId: string,
    _message: { filters?: unknown },
  ): Promise<void> {
    const client = this.clients.get(clientId)
    if (!client || !client.isAuthenticated) {
      this.sendErrorToClient(clientId, 'Authentication required')
      return
    }

    try {
      const dashboardData: BiasDashboardData = {
        summary: {
          totalSessions: 0,
          averageBiasScore: 0,
          alertsLast24h: 0,
          totalAlerts: 0,
          criticalIssues: 0,
          improvementRate: 0,
          complianceScore: 0,
        },
        recentAnalyses: [],
        alerts: [],
        trends: [],
        demographics: {
          age: {},
          gender: {},
          ethnicity: {},
          language: {},
          intersectional: [],
        },
        recommendations: [],
      }

      this.sendToClient(clientId, {
        type: 'dashboard-update' as const,
        timestamp: new Date(),
        data: {
          summary: dashboardData.summary,
          newAlerts: dashboardData.alerts,
          updatedTrends: dashboardData.trends,
        },
      })
    } catch (error: unknown) {
      logger.error('Error fetching dashboard data', { clientId, error })
      this.sendErrorToClient(clientId, 'Failed to fetch dashboard data')
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(
    clientId: string,
    code: number,
    reason: Buffer,
  ): void {
    const client = this.clients.get(clientId)
    if (client) {
      logger.info('WebSocket client disconnected', {
        clientId,
        code,
        reason: reason.toString(),
        totalConnections: this.clients.size - 1,
      })
      this.clients.delete(clientId)
    }
  }

  /**
   * Broadcast bias alert to subscribed clients
   */
  async broadcastBiasAlert(
    alert: BiasAlert,
    analysisResult: BiasAnalysisResult,
  ): Promise<void> {
    const alertEvent: BiasAlertWebSocketEvent = {
      type: 'bias-alert',
      timestamp: new Date(),
      sessionId: analysisResult.sessionId,
      data: {
        alert,
        analysisResult,
        requiresImmediateAction:
          alert.level === 'critical' || alert.level === 'high',
      },
    }

    await this.broadcastToSubscribers('bias_alerts', alertEvent, (client) => {
      return this.shouldReceiveAlert(client, alert)
    })

    logger.info('Broadcast bias alert to clients', {
      alertId: alert.alertId,
      level: alert.level,
      recipientCount: this.getSubscriberCount('bias_alerts'),
    })
  }

  /**
   * Broadcast dashboard update to subscribed clients
   */
  async broadcastDashboardUpdate(
    dashboardData: BiasDashboardData,
  ): Promise<void> {
    const updateEvent: DashboardUpdateWebSocketEvent = {
      type: 'dashboard-update',
      timestamp: new Date(),
      data: {
        summary: dashboardData.summary,
        newAlerts: dashboardData.alerts?.slice(0, 5) || [],
        updatedTrends: dashboardData.trends?.slice(-10) || [],
      },
    }

    await this.broadcastToSubscribers('dashboard_updates', updateEvent)

    logger.debug('Broadcast dashboard update to clients', {
      recipientCount: this.getSubscriberCount('dashboard_updates'),
    })
  }

  /**
   * Broadcast system status to subscribed clients
   */
  async broadcastSystemStatus(status: { status: string }): Promise<void> {
    const statusEvent: SystemStatusWebSocketEvent = {
      type: 'system-status',
      timestamp: new Date(),
      data: {
        status: {
          status: status.status as 'healthy' | 'degraded' | 'unhealthy',
          timestamp: new Date(),
          services: {
            pythonService: { status: 'up' as const, lastCheck: new Date() },
            database: { status: 'up' as const, lastCheck: new Date() },
            cache: { status: 'up' as const, lastCheck: new Date() },
            alertSystem: { status: 'up' as const, lastCheck: new Date() },
          },
          version: '1.0.0',
          uptime: 0,
        },
        changedServices: [],
      },
    }

    await this.broadcastToSubscribers('system_status', statusEvent)

    logger.debug('Broadcast system status to clients', {
      status: status.status,
      recipientCount: this.getSubscriberCount('system_status'),
    })
  }

  /**
   * Broadcast analysis completion to subscribed clients
   */
  async broadcastAnalysisComplete(
    analysisResult: BiasAnalysisResult,
    processingTime: number,
  ): Promise<void> {
    const completeEvent: AnalysisCompleteWebSocketEvent = {
      type: 'analysis-complete',
      timestamp: new Date(),
      sessionId: analysisResult.sessionId,
      data: {
        sessionId: analysisResult.sessionId,
        result: analysisResult,
        processingTime,
      },
    }

    await this.broadcastToSubscribers('analysis_complete', completeEvent)

    logger.debug('Broadcast analysis completion to clients', {
      sessionId: analysisResult.sessionId,
      processingTime,
      recipientCount: this.getSubscriberCount('analysis_complete'),
    })
  }

  /**
   * Broadcast message to subscribers of a specific channel
   */
  private async broadcastToSubscribers(
    channel: string,
    message: WebSocketMessage,
    filter?: (client: WebSocketClient) => boolean,
  ): Promise<void> {
    const recipients: string[] = []

    for (const [clientId, client] of this.clients) {
      if (
        client.subscriptions.has(channel) &&
        client.isAuthenticated &&
        (!filter || filter(client))
      ) {
        try {
          this.sendToClient(clientId, message)
          recipients.push(clientId)
        } catch (error: unknown) {
          logger.error('Failed to send message to client', {
            clientId,
            error,
          })
        }
      }
    }

    logger.debug('Broadcast completed', {
      channel,
      messageType: message.type,
      recipientCount: recipients.length,
      totalClients: this.clients.size,
    })
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId)
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      client.ws.send(JSON.stringify(message))
    } catch (error: unknown) {
      logger.error('Error sending message to client', { clientId, error })
      this.clients.delete(clientId)
    }
  }

  private sendErrorToClient(clientId: string, error: string): void {
    this.sendToClient(clientId, {
      type: 'system-status' as const,
      timestamp: new Date(),
      data: {
        status: 'error',
        error,
      },
    })
  }

  private checkRateLimit(clientId: string): boolean {
    const now = new Date()
    const client = this.clients.get(clientId)
    if (!client) {
      return false
    }

    const messages = this.messageRateLimits.get(clientId) || []
    const recentMessages = messages.filter(
      (time) => now.getTime() - time.getTime() < 60000,
    )

    if (
      recentMessages.length >= this.config.rateLimitConfig.maxMessagesPerMinute
    ) {
      return false
    }

    recentMessages.push(now)
    this.messageRateLimits.set(clientId, recentMessages)
    return true
  }

  private banClient(clientId: string, reason: string): void {
    const client = this.clients.get(clientId)
    if (!client) {
      return
    }

    const banExpiry = new Date(
      Date.now() + this.config.rateLimitConfig.banDurationMs,
    )
    this.bannedIPs.set(client.ipAddress, banExpiry)

    logger.warn('Client banned', { clientId, reason, banExpiry })
    client.ws.close(1008, reason)
    this.clients.delete(clientId)
  }

  private shouldReceiveAlert(
    client: WebSocketClient,
    alert: BiasAlert,
  ): boolean {
    if (
      client.filters.alertLevelFilter &&
      client.filters.alertLevelFilter !== 'all' &&
      alert.level !== client.filters.alertLevelFilter
    ) {
      return false
    }

    // Add more filtering logic as needed
    return true
  }

  private getSubscriberCount(channel: string): number {
    let count = 0
    for (const client of this.clients.values()) {
      if (client.subscriptions.has(channel) && client.isAuthenticated) {
        count++
      }
    }
    return count
  }

  private validateAuthToken(token?: string, userId?: string): boolean {
    // In a real implementation, this would validate the JWT token
    return !!(token && userId) // Simplified for now
  }

  private getUserPermissions(userId?: string): string[] {
    // Return user permissions based on their role
    if (!userId) {
      return []
    }
    return ['bias_analysis_read', 'dashboard_read', 'alerts_read']
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date()
      const timeout = this.config.heartbeatInterval * 2

      for (const [clientId, client] of this.clients) {
        if (now.getTime() - client.lastPing.getTime() > timeout) {
          logger.warn('Client heartbeat timeout', { clientId })
          client.ws.close(1001, 'Heartbeat timeout')
          this.clients.delete(clientId)
        } else {
          this.sendToClient(clientId, {
            type: 'system-status' as const,
            timestamp: now,
            data: {
              status: 'heartbeat',
            },
          })
        }
      }
    }, this.config.heartbeatInterval)
  }

  private startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      logger.info('WebSocket server metrics', {
        activeConnections: this.clients.size,
        bannedIPs: this.bannedIPs.size,
        uptime: process.uptime(),
      })
    }, 60000)
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  public getStats() {
    return {
      isRunning: this.isRunning,
      activeConnections: this.clients.size,
      bannedIPs: this.bannedIPs.size,
    }
  }

  /**
   * Get connected clients information
   */
  getClients(): Array<{
    id: string
    isAuthenticated: boolean
    userId: string | undefined
    subscriptions: string[]
    ipAddress: string
    connectedSince: Date
  }> {
    return Array.from(this.clients.values()).map((client) => ({
      id: client.id,
      isAuthenticated: client.isAuthenticated,
      userId: client.userId,
      subscriptions: Array.from(client.subscriptions),
      ipAddress: client.ipAddress,
      connectedSince: client.lastPing,
    }))
  }
}
