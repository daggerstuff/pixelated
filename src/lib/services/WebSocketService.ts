import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('WebSocketService')

type MessageHandler = (data: unknown) => void

export class WebSocketService {
  private static instance: WebSocketService
  private ws: WebSocket | null = null
  private url: string = ''
  private readonly handlers: Map<string, Set<MessageHandler>> = new Map()
  private reconnectTimer: NodeJS.Timeout | null = null
  private pingInterval: NodeJS.Timeout | null = null
  private isConnecting: boolean = false
  private readonly messageQueue: { type: string; payload: Record<string, unknown>; resolve: () => void; reject: (err: unknown) => void }[] = []

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService()
    }
    return WebSocketService.instance
  }

  public connect(url: string): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.url = url
    this.isConnecting = true

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        logger.info('WebSocket connected', { url })
        this.isConnecting = false
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
        
        // Start heartbeat
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)

        // Flush message queue
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift()
          if (msg) {
            this.send(msg.type, msg.payload).then(msg.resolve).catch(msg.reject)
          }
        }
      }

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const raw: string = typeof event.data === 'string' ? event.data : String(event.data)
          const data = JSON.parse(raw) as Record<string, unknown>
          const type = data['type']
          
          if (type === 'pong') {
            return // Heartbeat response, ignore
          }
          
          if (typeof type === 'string' && type && this.handlers.has(type)) {
            const typeHandlers = this.handlers.get(type)
            typeHandlers?.forEach((handler) => handler(data))
          }
        } catch (error) {
          const rawEvent: string = typeof event.data === 'string' ? event.data : String(event.data)
          logger.error('Failed to parse WebSocket message', { error, data: rawEvent })
        }
      }

      this.ws.onerror = (event: Event) => {
        logger.error('WebSocket error', { event })
      }

      this.ws.onclose = () => {
        logger.info('WebSocket disconnected')
        this.cleanup()
        this.scheduleReconnect()
      }
    } catch (error) {
      logger.error('Failed to connect WebSocket', { error, url })
      this.cleanup()
      this.scheduleReconnect()
    }
  }
  
  private cleanup(): void {
    this.isConnecting = false
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    // Simple exponential backoff could go here; keeping it simple with 5s
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.url) {
        this.connect(this.url)
      }
    }, 5000)
  }

  public send(type: string, payload: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        // Queue the message instead of rejecting
        logger.info('WebSocket not connected, queuing message', { type })
        this.messageQueue.push({ type, payload, resolve, reject })
        return
      }

      try {
        const message = JSON.stringify({ type, ...payload })
        this.ws.send(message)
        resolve()
      } catch (error) {
        logger.error('Failed to send WebSocket message', { error, type })
        reject(error)
      }
    })
  }

  public on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)?.add(handler)
  }

  public off(type: string, handler: MessageHandler): void {
    const typeHandlers = this.handlers.get(type)
    if (typeHandlers) {
      typeHandlers.delete(handler)
      if (typeHandlers.size === 0) {
        this.handlers.delete(type)
      }
    }
  }
}
