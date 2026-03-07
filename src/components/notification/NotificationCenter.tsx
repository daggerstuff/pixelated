import { useEffect, useState } from 'react'
import type { NotificationItem } from '@/lib/services/notification/NotificationService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useWebSocket } from '@/hooks/useWebSocket'
import { NotificationStatus } from '@/lib/services/notification/NotificationService'
import { cn } from '@/lib/utils'
import { Bell, Check, X } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface NotificationCenterProps {
  className?: string
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const { sendMessage } = useWebSocket({
    url: 'ws://localhost:8080', // Placeholder URL
    sessionId: 'placeholder-session', // Placeholder session ID
    onMessage: (message) => {
      try {
        const payload = JSON.parse(message.content) as {
          type: string
          data?: any
          count?: number
        }

        switch (payload.type) {
          case 'notification': {
            const newNotification = payload.data as NotificationItem
            setNotifications((prev) => [newNotification, ...prev])
            if (newNotification.status === NotificationStatus.PENDING) {
              setUnreadCount((prev) => prev + 1)
            }
            break
          }
          case 'unreadCount': {
            if (typeof payload.count === 'number') {
              setUnreadCount(payload.count)
            }
            break
          }
          case 'notifications': {
            if (Array.isArray(payload.data)) {
              setNotifications(payload.data)
            }
            break
          }
        }
      } catch (error) {
        console.error('Error parsing notification message:', error)
      }
    },
  })

  useEffect(() => {
    // Request initial notifications
    sendMessage({
      id: 'init-notifications', // Placeholder ID
      role: 'system', // Placeholder role
      content: JSON.stringify({
        type: 'get_notifications',
        limit: 20,
        offset: 0,
      }), // Stringify custom payload
    })
  }, [sendMessage])

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
    <TooltipProvider>
      <div className={cn('relative', className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Notifications"
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
          </TooltipTrigger>
          <TooltipContent>
            <p>Notifications</p>
          </TooltipContent>
        </Tooltip>

        {isOpen && (
          <Card className="absolute right-0 top-12 z-50 w-96 shadow-lg">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close notifications"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Close notifications</p>
                </TooltipContent>
              </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkAsRead(notification.id)}
                              aria-label="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Mark as read</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDismiss(notification.id)}
                            aria-label="Dismiss notification"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Dismiss notification</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </Card>
        )}
      </div>
    </TooltipProvider>
  )
}
