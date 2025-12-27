import { Alert } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences'
import { NotificationChannel } from '@/lib/services/notification/NotificationService'
import { cn } from '@/lib/utils'

type NotificationFrequency = 'immediate' | 'batched' | 'daily' | 'weekly'

interface NotificationPreferencesProps {
  className?: string
}

export function NotificationPreferences({
  className,
}: NotificationPreferencesProps) {
  const {
    preferences,
    isLoading,
    error,
    updateChannel,
    updateFrequency,
    updateQuietHours,
    updateCategory,
  } = useNotificationPreferences()

  if (isLoading) {
    return (
      <Card className={cn('p-6', className)} aria-busy="true">
        <div className="space-y-6" role="status">
          <Skeleton className="h-6 w-1/3" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="error" className={className}>
        Failed to load notification preferences: {String(error)}
      </Alert>
    )
  }

  return (
    <Card className={cn('p-6', className)}>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Notification Channels</h2>
          <p className="text-sm text-muted-foreground">
            Choose how you want to receive notifications
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="in-app">In-app notifications</Label>
            <Switch
              id="in-app"
              checked={preferences.channels[NotificationChannel.IN_APP]}
              onCheckedChange={(checked) =>
                updateChannel(NotificationChannel.IN_APP, checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="email">Email notifications</Label>
            <Switch
              id="email"
              checked={preferences.channels[NotificationChannel.EMAIL]}
              onCheckedChange={(checked) =>
                updateChannel(NotificationChannel.EMAIL, checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="push">Push notifications</Label>
            <Switch
              id="push"
              checked={preferences.channels[NotificationChannel.PUSH]}
              onCheckedChange={(checked) =>
                updateChannel(NotificationChannel.PUSH, checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="sms">SMS notifications</Label>
            <Switch
              id="sms"
              checked={preferences.channels[NotificationChannel.SMS]}
              onCheckedChange={(checked) =>
                updateChannel(NotificationChannel.SMS, checked)
              }
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Notification Frequency</h2>
            <p className="text-sm text-muted-foreground">
              Choose how often you want to receive notifications
            </p>
          </div>

          <div className="space-y-2">
            <Label id="notification-frequency-label" htmlFor="notification-frequency">
              Notification Frequency
            </Label>
            <Select
              value={preferences.frequency}
              onValueChange={(value) =>
                updateFrequency(value as NotificationFrequency)
              }
              placeholder="Select frequency"
            >
              <SelectTrigger id="notification-frequency" aria-labelledby="notification-frequency-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="batched">Batched</SelectItem>
                <SelectItem value="daily">Daily digest</SelectItem>
                <SelectItem value="weekly">Weekly digest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Quiet Hours</h2>
            <p className="text-sm text-muted-foreground">
              Set hours during which notifications will be muted
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Switch
              id="quiet-hours"
              checked={preferences.quiet_hours.enabled}
              onCheckedChange={(checked) =>
                updateQuietHours({
                  ...preferences.quiet_hours,
                  enabled: checked,
                })
              }
            />

            <Label htmlFor="quiet-hours">Enable quiet hours</Label>
          </div>

          {preferences.quiet_hours.enabled && (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="start-time">Start time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={preferences.quiet_hours.start}
                  onChange={(e) =>
                    updateQuietHours({
                      ...preferences.quiet_hours,
                      start: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="end-time">End time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={preferences.quiet_hours.end}
                  onChange={(e) =>
                    updateQuietHours({
                      ...preferences.quiet_hours,
                      end: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Notification Categories</h2>
            <p className="text-sm text-muted-foreground">
              Choose which types of notifications you want to receive
            </p>
          </div>

          <div className="space-y-4">
            {Object.entries(preferences.categories).map(
              ([category, enabled]) => (
                <div
                  key={category}
                  className="flex items-center justify-between"
                >
                  <Label htmlFor={category} className="capitalize">
                    {category} notifications
                  </Label>
                  <Switch
                    id={category}
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      updateCategory(category, checked)
                    }
                  />
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
