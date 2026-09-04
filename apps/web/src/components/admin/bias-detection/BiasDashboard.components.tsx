/**
 * BiasDashboard.components.tsx — Presentational components extracted from BiasDashboard.tsx
 * All components are pure/presentational — no state, no effects, no API calls.
 */

import React from 'react'
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  Check,

  Clock,
  Download,
  Eye,
  Filter,

  Mail,
  MessageSquare,
  RefreshCw,
  Users,
  X,
} from 'lucide-react'

import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Progress, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'

import {
  ResponsiveContainer,
  AreaChart,
  BarChart,
  PieChart,
  RadarChart,
  Area,
  Bar,
  Cell,
  Legend,
  Pie,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from '@/components/ui/LazyChart'

import type {
  AlertAction,
  AlertItem,
  BiasAnalysisItem,
  DashboardRecommendation,
  NotificationSettings,
  TooltipProps,
} from './BiasDashboard.types'
import { timeRangeOptions, demographicFilterOptions } from './BiasDashboard.types'
import type { BiasDashboardData } from '@/lib/ai/bias-detection'
import { getAlertColor, getBiasScoreColor, getChartColors, getResponsiveChartHeight, getResponsiveGridCols } from './BiasDashboard.helpers'
import type { DateRange, FilterParams } from './BiasDashboard.helpers'

// ---------------------------------------------------------------------------
// 1. CustomTooltip
// ---------------------------------------------------------------------------

export const CustomTooltip: React.FC<TooltipProps> = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border-gray-200 rounded-lg border p-3 shadow-lg">
        <p className="font-medium">{`${label}`}</p>
        {payload.map((entry) => (
          <p key={`${entry.name}-${entry.value}`} style={{ color: entry.color }}>
            {`${entry.name}: ${entry.value}${entry.payload?.percent ? ` (${entry.payload.percent}%)` : ''}`}
          </p>
        ))}
      </div>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// 2. HighBiasAlertNotification
// ---------------------------------------------------------------------------

interface HighBiasAlertNotificationProps {
  newHighBiasAlert: AlertItem | null
  onDismiss: () => void
}

export const HighBiasAlertNotification: React.FC<HighBiasAlertNotificationProps> = ({ newHighBiasAlert, onDismiss }) => {
  if (!newHighBiasAlert) return null
  return (
    <div
      role="alert"
      className="border-destructive/20 bg-destructive/10 flex items-start justify-between rounded-lg border p-4"
    >
      <div className="flex items-start space-x-3">
        <AlertTriangle className="text-destructive mt-0.5 h-5 w-5" />
        <div>
          <p className="font-semibold">
            High Bias Alert: {newHighBiasAlert.type}
          </p>
          <p className="text-muted-foreground text-sm">
            {newHighBiasAlert.message}
          </p>
          {newHighBiasAlert.sessionId && (
            <p className="text-muted-foreground mt-1 text-xs">
              Session: {newHighBiasAlert.sessionId}
            </p>
          )}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. AccessibilitySkipLinks
// ---------------------------------------------------------------------------

interface AccessibilitySkipLinksProps {
  skipLinkRef: React.RefObject<HTMLButtonElement | null>
  mainContentRef: React.RefObject<HTMLDivElement | null>
  announceToScreenReader: (message: string) => void
  announcements: string[]
}

export const AccessibilitySkipLinks: React.FC<AccessibilitySkipLinksProps> = ({
  skipLinkRef,
  mainContentRef,
  announceToScreenReader,
  announcements,
}) => {
  return (
    <>
      {/* Skip Links */}
      <div className="sr-only">
        <button
          ref={skipLinkRef}
          onClick={() => mainContentRef.current?.focus()}
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to main content (Alt+M)
        </button>
        <button
          onClick={() => announceToScreenReader('Alerts section')}
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to alerts (Alt+A)
        </button>
      </div>

      {/* Screen Reader Announcements */}
      {announcements.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {announcements.join('. ')}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// 4. Header
// ---------------------------------------------------------------------------

interface ConnectionStatusDisplay {
  text: string
  color: string
  icon: React.ReactNode
  pulse: boolean
}

interface HeaderProps {
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

interface NotificationSettingsPanelProps {
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
// 6. ExportDialog
// ---------------------------------------------------------------------------

interface ExportDialogProps {
  showExportDialog: boolean
  exportFormat: string
  setExportFormat: (format: string) => void
  exportDateRange: DateRange
  setExportDateRange: (range: DateRange) => void
  exportDataTypes: Record<string, boolean>
  setExportDataTypes: (types: Record<string, boolean>) => void
  exportFilters: {
    applyCurrentFilters: boolean
    includeArchived: boolean
    minBiasScore: number
    maxBiasScore: number
  }
  setExportFilters: (filters: ExportDialogProps['exportFilters']) => void
  exportProgress: { isExporting: boolean; progress: number; status: string }
  isExportFormat: (value: unknown) => value is 'json' | 'csv' | 'pdf'
  onExport: () => void
  onClose: () => void
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  showExportDialog,
  exportFormat,
  setExportFormat,
  exportDateRange,
  setExportDateRange,
  exportDataTypes,
  setExportDataTypes,
  exportFilters,
  setExportFilters,
  exportProgress,
  isExportFormat,
  onExport,
  onClose,
}) => {
  if (!showExportDialog) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Download className="mr-2 h-5 w-5" />
            Export Dashboard Data
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={exportProgress.isExporting}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Export Format */}
        <div>
          <h4 className="mb-2 font-semibold">Export Format</h4>
          <div className="flex space-x-4">
            {(['json', 'csv', 'pdf'] as const).map((fmt) => (
              <label key={fmt} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="exportFormat"
                  value={fmt}
                  checked={exportFormat === fmt}
                  onChange={(e) => {
                    if (isExportFormat(e.target.value)) {
                      setExportFormat(e.target.value)
                    }
                  }}
                />
                <span className="text-sm uppercase">{fmt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <h4 className="mb-2 font-semibold">Date Range</h4>
          <div className="flex space-x-4">
            <div>
              <label className="text-sm">Start Date</label>
              <input
                type="date"
                value={exportDateRange.start}
                onChange={(e) =>
                  setExportDateRange({ ...exportDateRange, start: e.target.value })
                }
                className="block rounded border p-1"
              />
            </div>
            <div>
              <label className="text-sm">End Date</label>
              <input
                type="date"
                value={exportDateRange.end}
                onChange={(e) =>
                  setExportDateRange({ ...exportDateRange, end: e.target.value })
                }
                className="block rounded border p-1"
              />
            </div>
          </div>
        </div>

        {/* Data Types */}
        <div>
          <h4 className="mb-2 font-semibold">Data Types to Export</h4>
          <div className="grid grid-cols-2 gap-2">
            {['summary', 'alerts', 'trends', 'demographics', 'sessions', 'recommendations'].map(
              (type) => (
                <label key={type} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={exportDataTypes[type] ?? false}
                    onChange={(e) =>
                      setExportDataTypes({
                        ...exportDataTypes,
                        [type]: e.target.checked,
                      })
                    }
                  />
                  <span className="text-sm capitalize">{type}</span>
                </label>
              ),
            )}
          </div>
        </div>

        {/* Export Filters */}
        <div>
          <h4 className="mb-2 font-semibold">Export Options</h4>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={exportFilters.applyCurrentFilters}
                onChange={(e) =>
                  setExportFilters({ ...exportFilters, applyCurrentFilters: e.target.checked })
                }
              />
              <span className="text-sm">Apply current dashboard filters</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={exportFilters.includeArchived}
                onChange={(e) =>
                  setExportFilters({ ...exportFilters, includeArchived: e.target.checked })
                }
              />
              <span className="text-sm">Include archived data</span>
            </label>
            <div className="flex space-x-4">
              <div>
                <label className="text-sm">Min Bias Score</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={exportFilters.minBiasScore}
                  onChange={(e) =>
                    setExportFilters({
                      ...exportFilters,
                      minBiasScore: Number(e.target.value),
                    })
                  }
                  className="block w-20 rounded border p-1"
                />
              </div>
              <div>
                <label className="text-sm">Max Bias Score</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={exportFilters.maxBiasScore}
                  onChange={(e) =>
                    setExportFilters({
                      ...exportFilters,
                      maxBiasScore: Number(e.target.value),
                    })
                  }
                  className="block w-20 rounded border p-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        {exportProgress.isExporting && (
          <div>
            <Progress value={exportProgress.progress} className="w-full" />
            <p className="text-muted-foreground mt-1 text-sm">{exportProgress.status}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={exportProgress.isExporting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onExport}
            disabled={
              exportProgress.isExporting ||
              !Object.values(exportDataTypes).some((v) => v)
            }
          >
            <Download className="mr-1 h-4 w-4" />
            Export as {exportFormat.toUpperCase()}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 7. FilteringControls
// ---------------------------------------------------------------------------

interface FilteringControlsProps {
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
// 8. CriticalAlerts
// ---------------------------------------------------------------------------

interface CriticalAlertsProps {
  filteredAlerts: AlertItem[]
}

export const CriticalAlerts: React.FC<CriticalAlertsProps> = ({ filteredAlerts }) => {
  const criticalHigh = filteredAlerts.filter(
    (a) => a.level === 'critical' || a.level === 'high',
  )
  if (criticalHigh.length === 0) return null

  return (
    <Alert variant="error">
      <AlertTriangle className="h-4 w-4" />
      <div>
        <p className="font-semibold">
          {criticalHigh.length} Critical/High Alert{criticalHigh.length > 1 ? 's' : ''}
        </p>
        <p className="text-sm">
          {criticalHigh.map((a) => a.type).join(', ')}
        </p>
      </div>
    </Alert>
  )
}

// ---------------------------------------------------------------------------
// 9. SummaryCards
// ---------------------------------------------------------------------------

interface SummaryCardsProps {
  summary: BiasDashboardData['summary']
  filteredSessions: BiasAnalysisItem[]
  filteredAlerts: AlertItem[]
  alerts: AlertItem[]
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  filteredSessions,
  filteredAlerts,
  alerts,
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Sessions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Total Sessions</p>
              <p className="text-2xl font-bold">{summary?.totalSessions ?? 0}</p>
            </div>
            <Users className="text-primary h-8 w-8" />
          </div>
        </CardContent>
      </Card>

      {/* Average Bias Score */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Average Bias Score</p>
              <p
                className={`text-2xl font-bold ${getBiasScoreColor(summary?.averageBiasScore ?? 0)}`}
              >
                {((summary?.averageBiasScore ?? 0) * 100).toFixed(1)}%
              </p>
              <Progress
                value={(summary?.averageBiasScore ?? 0) * 100}
                className="mt-1 h-1"
              />
            </div>
            <BarChart3 className="text-primary h-8 w-8" />
          </div>
        </CardContent>
      </Card>

      {/* Filtered Alerts */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Filtered Alerts</p>
              <p className="text-2xl font-bold">{filteredAlerts.length}</p>
              <p className="text-muted-foreground text-xs">
                of {alerts.length} total
              </p>
            </div>
            <AlertTriangle className="text-primary h-8 w-8" />
          </div>
        </CardContent>
      </Card>

      {/* Compliance Score */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Compliance Score</p>
              <p className="text-2xl font-bold">
                {((summary?.complianceScore ?? 0) * 100).toFixed(0)}%
              </p>
              <Progress
                value={(summary?.complianceScore ?? 0) * 100}
                className="mt-1 h-1"
              />
            </div>
            <Eye className="text-primary h-8 w-8" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 10. TrendsTab
// ---------------------------------------------------------------------------

interface TrendsTabProps {
  filteredTrends: Array<{ date: string; biasScore: number; sessionCount: number; alertCount: number }>
  reducedMotion: boolean
  isMobile: boolean
  isTablet: boolean
}

export const TrendsTab: React.FC<TrendsTabProps> = ({
  filteredTrends,
  reducedMotion,
  isMobile,
  isTablet,
}) => {
  const chartHeight = getResponsiveChartHeight(isMobile, isTablet)
  const gridCols = getResponsiveGridCols(2, isMobile, isTablet)

  return (
    <TabsContent value="trends" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            Bias Score Trends ({filteredTrends.length} data points)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={filteredTrends}>
              <defs>
                <linearGradient id="biasScoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string | number) =>
                  new Date(value).toLocaleDateString()
                }
              />
              <YAxis domain={[0, 1]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <ReferenceLine y={0.3} stroke="#f59e0b" strokeDasharray="3 3" label="Warning" />
              <ReferenceLine y={0.6} stroke="#ef4444" strokeDasharray="3 3" label="High" />
              <Area
                type="monotone"
                dataKey="biasScore"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#biasScoreGradient)"
                animationDuration={reducedMotion ? 0 : 1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div
        className={`grid grid-cols-1 ${gridCols === 2 ? 'lg:grid-cols-2' : ''} gap-6`}
      >
        <Card>
          <CardHeader>
            <CardTitle>Session Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={chartHeight - 100}>
              <BarChart data={filteredTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string | number) =>
                    new Date(value).toLocaleDateString()
                  }
                />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="sessionCount"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  animationDuration={reducedMotion ? 0 : 1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alert Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={chartHeight - 100}>
              <BarChart data={filteredTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string | number) =>
                    new Date(value).toLocaleDateString()
                  }
                />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="alertCount"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  animationDuration={reducedMotion ? 0 : 1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Radar Chart for Bias Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Bias Metrics Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RadarChart
              data={[
                { metric: 'Gender', value: 0.3 },
                { metric: 'Age', value: 0.4 },
                { metric: 'Ethnicity', value: 0.2 },
                { metric: 'Language', value: 0.5 },
                { metric: 'Cultural', value: 0.3 },
                { metric: 'Socioeconomic', value: 0.4 },
              ]}
            >
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={30} domain={[0, 1]} />
              <Radar
                name="Bias Score"
                dataKey="value"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.6}
                animationDuration={reducedMotion ? 0 : 1000}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </TabsContent>
  )
}

// ---------------------------------------------------------------------------
// 11. DemographicsTab
// ---------------------------------------------------------------------------

interface DemographicsTabProps {
  demographics: BiasDashboardData['demographics']
}

export const DemographicsTab: React.FC<DemographicsTabProps> = ({ demographics }) => {
  return (
    <TabsContent value="demographics" className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Age Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Age Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={Object.entries(demographics?.age ?? {}).map(([age, count]) => ({
                    name: age,
                    value: count,
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }: { name: string; percent?: number }) =>
                    `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
                  }
                  animationDuration={1000}
                  animationBegin={0}
                >
                  {Object.entries(demographics?.age ?? {}).map(([age, count], index) => (
                    <Cell
                      key={`age-${age}-${String(count)}`}
                      fill={getChartColors(index, Object.keys(demographics?.age ?? {}).length)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({
                    active,
                    payload,
                  }: {
                    active?: boolean
                    payload?: Array<{ name?: string; value?: number; percent?: number }>
                  }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white rounded border p-2 shadow">
                          <p className="font-semibold">{payload[0]?.name}</p>
                          <p>Count: {payload[0]?.value}</p>
                          <p>
                            Percentage: {payload[0]?.percent
                              ? (payload[0].percent * 100).toFixed(1)
                              : 0}
                            %
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gender Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Gender Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={Object.entries(demographics?.gender ?? {}).map(([gender, count]) => ({
                    name: gender,
                    value: count,
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#82ca9d"
                  dataKey="value"
                  label={({ name, percent }: { name: string; percent?: number }) =>
                    `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
                  }
                  animationDuration={1000}
                  animationBegin={0}
                >
                  {Object.entries(demographics?.gender ?? {}).map(([gender, count], index) => (
                    <Cell
                      key={`gender-${gender}-${String(count)}`}
                      fill={getChartColors(index, Object.keys(demographics?.gender ?? {}).length)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({
                    active,
                    payload,
                  }: {
                    active?: boolean
                    payload?: Array<{ name?: string; value?: number; percent?: number }>
                  }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white rounded border p-2 shadow">
                          <p className="font-semibold">{payload[0]?.name}</p>
                          <p>Count: {payload[0]?.value}</p>
                          <p>
                            Percentage: {payload[0]?.percent
                              ? (payload[0].percent * 100).toFixed(1)
                              : 0}
                            %
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ethnicity Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Ethnicity Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={Object.entries(demographics?.ethnicity ?? {}).map(([ethnicity, count]) => ({
                ethnicity,
                count,
              }))}
              layout="horizontal"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="ethnicity" type="category" width={100} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="count"
                fill="#8884d8"
                radius={[0, 4, 4, 0]}
                animationDuration={1000}
                animationBegin={0}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </TabsContent>
  )
}

// ---------------------------------------------------------------------------
// 12. AlertsTab
// ---------------------------------------------------------------------------

interface AlertsTabProps {
  filteredAlerts: AlertItem[]
  alerts: AlertItem[]
  selectedAlerts: Set<string>
  alertActions: Map<string, AlertAction[]>
  alertNotes: Map<string, string>
  onAlertAction: (alertId: string, action: string, notes?: string) => Promise<void>
  onBulkAlertAction: (alertIds: string[], action: string) => Promise<void>
  onToggleAlertSelection: (alertId: string) => void
  onSelectAllAlerts: () => void
  onClearAlertSelection: () => void
  onSetAlertLevelFilter: (value: string) => void
  onSetSelectedTimeRange: (value: string) => void
  onSetAlertNotes: (updater: (prev: Map<string, string>) => Map<string, string>) => void
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
  filteredAlerts,
  alerts,
  selectedAlerts,
  alertActions,
  alertNotes,
  onAlertAction,
  onBulkAlertAction,
  onToggleAlertSelection,
  onSelectAllAlerts,
  onClearAlertSelection,
  onSetAlertLevelFilter,
  onSetSelectedTimeRange,
  onSetAlertNotes,
}) => {
  return (
    <TabsContent value="alerts" className="space-y-4">
      {/* Alert Management Controls */}
      {filteredAlerts.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={
                      selectedAlerts.size === filteredAlerts.length &&
                      filteredAlerts.length > 0
                    }
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      e.target.checked ? onSelectAllAlerts() : onClearAlertSelection()
                    }
                    className="rounded"
                  />
                  <span className="text-sm">
                    {selectedAlerts.size > 0
                      ? `${selectedAlerts.size} selected`
                      : 'Select all'}
                  </span>
                </label>

                {selectedAlerts.size > 0 && (
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () =>
                        onBulkAlertAction(Array.from(selectedAlerts), 'acknowledge')
                      }
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Acknowledge
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () =>
                        onBulkAlertAction(Array.from(selectedAlerts), 'dismiss')
                      }
                    >
                      <X className="mr-1 h-4 w-4" />
                      Dismiss
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () =>
                        onBulkAlertAction(Array.from(selectedAlerts), 'archive')
                      }
                    >
                      <Archive className="mr-1 h-4 w-4" />
                      Archive
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Badge variant="secondary">{filteredAlerts.length} alerts</Badge>
                <Badge variant="destructive">
                  {
                    filteredAlerts.filter(
                      (a: AlertItem) => a.level === 'critical' || a.level === 'high',
                    ).length
                  }{' '}
                  high priority
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {alerts.length === 0 ? 'No active alerts' : 'No alerts match current filters'}
            </p>
            {alerts.length > 0 && filteredAlerts.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  onSetAlertLevelFilter('all')
                  onSetSelectedTimeRange('24h')
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        filteredAlerts.map((alert: AlertItem) => {
          const isSelected = selectedAlerts.has(alert.alertId)
          const actions = alertActions.get(alert.alertId) ?? []
          const lastAction = actions[actions.length - 1]

          return (
            <Card key={alert.alertId} className={isSelected ? 'ring-blue-500 ring-2' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleAlertSelection(alert.alertId)}
                    className="mt-1 rounded"
                  />

                  {/* Alert Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <Badge className={`${getAlertColor(alert.level)} text-white`}>
                          {alert.level?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                        <div>
                          <h4 className="font-semibold">{alert.type}</h4>
                          <p className="text-muted-foreground mt-1 text-sm">{alert.message}</p>
                          <p className="text-muted-foreground mt-2 text-xs">
                            Session: {alert.sessionId} •{' '}
                            {alert.timestamp
                              ? new Date(alert.timestamp).toLocaleString()
                              : 'Unknown time'}
                          </p>

                          {/* Alert Status */}
                          {lastAction && (
                            <div className="mt-2 flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs">
                                {lastAction.type === 'acknowledge' && (
                                  <Check className="mr-1 h-3 w-3" />
                                )}
                                {lastAction.type === 'dismiss' && (
                                  <X className="mr-1 h-3 w-3" />
                                )}
                                {lastAction.type === 'archive' && (
                                  <Archive className="mr-1 h-3 w-3" />
                                )}
                                {lastAction.type === 'escalate' && (
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                )}
                                {lastAction.type.charAt(0).toUpperCase() +
                                  lastAction.type.slice(1)}
                              </Badge>
                              <span className="text-muted-foreground text-xs">
                                {new Date(lastAction.timestamp).toLocaleString()}
                              </span>
                            </div>
                          )}

                          {/* Alert Notes */}
                          {alertNotes.has(alert.alertId) && (
                            <div className="bg-muted mt-2 rounded p-2 text-sm">
                              <strong>Notes:</strong> {alertNotes.get(alert.alertId)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                        {!alert.acknowledged && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () =>
                                onAlertAction(alert.alertId, 'acknowledge')
                              }
                            >
                              <Check className="mr-1 h-4 w-4" />
                              Acknowledge
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const notes = prompt('Add notes (optional):')
                                void onAlertAction(
                                  alert.alertId,
                                  'escalate',
                                  notes ?? undefined,
                                )
                              }}
                            >
                              <AlertTriangle className="mr-1 h-4 w-4" />
                              Escalate
                            </Button>
                          </>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const notes = prompt('Add notes (optional):')
                            if (notes) {
                              onSetAlertNotes(
                                (prev) => new Map(prev.set(alert.alertId, notes)),
                              )
                            }
                          }}
                        >
                          <MessageSquare className="mr-1 h-4 w-4" />
                          Note
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => onAlertAction(alert.alertId, 'dismiss')}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Dismiss
                        </Button>
                      </div>
                    </div>

                    {/* Action History */}
                    {actions.length > 0 && (
                      <div className="mt-3 border-t pt-3">
                        <details className="text-sm">
                          <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                            Action History ({actions.length})
                          </summary>
                          <div className="mt-2 space-y-1">
                            {actions.map((action) => (
                              <div
                                key={action.id}
                                className="flex items-center justify-between text-xs"
                              >
                                <span>
                                  {action.type.charAt(0).toUpperCase() + action.type.slice(1)}
                                  {action.notes && ` - ${action.notes}`}
                                </span>
                                <span className="text-muted-foreground">
                                  {new Date(action.timestamp).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </TabsContent>
  )
}

// ---------------------------------------------------------------------------
// 13. SessionsTab
// ---------------------------------------------------------------------------

interface SessionsTabProps {
  filteredSessions: BiasAnalysisItem[]
  recentAnalyses: BiasAnalysisItem[]
  onSetBiasScoreFilter: (value: string) => void
  onSetSelectedTimeRange: (value: string) => void
}

export const SessionsTab: React.FC<SessionsTabProps> = ({
  filteredSessions,
  recentAnalyses,
  onSetBiasScoreFilter,
  onSetSelectedTimeRange,
}) => {
  return (
    <TabsContent value="sessions" className="space-y-4">
      {filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {recentAnalyses.length === 0 ? 'No recent sessions' : 'No sessions match current filters'}
            </p>
            {recentAnalyses.length > 0 && filteredSessions.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  onSetBiasScoreFilter('all')
                  onSetSelectedTimeRange('24h')
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        filteredSessions.map((analysis: BiasAnalysisItem) => (
          <Card key={analysis['sessionId']}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Session {analysis['sessionId']}</h4>
                  <div className="mt-2 flex items-center space-x-4">
                    <span
                      className={`text-sm font-medium ${getBiasScoreColor(analysis.overallBiasScore)}`}
                    >
                      Bias Score: {(analysis.overallBiasScore * 100).toFixed(1)}%
                    </span>
                    <Badge
                      variant={analysis.alertLevel === 'low' ? 'secondary' : 'destructive'}
                    >
                      {analysis.alertLevel}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-sm">
                    {analysis.timestamp
                      ? new Date(analysis.timestamp).toLocaleString()
                      : 'Unknown time'}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    aria-label={`View details for session ${analysis['sessionId']}`}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </TabsContent>
  )
}

// ---------------------------------------------------------------------------
// 14. RecommendationsTab
// ---------------------------------------------------------------------------

interface RecommendationsTabProps {
  recommendations: DashboardRecommendation[]
}

export const RecommendationsTab: React.FC<RecommendationsTabProps> = ({ recommendations }) => {
  return (
    <TabsContent value="recommendations" className="space-y-4">
      {recommendations?.length > 0 ? (
        recommendations.map((rec: DashboardRecommendation) => (
          <Card key={rec.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center space-x-2">
                    <Badge
                      variant={rec.priority === 'critical' ? 'destructive' : 'secondary'}
                    >
                      {rec.priority}
                    </Badge>
                    <h4 className="font-semibold">{rec.title}</h4>
                  </div>
                  <p className="text-muted-foreground mb-3 text-sm">{rec.description}</p>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`View details for recommendation: ${rec.title}`}
                    >
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      aria-label={`Implement recommendation: ${rec.title}`}
                    >
                      Implement
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No recommendations available</p>
          </CardContent>
        </Card>
      )}
    </TabsContent>
  )
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export type {
  HighBiasAlertNotificationProps,
  AccessibilitySkipLinksProps,
  HeaderProps,
  ConnectionStatusDisplay,
  NotificationSettingsPanelProps,
  ExportDialogProps,
  FilteringControlsProps,
  CriticalAlertsProps,
  SummaryCardsProps,
  TrendsTabProps,
  DemographicsTabProps,
  AlertsTabProps,
  SessionsTabProps,
  RecommendationsTabProps,
}
