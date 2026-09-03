/**
 * Custom hooks for BiasDashboard — extracted from BiasDashboard.tsx to reduce file size.
 * Each hook encapsulates a logical domain of state + effects + callbacks.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Activity, RefreshCw, AlertTriangle } from 'lucide-react'
import type React from 'react'

import { useBiasDashboardWebSocket } from '@/components/admin/bias-detection/hooks/useBiasDashboardWebSocket'
import {
  isAlertItemArray,
  isBiasAnalysisItemArray,
  isTrendItemArray,
} from '@/components/admin/bias-detection/utils/dashboard-type-guards'
import { exportBiasDashboardData } from '@/components/admin/bias-detection/utils/export-dashboard-data'
import type {
  BiasDashboardData,
  BiasAnalysisResult,
  DashboardRecommendation,
  BiasAlert,
} from '@/lib/ai/bias-detection'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { isObject } from '@/lib/utils'

import type {
  AlertAction,
  AlertItem,
  BiasAnalysisItem,
  BiasDashboardProps,
  NotificationSettings,
  TrendItem,
} from './BiasDashboard.types'
import { getFilteredData } from './BiasDashboard.helpers'

const logger = createBuildSafeLogger('bias-dashboard')

/* ------------------------------------------------------------------ */
/* useBiasDashboardData                                                */
/* ------------------------------------------------------------------ */

export function useBiasDashboardData(refreshInterval: number, autoRefresh: boolean) {
  const [dashboardData, setDashboardData] = useState<BiasDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [newHighBiasAlert, setNewHighBiasAlert] = useState<AlertItem | null>(null)

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/bias-detection/dashboard')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const json = await response.json()
      const data: BiasDashboardData = json.success ? json.data : json
      if (!data || !data.summary) {
        throw new Error('Invalid dashboard data received')
      }
      setDashboardData(data)
      setLastUpdated(new Date())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard'
      setError(message)
      logger.error('Failed to fetch dashboard data', { error: message })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleWebSocketMessage = useCallback(
    (event: MessageEvent, socket: WebSocket) => {
      try {
        const message = JSON.parse(event.data)
        switch (message.type) {
          case 'bias_alert': {
            const alert: AlertItem = message.data
            setDashboardData((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                alerts: [alert, ...prev.alerts],
                summary: {
                  ...prev.summary,
                  alertsLast24h: (prev.summary.alertsLast24h ?? 0) + 1,
                  activeAlerts: (prev.summary.activeAlerts ?? 0) + 1,
                },
              }
            })
            if (alert.level === 'high' || alert.level === 'critical') {
              setNewHighBiasAlert(alert)
            }
            setLastUpdated(new Date())
            break
          }
          case 'session_update': {
            const session: BiasAnalysisItem = message.data
            setDashboardData((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                recentAnalyses: [session, ...prev.recentAnalyses].slice(0, 50),
              }
            })
            break
          }
          case 'metrics_update': {
            const metrics = message.data
            setDashboardData((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                summary: { ...prev.summary, ...metrics },
              }
            })
            break
          }
          case 'trends_update': {
            const trends: TrendItem[] = message.data
            setDashboardData((prev) => {
              if (!prev) return prev
              return { ...prev, trends }
            })
            break
          }
          case 'connection_status':
            logger.info('WebSocket connection status', { status: message.data?.status })
            break
          case 'heartbeat':
            try {
              socket.send(JSON.stringify({ type: 'heartbeat_response' }))
            } catch {
              // ignore
            }
            break
        }
      } catch {
        logger.error('Failed to parse WebSocket message')
      }
    },
    [],
  )

  const ws = useBiasDashboardWebSocket({
    onMessage: handleWebSocketMessage,
    enabled: autoRefresh,
  })

  // Auto-refresh effect
  useEffect(() => {
    void fetchDashboardData()
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => void fetchDashboardData(), refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchDashboardData, autoRefresh, refreshInterval])

  return {
    dashboardData,
    setDashboardData,
    loading,
    error,
    lastUpdated,
    newHighBiasAlert,
    setNewHighBiasAlert,
    wsConnected: ws.connected,
    wsConnectionStatus: ws.connectionStatus,
    wsReconnectAttempts: ws.reconnectAttempts,
    wsRef: ws.wsRef,
    fetchDashboardData,
  }
}

/* ------------------------------------------------------------------ */
/* useAlertActions                                                     */
/* ------------------------------------------------------------------ */

interface UseAlertActionsParams {
  dashboardData: BiasDashboardData | null
  selectedTimeRange: string
  alertLevelFilter: string
  biasScoreFilter: string
  customDateRange: { start: Date; end: Date }
}

export function useAlertActions(params: UseAlertActionsParams) {
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set())
  const [alertActions, setAlertActions] = useState<Map<string, AlertAction[]>>(new Map())
  const [alertNotes, setAlertNotes] = useState<Map<string, string>>(new Map())

  const handleAlertAction = useCallback(
    async (alertId: string, action: AlertAction['type'], notes?: string) => {
      try {
        const response = await fetch(`/api/bias-detection/alerts/${alertId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, notes }),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const alertAction: AlertAction = {
          id: crypto.randomUUID(),
          type: action,
          timestamp: new Date().toISOString(),
          userId: 'current-user',
          ...(notes ? { notes } : {}),
        }

        setAlertActions((prev) => {
          const next = new Map(prev)
          const existing = next.get(alertId) ?? []
          next.set(alertId, [...existing, alertAction])
          return next
        })

        setDashboardDataProxy((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            alerts: prev.alerts.map((a) =>
              a.alertId === alertId
                ? { ...a, status: action, acknowledged: true, timestamp: new Date().toISOString() }
                : a,
            ),
          }
        })
      } catch (err) {
        logger.error('Failed to perform alert action', { alertId, error: err })
      }
    },
    [],
  )

  // Proxy to update dashboard data alerts — used internally by handleAlertAction
  const [dashboardDataProxy, setDashboardDataProxy] = useState<BiasDashboardData | null>(
    params.dashboardData,
  )
  useEffect(() => {
    setDashboardDataProxy(params.dashboardData)
  }, [params.dashboardData])

  const handleBulkAlertAction = useCallback(
    async (alertIds: string[], action: AlertAction['type']) => {
      for (const id of alertIds) {
        await handleAlertAction(id, action)
      }
      setSelectedAlerts(new Set())
    },
    [handleAlertAction],
  )

  const toggleAlertSelection = useCallback((alertId: string) => {
    setSelectedAlerts((prev) => {
      const next = new Set(prev)
      if (next.has(alertId)) {
        next.delete(alertId)
      } else {
        next.add(alertId)
      }
      return next
    })
  }, [])

  const selectAllAlerts = useCallback(() => {
    if (!params.dashboardData?.alerts) return
    const filtered = getFilteredData(params.dashboardData.alerts, 'alerts', {
      selectedTimeRange: params.selectedTimeRange,
      alertLevelFilter: params.alertLevelFilter,
      biasScoreFilter: params.biasScoreFilter,
      customDateRange: params.customDateRange,
    })
    if (isAlertItemArray(filtered)) {
      setSelectedAlerts(new Set(filtered.map((a) => a.alertId)))
    }
  }, [params])

  const clearAlertSelection = useCallback(() => {
    setSelectedAlerts(new Set())
  }, [])

  return {
    selectedAlerts,
    alertActions,
    alertNotes,
    setAlertNotes,
    handleAlertAction,
    handleBulkAlertAction,
    toggleAlertSelection,
    selectAllAlerts,
    clearAlertSelection,
    setDashboardData: setDashboardDataProxy,
  }
}

/* ------------------------------------------------------------------ */
/* useNotificationSettings                                             */
/* ------------------------------------------------------------------ */

export function useNotificationSettings() {
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    smsEnabled: false,
    inAppEnabled: true,
    criticalAlerts: true,
    highAlerts: true,
    mediumAlerts: false,
    lowAlerts: false,
  })
  const [showNotificationSettings, setShowNotificationSettings] = useState(false)

  const updateNotificationSettings = useCallback(
    async (newSettings: Partial<NotificationSettings>) => {
      const previous = notificationSettings
      setNotificationSettings((prev) => ({ ...prev, ...newSettings }))
      try {
        const response = await fetch('/api/bias-detection/notification-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
      } catch (err) {
        setNotificationSettings(previous)
        logger.error('Failed to update notification settings', { error: err })
      }
    },
    [notificationSettings],
  )

  const sendTestNotification = useCallback(async () => {
    try {
      const response = await fetch('/api/bias-detection/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationSettings),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      alert('Test notification sent successfully')
    } catch {
      alert('Failed to send test notification')
    }
  }, [notificationSettings])

  return {
    notificationSettings,
    showNotificationSettings,
    setShowNotificationSettings,
    updateNotificationSettings,
    sendTestNotification,
  }
}

/* ------------------------------------------------------------------ */
/* useAccessibility                                                    */
/* ------------------------------------------------------------------ */

export function useAccessibility() {
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const [screenSize, setScreenSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })
  const [highContrast, setHighContrast] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [announcements, setAnnouncements] = useState<string[]>([])

  const skipLinkRef = useRef<HTMLButtonElement>(null)
  const mainContentRef = useRef<HTMLDivElement>(null)

  const announceToScreenReader = useCallback((message: string) => {
    setAnnouncements((prev) => [...prev, message])
    setTimeout(() => {
      setAnnouncements((prev) => prev.filter((a) => a !== message))
    }, 5000)
  }, [])

  const checkAccessibilityPreferences = useCallback(() => {
    if (typeof window === 'undefined') return
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(motionQuery.matches)
    const contrastQuery = window.matchMedia('(prefers-contrast: more)')
    setHighContrast(contrastQuery.matches)
  }, [])

  const updateScreenSize = useCallback(() => {
    if (typeof window === 'undefined') return
    const width = window.innerWidth
    const height = window.innerHeight
    setIsMobile(width < 768)
    setIsTablet(width >= 768 && width < 1024)
    setScreenSize({ width, height })
  }, [])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'm') {
        event.preventDefault()
        mainContentRef.current?.focus()
      }
      if (event.altKey && event.key === 'a') {
        event.preventDefault()
        announceToScreenReader('Navigating to alerts section')
      }
      if (event.key === 'Escape') {
        // Close dialogs — handled by parent components
      }
    },
    [announceToScreenReader],
  )

  useEffect(() => {
    updateScreenSize()
    checkAccessibilityPreferences()
    window.addEventListener('resize', updateScreenSize)
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const contrastQuery = window.matchMedia('(prefers-contrast: more)')
    motionQuery.addEventListener('change', checkAccessibilityPreferences)
    contrastQuery.addEventListener('change', checkAccessibilityPreferences)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('resize', updateScreenSize)
      motionQuery.removeEventListener('change', checkAccessibilityPreferences)
      contrastQuery.removeEventListener('change', checkAccessibilityPreferences)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [updateScreenSize, checkAccessibilityPreferences, handleKeyDown])

  return {
    isMobile,
    isTablet,
    screenSize,
    highContrast,
    reducedMotion,
    announcements,
    announceToScreenReader,
    skipLinkRef,
    mainContentRef,
  }
}

/* ------------------------------------------------------------------ */
/* useExportData                                                       */
/* ------------------------------------------------------------------ */

interface UseExportDataParams {
  selectedTimeRange: string
  biasScoreFilter: string
  alertLevelFilter: string
  selectedDemographicFilter: string
  customDateRange: { start: Date; end: Date }
  dashboardData: BiasDashboardData | null
}

export function useExportData(params: UseExportDataParams) {
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>('json')
  const [exportDateRange, setExportDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date(),
  })
  const [exportDataTypes, setExportDataTypes] = useState({
    summary: true,
    alerts: true,
    trends: true,
    demographics: true,
    sessions: true,
    recommendations: true,
  })
  const [exportFilters, setExportFilters] = useState({
    applyCurrentFilters: true,
    includeArchived: false,
    minBiasScore: 0,
    maxBiasScore: 1,
  })
  const [exportProgress, setExportProgress] = useState({
    isExporting: false,
    progress: 0,
    status: '',
  })

  const exportDataWithOptions = useCallback(async () => {
    return exportBiasDashboardData({
      format: exportFormat,
      exportDateRange,
      exportDataTypes,
      exportFilters,
      selectedTimeRange: params.selectedTimeRange,
      biasScoreFilter: params.biasScoreFilter,
      alertLevelFilter: params.alertLevelFilter,
      selectedDemographicFilter: params.selectedDemographicFilter,
      customDateRange: params.customDateRange,
      setExportProgress,
      setShowExportDialog,
      logger: {
        info: (message: string, details?: unknown) => logger.info(message, details),
        error: (message: string, details?: unknown) => logger.error(message, details),
      },
      dashboardData: params.dashboardData,
    })
  }, [
    exportFormat,
    exportDateRange,
    exportDataTypes,
    exportFilters,
    params.selectedTimeRange,
    params.biasScoreFilter,
    params.alertLevelFilter,
    params.selectedDemographicFilter,
    params.customDateRange,
    params.dashboardData,
  ])

  return {
    showExportDialog,
    setShowExportDialog,
    exportFormat,
    setExportFormat,
    exportDateRange,
    setExportDateRange,
    exportDataTypes,
    setExportDataTypes,
    exportFilters,
    setExportFilters,
    exportProgress,
    exportDataWithOptions,
  }
}

/* ------------------------------------------------------------------ */
/* useConnectionStatus                                                 */
/* ------------------------------------------------------------------ */

export function useConnectionStatus(
  wsConnectionStatus: string,
  wsReconnectAttempts: number,
  wsRef: React.MutableRefObject<WebSocket | null>,
  enableRealTimeUpdates: boolean,
  announceToScreenReader: (msg: string) => void,
) {
  const connectionStatus = useMemo(() => {
    switch (wsConnectionStatus) {
      case 'connected':
        return {
          text: 'Live updates connected',
          color: 'text-neutral-600',
          icon: <Activity className="mr-1 h-3 w-3" />,
          pulse: false,
        }
      case 'connecting':
        return {
          text: 'Connecting to live updates...',
          color: 'text-neutral-700',
          icon: <RefreshCw className="mr-1 h-3 w-3 animate-spin" />,
          pulse: true,
        }
      case 'reconnecting':
        return {
          text: `Reconnecting... (attempt ${wsReconnectAttempts})`,
          color: 'text-neutral-800',
          icon: <RefreshCw className="mr-1 h-3 w-3 animate-spin" />,
          pulse: true,
        }
      case 'error':
        return {
          text: 'Live updates failed',
          color: 'text-neutral-900',
          icon: <AlertTriangle className="mr-1 h-3 w-3" />,
          pulse: false,
        }
      case 'disconnected':
        return {
          text: 'Disconnected from live updates',
          color: 'text-gray-400',
          icon: <Activity className="mr-1 h-3 w-3" />,
          pulse: false,
        }
      default:
        return {
          text: 'Live updates disabled',
          color: 'text-gray-500',
          icon: <Activity className="mr-1 h-3 w-3" />,
          pulse: false,
        }
    }
  }, [wsConnectionStatus, wsReconnectAttempts])

  const reconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      const ws = wsRef.current as WebSocket & {
        heartbeatInterval?: ReturnType<typeof setInterval>
      }
      if (ws.heartbeatInterval) {
        clearInterval(ws.heartbeatInterval)
      }
      wsRef.current.close(1000, 'Manual reconnection')
      wsRef.current = null
    }

    if (enableRealTimeUpdates) {
      setTimeout(() => {
        // The useEffect in useBiasDashboardWebSocket will handle reconnection
      }, 100)
    }

    announceToScreenReader('Manually reconnecting to live updates')
    logger.info('Manual WebSocket reconnection initiated')
  }, [enableRealTimeUpdates, announceToScreenReader, wsRef])

  return { connectionStatus, reconnectWebSocket }
}

/* ------------------------------------------------------------------ */
/* useFilters                                                          */
/* ------------------------------------------------------------------ */

export function useFilters() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h')
  const [selectedDemographicFilter, setSelectedDemographicFilter] = useState('all')
  const [biasScoreFilter, setBiasScoreFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all')
  const [alertLevelFilter, setAlertLevelFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all')
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date(),
  })

  return {
    selectedTimeRange,
    setSelectedTimeRange,
    selectedDemographicFilter,
    setSelectedDemographicFilter,
    biasScoreFilter,
    setBiasScoreFilter,
    alertLevelFilter,
    setAlertLevelFilter,
    customDateRange,
    setCustomDateRange,
  }
}
