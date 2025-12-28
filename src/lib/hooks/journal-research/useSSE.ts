import { useEffect, useRef, useState, useCallback } from 'react'
import { journalResearchApiClient } from '@/lib/api/journal-research'
import type {
  WebSocketMessage,
} from './useWebSocket'

export type SSEConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

interface UseJournalResearchSSEOptions {
  sessionId: string | null
  /**
   * Relative endpoint path. Defaults to `/sessions/{sessionId}/progress/events`.
   */
  endpoint?: string
  enabled?: boolean
  reconnectIntervalMs?: number
  maxReconnectAttempts?: number
  onMessage?: (message: WebSocketMessage) => void
  onError?: (error: Error) => void
  onOpen?: () => void
  onClose?: () => void
}

export interface UseJournalResearchSSEReturn {
  connectionState: SSEConnectionState
  isConnected: boolean
  reconnectAttempts: number
  close: () => void
  reconnect: () => void
}

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
    console.warn('Failed to read auth token for SSE connection', error)
    return null
  }
}

const buildSSEUrl = (
  baseUrl: string,
  path: string,
  authToken: string | null,
) => {
  const url = new URL(path, baseUrl)
  if (authToken) {
    url.searchParams.set('token', authToken)
  }
  return url.toString()
}

export const useJournalResearchSSE = ({
  sessionId,
  endpoint,
  enabled = true,
  reconnectIntervalMs = 10_000,
  maxReconnectAttempts = 5,
  onMessage,
  onError,
  onOpen,
  onClose,
}: UseJournalResearchSSEOptions): UseJournalResearchSSEReturn => {
  const reconnectTimerRef = useRef<number | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const shouldReconnectRef = useRef(true)
  const reconnectAttemptsRef = useRef(0)
  const [connectionState, setConnectionState] =
    useState<SSEConnectionState>('disconnected')
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
        console.warn('Failed to parse SSE message', error)
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

    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return
    }

    const baseUrl = journalResearchApiClient.getBaseUrl()
    const path =
      endpoint ?? `/sessions/${sessionId}/progress/events`
    const authToken = getAuthToken()
    const sseUrl = buildSSEUrl(baseUrl, path, authToken)

    setConnectionState(
      reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting',
    )

    try {
      eventSourceRef.current = new EventSource(sseUrl)

      eventSourceRef.current.onopen = () => {
        setConnectionState('connected')
        setReconnectAttempts(0)
        reconnectAttemptsRef.current = 0
        onOpen?.()
      }

      eventSourceRef.current.onmessage = handleMessage

      eventSourceRef.current.onerror = () => {
        const currentState = eventSourceRef.current?.readyState

        if (currentState === EventSource.CONNECTING) {
          setConnectionState('connecting')
        } else if (currentState === EventSource.CLOSED) {
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
            setConnectionState('error')
            const error = new Error(
              `SSE reconnection failed after ${maxReconnectAttempts} attempts`,
            )
            onError?.(error)
          }
        } else {
          setConnectionState('error')
          const error = new Error('SSE connection error')
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
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [enabled, sessionId, connect])

  const close = useCallback(() => {
    shouldReconnectRef.current = false
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    eventSourceRef.current?.close()
    eventSourceRef.current = null
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
    close,
    reconnect,
  }
}

