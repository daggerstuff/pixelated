import { useMemo, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

import { Alert, Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { isAlertItemArray, isBiasAnalysisItemArray, isTrendItemArray } from '@/components/admin/bias-detection/utils/dashboard-type-guards'

import type { BiasDashboardData, BiasAnalysisItem, AlertItem } from './BiasDashboard.types'
import type { BiasDashboardProps } from './BiasDashboard.types'
import { timeRangeOptions, demographicFilterOptions } from './BiasDashboard.types'
import { getAlertColor, getBiasScoreColor, getChartColors, getFilteredData } from './BiasDashboard.helpers'
import {
  useAccessibility,
  useAlertActions,
  useBiasDashboardData,
  useConnectionStatus,
  useExportData,
  useFilters,
  useNotificationSettings,
} from './BiasDashboard.hooks'
import {
  AccessibilitySkipLinks,
  AlertsTab,
  CriticalAlerts,
  DemographicsTab,
  ExportDialog,
  FilteringControls,
  Header,
  HighBiasAlertNotification,
  NotificationSettingsPanel,
  RecommendationsTab,
  SessionsTab,
  SummaryCards,
  TrendsTab,
} from './BiasDashboard.components'

export const BiasDashboard: React.FC<BiasDashboardProps> = ({
  className = '',
  refreshInterval = 30000,
  enableRealTimeUpdates = true,
}) => {
  // ── Accessibility ──────────────────────────────────────────────────
  const {
    isMobile,
    isTablet,
    highContrast,
    reducedMotion,
    announcements,
    announceToScreenReader,
    skipLinkRef,
    mainContentRef,
  } = useAccessibility()

  // ── Filters ────────────────────────────────────────────────────────
  const {
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
  } = useFilters()

  // ── Dashboard Data (fetch + WebSocket) ────────────────────────────
  const {
    dashboardData,
    loading,
    error,
    lastUpdated,
    newHighBiasAlert,
    setNewHighBiasAlert,
    wsConnectionStatus,
    wsRef,
    fetchDashboardData,
  } = useBiasDashboardData(refreshInterval, enableRealTimeUpdates)

  // ── Connection Status ──────────────────────────────────────────────
  const { connectionStatus, reconnectWebSocket } = useConnectionStatus(
    wsConnectionStatus,
    wsRef,
    enableRealTimeUpdates,
    announceToScreenReader,
  )

  // ── Alert Actions ──────────────────────────────────────────────────
  const {
    selectedAlerts,
    alertActions,
    alertNotes,
    setAlertNotes,
    handleAlertAction,
    handleBulkAlertAction,
    toggleAlertSelection,
    selectAllAlerts,
    clearAlertSelection,
  } = useAlertActions({
    dashboardData,
    selectedTimeRange,
    alertLevelFilter,
    biasScoreFilter,
    customDateRange,
  })

  // ── Notification Settings ──────────────────────────────────────────
  const {
    notificationSettings,
    showNotificationSettings,
    setShowNotificationSettings,
    updateNotificationSettings,
    sendTestNotification,
  } = useNotificationSettings()

  // ── Export Data ────────────────────────────────────────────────────
  const {
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
  } = useExportData({
    selectedTimeRange,
    biasScoreFilter,
    alertLevelFilter,
    selectedDemographicFilter,
    customDateRange,
  })

  // ── Auto-refresh state (local toggle) ──────────────────────────────
  const [autoRefresh, setAutoRefresh] = useState(enableRealTimeUpdates)

  // ── Resolved data + filtered datasets ──────────────────────────────
  const filterParams = {
    selectedTimeRange,
    alertLevelFilter,
    biasScoreFilter,
    customDateRange,
  }

  const resolvedDashboardData =
    dashboardData ??
    ({
      summary: {
        totalSessions: 0,
        averageBiasScore: 0,
        alertsLayerBreakdown: {},
        alertsLast24h: 0,
        activeAlerts: 0,
        trendDirection: 'stable',
        alerts: { low: 0, medium: 0, high: 0, critical: 0 },
        complianceScore: 0,
      },
      recentAnalyses: [],
      alerts: [],
      trends: [],
      demographics: {
        age: {},
        gender: {},
        ethnicity: {},
      },
      recommendations: [],
    } satisfies BiasDashboardData)

  const { summary, recentAnalyses, alerts, trends, demographics, recommendations } =
    resolvedDashboardData

  const filteredTrends = useMemo<BiasDashboardData['trends']>(() => {
    const data = getFilteredData(trends, 'trends', filterParams)
    return isTrendItemArray(data) ? data : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTimeRange, alertLevelFilter, biasScoreFilter, customDateRange, trends])

  const filteredAlerts = useMemo<AlertItem[]>(() => {
    const data = getFilteredData(alerts, 'alerts', filterParams)
    return isAlertItemArray(data) ? data : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTimeRange, alertLevelFilter, biasScoreFilter, customDateRange, alerts])

  const filteredSessions = useMemo<BiasAnalysisItem[]>(() => {
    const data = getFilteredData(recentAnalyses, 'sessions', filterParams)
    return isBiasAnalysisItemArray(data) ? data : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTimeRange, alertLevelFilter, biasScoreFilter, customDateRange, recentAnalyses])

  // ── Early returns ──────────────────────────────────────────────────
  if (loading && !dashboardData) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex h-64 items-center justify-center">
          <RefreshCw className="text-neutral-500 h-8 w-8 animate-spin" />
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
                <RefreshCw className="mr-2 h-4 w-4" />
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

  // ── Main render ────────────────────────────────────────────────────
  return (
    <div
      className={`space-y-6 p-6 ${className} ${highContrast ? 'high-contrast' : ''}`}
    >
      <HighBiasAlertNotification
        newHighBiasAlert={newHighBiasAlert}
        onDismiss={() => setNewHighBiasAlert(null)}
      />

      <AccessibilitySkipLinks
        skipLinkRef={skipLinkRef}
        mainContentRef={mainContentRef}
        announceToScreenReader={announceToScreenReader}
        announcements={announcements}
      />

      <Header
        isMobile={isMobile}
        lastUpdated={lastUpdated}
        enableRealTimeUpdates={enableRealTimeUpdates}
        connectionStatus={connectionStatus}
        autoRefresh={autoRefresh}
        loading={loading}
        wsConnectionStatus={wsConnectionStatus}
        showNotificationSettings={showNotificationSettings}
        handlers={{
          setAutoRefresh,
          fetchDashboardData,
          reconnectWebSocket,
          setShowNotificationSettings,
          setShowExportDialog,
        }}
      />

      <NotificationSettingsPanel
        showNotificationSettings={showNotificationSettings}
        notificationSettings={notificationSettings}
        updateNotificationSettings={updateNotificationSettings}
        sendTestNotification={sendTestNotification}
        onClose={() => setShowNotificationSettings(false)}
      />

      <ExportDialog
        showExportDialog={showExportDialog}
        exportFormat={exportFormat}
        setExportFormat={setExportFormat}
        exportDateRange={exportDateRange}
        setExportDateRange={setExportDateRange}
        exportDataTypes={exportDataTypes}
        setExportDataTypes={setExportDataTypes}
        exportFilters={exportFilters}
        setExportFilters={setExportFilters}
        exportProgress={exportProgress}
        exportDataWithOptions={exportDataWithOptions}
        onClose={() => setShowExportDialog(false)}
      />

      <FilteringControls
        selectedTimeRange={selectedTimeRange}
        setSelectedTimeRange={setSelectedTimeRange}
        customDateRange={customDateRange}
        setCustomDateRange={setCustomDateRange}
        biasScoreFilter={biasScoreFilter}
        setBiasScoreFilter={setBiasScoreFilter}
        alertLevelFilter={alertLevelFilter}
        setAlertLevelFilter={setAlertLevelFilter}
        selectedDemographicFilter={selectedDemographicFilter}
        setSelectedDemographicFilter={setSelectedDemographicFilter}
        timeRangeOptions={timeRangeOptions}
        demographicFilterOptions={demographicFilterOptions}
      />

      <CriticalAlerts filteredAlerts={filteredAlerts} />

      <SummaryCards
        summary={summary}
        filteredSessions={filteredSessions}
        filteredAlerts={filteredAlerts}
        alerts={alerts}
        getBiasScoreColor={getBiasScoreColor}
      />

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
              className={isMobile ? 'py-3 text-xs' : ''}
              aria-label="Trends Tab - View bias trends and analytics"
              data-testid="trends-tab"
            >
              {isMobile ? 'Trends' : 'Trends Tab'}
            </TabsTrigger>
            <TabsTrigger
              value="demographics"
              className={isMobile ? 'py-3 text-xs' : ''}
              aria-label="Demographics Tab - View demographic breakdown"
              data-testid="demographics-tab"
            >
              {isMobile ? 'Demo' : 'Demographics Tab'}
            </TabsTrigger>
            <TabsTrigger
              value="alerts"
              className={isMobile ? 'py-3 text-xs' : ''}
              aria-label={`Alerts Tab - View alerts. ${filteredAlerts.length} alerts currently active`}
              data-testid="alerts-tab"
            >
              {isMobile ? 'Alerts' : 'Alerts Tab'}
              {filteredAlerts.length > 0 && (
                <span
                  className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
                  aria-label={`${filteredAlerts.length} active alerts`}
                >
                  {filteredAlerts.length}
                </span>
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
            <TabsList className="mt-2 grid w-full grid-cols-2">
              <TabsTrigger
                value="sessions"
                className="py-3 text-xs"
                aria-label="Recent Sessions Tab - View recent session data"
                data-testid="sessions-tab-mobile"
              >
                Sessions Tab
              </TabsTrigger>
              <TabsTrigger
                value="recommendations"
                className="py-3 text-xs"
                aria-label="Recommendations Tab - View system recommendations"
                data-testid="recommendations-tab-mobile"
              >
                Recommendations Tab
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="trends" className="space-y-6">
            <TrendsTab
              filteredTrends={filteredTrends}
              isMobile={isMobile}
              isTablet={isTablet}
              reducedMotion={reducedMotion}
              getChartColors={getChartColors}
              getResponsiveChartHeight={(isMobile: boolean, isTablet: boolean) =>
                isMobile ? 200 : isTablet ? 300 : 400
              }
              getResponsiveGridCols={(defaultCols: number, isMobile: boolean, isTablet: boolean) =>
                isMobile ? 1 : isTablet ? 2 : defaultCols
              }
            />
          </TabsContent>

          <TabsContent value="demographics" className="space-y-6">
            <DemographicsTab demographics={demographics} getChartColors={getChartColors} />
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <AlertsTab
              filteredAlerts={filteredAlerts}
              selectedAlerts={selectedAlerts}
              alertActions={alertActions}
              alertNotes={alertNotes}
              setAlertNotes={setAlertNotes}
              handleAlertAction={handleAlertAction}
              handleBulkAlertAction={handleBulkAlertAction}
              toggleAlertSelection={toggleAlertSelection}
              selectAllAlerts={selectAllAlerts}
              clearAlertSelection={clearAlertSelection}
              setAlertLevelFilter={setAlertLevelFilter}
              setSelectedTimeRange={setSelectedTimeRange}
              getAlertColor={getAlertColor}
            />
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <SessionsTab
              filteredSessions={filteredSessions}
              recentAnalyses={recentAnalyses}
              setBiasScoreFilter={setBiasScoreFilter}
              setSelectedTimeRange={setSelectedTimeRange}
              getBiasScoreColor={getBiasScoreColor}
            />
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6">
            <RecommendationsTab recommendations={recommendations} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default BiasDashboard
