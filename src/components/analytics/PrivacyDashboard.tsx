import { useState, useEffect } from 'react'
import { AnalyticsService } from '@/lib/analytics'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Slider } from '../ui/slider'
import { Button } from '@/components/ui/button'
import { Lock, Trash, RefreshCw } from 'lucide-react'

interface PrivacySettings {
  enabled: boolean
  differentialPrivacy: boolean
  privacyBudget: number
  anonymize: boolean
}

export function PrivacyDashboard() {
  const [settings, setSettings] = useState<PrivacySettings>({
    enabled: true,
    differentialPrivacy: true,
    privacyBudget: 1.0,
    anonymize: true,
  })
  const [eventCount, setEventCount] = useState(0)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const analytics = AnalyticsService.getInstance()

  useEffect(() => {
    // Load initial settings
    const events = analytics.getEvents()
    setEventCount(events.length)
    setLastSync(new Date())
  }, [analytics])

  const handleSettingChange = (
    key: keyof PrivacySettings,
    value: boolean | number,
  ) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)

    // Update analytics service config
    analytics.updateConfig({
      enabled: newSettings.enabled,
      differentialPrivacyEnabled: newSettings.differentialPrivacy,
      privacyBudget: newSettings.privacyBudget,
      anonymize: newSettings.anonymize,
    })
  }

  const handleClearData = async () => {
    analytics.clearEvents()
    setEventCount(0)
    setLastSync(new Date())
  }

  const handleRefresh = async () => {
    const events = analytics.getEvents()
    setEventCount(events.length)
    setLastSync(new Date())
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Privacy Controls
          </CardTitle>
          <CardDescription>
            Manage how your analytics data is collected and processed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Enable Analytics</h3>
              <p className="text-sm text-gray-500">
                Allow collection of anonymous usage data
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked: boolean) =>
                handleSettingChange('enabled', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Differential Privacy</h3>
              <p className="text-sm text-gray-500">
                Add noise to data to enhance privacy
              </p>
            </div>
            <Switch
              checked={settings.differentialPrivacy}
              onCheckedChange={(checked: boolean) =>
                handleSettingChange('differentialPrivacy', checked)
              }
            />
          </div>

          <div className="space-y-2">
            <div>
              <h3 className="font-medium">Privacy Budget</h3>
              <p className="text-sm text-gray-500">
                Control the balance between privacy and accuracy
              </p>
            </div>
            <Slider
              value={[settings.privacyBudget]}
              min={0.1}
              max={2.0}
              step={0.1}
              onValueChange={(values: number[]) =>
                handleSettingChange('privacyBudget', values[0] ?? settings.privacyBudget)
              }
            />

            <div className="flex justify-between text-sm text-gray-500">
              <span>More Private</span>
              <span>More Accurate</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Anonymize Data</h3>
              <p className="text-sm text-gray-500">
                Remove personally identifiable information
              </p>
            </div>
            <Switch
              checked={settings.anonymize}
              onCheckedChange={(checked: boolean) =>
                handleSettingChange('anonymize', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Collection Status</CardTitle>
          <CardDescription>
            Overview of collected analytics data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Events Collected</span>
              <span className="font-medium">{eventCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Last Updated</span>
              <span className="font-medium">
                {lastSync?.toLocaleTimeString() ?? 'Never'}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearData}
                className="flex items-center gap-2"
              >
                <Trash className="h-4 w-4" />
                Clear Data
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
