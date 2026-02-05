import { useEffect, useState } from 'react'
import type { NotificationItem } from '@/lib/services/notification/NotificationService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useWebSocket } from '@/hooks/useWebSocket'
import { NotificationStatus } from '@/lib/services/notification/NotificationService'
import { cn } from '@/lib/utils'
import { Bell, Check, X } from 'lucide-react'

interface NotificationCenterProps {
  className?: string
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const { isConnected, sendMessage } = useWebSocket({
    url: 'ws://localhost:8080', // Placeholder URL
    sessionId: 'placeholder-session', // Placeholder session ID
    onMessage: (message) => {
      try {
        const payload = JSON.parse(message.content)

        switch (payload.type) {
          case 'unreadCount':
            setUnreadCount(payload.count)
            break

          case 'notifications':
            if (Array.isArray(payload.data)) {
              setNotifications(payload.data)
            }
            break

          case 'notification':
            // New incoming notification
            setNotifications((prev) => [payload.data, ...prev])
            if (payload.data.status === NotificationStatus.PENDING) {
              setUnreadCount((prev) => prev + 1)
            }
            break

          case 'error':
            console.error('Notification server error:', payload.message)
            break

          default:
            console.warn('Unknown notification message type:', payload.type)
        }
      } catch (err) {
        console.error('Failed to parse notification message', err)
      }
    },
  })

  useEffect(() => {
    if (isConnected) {
      // Request initial notifications
      sendMessage({
        id: 'init-notifications',
        role: 'system',
        content: JSON.stringify({
          type: 'get_notifications',
          limit: 20,
          offset: 0,
        }),
      })
    }
  }, [sendMessage, isConnected])

  const handleMarkAsRead = async (notificationId: string) => {
    sendMessage({
      id: `mark-read-${notificationId}`,
      role: 'system',
      content: JSON.stringify({ type: 'mark_read', notificationId }),
    })

    setNotifications((prev: NotificationItem[]) =>
      prev.map((n: NotificationItem) =>
        n.id === notificationId
          ? { ...n, status: NotificationStatus.READ, readAt: Date.now() }
          : n,
      ),
    )
    setUnreadCount((prev: number) => Math.max(0, prev - 1))
  }

  const handleDismiss = async (notificationId: string) => {
    sendMessage({
      id: `dismiss-${notificationId}`,
      role: 'system',
      content: JSON.stringify({ type: 'dismiss', notificationId }),
    })

    setNotifications((prev: NotificationItem[]) =>
      prev.filter((n: NotificationItem) => n.id !== notificationId),
    )
    if (
      notifications.find((n: NotificationItem) => n.id === notificationId)
        ?.status === NotificationStatus.PENDING
    ) {
      setUnreadCount((prev: number) => Math.max(0, prev - 1))
    }
  }

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
          >
            {unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute right-0 top-12 z-50 w-96 shadow-lg">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">Notifications</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
                No notifications
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification: NotificationItem) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-4 p-4 transition-colors',
                      notification.status === NotificationStatus.PENDING &&
                        'bg-muted/50',
                    )}
                  >
                    <div className="flex-1">
                      <h3 className="font-medium">{notification.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {notification.body}
                      </p>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex gap-1">
                      {notification.status === NotificationStatus.PENDING && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMarkAsRead(notification.id)}
                          aria-label="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDismiss(notification.id)}
                        aria-label="Dismiss notification"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
