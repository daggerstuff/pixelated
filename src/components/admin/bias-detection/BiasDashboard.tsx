/**
 * Bias Detection Dashboard Component
 *
 * Provides real-time monitoring and analytics for bias detection in therapeutic training sessions.
 * Features bias metrics, alerts, trends, and demographic analysis.
 *
 * Accessibility Features:
 * - ARIA labels and descriptions for all interactive elements
 * - Keyboard navigation support
 * - Screen reader friendly content
 * - High contrast support
 * - Focus management
 *
 * Responsive Design:
 * - Mobile-first approach with breakpoint-specific layouts
 * - Flexible grid systems that adapt to screen size
 * - Touch-friendly interface elements
 * - Optimized chart rendering for different screen sizes
 */

import type React from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'

// Lazy load the charts component to reduce initial bundle size
// const BiasCharts = lazy(() => import('./BiasCharts').then(module => ({ default: module.BiasCharts })));
// Note: Removing lazy import as it's currently commented out

// Lazy load the charts component to reduce initial bundle size
// const _BiasCharts = lazy(() => import('./BiasCharts').then(module => ({ default: module.BiasCharts })));
// Note: Removing lazy import as it's currently commented out
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert } from '@/components/ui/alert'
// Use lazy-loaded chart components to reduce bundle size
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from '@/components/ui/LazyChart'
import {
  AlertTriangle,
  Users,
  Eye,
  Download,
  RefreshCw,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Calendar,
  Clock,
  Bell,
  Check,
  X,
  Mail,
  MessageSquare,
  Archive,
  AlertCircle,
  Info,
  CheckCircle,
} from 'lucide-react'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import type {
  BiasDashboardData,
  BiasAnalysisResult,
  DashboardRecommendation,
  BiasAlert,
  BiasDashboardSummary,
} from '@/lib/ai/bias-detection'

const logger = createBuildSafeLogger('bias-dashboard')

interface BiasDashboardProps {
  className?: string
  refreshInterval?: number // milliseconds
  enableRealTimeUpdates?: boolean
}

// Notification types
interface NotificationSettings {
  emailEnabled: boolean
  smsEnabled: boolean
  inAppEnabled: boolean
  criticalAlerts: boolean
  highAlerts: boolean
  mediumAlerts: boolean
  lowAlerts: boolean
}

interface AlertAction {
  id: string
  type: 'acknowledge' | 'dismiss' | 'escalate' | 'archive'
  timestamp: string
  userId?: string
  notes?: string
}

// Extended WebSocket interface for heartbeat
interface ExtendedWebSocket extends WebSocket {
  heartbeatInterval?: ReturnType<typeof setInterval>
}

// Type for filtered data
interface BaseFilterableItem {
  timestamp?: string | Date
  date?: string | Date
}

interface BiasAnalysisItem extends BaseFilterableItem {
  sessionId: string
  overallBiasScore: number
  alertLevel: string
}

interface AlertItem extends BaseFilterableItem {
  alertId: string
  type: string
  message: string
  level: string
  sessionId: string
  acknowledged?: boolean
  status?: string
}

// WebSocket message types (currently unused - defined for future real-time features)
// type WebSocketMessage =
//   | { type: 'bias_alert'; alert: AlertItem }
//   | { type: 'session_update'; session: BiasAnalysisResult }
//   | { type: 'metrics_update'; metrics: Partial<BiasDashboardData['summary']> }
//   | { type: 'trends_update'; trends: TrendItem[] }
//   | { type: 'connection_status'; status: string; error?: string }
//   | { type: 'heartbeat' }
//   | { type: 'heartbeat_response' }

interface TrendItem extends BaseFilterableItem {
  biasScore: number
  sessionCount: number
  alertCount: number
}

type FilterableData = Array<
  BaseFilterableItem | BiasAnalysisItem | AlertItem | TrendItem
>

// Tooltip props type
interface TooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    color: string
    payload: {
      percent: number
    }
  }>
  label?: string
}

export const BiasDashboard: React.FC<BiasDashboardProps> = ({
  className = '',
  refreshInterval = 30000, // 30 seconds
  enableRealTimeUpdates = true,
}) => {
  // State management
  const [dashboardData, setDashboardData] = useState<BiasDashboardData | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h')
  const [selectedDemographicFilter, setSelectedDemographicFilter] =
    useState('all')
  const [autoRefresh, setAutoRefresh] = useState(enableRealTimeUpdates)
  const [, setWsConnected] = useState(false)
  const [wsConnectionStatus, setWsConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting'
  >('disconnected')
  const [wsReconnectAttempts, setWsReconnectAttempts] = useState(0)
  const wsRef = useRef<ExtendedWebSocket | null>(null)

  // Filtering state
  const [biasScoreFilter, setBiasScoreFilter] = useState<
    'all' | 'low' | 'medium' | 'high'
  >('all')
  const [alertLevelFilter, setAlertLevelFilter] = useState<
    'all' | 'low' | 'medium' | 'high' | 'critical'
  >('all')
  const [customDateRange, setCustomDateRange] = useState<{
    start: string
    end: string
  }>({
    start:
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0] || '', // 7 days ago
    end: new Date().toISOString().split('T')[0] || '', // today
  })

  // Alert management state
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>({
      emailEnabled: true,
      smsEnabled: false,
      inAppEnabled: true,
      criticalAlerts: true,
      highAlerts: true,
      mediumAlerts: true,
      lowAlerts: false,
    })
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set())
  const [alertActions, setAlertActions] = useState<Map<string, AlertAction[]>>(
    new Map(),
  )
  const [showNotificationSettings, setShowNotificationSettings] =
    useState(false)
  const [alertNotes, setAlertNotes] = useState<Map<string, string>>(new Map())

  // Data export state
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>(
    'json',
  )
  const [exportDateRange, setExportDateRange] = useState<{
    start: string
    end: string
  }>({
    start:
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0] || '', // 7 days ago
    end: new Date().toISOString().split('T')[0] || '', // today
  })
  const [exportDataTypes, setExportDataTypes] = useState({
    summary: true,
    alerts: true,
    trends: true,
    demographics: true,
    sessions: true,
    recommendations: false,
  })
  const [exportFilters, setExportFilters] = useState({
    applyCurrentFilters: true,
    includeArchived: false,
    minBiasScore: 0,
    maxBiasScore: 1,
  })
  const [exportProgress, setExportProgress] = useState<{
    isExporting: boolean
    progress: number
    status: string
  }>({
    isExporting: false,
    progress: 0,
    status: '',
  })

  // Responsive design state
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const [, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')

  // Accessibility state
  const [highContrast, setHighContrast] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [announcements, setAnnouncements] = useState<string[]>([])
  // State for new high/critical bias alert notification
  const [newHighBiasAlert, setNewHighBiasAlert] = useState<AlertItem | null>(
    null,
  )

  // Focus management refs
  const skipLinkRef = useRef<HTMLButtonElement>(null)
  const mainContentRef = useRef<HTMLDivElement>(null)

  // Time range options
  const timeRangeOptions = [
    { value: '1h', label: 'Last Hour' },
    { value: '6h', label: 'Last 6 Hours' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'custom', label: 'Custom Range' },
  ]

  // Demographic filter options
  const demographicFilterOptions = [
    { value: 'all', label: 'All Demographics' },
    { value: 'age', label: 'Filter by Age' },
    { value: 'gender', label: 'Filter by Gender' },
    { value: 'ethnicity', label: 'Filter by Ethnicity' },
  ]

  // Accessibility helpers
  const announceToScreenReader = useCallback((message: string) => {
    setAnnouncements((prev) => [...prev, message])
    // Remove announcement after 5 seconds to prevent accumulation
    setTimeout(() => {
      setAnnouncements((prev) => prev.slice(1))
    }, 5000)
  }, [])

  const checkAccessibilityPreferences = useCallback(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    setReducedMotion(prefersReducedMotion)

    // Check for high contrast preference
    const prefersHighContrast = window.matchMedia(
      '(prefers-contrast: high)',
    ).matches
    setHighContrast(prefersHighContrast)
  }, [])

  // Responsive design helpers
  const updateScreenSize = useCallback(() => {
    const width = window.innerWidth
    const newIsMobile = width < 768
    const newIsTablet = width >= 768 && width < 1024
    const newScreenSize: 'mobile' | 'tablet' | 'desktop' = newIsMobile
      ? 'mobile'
      : newIsTablet
        ? 'tablet'
        : 'desktop'

    setIsMobile(newIsMobile)
    setIsTablet(newIsTablet)
    setScreenSize(newScreenSize)
  }, [])

  // Keyboard navigation helpers
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Skip to main content with Alt+M
      if (event.altKey && event.key === 'm') {
        event.preventDefault()
        mainContentRef.current?.focus()
        announceToScreenReader('Jumped to main content')
      }

      // Skip to alerts with Alt+A (we'll use programmatic tab switching)
      if (event.altKey && event.key === 'a') {
        event.preventDefault()
        // We can add tab switching logic here if needed
        announceToScreenReader('Jumped to alerts section')
      }

      // Escape key to close dialogs
      if (event.key === 'Escape') {
        if (showExportDialog) {
          setShowExportDialog(false)
          announceToScreenReader('Export dialog closed')
        }
        if (showNotificationSettings) {
          setShowNotificationSettings(false)
          announceToScreenReader('Notification settings closed')
        }
      }
    },
    [showExportDialog, showNotificationSettings, announceToScreenReader],
  )

  // Filter functions
  const filterDataByTimeRange = useCallback(
    (data: FilterableData, timeRange: string) => {
      if (!data || data.length === 0) {
        return data
      }

      const now = new Date()
      let startTime: Date

      switch (timeRange) {
        case '1h': {
          startTime = new Date(now.getTime() - 60 * 60 * 1000)
          break
        }
        case '6h': {
          startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000)
          break
        }
        case '24h': {
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        }
        case '7d': {
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        }
        case '30d': {
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        }
        case '90d': {
          startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        }
        case 'custom': {
          if (customDateRange.start) {
            startTime = new Date(customDateRange.start)
          } else {
            return data
          }
          break
        }
        default: {
          return data
        }
      }

      const endTime =
        timeRange === 'custom' && customDateRange.end
          ? new Date(customDateRange.end)
          : now

      return data.filter((item) => {
        const itemDate = new Date(item.timestamp || item.date || '')
        return itemDate >= startTime && itemDate <= endTime
      })
    },
    [customDateRange],
  )

  const filterDataByBiasScore = useCallback(
    (data: FilterableData, filter: string) => {
      if (filter === 'all' || !data) {
        return data
      }

      return data.filter((item) => {
        // Type guard to check if item has bias score properties
        const score = (
          'biasScore' in item
            ? item.biasScore
            : 'overallBiasScore' in item
              ? item.overallBiasScore
              : 0
        ) as number
        switch (filter) {
          case 'low':
            return score < 0.3
          case 'medium':
            return score >= 0.3 && score < 0.6
          case 'high':
            return score >= 0.6
          default:
            return true
        }
      })
    },
    [],
  )

  const filterDataByAlertLevel = useCallback(
    (data: FilterableData, filter: string) => {
      if (filter === 'all' || !data) {
        return data
      }
      return data.filter((item) => {
        const level = (
          'level' in item
            ? item.level
            : 'alertLevel' in item
              ? item.alertLevel
              : ''
        ) as string
        return level === filter
      })
    },
    [],
  )

  // Apply all filters to data
  const getFilteredData = useCallback(
    (data: FilterableData, type: 'trends' | 'alerts' | 'sessions') => {
      if (!data) {
        return data
      }

      let filtered = filterDataByTimeRange(data, selectedTimeRange)

      if (type === 'alerts') {
        filtered = filterDataByAlertLevel(filtered, alertLevelFilter)
      }

      if (type === 'sessions' || type === 'trends') {
        filtered = filterDataByBiasScore(filtered, biasScoreFilter)
      }

      return filtered
    },
    [
      selectedTimeRange,
      alertLevelFilter,
      biasScoreFilter,
      filterDataByTimeRange,
      filterDataByAlertLevel,
      filterDataByBiasScore,
    ],
  )

  // Alert management functions
  const handleAlertAction = useCallback(
    async (alertId: string, action: AlertAction['type'], notes?: string) => {
      try {
        const actionData: AlertAction = {
          id: `action-${Date.now()}`,
          type: action,
          timestamp: new Date().toISOString(),
          userId: 'current-user', // In real app, get from auth context
          ...(notes && { notes }),
        }

        // Update local state
        setAlertActions((prev) => {
          const newActions = new Map(prev)
          const existingActions = newActions.get(alertId) || []
          newActions.set(alertId, [...existingActions, actionData])
          return newActions
        })

        // Update dashboard data based on action
        if (
          action === 'acknowledge' ||
          action === 'dismiss' ||
          action === 'archive'
        ) {
          setDashboardData((prev: BiasDashboardData | null) => {
            if (!prev) {
              return prev
            }
            return {
              ...prev,
              alerts: prev.alerts.map((alert: AlertItem) => {
                if (alert.alertId === alertId) {
                  // Ensure timestamp is a Date and all BiasAlert fields are present
                  return {
                    ...alert,
                    acknowledged: true,
                    status: action,
                    timestamp:
                      alert.timestamp instanceof Date
                        ? alert.timestamp
                        : new Date(alert.timestamp!),
                  } as typeof alert
                }
                return {
                  ...alert,
                  timestamp:
                    alert.timestamp instanceof Date
                      ? alert.timestamp
                      : new Date(alert.timestamp!),
                } as typeof alert
              }),
            }
          })
        }

        // Send to backend
        const response = await fetch(
          `/api/bias-detection/alerts/${alertId}/action`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(actionData),
          },
        )

        if (!response.ok) {
          throw new Error('Failed to update alert')
        }

        logger.info('Alert action completed', { alertId, action, notes })
      } catch (err: unknown) {
        logger.error('Failed to perform alert action', {
          error: err,
          alertId,
          action,
        })
        // Revert local state on error
        setAlertActions((prev) => {
          const newActions = new Map(prev)
          const existingActions = newActions.get(alertId) || []
          newActions.set(alertId, existingActions.slice(0, -1))
          return newActions
        })
      }
    },
    [],
  )

  const handleBulkAlertAction = useCallback(
    async (alertIds: string[], action: AlertAction['type']) => {
      try {
        const promises = alertIds.map((alertId) =>
          handleAlertAction(alertId, action),
        )
        await Promise.all(promises)
        setSelectedAlerts(new Set()) // Clear selection
        logger.info(`Bulk ${action} completed`, { count: alertIds.length })
      } catch (err: unknown) {
        logger.error('Failed to perform bulk alert action', {
          error: err,
          action,
          count: alertIds.length,
        })
      }
    },
    [handleAlertAction],
  )

  const toggleAlertSelection = useCallback((alertId: string) => {
    setSelectedAlerts((prev) => {
      const newSelection = new Set(prev)
      if (newSelection.has(alertId)) {
        newSelection.delete(alertId)
      } else {
        newSelection.add(alertId)
      }
      return newSelection
    })
  }, [])

  const selectAllAlerts = useCallback(() => {
    if (!dashboardData?.alerts) {
      return
    }
    const filteredAlerts = getFilteredData(dashboardData.alerts, 'alerts')
    setSelectedAlerts(
      new Set(
        filteredAlerts
          .map((alert) => ('alertId' in alert ? alert.alertId : '') as string)
          .filter(Boolean),
      ),
    )
  }, [dashboardData?.alerts, getFilteredData])

  const clearAlertSelection = useCallback(() => {
    setSelectedAlerts(new Set())
  }, [])

  const updateNotificationSettings = useCallback(
    async (newSettings: Partial<NotificationSettings>) => {
      try {
        const updatedSettings = { ...notificationSettings, ...newSettings }
        setNotificationSettings(updatedSettings)

        // Send to backend
        const response = await fetch(
          '/api/bias-detection/notification-settings',
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedSettings),
          },
        )

        if (!response.ok) {
          throw new Error('Failed to update notification settings')
        }

        logger.info('Notification settings updated', updatedSettings)
      } catch (err: unknown) {
        logger.error('Failed to update notification settings', { error: err })
        // Revert on error
        setNotificationSettings(notificationSettings)
      }
    },
    [notificationSettings],
  )

  const sendTestNotification = useCallback(async () => {
    try {
      const response = await fetch('/api/bias-detection/test-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: notificationSettings }),
      })

      if (!response.ok) {
        throw new Error('Failed to send test notification')
      }

      logger.info('Test notification sent')
      // Show success message (in real app, use toast notification)
      alert('Test notification sent successfully!')
    } catch (err: unknown) {
      logger.error('Failed to send test notification', { error: err })
      alert('Failed to send test notification')
    }
  }, [notificationSettings])

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/bias-detection/dashboard', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(
          `Failed to fetch dashboard data: ${response.statusText}`,
        )
      }

      const data: BiasDashboardData = await response.json()
      setDashboardData(data)
      setLastUpdated(new Date())

      logger.info('Dashboard data loaded successfully', {
        totalSessions: data.summary.totalSessions,
        averageBiasScore: data.summary.averageBiasScore,
        alertsCount: data.alerts.length,
      })
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? (err as Error)?.message || String(err)
          : 'Unknown error'
      setError(errorMessage)
      logger.error('Failed to fetch dashboard data', { error: errorMessage })
    } finally {
      setLoading(false)
    }
  }, [])

  // WebSocket connection setup
  useEffect(() => {
    if (!enableRealTimeUpdates) {
      return
    }

    let reconnectAttempts = 0
    const maxReconnectAttempts = 5
    const reconnectDelay = 1000 // Start with 1 second

    const connectWebSocket = () => {
      try {
        setWsConnectionStatus('connecting')
        const wsUrl =
          process.env['NEXT_PUBLIC_WS_URL'] ||
          'ws://localhost:8000/bias-detection'
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          setWsConnected(true)
          setWsConnectionStatus('connected')
          setWsReconnectAttempts(0)
          reconnectAttempts = 0 // Reset attempts on successful connection
          // Use distinct message for screen readers to avoid duplicating visible label text
          announceToScreenReader('Live updates connection established')
          logger.info('WebSocket connection established', { url: wsUrl })

          // Send initial subscription message
          ws.send(
            JSON.stringify({
              type: 'subscribe',
              channels: [
                'bias_alerts',
                'session_updates',
                'metrics_updates',
                'trends_updates',
              ],
              filters: {
                timeRange: selectedTimeRange,
                biasScoreFilter,
                alertLevelFilter,
              },
            }),
          )
        }

        ws.onclose = (event) => {
          setWsConnected(false)
          // Use distinct message for screen readers
          announceToScreenReader('Live updates connection closed')
          logger.info('WebSocket connection closed', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          })

          // Attempt to reconnect with exponential backoff
          if (reconnectAttempts < maxReconnectAttempts) {
            setWsConnectionStatus('reconnecting')
            const delay = reconnectDelay * 2 ** reconnectAttempts
            reconnectAttempts++
            setWsReconnectAttempts(reconnectAttempts)

            logger.info('Attempting to reconnect WebSocket', {
              attempt: reconnectAttempts,
              delay,
              maxAttempts: maxReconnectAttempts,
            })

            setTimeout(() => {
              if (wsRef.current?.readyState === WebSocket.CLOSED) {
                connectWebSocket()
              }
            }, delay)
          } else {
            setWsConnectionStatus('error')
            logger.error('Max WebSocket reconnection attempts reached')
            announceToScreenReader(
              'Live updates failed to reconnect. Please refresh the page.',
            )
          }
        }

        ws.onerror = (error) => {
          setWsConnectionStatus('error')
          setWsConnected(false)
          logger.error('WebSocket error', { error })
          // Keep error message distinct from visible label 'Live updates failed'
          announceToScreenReader('Live updates encountered a connection error')
        }

        ws.onmessage = (event) => {
          try {
            const data: unknown = JSON.parse(event.data)

            const isObject = (v: unknown): v is Record<string, unknown> =>
              typeof v === 'object' && v !== null

            const hasStringProp = (
              v: Record<string, unknown>,
              prop: string,
            ): boolean => prop in v && typeof v[prop] === 'string'

            if (!isObject(data) || !hasStringProp(data, 'type')) {
              logger.warn('WS message missing type', { data })
              return
            }

            const message = data as Record<string, unknown>

            // Helper to safely read nested object fields
            const getObject = (
              obj: Record<string, unknown>,
              key: string,
            ): Record<string, unknown> | undefined => {
              const v = obj[key]
              return isObject(v) ? v : undefined
            }

            // Handler for bias_alert
            if (message.type === 'bias_alert') {
              const alertObj = getObject(message, 'alert')
              if (alertObj) {
                const newAlert = alertObj as unknown as BiasAlert // rely on structural typing
                setDashboardData((prev: BiasDashboardData | null) => {
                  if (!prev) {
                    return prev
                  }
                  if (
                    newAlert.level === 'high' ||
                    newAlert.level === 'critical'
                  ) {
                    setNewHighBiasAlert(newAlert)
                  }
                  announceToScreenReader(
                    `New ${newAlert.level} bias alert: ${newAlert.message}`,
                  )
                  return {
                    ...prev,
                    alerts: [newAlert, ...(prev.alerts || [])],
                    summary: {
                      ...prev.summary,
                      alertsLast24h: prev.summary.alertsLast24h + 1,
                    },
                  }
                })
              }
              setLastUpdated(new Date())
              return
            }

            // Handler for session_update
            if (message.type === 'session_update') {
              const sessionObj = getObject(message, 'session')
              if (sessionObj) {
                const updatedSession =
                  sessionObj as unknown as BiasAnalysisResult
                setDashboardData((prev: BiasDashboardData | null) => {
                  if (!prev) {
                    return prev
                  }
                  return {
                    ...prev,
                    recentAnalyses: prev.recentAnalyses.map(
                      (session: BiasAnalysisResult) =>
                        session.sessionId === updatedSession.sessionId
                          ? updatedSession
                          : session,
                    ),
                  }
                })
                announceToScreenReader(
                  `Session updated: ${updatedSession.sessionId}`,
                )
              }
              setLastUpdated(new Date())
              return
            }

            // Handler for metrics_update
            if (message.type === 'metrics_update') {
              const metricsObj = getObject(message, 'metrics')
              if (metricsObj) {
                setDashboardData((prev: BiasDashboardData | null) => {
                  if (!prev) {
                    return prev
                  }
                  return {
                    ...prev,
                    summary: {
                      ...prev.summary,
                      ...(metricsObj as unknown as Partial<BiasDashboardSummary>),
                    },
                  }
                })
                announceToScreenReader('Dashboard metrics updated')
              }
              setLastUpdated(new Date())
              return
            }

            // Handler for trends_update
            if (message.type === 'trends_update') {
              const trends = message['trends']
              if (trends !== undefined) {
                setDashboardData((prev: BiasDashboardData | null) => {
                  if (!prev) {
                    return prev
                  }
                  return {
                    ...prev,
                    trends: (trends as unknown as TrendItem[]) || prev.trends,
                  }
                })
                announceToScreenReader('Trend data updated')
              }
              setLastUpdated(new Date())
              return
            }

            // Handler for connection_status
            if (message.type === 'connection_status') {
              const status =
                typeof message['status'] === 'string'
                  ? (message['status'] as string)
                  : undefined
              if (status === 'authenticated') {
                logger.info('WebSocket authenticated successfully')
              } else if (status === 'error') {
                const err = message['error']
                logger.error('WebSocket authentication failed', {
                  error: isObject(err) ? err : undefined,
                })
              }
              setLastUpdated(new Date())
              return
            }

            // Handle heartbeat messages
            if (message.type === 'heartbeat') {
              // Respond to server heartbeat with heartbeat_response
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'heartbeat_response' }))
              }
              return
            }

            // Update last updated timestamp for any other message types
            setLastUpdated(new Date())
          } catch (error: unknown) {
            logger.error('Failed to process WebSocket message', {
              error,
              rawData: event.data,
            })
          }
        }

        // Set up heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }))
          }
        }, 30000) // Send heartbeat every 30 seconds

          // Store interval reference for cleanup
          // Store interval reference for cleanup using extended interface
          ; (ws as ExtendedWebSocket).heartbeatInterval = heartbeatInterval
      } catch (error: unknown) {
        setWsConnectionStatus('error')
        logger.error('Failed to create WebSocket connection', { error })
        setWsConnected(false)
      }
    }

    connectWebSocket()

    return () => {
      if (wsRef.current) {
        // Clear heartbeat interval
        if ((wsRef.current as ExtendedWebSocket).heartbeatInterval) {
          clearInterval((wsRef.current as ExtendedWebSocket).heartbeatInterval!)
        }
        // Attempt graceful unsubscribe
        if (wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current?.send(JSON.stringify({ type: 'unsubscribe' }))
          } catch {
            // Intentionally ignore errors during WebSocket unsubscribe/close
          }
        }
        wsRef.current.close(1000, 'Component unmounting')
        wsRef.current = null
      }
    }
  }, [
    enableRealTimeUpdates,
    selectedTimeRange,
    biasScoreFilter,
    alertLevelFilter,
    announceToScreenReader,
  ])

  // Update WebSocket subscription when filters change
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current?.send(
        JSON.stringify({
          type: 'update_subscription',
          filters: {
            timeRange: selectedTimeRange,
            biasScoreFilter,
            alertLevelFilter,
            demographicFilter: selectedDemographicFilter,
          },
        }),
      )
      logger.info('Updated WebSocket subscription filters', {
        timeRange: selectedTimeRange,
        biasScoreFilter,
        alertLevelFilter,
        demographicFilter: selectedDemographicFilter,
      })
    }
  }, [
    selectedTimeRange,
    biasScoreFilter,
    alertLevelFilter,
    selectedDemographicFilter,
  ])

  // Auto-refresh effect
  useEffect(() => {
    fetchDashboardData()

    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(fetchDashboardData, refreshInterval)
      return () => clearInterval(interval)
    }

    // Return undefined explicitly when no cleanup is needed
    return undefined
  }, [fetchDashboardData, autoRefresh, refreshInterval])

  // Responsive design effect
  useEffect(() => {
    updateScreenSize()
    checkAccessibilityPreferences()

    const handleResize = () => {
      updateScreenSize()
    }

    const handleMediaChange = () => {
      checkAccessibilityPreferences()
    }

    window.addEventListener('resize', handleResize)

    // Listen for accessibility preference changes
    const reducedMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    )
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)')

    reducedMotionQuery.addEventListener('change', handleMediaChange)
    highContrastQuery.addEventListener('change', handleMediaChange)

    return () => {
      window.removeEventListener('resize', handleResize)
      reducedMotionQuery.removeEventListener('change', handleMediaChange)
      highContrastQuery.removeEventListener('change', handleMediaChange)
    }
  }, [updateScreenSize, checkAccessibilityPreferences])

  // Keyboard navigation effect
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Alert severity colors
  const getAlertColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-500'
      case 'high':
        return 'bg-orange-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  // Bias score color based on severity
  const getBiasScoreColor = (score: number) => {
    if (score >= 0.8) {
      return 'text-red-600'
    }
    if (score >= 0.6) {
      return 'text-orange-600'
    }
    if (score >= 0.3) {
      return 'text-yellow-600'
    }
    return 'text-green-600'
  }

  // Export dashboard data

  // Enhanced export function with progress tracking
  const exportDataWithOptions = async () => {
    try {
      setExportProgress({
        isExporting: true,
        progress: 0,
        status: 'Preparing export...',
      })

      // Prepare export parameters
      const exportParams = {
        format: exportFormat,
        dateRange: exportDateRange,
        dataTypes: exportDataTypes,
        filters: exportFilters,
        currentFilters: exportFilters.applyCurrentFilters
          ? {
            timeRange: selectedTimeRange,
            biasScoreFilter,
            alertLevelFilter,
            demographicFilter: selectedDemographicFilter,
            customDateRange:
              selectedTimeRange === 'custom' ? customDateRange : undefined,
          }
          : undefined,
      }

      setExportProgress((prev) => ({
        ...prev,
        progress: 25,
        status: 'Gathering data...',
      }))

      const response = await fetch('/api/bias-detection/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportParams),
      })

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`)
      }

      setExportProgress((prev) => ({
        ...prev,
        progress: 75,
        status: 'Generating file...',
      }))

      // Handle different response types based on format
      let blob: Blob
      let filename: string
      const timestamp = new Date().toISOString().split('T')[0]

      switch (exportFormat) {
        case 'json':
          blob = await response.blob()
          filename = `bias-dashboard-${timestamp}.json`
          break
        case 'csv':
          blob = await response.blob()
          filename = `bias-dashboard-${timestamp}.csv`
          break
        case 'pdf':
          blob = await response.blob()
          filename = `bias-dashboard-report-${timestamp}.pdf`
          break
        default:
          throw new Error('Unsupported export format')
      }

      setExportProgress((prev) => ({
        ...prev,
        progress: 90,
        status: 'Downloading file...',
      }))

      // Download the file
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setExportProgress((prev) => ({
        ...prev,
        progress: 100,
        status: 'Export completed!',
      }))

      // Close dialog after successful export
      setTimeout(() => {
        setShowExportDialog(false)
        setExportProgress({
          isExporting: false,
          progress: 0,
          status: '',
        })
      }, 1500)

      logger.info('Dashboard data exported successfully', {
        format: exportFormat,
        dataTypes: Object.keys(exportDataTypes).filter(
          (key) => exportDataTypes[key as keyof typeof exportDataTypes],
        ),
        dateRange: exportDateRange,
        filename,
      })
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? (err as Error)?.message || String(err)
          : 'Export failed'
      setExportProgress({
        isExporting: false,
        progress: 0,
        status: `Error: ${errorMessage}`,
      })
      logger.error('Export failed', {
        error: errorMessage,
        exportParams: { format: exportFormat, dataTypes: exportDataTypes },
      })

      // Clear error after 3 seconds
      setTimeout(() => {
        setExportProgress({
          isExporting: false,
          progress: 0,
          status: '',
        })
      }, 3000)
    }
  }

  // Add new helper functions
  const getChartColors = (index: number, total: number) => {
    const hue = (index * 360) / total
    return `hsl(${hue}, 70%, 60%)`
  }

  // Responsive chart helper functions
  const getResponsiveChartHeight = () => {
    if (isMobile) {
      return 200
    }
    if (isTablet) {
      return 300
    }
    return 400
  }

  const getResponsiveGridCols = (defaultCols: number) => {
    if (isMobile) {
      return 1
    }
    if (isTablet) {
      return Math.min(defaultCols, 2)
    }
    return defaultCols
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{`${label}`}</p>
          {payload.map((entry) => (
            <p
              key={`${entry.name}-${entry.value}`}
              style={{ color: entry.color }}
            >
              {`${entry.name}: ${entry.value}${entry.payload?.percent ? ` (${entry.payload.percent}%)` : ''}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Helper function to get connection status display
  const getConnectionStatusDisplay = () => {
    switch (wsConnectionStatus) {
      case 'connected':
        return {
          text: 'Live updates connected',
          color: 'text-green-500',
          icon: <Activity className="h-3 w-3 mr-1" />,
          pulse: false,
        }
      case 'connecting':
        return {
          text: 'Connecting to live updates...',
          color: 'text-yellow-500',
          icon: <RefreshCw className="h-3 w-3 mr-1 animate-spin" />,
          pulse: true,
        }
      case 'reconnecting':
        return {
          text: `Reconnecting... (attempt ${wsReconnectAttempts})`,
          color: 'text-orange-500',
          icon: <RefreshCw className="h-3 w-3 mr-1 animate-spin" />,
          pulse: true,
        }
      case 'error':
        return {
          text: 'Live updates failed',
          color: 'text-red-500',
          icon: <AlertTriangle className="h-3 w-3 mr-1" />,
          pulse: false,
        }
      default:
        return {
          text: 'Live updates disabled',
          color: 'text-gray-500',
          icon: <Activity className="h-3 w-3 mr-1" />,
          pulse: false,
        }
    }
  }

  const connectionStatus = getConnectionStatusDisplay()

  // Manual WebSocket reconnection
  const reconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      // Close existing connection
      if (wsRef.current.heartbeatInterval) {
        clearInterval(wsRef.current.heartbeatInterval)
      }
      wsRef.current.close(1000, 'Manual reconnection')
      wsRef.current = null
    }

    // Reset connection state
    setWsConnected(false)
    setWsConnectionStatus('disconnected')
    setWsReconnectAttempts(0)

    // Trigger reconnection
    if (enableRealTimeUpdates) {
      setTimeout(() => {
        // The useEffect will handle the actual reconnection
        setWsConnectionStatus('connecting')
      }, 100)
    }

    announceToScreenReader('Manually reconnecting to live updates')
    logger.info('Manual WebSocket reconnection initiated')
  }, [enableRealTimeUpdates, announceToScreenReader])

  if (loading && !dashboardData) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-lg">
            Loading bias detection dashboard...
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <Alert
          variant="error"
          title="Error Loading Dashboard"
          description={
            <div>
              {error}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={fetchDashboardData}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          }
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>
    )
  }

  if (!dashboardData) {
    return null
  }

  const {
    summary = {
      totalSessions: 0,
      averageBiasScore: 0,
      highBiasSessions: 0,
      totalAlerts: 0,
      complianceScore: 0,
    },
    recentAnalyses = [],
    alerts = [],
    trends = [],
    demographics = { age: {}, gender: {}, ethnicity: {} } as {
      age: Record<string, number>
      gender: Record<string, number>
      ethnicity: Record<string, number>
    },
    recommendations = [],
  } = dashboardData

  // Apply filters to data
  const filteredTrends =
    (getFilteredData(trends, 'trends') as TrendItem[]) || []
  const filteredAlerts =
    (getFilteredData(alerts, 'alerts') as AlertItem[]) || []
  const filteredSessions =
    (getFilteredData(recentAnalyses, 'sessions') as BiasAnalysisItem[]) || []

  return (
    <div
      className={`p-6 space-y-6 ${className} ${highContrast ? 'high-contrast' : ''}`}
    >
      {/* New High Bias Alert Notification */}
      {newHighBiasAlert && (
        <div
          className="mb-4 p-4 bg-orange-100 border-l-4 border-orange-500 flex items-center justify-between"
          role="alert"
          data-testid="new-high-bias-alert"
        >
          <div>
            <span className="font-bold text-orange-700 mr-2">
              New high bias alert
            </span>
            <span className="text-sm text-orange-800">
              {newHighBiasAlert.message}
            </span>
          </div>
          <button
            className="ml-4 px-2 py-1 bg-orange-200 rounded text-orange-800 hover:bg-orange-300"
            aria-label="Dismiss new high bias alert"
            onClick={() => setNewHighBiasAlert(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Skip Links for Accessibility */}
      <div className="sr-only">
        <button
          type="button"
          ref={skipLinkRef}
          className="skip-link focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded"
          onClick={() => {
            mainContentRef.current?.focus()
            announceToScreenReader('Jumped to main content')
          }}
        >
          Skip to main content
        </button>
        <button
          type="button"
          className="skip-link focus:not-sr-only focus:absolute focus:top-4 focus:left-32 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded"
          onClick={() => {
            // Use programmatic tab switching if needed
            announceToScreenReader('Jumped to alerts section')
          }}
        >
          Skip to alerts
        </button>
      </div>

      {/* Screen Reader Announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcements.map((announcement, index) => (
          <div key={`announcement-${index}-${Date.now()}`}>{announcement}</div>
        ))}
      </div>

      {/* Header */}
      <header
        className={`flex ${isMobile ? 'flex-col space-y-4' : 'flex-row items-center justify-between'}`}
      >
        <div>
          <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold`}>
            Bias Detection Dashboard
          </h1>
          <p className={`text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>
            Real-time monitoring of therapeutic training bias
            {lastUpdated && (
              <span className={`${isMobile ? 'block' : 'ml-2'}`}>
                • Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {enableRealTimeUpdates && (
              <span
                className={`${isMobile ? 'block' : 'ml-2'} ${connectionStatus.color} ${connectionStatus.pulse ? 'animate-pulse' : ''}`}
              >
                • {connectionStatus.icon}
                {connectionStatus.text}
              </span>
            )}
          </p>
        </div>

        <div
          className={`flex ${isMobile ? 'flex-col space-y-2' : 'items-center space-x-2'} ${isMobile ? 'w-full' : ''}`}
        >
          <Button
            variant="outline"
            size={isMobile ? 'default' : 'sm'}
            onClick={() => {
              setAutoRefresh(!autoRefresh)
              announceToScreenReader(
                `Auto-refresh ${autoRefresh ? 'disabled' : 'enabled'}`,
              )
            }}
            className={isMobile ? 'w-full justify-start' : ''}
            aria-label={`Auto-refresh is currently ${autoRefresh ? 'on' : 'off'}. Click to ${autoRefresh ? 'disable' : 'enable'}.`}
          >
            <Activity
              className={`h-4 w-4 ${isMobile ? 'mr-2' : 'mr-2'} ${autoRefresh ? 'text-green-500' : 'text-gray-500'}`}
            />
            Auto-refresh {autoRefresh ? 'On' : 'Off'}
          </Button>

          <Button
            variant="outline"
            size={isMobile ? 'default' : 'sm'}
            onClick={() => {
              fetchDashboardData()
              announceToScreenReader('Dashboard data refreshed')
            }}
            disabled={loading}
            className={isMobile ? 'w-full justify-start' : ''}
            aria-label="Refresh dashboard data"
          >
            <RefreshCw
              className={`h-4 w-4 ${isMobile ? 'mr-2' : 'mr-2'} ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>

          {/* WebSocket Reconnect Button - Show when connection failed */}
          {enableRealTimeUpdates &&
            (wsConnectionStatus === 'error' ||
              wsConnectionStatus === 'disconnected') && (
              <Button
                variant="outline"
                size={isMobile ? 'default' : 'sm'}
                onClick={reconnectWebSocket}
                className={isMobile ? 'w-full justify-start' : ''}
                aria-label="Reconnect to live updates"
              >
                <Activity className={`h-4 w-4 ${isMobile ? 'mr-2' : 'mr-2'}`} />
                Reconnect Live Updates
              </Button>
            )}

          <Button
            variant="outline"
            size={isMobile ? 'default' : 'sm'}
            onClick={() => {
              setShowNotificationSettings(!showNotificationSettings)
              announceToScreenReader(
                `Notification settings ${showNotificationSettings ? 'closed' : 'opened'}`,
              )
            }}
            className={isMobile ? 'w-full justify-start' : ''}
            aria-label="Notification Settings Button - Open notification settings"
            aria-expanded={showNotificationSettings}
            data-testid="notifications-button"
          >
            <Bell className={`h-4 w-4 ${isMobile ? 'mr-2' : 'mr-2'}`} />
            Notification Settings
          </Button>

          <Button
            variant="outline"
            size={isMobile ? 'default' : 'sm'}
            onClick={() => {
              setShowExportDialog(true)
              announceToScreenReader('Export dialog opened')
            }}
            className={isMobile ? 'w-full justify-start' : ''}
            aria-label="Export Data Button - Open data export options"
            data-testid="export-button"
          >
            <Download className={`h-4 w-4 ${isMobile ? 'mr-2' : 'mr-2'}`} />
            Export Data
          </Button>
        </div>
      </header>

      {/* Notification Settings Panel */}
      {showNotificationSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Notification Settings Panel
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotificationSettings(false)}
                aria-label="Close notification settings panel"
                data-testid="close-notification-settings"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Notification Channels */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Notification Channels
                </h4>

                <div className="space-y-3">
                  <label
                    htmlFor="inAppNotificationsCheckbox"
                    className="flex items-center space-x-3"
                  >
                    <input
                      id="inAppNotificationsCheckbox"
                      type="checkbox"
                      checked={notificationSettings.inAppEnabled}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateNotificationSettings({
                          inAppEnabled: e.target.checked,
                        })
                      }
                      className="rounded"
                      aria-label="Enable in-app notifications"
                    />
                    <Bell className="h-4 w-4" />
                    <span>In-App Notifications</span>
                  </label>

                  <label
                    htmlFor="emailNotificationsCheckbox"
                    className="flex items-center space-x-3"
                  >
                    <input
                      id="emailNotificationsCheckbox"
                      type="checkbox"
                      checked={notificationSettings.emailEnabled}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateNotificationSettings({
                          emailEnabled: e.target.checked,
                        })
                      }
                      className="rounded"
                      aria-label="Enable email notifications"
                    />
                    <Mail className="h-4 w-4" />
                    <span>Email Notifications</span>
                  </label>

                  <label
                    htmlFor="smsNotificationsCheckbox"
                    className="flex items-center space-x-3"
                  >
                    <input
                      id="smsNotificationsCheckbox"
                      type="checkbox"
                      checked={notificationSettings.smsEnabled}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateNotificationSettings({
                          smsEnabled: e.target.checked,
                        })
                      }
                      className="rounded"
                      aria-label="Enable SMS notifications"
                    />
                    <MessageSquare className="h-4 w-4" />
                    <span>SMS Notifications</span>
                  </label>
                </div>
              </div>

              {/* Alert Level Settings */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Alert Level Notifications
                </h4>

                <div className="space-y-3">
                  <label
                    htmlFor="criticalAlertsCheckbox"
                    className="flex items-center space-x-3"
                  >
                    <input
                      id="criticalAlertsCheckbox"
                      type="checkbox"
                      checked={notificationSettings.criticalAlerts}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateNotificationSettings({
                          criticalAlerts: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span>Critical Alerts</span>
                  </label>

                  <label
                    htmlFor="highAlertsCheckbox"
                    className="flex items-center space-x-3"
                  >
                    <input
                      id="highAlertsCheckbox"
                      type="checkbox"
                      checked={notificationSettings.highAlerts}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateNotificationSettings({
                          highAlerts: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span>High Priority Alerts</span>
                  </label>

                  <label
                    htmlFor="mediumAlertsCheckbox"
                    className="flex items-center space-x-3"
                  >
                    <input
                      id="mediumAlertsCheckbox"
                      type="checkbox"
                      checked={notificationSettings.mediumAlerts}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateNotificationSettings({
                          mediumAlerts: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <Info className="h-4 w-4 text-yellow-500" />
                    <span>Medium Priority Alerts</span>
                  </label>

                  <label
                    htmlFor="lowAlertsCheckbox"
                    className="flex items-center space-x-3"
                  >
                    <input
                      id="lowAlertsCheckbox"
                      type="checkbox"
                      checked={notificationSettings.lowAlerts}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateNotificationSettings({
                          lowAlerts: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span>Low Priority Alerts</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Test Notification */}
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Test Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Send a test notification to verify your settings
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={sendTestNotification}
                  disabled={
                    !notificationSettings.emailEnabled &&
                    !notificationSettings.smsEnabled &&
                    !notificationSettings.inAppEnabled
                  }
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Send Test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Export Dialog */}
      {showExportDialog && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Download className="h-5 w-5 mr-2" />
                Export Dashboard Data Dialog
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExportDialog(false)}
                disabled={exportProgress.isExporting}
                aria-label="Close export dialog"
                data-testid="close-export-dialog"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Export Format Selection */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center">
                  <PieChartIcon className="h-4 w-4 mr-2" />
                  Export Format
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <label
                    htmlFor="exportFormatJson"
                    className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted"
                    aria-label="Export data as JSON format"
                  >
                    <input
                      id="exportFormatJson"
                      type="radio"
                      name="exportFormat"
                      value="json"
                      checked={exportFormat === 'json'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExportFormat(e.target.value as 'json')
                      }
                      className="rounded"
                      aria-describedby="json-format-description"
                    />
                    <div>
                      <div className="font-medium">JSON</div>
                      <div
                        className="text-xs text-muted-foreground"
                        id="json-format-description"
                      >
                        Raw data format
                      </div>
                    </div>
                  </label>

                  <label
                    htmlFor="exportFormatCsv"
                    className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted"
                    aria-label="Export data as CSV format"
                  >
                    <input
                      id="exportFormatCsv"
                      type="radio"
                      name="exportFormat"
                      value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExportFormat(e.target.value as 'csv')
                      }
                      className="rounded"
                      aria-describedby="csv-format-description"
                    />
                    <div>
                      <div className="font-medium">CSV</div>
                      <div
                        className="text-xs text-muted-foreground"
                        id="csv-format-description"
                      >
                        Spreadsheet format
                      </div>
                    </div>
                  </label>

                  <label
                    htmlFor="exportFormatPdf"
                    className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted"
                    aria-label="Export data as PDF format"
                  >
                    <input
                      id="exportFormatPdf"
                      type="radio"
                      name="exportFormat"
                      value="pdf"
                      checked={exportFormat === 'pdf'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExportFormat(e.target.value as 'pdf')
                      }
                      className="rounded"
                      aria-describedby="pdf-format-description"
                    />
                    <div>
                      <div className="font-medium">PDF</div>
                      <div
                        className="text-xs text-muted-foreground"
                        id="pdf-format-description"
                      >
                        Report format
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Date Range Selection */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Date Range
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="export-start-date"
                      className="text-sm font-medium"
                    >
                      Start Date
                    </label>
                    <input
                      id="export-start-date"
                      type="date"
                      value={exportDateRange.start}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExportDateRange((prev) => ({
                          ...prev,
                          start: e.target.value,
                        }))
                      }
                      className="w-full p-2 border rounded-md bg-background mt-1"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="export-end-date"
                      className="text-sm font-medium"
                    >
                      End Date
                    </label>
                    <input
                      id="export-end-date"
                      type="date"
                      value={exportDateRange.end}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExportDateRange((prev) => ({
                          ...prev,
                          end: e.target.value,
                        }))
                      }
                      className="w-full p-2 border rounded-md bg-background mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Data Types Selection */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Data to Include
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    htmlFor="exportSummaryCheckbox"
                    className="flex items-center space-x-2"
                  >
                    <input
                      id="exportSummaryCheckbox"
                      type="checkbox"
                      checked={exportDataTypes.summary}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExportDataTypes((prev) => ({
                          ...prev,
                          summary: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span>Summary Metrics</span>
                  </label>

                  <label
                    htmlFor="exportAlertsCheckbox"
                    className="flex items-center space-x-2"
                  >
                    <input
                      id="exportAlertsCheckbox"
                      type="checkbox"
                      checked={exportDataTypes.alerts}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExportDataTypes((prev) => ({
                          ...prev,
                          alerts: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span>Alerts</span>
                  </label>

                  <label
                    htmlFor="exportTrendsCheckbox"
                    className="flex items-center space-x-2"
                  >
                    <input
                      id="exportTrendsCheckbox"
                      type="checkbox"
                      checked={exportDataTypes.trends}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExportDataTypes((prev) => ({
                          ...prev,
                          trends: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span>Trend Data</span>
                  </label>

                  <label
                    htmlFor="exportDemographicsCheckbox"
                    className="flex items-center space-x-2"
                  >
                    <input
                      id="exportDemographicsCheckbox"
                      type="checkbox"
                      checked={exportDataTypes.demographics}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExportDataTypes((prev) => ({
                          ...prev,
                          demographics: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span>Demographics</span>
                  </label>

                  <label
                    htmlFor="exportSessionsCheckbox"
                    className="flex items-center space-x-2"
                  >
                    <input
                      id="exportSessionsCheckbox"
                      type="checkbox"
                      checked={exportDataTypes.sessions}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExportDataTypes((prev) => ({
                          ...prev,
                          sessions: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span>Session Data</span>
                  </label>

                  <label
                    htmlFor="exportRecommendationsCheckbox"
                    className="flex items-center space-x-2"
                  >
                    <input
                      id="exportRecommendationsCheckbox"
                      type="checkbox"
                      checked={exportDataTypes.recommendations}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExportDataTypes((prev) => ({
                          ...prev,
                          recommendations: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span>Recommendations</span>
                  </label>
                </div>
              </div>

              {/* Export Filters */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center">
                  <Filter className="h-4 w-4 mr-2" />
                  Export Options
                </h4>
                <div className="space-y-3">
                  <label
                    htmlFor="applyCurrentFiltersCheckbox"
                    className="flex items-center space-x-2"
                  >
                    <input
                      id="applyCurrentFiltersCheckbox"
                      type="checkbox"
                      checked={exportFilters.applyCurrentFilters}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExportFilters((prev) => ({
                          ...prev,
                          applyCurrentFilters: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span>Apply current dashboard filters</span>
                  </label>

                  <label
                    htmlFor="includeArchivedCheckbox"
                    className="flex items-center space-x-2"
                  >
                    <input
                      id="includeArchivedCheckbox"
                      type="checkbox"
                      checked={exportFilters.includeArchived}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExportFilters((prev) => ({
                          ...prev,
                          includeArchived: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span>Include archived alerts</span>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="export-min-bias"
                        className="text-sm font-medium"
                      >
                        Min Bias Score
                      </label>
                      <input
                        id="export-min-bias"
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={exportFilters.minBiasScore}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setExportFilters((prev) => ({
                            ...prev,
                            minBiasScore: Number.parseFloat(e.target.value),
                          }))
                        }
                        className="w-full p-2 border rounded-md bg-background mt-1"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="export-max-bias"
                        className="text-sm font-medium"
                      >
                        Max Bias Score
                      </label>
                      <input
                        id="export-max-bias"
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={exportFilters.maxBiasScore}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setExportFilters((prev) => ({
                            ...prev,
                            maxBiasScore: Number.parseFloat(e.target.value),
                          }))
                        }
                        className="w-full p-2 border rounded-md bg-background mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Export Progress */}
              {exportProgress.isExporting && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center">
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Export Progress
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{exportProgress.status}</span>
                      <span>{exportProgress.progress}%</span>
                    </div>
                    <Progress
                      value={exportProgress.progress}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Export Status */}
              {exportProgress.status && !exportProgress.isExporting && (
                <div
                  className={`p-3 rounded-md ${exportProgress.status.startsWith('Error')
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-green-50 text-green-700 border border-green-200'
                    }`}
                >
                  <div className="flex items-center">
                    {exportProgress.status.startsWith('Error') ? (
                      <AlertTriangle className="h-4 w-4 mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    {exportProgress.status}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {Object.values(exportDataTypes).filter(Boolean).length} data
                  types selected
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowExportDialog(false)}
                    disabled={exportProgress.isExporting}
                    data-testid="cancel-export"
                  >
                    Cancel Export
                  </Button>
                  <Button
                    onClick={exportDataWithOptions}
                    disabled={
                      exportProgress.isExporting ||
                      !Object.values(exportDataTypes).some(Boolean)
                    }
                    data-testid="export-data-button"
                  >
                    {exportProgress.isExporting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Exporting Data...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Export as {exportFormat.toUpperCase()}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtering Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters & Time Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Time Range Selection */}
            <div className="space-y-2">
              <label
                htmlFor="time-range-select"
                className="text-sm font-medium flex items-center"
              >
                <Clock className="h-4 w-4 mr-1" />
                Time Range
              </label>
              <select
                id="time-range-select"
                value={selectedTimeRange}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSelectedTimeRange(e.target.value)
                }
                className="w-full p-2 border rounded-md bg-background"
              >
                {timeRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Date Range */}
            {selectedTimeRange === 'custom' && (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor="custom-start-date"
                    className="text-sm font-medium flex items-center"
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Start Date
                  </label>
                  <input
                    id="custom-start-date"
                    type="datetime-local"
                    value={customDateRange.start}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCustomDateRange((prev) => ({
                        ...prev,
                        start: e.target.value,
                      }))
                    }
                    className="w-full p-2 border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="custom-end-date"
                    className="text-sm font-medium flex items-center"
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    End Date
                  </label>
                  <input
                    id="custom-end-date"
                    type="datetime-local"
                    value={customDateRange.end}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCustomDateRange((prev) => ({
                        ...prev,
                        end: e.target.value,
                      }))
                    }
                    className="w-full p-2 border rounded-md bg-background"
                  />
                </div>
              </>
            )}

            {/* Bias Score Filter */}
            <div className="space-y-2">
              <label
                htmlFor="bias-score-filter"
                className="text-sm font-medium flex items-center"
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                Bias Score Level
              </label>
              <select
                id="bias-score-filter"
                value={biasScoreFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setBiasScoreFilter(
                    e.target.value as 'all' | 'low' | 'medium' | 'high',
                  )
                }
                className="w-full p-2 border rounded-md bg-background"
              >
                <option value="all">All Levels</option>
                <option value="low">Low (&lt; 30%)</option>
                <option value="medium">Medium (30-60%)</option>
                <option value="high">High (&gt; 60%)</option>
              </select>
            </div>

            {/* Alert Level Filter */}
            <div className="space-y-2">
              <label
                htmlFor="alert-level-filter"
                className="text-sm font-medium flex items-center"
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Alert Level
              </label>
              <select
                id="alert-level-filter"
                value={alertLevelFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setAlertLevelFilter(
                    e.target.value as
                    | 'all'
                    | 'low'
                    | 'medium'
                    | 'high'
                    | 'critical',
                  )
                }
                className="w-full p-2 border rounded-md bg-background"
              >
                <option value="all">All Alerts</option>
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* Demographics Filter */}
            <div className="space-y-2">
              <label
                htmlFor="demographics-filter"
                className="text-sm font-medium flex items-center"
              >
                <Users className="h-4 w-4 mr-1" />
                Demographics
              </label>
              <select
                id="demographics-filter"
                value={selectedDemographicFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSelectedDemographicFilter(e.target.value)
                }
                className="w-full p-2 border rounded-md bg-background"
              >
                {demographicFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            <div className="space-y-2">
              <div className="text-sm font-medium opacity-0">Clear</div>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedTimeRange('24h')
                  setBiasScoreFilter('all')
                  setAlertLevelFilter('all')
                  setSelectedDemographicFilter('all')
                  setCustomDateRange({ start: '', end: '' })
                }}
                className="w-full"
              >
                Clear All Filters
              </Button>
            </div>
          </div>

          {/* Filter Summary */}
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">
              <strong>Active Filters:</strong>
              {selectedTimeRange !== '24h' &&
                ` Time: ${timeRangeOptions.find((o) => o.value === selectedTimeRange)?.label}`}
              {biasScoreFilter !== 'all' && ` • Bias: ${biasScoreFilter}`}
              {alertLevelFilter !== 'all' && ` • Alerts: ${alertLevelFilter}`}
              {selectedDemographicFilter !== 'all' &&
                ` • Demographics: ${selectedDemographicFilter}`}
              {selectedTimeRange === '24h' &&
                biasScoreFilter === 'all' &&
                alertLevelFilter === 'all' &&
                selectedDemographicFilter === 'all' &&
                ' None'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {filteredAlerts.filter(
        (alert) => alert.level === 'critical' || alert.level === 'high',
      ).length > 0 && (
          <Alert
            variant="error"
            title="High Priority Bias Alerts"
            description={`${filteredAlerts.filter((alert) => alert.level === 'critical' || alert.level === 'high').length} critical or high-priority bias issues require immediate attention.`}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        )}

      {/* Summary Cards - Update with filtered data counts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sessions
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.totalSessions?.toLocaleString() ?? '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredSessions.length !== recentAnalyses.length &&
                `${filteredSessions.length} match current filters`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Bias Score
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getBiasScoreColor(
                filteredSessions.length > 0
                  ? filteredSessions.reduce(
                    (sum, session) => sum + (session.overallBiasScore || 0),
                    0,
                  ) / filteredSessions.length
                  : (summary?.averageBiasScore ?? 0),
              )}`}
            >
              {filteredSessions.length > 0
                ? (
                  (filteredSessions.reduce(
                    (sum, session) => sum + (session.overallBiasScore || 0),
                    0,
                  ) /
                    filteredSessions.length) *
                  100
                ).toFixed(1)
                : ((summary?.averageBiasScore ?? 0) * 100).toFixed(1)}
              %
            </div>
            <Progress
              value={
                filteredSessions.length > 0
                  ? (filteredSessions.reduce(
                    (sum, session) => sum + (session.overallBiasScore || 0),
                    0,
                  ) /
                    filteredSessions.length) *
                  100
                  : (summary?.averageBiasScore ?? 0) * 100
              }
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Filtered Alerts
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              {filteredAlerts.length !== alerts.length &&
                `of ${alerts.length} total alerts`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Compliance Score
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {((summary?.complianceScore ?? 0) * 100).toFixed(1)}%
            </div>
            <Progress
              value={(summary?.complianceScore ?? 0) * 100}
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <main
        ref={mainContentRef}
        id="main-content"
        tabIndex={-1}
        className="focus:outline-none"
        aria-label="Dashboard main content"
      >
        <Tabs defaultValue="trends" className="w-full">
          <TabsList
            className={`grid w-full ${isMobile ? 'grid-cols-2' : isTablet ? 'grid-cols-3' : 'grid-cols-5'} ${isMobile ? 'h-auto' : ''}`}
          >
            <TabsTrigger
              value="trends"
              className={isMobile ? 'text-xs py-3' : ''}
              aria-label="Trends Tab - View bias trends and analytics"
              data-testid="trends-tab"
            >
              {isMobile ? 'Trends' : 'Trends Tab'}
            </TabsTrigger>
            <TabsTrigger
              value="demographics"
              className={isMobile ? 'text-xs py-3' : ''}
              aria-label="Demographics Tab - View demographic breakdown"
              data-testid="demographics-tab"
            >
              {isMobile ? 'Demo' : 'Demographics Tab'}
            </TabsTrigger>
            <TabsTrigger
              value="alerts"
              className={isMobile ? 'text-xs py-3' : ''}
              aria-label={`Alerts Tab - View alerts. ${filteredAlerts.length} alerts currently active`}
              data-testid="alerts-tab"
            >
              {isMobile ? 'Alerts' : 'Alerts Tab'}
              {filteredAlerts.length > 0 && (
                <Badge
                  variant="destructive"
                  className={`ml-2 ${isMobile ? 'text-xs px-1' : ''}`}
                  aria-label={`${filteredAlerts.length} active alerts`}
                >
                  {filteredAlerts.length}
                </Badge>
              )}
            </TabsTrigger>
            {!isMobile && (
              <>
                <TabsTrigger
                  value="sessions"
                  aria-label="Recent Sessions Tab - View recent session data"
                  data-testid="sessions-tab"
                >
                  Recent Sessions Tab
                </TabsTrigger>
                <TabsTrigger
                  value="recommendations"
                  aria-label="Recommendations Tab - View system recommendations"
                  data-testid="recommendations-tab"
                >
                  Recommendations Tab
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Mobile-specific additional tabs */}
          {isMobile && (
            <TabsList className="grid w-full grid-cols-2 mt-2">
              <TabsTrigger
                value="sessions"
                className="text-xs py-3"
                aria-label="Recent Sessions Tab - View recent session data"
                data-testid="sessions-tab-mobile"
              >
                Sessions Tab
              </TabsTrigger>
              <TabsTrigger
                value="recommendations"
                className="text-xs py-3"
                aria-label="Recommendations Tab - View system recommendations"
                data-testid="recommendations-tab-mobile"
              >
                Recommendations Tab
              </TabsTrigger>
            </TabsList>
          )}

          {/* Trends Tab - Use filtered data */}
          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  Bias Score Trends ({filteredTrends.length} data points)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer
                  width="100%"
                  height={getResponsiveChartHeight()}
                >
                  <AreaChart data={filteredTrends}>
                    <defs>
                      <linearGradient
                        id="biasScoreGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#ef4444"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#ef4444"
                          stopOpacity={0.1}
                        />
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
                    <ReferenceLine
                      y={0.3}
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                      label="Warning"
                    />
                    <ReferenceLine
                      y={0.6}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                      label="High"
                    />
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
              className={`grid grid-cols-1 ${getResponsiveGridCols(2) === 2 ? 'lg:grid-cols-2' : ''} gap-6`}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Session Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer
                    width="100%"
                    height={getResponsiveChartHeight() - 100}
                  >
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
                  <ResponsiveContainer
                    width="100%"
                    height={getResponsiveChartHeight() - 100}
                  >
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

            {/* Add new Radar Chart for Bias Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Bias Metrics Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer
                  width="100%"
                  height={getResponsiveChartHeight()}
                >
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

          {/* Demographics Tab */}
          <TabsContent value="demographics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Age Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Age Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={Object.entries(demographics.age ?? {}).map(
                          ([age, count]) => ({
                            name: age,
                            value: count,
                          }),
                        )}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({
                          name,
                          percent,
                        }: {
                          name: string
                          percent?: number
                        }) => {
                          return `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
                        }}
                        animationDuration={1000}
                        animationBegin={0}
                      >
                        {Object.entries(demographics.age ?? {}).map(
                          ([age, count], index) => (
                            <Cell
                              key={`age-${age}-${count}`}
                              fill={getChartColors(
                                index,
                                Object.keys(demographics.age ?? {}).length,
                              )}
                            />
                          ),
                        )}
                      </Pie>
                      <Tooltip
                        content={({
                          active,
                          payload,
                        }: {
                          active?: boolean
                          payload?: Array<{
                            name?: string
                            value?: number
                            percent?: number
                          }>
                        }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-2 border rounded shadow">
                                <p className="font-semibold">
                                  {payload[0]?.name}
                                </p>
                                <p>Count: {payload[0]?.value}</p>
                                <p>
                                  Percentage:{' '}
                                  {payload[0]?.percent
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
                        data={Object.entries(demographics.gender ?? {}).map(
                          ([gender, count]) => ({
                            name: gender,
                            value: count,
                          }),
                        )}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#82ca9d"
                        dataKey="value"
                        label={({
                          name,
                          percent,
                        }: {
                          name: string
                          percent?: number
                        }) => {
                          return `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
                        }}
                        animationDuration={1000}
                        animationBegin={0}
                      >
                        {Object.entries(demographics.gender ?? {}).map(
                          ([gender, count], index) => (
                            <Cell
                              key={`gender-${gender}-${count}`}
                              fill={getChartColors(
                                index,
                                Object.keys(demographics.gender ?? {}).length,
                              )}
                            />
                          ),
                        )}
                      </Pie>
                      <Tooltip
                        content={({
                          active,
                          payload,
                        }: {
                          active?: boolean
                          payload?: Array<{
                            name?: string
                            value?: number
                            percent?: number
                          }>
                        }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-2 border rounded shadow">
                                <p className="font-semibold">
                                  {payload[0]?.name}
                                </p>
                                <p>Count: {payload[0]?.value}</p>
                                <p>
                                  Percentage:{' '}
                                  {payload[0]?.percent
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
                    data={Object.entries(demographics.ethnicity ?? {}).map(
                      ([ethnicity, count]) => ({
                        ethnicity,
                        count,
                      }),
                    )}
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

          {/* Alerts Tab - Use filtered data */}
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
                            e.target.checked
                              ? selectAllAlerts()
                              : clearAlertSelection()
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
                            onClick={() =>
                              handleBulkAlertAction(
                                Array.from(selectedAlerts),
                                'acknowledge',
                              )
                            }
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Acknowledge
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleBulkAlertAction(
                                Array.from(selectedAlerts),
                                'dismiss',
                              )
                            }
                          >
                            <X className="h-4 w-4 mr-1" />
                            Dismiss
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleBulkAlertAction(
                                Array.from(selectedAlerts),
                                'archive',
                              )
                            }
                          >
                            <Archive className="h-4 w-4 mr-1" />
                            Archive
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">
                        {filteredAlerts.length} alerts
                      </Badge>
                      <Badge variant="destructive">
                        {
                          filteredAlerts.filter(
                            (a) => a.level === 'critical' || a.level === 'high',
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
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">
                    {alerts.length === 0
                      ? 'No active alerts'
                      : 'No alerts match current filters'}
                  </p>
                  {alerts.length > 0 && filteredAlerts.length === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setAlertLevelFilter('all')
                        setSelectedTimeRange('24h')
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
                const actions = alertActions.get(alert.alertId) || []
                const lastAction = actions[actions.length - 1]

                return (
                  <Card
                    key={alert.alertId}
                    className={`${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        {/* Selection Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleAlertSelection(alert.alertId)}
                          className="mt-1 rounded"
                        />

                        {/* Alert Content */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3">
                              <Badge
                                className={`${getAlertColor(alert.level)} text-white`}
                              >
                                {alert.level?.toUpperCase() || 'UNKNOWN'}
                              </Badge>
                              <div>
                                <h4 className="font-semibold">{alert.type}</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {alert.message}
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Session: {alert.sessionId} •{' '}
                                  {alert.timestamp
                                    ? new Date(alert.timestamp).toLocaleString()
                                    : 'Unknown time'}
                                </p>

                                {/* Alert Status */}
                                {lastAction && (
                                  <div className="mt-2 flex items-center space-x-2">
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {lastAction.type === 'acknowledge' && (
                                        <Check className="h-3 w-3 mr-1" />
                                      )}
                                      {lastAction.type === 'dismiss' && (
                                        <X className="h-3 w-3 mr-1" />
                                      )}
                                      {lastAction.type === 'archive' && (
                                        <Archive className="h-3 w-3 mr-1" />
                                      )}
                                      {lastAction.type === 'escalate' && (
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                      )}
                                      {lastAction.type.charAt(0).toUpperCase() +
                                        lastAction.type.slice(1)}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(
                                        lastAction.timestamp,
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                )}

                                {/* Alert Notes */}
                                {alertNotes.has(alert.alertId) && (
                                  <div className="mt-2 p-2 bg-muted rounded text-sm">
                                    <strong>Notes:</strong>{' '}
                                    {alertNotes.get(alert.alertId)}
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
                                    onClick={() =>
                                      handleAlertAction(
                                        alert.alertId,
                                        'acknowledge',
                                      )
                                    }
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Acknowledge
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const notes = prompt(
                                        'Add notes (optional):',
                                      )
                                      handleAlertAction(
                                        alert.alertId,
                                        'escalate',
                                        notes || undefined,
                                      )
                                    }}
                                  >
                                    <AlertTriangle className="h-4 w-4 mr-1" />
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
                                    setAlertNotes(
                                      (prev) =>
                                        new Map(prev.set(alert.alertId, notes)),
                                    )
                                  }
                                }}
                              >
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Note
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleAlertAction(alert.alertId, 'dismiss')
                                }
                              >
                                <X className="h-4 w-4 mr-1" />
                                Dismiss
                              </Button>
                            </div>
                          </div>

                          {/* Action History */}
                          {actions.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <details className="text-sm">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                  Action History ({actions.length})
                                </summary>
                                <div className="mt-2 space-y-1">
                                  {actions.map((action) => (
                                    <div
                                      key={action.id}
                                      className="flex items-center justify-between text-xs"
                                    >
                                      <span>
                                        {action.type.charAt(0).toUpperCase() +
                                          action.type.slice(1)}
                                        {action.notes && ` - ${action.notes}`}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {new Date(
                                          action.timestamp,
                                        ).toLocaleString()}
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

          {/* Recent Sessions Tab - Use filtered data */}
          <TabsContent value="sessions" className="space-y-4">
            {filteredSessions.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">
                    {recentAnalyses.length === 0
                      ? 'No recent sessions'
                      : 'No sessions match current filters'}
                  </p>
                  {recentAnalyses.length > 0 &&
                    filteredSessions.length === 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setBiasScoreFilter('all')
                          setSelectedTimeRange('24h')
                        }}
                      >
                        Clear Filters
                      </Button>
                    )}
                </CardContent>
              </Card>
            ) : (
              filteredSessions.map((analysis) => (
                <Card key={analysis['sessionId']}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">
                          Session {analysis['sessionId']}
                        </h4>
                        <div className="flex items-center space-x-4 mt-2">
                          <span
                            className={`text-sm font-medium ${getBiasScoreColor(analysis.overallBiasScore)}`}
                          >
                            Bias Score:{' '}
                            {(analysis.overallBiasScore * 100).toFixed(1)}%
                          </span>

                          <Badge
                            variant={
                              analysis.alertLevel === 'low'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {analysis.alertLevel}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {analysis.timestamp
                            ? new Date(analysis.timestamp).toLocaleString()
                            : 'Unknown time'}
                        </p>
                        <Button size="sm" variant="outline" className="mt-2">
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations" className="space-y-4">
            {recommendations?.length > 0 ? (
              recommendations.map((rec: DashboardRecommendation) => (
                <Card key={rec.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge
                            variant={
                              rec.priority === 'critical'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {rec.priority}
                          </Badge>
                          <h4 className="font-semibold">{rec.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {rec.description}
                        </p>
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                          <Button size="sm">Implement</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">
                    No recommendations available
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
