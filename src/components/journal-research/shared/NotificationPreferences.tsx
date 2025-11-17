import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Bell, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NotificationFrequency = 'immediate' | 'batched' | 'daily' | 'never'

export interface JournalResearchNotificationPreferences {
  inApp: boolean
  toast: boolean
  browserPush: boolean
  email: boolean
  frequency: NotificationFrequency
  quietHours: {
    enabled: boolean
    start: string // HH:mm format
    end: string // HH:mm format
  }
  categories: {
    progress: boolean
    discovery: boolean
    evaluation: boolean
    acquisition: boolean
    integration: boolean
    errors: boolean
  }
}

const defaultPreferences: JournalResearchNotificationPreferences = {
  inApp: true,
  toast: true,
  browserPush: false,
  email: false,
  frequency: 'immediate',
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
  categories: {
    progress: true,
    discovery: true,
    evaluation: true,
    acquisition: true,
    integration: true,
    errors: true,
  },
}

interface NotificationPreferencesStore {
  preferences: JournalResearchNotificationPreferences
  setPreferences: (preferences: Partial<JournalResearchNotificationPreferences>) => void
  resetPreferences: () => void
}

const useNotificationPreferencesStore = create<NotificationPreferencesStore>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      setPreferences: (newPreferences) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...newPreferences,
          },
        })),
      resetPreferences: () => set({ preferences: defaultPreferences }),
    }),
    {
      name: 'journal-research-notification-preferences',
    },
  ),
)

interface NotificationPreferencesProps {
  className?: string
}

export function NotificationPreferences({
  className,
}: NotificationPreferencesProps) {
  const { preferences, setPreferences } = useNotificationPreferencesStore()
  const [pushPermission, setPushPermission] =
    useState<NotificationPermission>('default')
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(
    null,
  )
  const [isRequestingPush, setIsRequestingPush] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission)
    }
  }, [])

  const requestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setError('Browser push notifications are not supported')
      return
    }

    if (!('serviceWorker' in navigator)) {
      setError('Service workers are not supported')
      return
    }

    try {
      setIsRequestingPush(true)
      setError(null)

      // Request notification permission
      const permission = await Notification.requestPermission()
      setPushPermission(permission)

      if (permission !== 'granted') {
        setError('Push notification permission was denied')
        setIsRequestingPush(false)
        return
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register(
        '/sw.js',
      ).catch(() => {
        // Fallback: try to get existing registration
        return navigator.serviceWorker.getRegistration()
      })

      if (!registration) {
        setError('Failed to register service worker')
        setIsRequestingPush(false)
        return
      }

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })

      setPushSubscription(subscription)

      // Send subscription to server
      await fetch('/api/journal-research/push-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      })

      setPreferences({ browserPush: true })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to enable push notifications',
      )
    } finally {
      setIsRequestingPush(false)
    }
  }

  const disablePushNotifications = async () => {
    if (pushSubscription) {
      try {
        await pushSubscription.unsubscribe()
        await fetch('/api/journal-research/push-subscription', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pushSubscription),
        })
        setPushSubscription(null)
        setPreferences({ browserPush: false })
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to disable push notifications',
        )
      }
    } else {
      setPreferences({ browserPush: false })
    }
  }

  return (
    <Card className={cn('p-6', className)}>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Configure how you receive notifications for journal research activities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">Notification Channels</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="in-app">In-app notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Show notifications in the notification center
                  </p>
                </div>
                <Switch
                  id="in-app"
                  checked={preferences.inApp}
                  onCheckedChange={(checked) =>
                    setPreferences({ inApp: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="toast">Toast notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Show temporary toast messages
                  </p>
                </div>
                <Switch
                  id="toast"
                  checked={preferences.toast}
                  onCheckedChange={(checked) =>
                    setPreferences({ toast: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="browser-push">Browser push notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Receive notifications even when the app is closed
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {pushPermission === 'granted' && preferences.browserPush ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={disablePushNotifications}
                    >
                      Disable
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={requestPushPermission}
                      disabled={isRequestingPush || pushPermission === 'denied'}
                    >
                      {isRequestingPush
                        ? 'Enabling...'
                        : pushPermission === 'denied'
                          ? 'Permission Denied'
                          : 'Enable'}
                    </Button>
                  )}
                  {pushPermission === 'granted' && (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email">Email notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  id="email"
                  checked={preferences.email}
                  onCheckedChange={(checked) =>
                    setPreferences({ email: checked })
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">Notification Frequency</h3>
            <Select
              value={preferences.frequency}
              onValueChange={(value: NotificationFrequency) =>
                setPreferences({ frequency: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="batched">Batched (every 5 minutes)</SelectItem>
                <SelectItem value="daily">Daily digest</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">Notification Categories</h3>
            <div className="space-y-2">
              {Object.entries(preferences.categories).map(([category, enabled]) => (
                <div
                  key={category}
                  className="flex items-center justify-between"
                >
                  <Label
                    htmlFor={`category-${category}`}
                    className="capitalize"
                  >
                    {category}
                  </Label>
                  <Switch
                    id={`category-${category}`}
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      setPreferences({
                        categories: {
                          ...preferences.categories,
                          [category]: checked,
                        },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Export hook for accessing preferences
export const useJournalResearchNotificationPreferences = () => {
  const store = useNotificationPreferencesStore()
  return {
    preferences: store.preferences,
    setPreferences: store.setPreferences,
    resetPreferences: store.resetPreferences,
  }
}

