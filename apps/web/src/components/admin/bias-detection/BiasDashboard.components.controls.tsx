/**
 * BiasDashboard.components.controls.tsx — presentational components extracted from
 * BiasDashboard.components.tsx. Pure components; no state, no effects, no API calls.
 */

import React from 'react'
import {
  AlertTriangle,
  Bell,
  Clock,
  Download,
  Filter,
  Mail,
  MessageSquare,
  RefreshCw,
  X,
} from 'lucide-react'
import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import {
  timeRangeOptions,
  demographicFilterOptions,
  type NotificationSettings,
} from './BiasDashboard.types'
import {
  type DateRange,
} from './BiasDashboard.helpers'

// 4. Header
// ---------------------------------------------------------------------------

export interface ConnectionStatusDisplay {
  text: string
  color: string
  icon: React.ReactNode
  pulse: boolean
}

export interface HeaderProps {
  isMobile: boolean
  lastUpdated: Date | null
  enableRealTimeUpdates: boolean
  connectionStatus: ConnectionStatusDisplay
  autoRefresh: boolean
  loading: boolean
  wsConnectionStatus: string
  showNotificationSettings: boolean
  onAutoRefreshChange: (value: boolean) => void
  onRefresh: () => void
  onReconnect: () => void
  onToggleNotificationSettings: () => void
  onToggleExportDialog: () => void
}

export const Header: React.FC<HeaderProps> = ({
  isMobile,
  lastUpdated,
  enableRealTimeUpdates,
  connectionStatus,
  autoRefresh,
  loading,
  wsConnectionStatus,
  showNotificationSettings,
  onAutoRefreshChange,
  onRefresh,
  onReconnect,
  onToggleNotificationSettings,
  onToggleExportDialog,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">Bias Detection Dashboard</h1>
        {lastUpdated && (
          <p className="text-muted-foreground flex items-center text-sm">
            <Clock className="mr-1 h-3 w-3" />
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        {/* Connection status */}
        <div className={`flex items-center space-x-1 ${connectionStatus.color}`}>
          {connectionStatus.icon}
          <span className="text-sm">
            {connectionStatus.text}
            {connectionStatus.pulse && (
              <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
            )}
          </span>
        </div>

        {/* Auto-refresh toggle */}
        {enableRealTimeUpdates && (
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => onAutoRefreshChange(!autoRefresh)}
            aria-label="Toggle auto-refresh"
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {!isMobile && 'Auto'}
          </Button>
        )}

        {/* Manual refresh */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh dashboard"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>

        {/* Reconnect */}
        {(wsConnectionStatus === 'error' || wsConnectionStatus === 'disconnected') && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReconnect}
            aria-label="Reconnect WebSocket"
          >
            <AlertTriangle className="h-4 w-4" />
          </Button>
        )}

        {/* Notification settings */}
        <Button
          variant={showNotificationSettings ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleNotificationSettings}
          aria-label="Notification settings"
        >
          <Bell className="h-4 w-4" />
        </Button>

        {/* Export */}
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleExportDialog}
          aria-label="Export dashboard data"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. NotificationSettingsPanel
// ---------------------------------------------------------------------------

export interface NotificationSettingsPanelProps {
  showNotificationSettings: boolean
  notificationSettings: NotificationSettings
  onUpdate: (settings: Partial<NotificationSettings>) => void
  onTestNotification: () => void
  onClose: () => void
}

export const NotificationSettingsPanel: React.FC<NotificationSettingsPanelProps> = ({
  showNotificationSettings,
  notificationSettings,
  onUpdate,
  onTestNotification,
  onClose,
}) => {
  if (!showNotificationSettings) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Bell className="mr-2 h-5 w-5" />
            Notification Settings
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Notification Channels */}
          <div>
            <h4 className="mb-3 font-semibold">Notification Channels</h4>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={notificationSettings.inAppEnabled}
                  onChange={(e) => onUpdate({ inAppEnabled: e.target.checked })}
                />
                <span className="text-sm">In-App Notifications</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={notificationSettings.emailEnabled}
                  onChange={(e) => onUpdate({ emailEnabled: e.target.checked })}
                />
                <Mail className="h-4 w-4" />
                <span className="text-sm">Email Notifications</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={notificationSettings.smsEnabled}
                  onChange={(e) => onUpdate({ smsEnabled: e.target.checked })}
                />
                <MessageSquare className="h-4 w-4" />
                <span className="text-sm">SMS Notifications</span>
              </label>
            </div>
          </div>

          {/* Alert Levels */}
          <div>
            <h4 className="mb-3 font-semibold">Alert Level Notifications</h4>
            <div className="space-y-2">
              {(['critical', 'high', 'medium', 'low'] as const).map((level) => (
                <label key={level} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={notificationSettings[`${level}Alerts` as keyof NotificationSettings] as boolean}
                    onChange={(e) =>
                      onUpdate({
                        [`${level}Alerts`]: e.target.checked,
                      } as Partial<NotificationSettings>)
                    }
                  />
                  <span className="text-sm capitalize">{level} Alerts</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onTestNotification}
            disabled={
              !notificationSettings.inAppEnabled &&
              !notificationSettings.emailEnabled &&
              !notificationSettings.smsEnabled
            }
          >
            <Bell className="mr-1 h-4 w-4" />
            Send Test Notification
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 7. FilteringControls
// ---------------------------------------------------------------------------

export interface FilteringControlsProps {
  selectedTimeRange: string
  setSelectedTimeRange: (value: string) => void
  customDateRange: DateRange
  setCustomDateRange: (range: DateRange) => void
  biasScoreFilter: string
  setBiasScoreFilter: (value: string) => void
  alertLevelFilter: string
  setAlertLevelFilter: (value: string) => void
  selectedDemographicFilter: string
  setSelectedDemographicFilter: (value: string) => void
  timeRangeOptions: typeof timeRangeOptions
  demographicFilterOptions: typeof demographicFilterOptions
  isAlertLevel: (value: unknown) => value is string
}

export const FilteringControls: React.FC<FilteringControlsProps> = ({
  selectedTimeRange,
  setSelectedTimeRange,
  customDateRange,
  setCustomDateRange,
  biasScoreFilter,
  setBiasScoreFilter,
  alertLevelFilter,
  setAlertLevelFilter,
  selectedDemographicFilter,
  setSelectedDemographicFilter,
  timeRangeOptions: timeOpts,
  demographicFilterOptions: demoOpts,
  isAlertLevel,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Filter className="mr-2 h-5 w-5" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Time Range */}
          <div>
            <label className="text-sm font-medium">Time Range</label>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="mt-1 block w-full rounded border p-2"
            >
              {timeOpts.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Date Range */}
          {selectedTimeRange === 'custom' && (
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Custom Date Range</label>
              <div className="mt-1 flex space-x-2">
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) =>
                    setCustomDateRange({ ...customDateRange, start: e.target.value })
                  }
                  className="rounded border p-1"
                />
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) =>
                    setCustomDateRange({ ...customDateRange, end: e.target.value })
                  }
                  className="rounded border p-1"
                />
              </div>
            </div>
          )}

          {/* Bias Score Level */}
          <div>
            <label className="text-sm font-medium">Bias Score Level</label>
            <select
              value={biasScoreFilter}
              onChange={(e) => setBiasScoreFilter(e.target.value)}
              className="mt-1 block w-full rounded border p-2"
            >
              <option value="all">All Levels</option>
              <option value="low">Low (&lt; 0.3)</option>
              <option value="medium">Medium (0.3 - 0.6)</option>
              <option value="high">High (&ge; 0.6)</option>
            </select>
          </div>

          {/* Alert Level */}
          <div>
            <label className="text-sm font-medium">Alert Level</label>
            <select
              value={alertLevelFilter}
              onChange={(e) => {
                if (isAlertLevel(e.target.value)) {
                  setAlertLevelFilter(e.target.value)
                }
              }}
              className="mt-1 block w-full rounded border p-2"
            >
              <option value="all">All Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Demographics */}
          <div>
            <label className="text-sm font-medium">Demographics</label>
            <select
              value={selectedDemographicFilter}
              onChange={(e) => setSelectedDemographicFilter(e.target.value)}
              className="mt-1 block w-full rounded border p-2"
            >
              {demoOpts.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTimeRange('24h')
                setBiasScoreFilter('all')
                setAlertLevelFilter('all')
                setSelectedDemographicFilter('all')
              }}
            >
              Clear All Filters
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
