import { NotificationChannel } from '@/lib/services/notification/NotificationService'
import { useEffect, useState } from 'react'

export interface NotificationPreferences {
  channels: {
    [NotificationChannel.IN_APP]: boolean
    [NotificationChannel.EMAIL]: boolean
    [NotificationChannel.PUSH]: boolean
    [NotificationChannel.SMS]: boolean
  }
  frequency: 'immediate' | 'batched' | 'daily' | 'weekly'
  quiet_hours: {
    enabled: boolean
    start: string // HH:mm format
    end: string // HH:mm format
  }
  categories: {
    [key: string]: boolean
  }
}

const defaultPreferences: NotificationPreferences = {
  channels: {
    [NotificationChannel.IN_APP]: true,
    [NotificationChannel.EMAIL]: true,
    [NotificationChannel.PUSH]: false,
    [NotificationChannel.SMS]: false,
  },
  frequency: 'immediate',
  quiet_hours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
  categories: {
    system: true,
    security: true,
    updates: true,
    reminders: true,
  },
}

export function useNotificationPreferences() {
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(defaultPreferences)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/user/notification-preferences')
      if (!response.ok) {
        throw new Error('Failed to load notification preferences')
      }

      const data = await response.json()
      setPreferences(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      // Fall back to default preferences on error
      setPreferences(defaultPreferences)
    } finally {
      setIsLoading(false)
    }
  }

  const updatePreferences = async (
    newPreferences: Partial<NotificationPreferences>,
  ) => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/user/notification-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...preferences,
          ...newPreferences,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update notification preferences')
      }

      const data = await response.json()
      setPreferences(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      // Keep existing preferences on error
    } finally {
      setIsLoading(false)
    }
  }

  const updateChannel = async (
    channel: keyof NotificationPreferences['channels'],
    enabled: boolean,
  ) => {
    await updatePreferences({
      channels: {
        ...preferences.channels,
        [channel]: enabled,
      },
    })
  }

  const updateFrequency = async (
    frequency: NotificationPreferences['frequency'],
  ) => {
    await updatePreferences({ frequency })
  }

  const updateQuietHours = async (
    quietHours: NotificationPreferences['quiet_hours'],
  ) => {
    await updatePreferences({ quiet_hours: quietHours })
  }

  const updateCategory = async (category: string, enabled: boolean) => {
    await updatePreferences({
      categories: {
        ...preferences.categories,
        [category]: enabled,
      },
    })
  }

  return {
    preferences,
    isLoading,
    error,
    updateChannel,
    updateFrequency,
    updateQuietHours,
    updateCategory,
    updatePreferences,
  }
}
