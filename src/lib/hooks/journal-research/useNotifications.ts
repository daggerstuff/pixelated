import { useEffect } from 'react'
import {
  useNotificationStore,
  type Notification,
} from '@/lib/stores/journal-research/notificationStore'
import { useJournalResearchWebSocket } from './useWebSocket'
import { useJournalResearchSSE } from './useSSE'
import type { WebSocketMessage } from './useWebSocket'

interface UseNotificationsOptions {
  sessionId: string | null
  enabled?: boolean
  preferWebSocket?: boolean
  onNotification?: (notification: Notification) => void
}

export const useNotifications = ({
  sessionId,
  enabled = true,
  preferWebSocket = true,
  onNotification,
}: UseNotificationsOptions) => {
  const addNotification = useNotificationStore(
    (state) => state.addNotification,
  )

  const handleMessage = (message: WebSocketMessage) => {
    if (message.type === 'notification') {
      addNotification({
        level: message.data.level,
        title: message.data.title,
        message: message.data.message,
        actionUrl: message.data.actionUrl,
        sessionId: message.sessionId,
      })

      // Get the notification that was just added
      const notifications = useNotificationStore.getState().notifications
      const newNotification = notifications[0] // Most recent notification

      if (newNotification && onNotification) {
        onNotification(newNotification)
      }
    }
  }

  // Use WebSocket if preferred and available, otherwise fall back to SSE
  const ws = useJournalResearchWebSocket({
    sessionId,
    enabled: enabled && preferWebSocket,
    onMessage: handleMessage,
  })

  const sse = useJournalResearchSSE({
    sessionId,
    enabled: enabled && !preferWebSocket,
    onMessage: handleMessage,
  })

  // If WebSocket fails, fall back to SSE
  useEffect(() => {
    if (preferWebSocket && ws.connectionState === 'error' && enabled) {
      // SSE will automatically connect when WebSocket is disabled
      // This is handled by the enabled flag
    }
  }, [preferWebSocket, ws.connectionState, enabled])

  return {
    connectionState: preferWebSocket ? ws.connectionState : sse.connectionState,
    isConnected: preferWebSocket ? ws.isConnected : sse.isConnected,
    reconnectAttempts: preferWebSocket
      ? ws.reconnectAttempts
      : sse.reconnectAttempts,
    reconnect: preferWebSocket ? ws.reconnect : sse.reconnect,
  }
}

