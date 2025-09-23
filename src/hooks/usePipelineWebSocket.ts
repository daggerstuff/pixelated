import { useState, useEffect, useRef, useCallback } from 'react'
import { WebSocketMessage } from '@/types/pipeline'

/**
 * Custom hook for managing WebSocket connections to the pipeline service
 * Provides real-time progress updates, connection management, and error handling
 */
export function usePipelineWebSocket({
  url,
  executionId,
  autoConnect = true,
  maxRetries = 5,
  retryDelay = 3000,
  onProgressUpdate,
  onStatusChange,
  onError,
  onConnect,
  onDisconnect
}: {
  url: string
  executionId: string
  autoConnect?: boolean
  maxRetries?: number
  retryDelay?: number
  onProgressUpdate?: (progress: number, stage?: string, data?: unknown) => void
  onStatusChange?: (status: string, message?: string) => void
  onError?: (error: Error) => void
  onConnect?: () => void
  onDisconnect?: () => void
}) {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const [isReconnecting, setIsReconnecting] = useState(false)

  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const messageQueueRef = useRef<WebSocketMessage[]>([])
  const isMountedRef = useRef(true)
  // keep a ref to the socket to avoid reading socket.readyState inside hooks deps
  const socketRef = useRef<WebSocket | null>(null)

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus('connecting')
    setIsReconnecting(connectionAttempts > 0)

    try {
      const ws = new WebSocket(url)

      ws.onopen = () => {
        if (!isMountedRef.current) return

        setConnectionStatus('connected')
        setConnectionAttempts(0)
        setIsReconnecting(false)
        onConnect?.()

        // Send initial subscription message
        const subscribeMessage: WebSocketMessage = {
          type: 'subscribe',
          executionId,
          timestamp: new Date().toISOString(),
          data: { executionId }
        }

        ws.send(JSON.stringify(subscribeMessage))

        // Process any queued messages
        while (messageQueueRef.current.length > 0) {
          const message = messageQueueRef.current.shift()
          if (message) {
            try {
              ws.send(JSON.stringify(message))
            } catch (_e) {
              // If send fails, push back and break to avoid busy loop
              if (message) messageQueueRef.current.unshift(message)
              break
            }
          }
        }
      }

      ws.onclose = () => {
        if (!isMountedRef.current) return

        setConnectionStatus('disconnected')
  setSocket(null)
  socketRef.current = null
        onDisconnect?.()

        // Auto-reconnect logic
        if (autoConnect && connectionAttempts < maxRetries) {
          setIsReconnecting(true)
          reconnectTimerRef.current = setTimeout(() => {
            setConnectionAttempts(prev => prev + 1)
            connect()
          }, retryDelay)
        }
      }

      ws.onerror = (error) => {
        if (!isMountedRef.current) return

        setConnectionStatus('error')
        const errorMessage = new Error(`WebSocket connection error: ${error.type}`)
        onError?.(errorMessage)
      }

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return

        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setLastMessage(message)

          // Handle different message types
          switch (message.type) {
            case 'progress_update':
              if (message.executionId === executionId) {
                const { progress, stage, data } = message.data
                onProgressUpdate?.(progress, stage, data)
              }
              break

            case 'status_update':
              if (message.executionId === executionId) {
                const { status, message: statusMessage } = message.data
                onStatusChange?.(status, statusMessage)
              }
              break

            case 'error':
              if (message.executionId === executionId) {
                const error = new Error(message.data.message || 'Unknown WebSocket error')
                onError?.(error)
              }
              break

            case 'completion':
              if (message.executionId === executionId) {
                onStatusChange?.('completed', 'Pipeline execution completed')
              }
              break
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
          onError?.(new Error('Failed to parse WebSocket message'))
        }
      }

      setSocket(ws)
    } catch (error) {
      if (!isMountedRef.current) return

      setConnectionStatus('error')
      onError?.(error instanceof Error ? error : new Error('Unknown connection error'))
    }
  }, [url, executionId, autoConnect, maxRetries, retryDelay, onConnect, onDisconnect, onError, onProgressUpdate, onStatusChange, connectionAttempts])

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    if (socket) {
      socket.close()
      setSocket(null)
      socketRef.current = null
    }

    setConnectionStatus('disconnected')
    setConnectionAttempts(0)
    setIsReconnecting(false)
  }, [socket])

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message))
    } else {
      // Queue message if not connected
      messageQueueRef.current.push(message)
    }
  }, [])

  const sendProgressRequest = useCallback((requestData: unknown) => {
    const message: WebSocketMessage = {
      type: 'progress_request',
      executionId,
      timestamp: new Date().toISOString(),
      data: requestData as unknown
    }
    sendMessage(message)
  }, [executionId, sendMessage])

  const sendStatusRequest = useCallback((requestData: unknown) => {
    const message: WebSocketMessage = {
      type: 'status_request',
      executionId,
      timestamp: new Date().toISOString(),
      data: requestData as unknown
    }
    sendMessage(message)
  }, [executionId, sendMessage])

  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      isMountedRef.current = false
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  return {
    socket,
    connectionStatus,
    lastMessage,
    connectionAttempts,
    isReconnecting,
    connect,
    disconnect,
    sendMessage,
    sendProgressRequest,
    sendStatusRequest
  }
}

/**
 * Custom hook for managing multiple WebSocket connections
 * Useful for monitoring multiple pipeline executions simultaneously
 */
export function useMultiPipelineWebSocket({
  urls,
  executionIds,
  autoConnect = true,
  maxRetries = 5,
  retryDelay = 3000,
  onProgressUpdate,
  onStatusChange,
  onError,
  onConnect,
  onDisconnect
}: {
  urls: string[]
  executionIds: string[]
  autoConnect?: boolean
  maxRetries?: number
  retryDelay?: number
  onProgressUpdate?: (executionId: string, progress: number, stage?: string, data?: unknown) => void
  onStatusChange?: (executionId: string, status: string, message?: string) => void
  onError?: (executionId: string, error: Error) => void
  onConnect?: (executionId: string) => void
  onDisconnect?: (executionId: string) => void
}) {
  type Connection = {
    url: string
    executionId: string
    autoConnect: boolean
    maxRetries: number
    retryDelay: number
    onProgressUpdate?: (progress: number, stage?: string, data?: unknown) => void
    onStatusChange?: (status: string, message?: string) => void
    onError?: (error: Error) => void
    onConnect?: () => void
    onDisconnect?: () => void
  }

  const [connections, setConnections] = useState<Map<string, Connection>>(new Map())
  const [overallStatus, setOverallStatus] = useState<'disconnected' | 'partial' | 'connected'>('disconnected')

  useEffect(() => {
    if (urls.length !== executionIds.length) {
      console.error('URLs and executionIds arrays must have the same length')
      return
    }

  const newConnections = new Map<string, Connection>()

    urls.forEach((url, index) => {
      const executionId = executionIds[index]

      // Create a connection object without calling hooks
      const connection = {
        url,
        executionId,
        autoConnect,
        maxRetries,
        retryDelay,
        onProgressUpdate: (progress: number, stage?: string, data?: unknown) => {
          onProgressUpdate?.(executionId, progress, stage, data)
        },
        onStatusChange: (status: string, message?: string) => {
          onStatusChange?.(executionId, status, message)
        },
        onError: (error: Error) => {
          onError?.(executionId, error)
        },
        onConnect: () => {
          onConnect?.(executionId)
        },
        onDisconnect: () => {
          onDisconnect?.(executionId)
        }
      }

      newConnections.set(executionId, connection)
    })

    setConnections(newConnections)

    return () => {
      // Cleanup logic would go here
      newConnections.forEach((_connection) => {
        // Disconnect logic placeholder
      })
    }
  }, [urls, executionIds, autoConnect, maxRetries, retryDelay, onProgressUpdate, onStatusChange, onError, onConnect, onDisconnect])

  useEffect(() => {
    // This would need to be implemented differently since we can't track connection status
    // without actual WebSocket connections
    setOverallStatus('partial') // Placeholder
  }, [connections])

  const getConnection = useCallback((executionId: string) => {
    return connections.get(executionId)
  }, [connections])

  const disconnectAll = useCallback(() => {
    connections.forEach((_connection) => {
      // Disconnect logic placeholder
    })
  }, [connections])

  const reconnectAll = useCallback(() => {
    connections.forEach((_connection) => {
      // Reconnect logic placeholder
    })
  }, [connections])

  return {
    connections,
    overallStatus,
    getConnection,
    disconnectAll,
    reconnectAll
  }
}

/**
 * Custom hook for managing WebSocket message history and debugging
 */
export function useWebSocketMessageHistory(maxMessages = 100) {
  const [messages, setMessages] = useState<Array<{
    id: string
    timestamp: Date
    type: 'sent' | 'received' | 'error' | 'system'
    data: unknown
    executionId?: string
  }>>([])

  const addMessage = useCallback((message: {
    type: 'sent' | 'received' | 'error' | 'system'
    data: unknown
    executionId?: string
  }) => {
    const newMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...message
    }

    setMessages(prev => {
      const updated = [...prev, newMessage]
      // Keep only the most recent messages
      return updated.slice(-maxMessages)
    })

    return newMessage.id
  }, [maxMessages])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  const getMessagesByExecutionId = useCallback((executionId: string) => {
    return messages.filter(msg => msg.executionId === executionId)
  }, [messages])

  const getMessagesByType = useCallback((type: 'sent' | 'received' | 'error' | 'system') => {
    return messages.filter(msg => msg.type === type)
  }, [messages])

  return {
    messages,
    addMessage,
    clearMessages,
    getMessagesByExecutionId,
    getMessagesByType
  }
}
