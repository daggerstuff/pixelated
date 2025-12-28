import { useEffect } from 'react'
import { toast } from '@/components/ui/toast'
import {
  useNotificationStore,
  } from '@/lib/stores/journal-research/notificationStore'

interface UseNotificationToastsOptions {
  enabled?: boolean
  showToasts?: boolean
}

/**
 * Hook to automatically show toast notifications for new notifications
 */
export const useNotificationToasts = ({
  enabled = true,
  showToasts = true,
}: UseNotificationToastsOptions = {}) => {
  const notifications = useNotificationStore((state) => state.notifications)
  const markAsRead = useNotificationStore((state) => state.markAsRead)

  useEffect(() => {
    if (!enabled || !showToasts) {
      return
    }

    // Get the most recent unread notification
    const unreadNotifications = notifications.filter((n) => !n.read)
    const latestNotification = unreadNotifications[0]

    if (latestNotification) {
      // Show toast based on notification level
      const toastMessage = latestNotification.message
        ? `${latestNotification.title}: ${latestNotification.message}`
        : latestNotification.title

      switch (latestNotification.level) {
        case 'success':
          toast.success(toastMessage, {
            duration: 5000,
          })
          break
        case 'error':
          toast.error(toastMessage, {
            duration: 7000,
          })
          break
        case 'warning':
          toast.warning(toastMessage, {
            duration: 6000,
          })
          break
        case 'info':
        default:
          toast.info(toastMessage, {
            duration: 5000,
          })
          break
      }

      // Mark as read after showing toast
      markAsRead(latestNotification.id)
    }
  }, [notifications, enabled, showToasts, markAsRead])
}

