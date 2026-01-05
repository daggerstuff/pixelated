import { useEffect, useRef, useState, useCallback } from 'react'
import { journalResearchApiClient } from '@/lib/api/journal-research'

const getAuthToken = () => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const token =
      window.localStorage.getItem('auth_token') ??
      window.localStorage.getItem('authToken')
    if (!token) {
      return null
    }
    return token.startsWith('Bearer ') ? token.slice(7) : token
  } catch (error) {
    console.warn('Failed to read auth token for WebSocket connection', error)
    return null
  }
}

const buildWebSocketUrl = (
  baseUrl: string,
  path: string,
  authToken: string | null,
) => {
  const url = new URL(path, baseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  if (authToken) {
    url.searchParams.set('token', authToken)
  }
  return url.toString()
}

export type WebSocketConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

export interface ProgressUpdateMessage {
  type: 'progress_update'
  sessionId: string
  data: {
    phase: string
    progress: number
    metrics?: Record<string, number>
    message?: string
  }
  timestamp: string
}

export interface StatusUpdateMessage {
  type: 'status_update'
  sessionId: string
  data: {
    status: string
    phase?: string
    message?: string
  }
  timestamp: string
}

export interface NotificationMessage {
  type: 'notification'
  sessionId: string
  data: {
    level: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    actionUrl?: string
  }
  timestamp: string
}

export type WebSocketMessage =
  | ProgressUpdateMessage
  | StatusUpdateMessage
  | NotificationMessage

interface UseJournalResearchWebSocketOptions {
  sessionId: string | null
  /**
   * Relative endpoint path. Defaults to `/sessions/{sessionId}/progress/stream`.
   */
  endpoint?: string
  protocols?: string | string[]
  enabled?: boolean
  reconnectIntervalMs?: number
  maxReconnectAttempts?: number
  onMessage?: (message: WebSocketMessage) => void
  onError?: (error: Error) => void
  onOpen?: () => void
  onClose?: () => void
}

export interface UseJournalResearchWebSocketReturn {
  connectionState: WebSocketConnectionState
  isConnected: boolean
  reconnectAttempts: number
  send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void
  close: () => void
  reconnect: () => void
}

export const useJournalResearchWebSocket = ({
  sessionId,
  endpoint,
  protocols,
  enabled = true,
  reconnectIntervalMs = 10_000,
  maxReconnectAttempts = 5,
  onMessage,
  onError,
  onOpen,
  onClose,
}: UseJournalResearchWebSocketOptions): UseJournalResearchWebSocketReturn => {
  const reconnectTimerRef = useRef<number | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const shouldReconnectRef = useRef(true)
  const reconnectAttemptsRef = useRef(0)
  const [connectionState, setConnectionState] =
    useState<WebSocketConnectionState>('disconnected')
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as unknown
        if (
          typeof data === 'object' &&
          data !== null &&
          'type' in data &&
          typeof data.type === 'string'
        ) {
          onMessage?.(data as WebSocketMessage)
        }
      } catch (error) {
        console.warn('Failed to parse WebSocket message', error)
        onError?.(error as Error)
      }
    },
    [onMessage, onError],
  )

  const connect = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (!sessionId || !enabled) {
      return
    }

    const baseUrl = journalResearchApiClient.getBaseUrl()
    const path =
      endpoint ?? `/sessions/${sessionId}/progress/stream`
    const authToken = getAuthToken()
    const wsUrl = buildWebSocketUrl(baseUrl, path, authToken)

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setConnectionState(
      reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting',
    )

    try {
      socketRef.current = new WebSocket(wsUrl, protocols)

      socketRef.current.onopen = () => {
        setConnectionState('connected')
        setReconnectAttempts(0)
        reconnectAttemptsRef.current = 0
        onOpen?.()
      }

      socketRef.current.onmessage = handleMessage

      socketRef.current.onerror = () => {
        setConnectionState('error')
        const error = new Error('WebSocket connection error')
        onError?.(error)
      }

      socketRef.current.onclose = () => {
        setConnectionState('disconnected')
        onClose?.()

        if (
          shouldReconnectRef.current &&
          reconnectIntervalMs > 0 &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current += 1
          setReconnectAttempts(reconnectAttemptsRef.current)
          reconnectTimerRef.current = window.setTimeout(
            connect,
            reconnectIntervalMs,
          )
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          const error = new Error(
            `WebSocket reconnection failed after ${maxReconnectAttempts} attempts`,
          )
          onError?.(error)
        }
      }
    } catch (error) {
      setConnectionState('error')
      onError?.(error as Error)
    }
  }, [
    sessionId,
    endpoint,
    protocols,
    enabled,
    reconnectIntervalMs,
    maxReconnectAttempts,
    handleMessage,
    onOpen,
    onError,
    onClose,
  ])

  useEffect(() => {
    if (!enabled || !sessionId) {
      return
    }

    connect()

    return () => {
      shouldReconnectRef.current = false
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [enabled, sessionId, connect])

  const send = useCallback(
    (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(data)
      } else {
        const error = new Error('WebSocket is not connected')
        onError?.(error)
      }
    },
    [onError],
  )

  const close = useCallback(() => {
    shouldReconnectRef.current = false
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    socketRef.current?.close()
    socketRef.current = null
    setConnectionState('disconnected')
  }, [])

  const reconnect = useCallback(() => {
    close()
    reconnectAttemptsRef.current = 0
    setReconnectAttempts(0)
    shouldReconnectRef.current = true
    connect()
  }, [close, connect])

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    reconnectAttempts,
    send,
    close,
    reconnect,
  }
}


