import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  level: NotificationLevel
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionUrl?: string
  sessionId?: string
  phase?: string
}

interface NotificationFilters {
  level?: NotificationLevel[]
  read?: boolean
  sessionId?: string
}

interface NotificationStoreState {
  notifications: Notification[]
  filters: NotificationFilters
  unreadCount: number

  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  dismiss: (id: string) => void
  dismissAll: () => void
  clear: () => void
  setFilters: (filters: Partial<NotificationFilters>) => void
  resetFilters: () => void
}

const defaultFilters: NotificationFilters = {}

export const useNotificationStore = create<NotificationStoreState>()(
  persist(
    (set, get) => ({
      notifications: [],
      filters: defaultFilters,
      unreadCount: 0,

      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          read: false,
        }

        set((state) => {
          const notifications = [newNotification, ...state.notifications]
          const unreadCount = notifications.filter((n) => !n.read).length

          // Keep only the last 100 notifications
          const trimmedNotifications = notifications.slice(0, 100)

          return {
            notifications: trimmedNotifications,
            unreadCount,
          }
        })
      },

      markAsRead: (id) => {
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          )
          const unreadCount = notifications.filter((n) => !n.read).length

          return {
            notifications,
            unreadCount,
          }
        })
      },

      markAllAsRead: () => {
        set((state) => {
          const notifications = state.notifications.map((n) => ({
            ...n,
            read: true,
          }))

          return {
            notifications,
            unreadCount: 0,
          }
        })
      },

      dismiss: (id) => {
        set((state) => {
          const notifications = state.notifications.filter((n) => n.id !== id)
          const unreadCount = notifications.filter((n) => !n.read).length

          return {
            notifications,
            unreadCount,
          }
        })
      },

      dismissAll: () => {
        set({
          notifications: [],
          unreadCount: 0,
        })
      },

      clear: () => {
        set({
          notifications: [],
          unreadCount: 0,
          filters: defaultFilters,
        })
      },

      setFilters: (filters) => {
        set((state) => ({
          filters: {
            ...state.filters,
            ...filters,
          },
        }))
      },

      resetFilters: () => {
        set({
          filters: defaultFilters,
        })
      },
    }),
    {
      name: 'journal-research-notifications',
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
    },
  ),
)

// Computed selectors
export const useFilteredNotifications = () => {
  const notifications = useNotificationStore((state) => state.notifications)
  const filters = useNotificationStore((state) => state.filters)

  return notifications.filter((notification) => {
    if (filters.level && !filters.level.includes(notification.level)) {
      return false
    }
    if (filters.read !== undefined && notification.read !== filters.read) {
      return false
    }
    if (filters.sessionId && notification.sessionId !== filters.sessionId) {
      return false
    }
    return true
  })
}

