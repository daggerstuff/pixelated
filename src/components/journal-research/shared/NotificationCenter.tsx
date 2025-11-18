import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/card'
import { X, Bell, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useNotificationStore,
  useFilteredNotifications,
  type Notification,
} from '@/lib/stores/journal-research/notificationStore'

export interface NotificationCenterProps {
  sessionId?: string | null
  maxVisible?: number
  className?: string
}

const typeIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
}

const typeColors = {
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  info: 'text-blue-600 dark:text-blue-400',
}

const mapNotificationLevelToType = (
  level: Notification['level'],
): 'success' | 'error' | 'warning' | 'info' => {
  switch (level) {
    case 'success':
      return 'success'
    case 'error':
      return 'error'
    case 'warning':
      return 'warning'
    case 'info':
    default:
      return 'info'
  }
}

export function NotificationCenter({
  sessionId,
  maxVisible = 10,
  className,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const markAsRead = useNotificationStore((state) => state.markAsRead)
  const dismiss = useNotificationStore((state) => state.dismiss)
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead)
  const dismissAll = useNotificationStore((state) => state.dismissAll)
  const setFilters = useNotificationStore((state) => state.setFilters)

  // Apply session filter if provided
  useEffect(() => {
    if (sessionId) {
      setFilters({ sessionId })
    } else {
      setFilters({ sessionId: undefined })
    }
  }, [sessionId, setFilters])

  const notifications = useFilteredNotifications()
  const visibleNotifications = notifications.slice(0, maxVisible)

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dismiss(id)
  }

  const handleClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id)
    }
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead()
  }

  const handleDismissAll = () => {
    dismissAll()
  }

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <Card className="absolute right-0 top-12 z-50 w-96 max-h-[600px] overflow-hidden shadow-lg">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">
                  Notifications
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {unreadCount > 0 && (
                <CardDescription>
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </CardDescription>
              )}
              {visibleNotifications.length > 0 && (
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-primary hover:underline"
                  >
                    Mark all as read
                  </button>
                  <span className="text-xs text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={handleDismissAll}
                    className="text-xs text-destructive hover:underline"
                  >
                    Dismiss all
                  </button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {visibleNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No notifications
                  </p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  {visibleNotifications.map((notification) => {
                    const notificationType = mapNotificationLevelToType(
                      notification.level,
                    )
                    const Icon = typeIcons[notificationType]
                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          'border-b p-4 transition-colors cursor-pointer',
                          {
                            'bg-muted/50': !notification.read,
                            'hover:bg-muted/30': true,
                          },
                        )}
                        onClick={() => handleClick(notification)}
                      >
                        <div className="flex items-start gap-3">
                          <Icon
                            className={cn(
                              'mt-0.5 h-5 w-5 flex-shrink-0',
                              typeColors[notificationType],
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p
                                  className={cn('text-sm font-medium', {
                                    'font-semibold': !notification.read,
                                  })}
                                >
                                  {notification.title}
                                </p>
                                {notification.message && (
                                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                    {notification.message}
                                  </p>
                                )}
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {notification.timestamp.toLocaleTimeString()}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => handleDismiss(notification.id, e)}
                                className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-muted"
                                aria-label="Dismiss notification"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            {notification.actionUrl && (
                              <a
                                href={notification.actionUrl}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                              >
                                View details
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

