import { useEffect, useRef } from 'react'
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

interface UseJournalResearchWebSocketOptions {
  sessionId: string | null
  /**
   * Relative endpoint path. Defaults to `/sessions/{sessionId}/progress/stream`.
   */
  endpoint?: string
  protocols?: string | string[]
  enabled?: boolean
  reconnectIntervalMs?: number
  onMessage?: (event: MessageEvent) => void
  onError?: (event: Event) => void
  onOpen?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
}

export const useJournalResearchWebSocket = ({
  sessionId,
  endpoint,
  protocols,
  enabled = true,
  reconnectIntervalMs = 10_000,
  onMessage,
  onError,
  onOpen,
  onClose,
}: UseJournalResearchWebSocketOptions) => {
  const reconnectTimerRef = useRef<number | null>(null)
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (!sessionId || !enabled) {
      return undefined
    }

    const baseUrl = journalResearchApiClient.getBaseUrl()
    const path =
      endpoint ?? `/sessions/${sessionId}/progress/stream`
    const authToken = getAuthToken()
    const wsUrl = buildWebSocketUrl(baseUrl, path, authToken)

    let shouldReconnect = true

    const connect = () => {
      socketRef.current = new WebSocket(wsUrl, protocols)

      socketRef.current.onopen = (event) => {
        onOpen?.(event)
      }

      socketRef.current.onmessage = (event) => {
        onMessage?.(event)
      }

      socketRef.current.onerror = (event) => {
        onError?.(event)
      }

      socketRef.current.onclose = (event) => {
        onClose?.(event)
        if (shouldReconnect && reconnectIntervalMs > 0) {
          reconnectTimerRef.current = window.setTimeout(
            connect,
            reconnectIntervalMs,
          )
        }
      }
    }

    connect()

    return () => {
      shouldReconnect = false
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      socketRef.current?.close()
    }
  }, [
    sessionId,
    endpoint,
    protocols,
    enabled,
    reconnectIntervalMs,
    onMessage,
    onError,
    onOpen,
    onClose,
  ])
}


