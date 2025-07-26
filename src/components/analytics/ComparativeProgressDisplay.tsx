import { useState } from 'react'
// import { LineChart } from '../ui/charts/LineChart' // This will be in ProgressChart.tsx
import type { ComparativeProgressResult } from '../../types/analytics'
import { useComparativeProgress } from '../../hooks/useComparativeProgress'
import { ComparativeProgressControls } from './ComparativeProgressControls'
import { ProgressDataDisplay } from './ProgressDataDisplay'
import { InsightMessage } from './InsightMessage'
import { PercentileBar } from './PercentileBar'

interface ComparativeProgressDisplayProps {
  userId: string
  defaultMetric?: string
  defaultCohort?: string
  className?: string
}

// Helper components for different states. These can be moved to separate files if preferred.
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
  </div>
)

const ErrorState = ({
  message,
  retry,
}: {
  message: string
  retry: () => void
}) => (
  <div className="p-4 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300 rounded-md">
    <p className="font-medium">Error loading data</p>
    <p className="text-sm">{message}</p>
    <button
      onClick={retry}
      className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-800/30 dark:hover:bg-red-800/50 rounded-md text-sm font-medium"
    >
      Retry
    </button>
  </div>
)

const EmptyState = () => (
  <div className="p-8 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-md">
    <p className="text-gray-500 dark:text-gray-400">
      No data available for the selected metric and time period.
    </p>
    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
      Try selecting a different metric or expanding the date range.
    </p>
  </div>
)

// Configuration for metrics (label and color).
// This could also be imported from a shared constants file.
const availableMetricsForDisplay = [
  { id: 'phq9_score', label: 'Depression (PHQ-9)', color: '#3b82f6' },
  { id: 'gad7_score', label: 'Anxiety (GAD-7)', color: '#8b5cf6' },
  { id: 'engagement_rating', label: 'Session Engagement', color: '#10b981' },
  { id: 'treatment_adherence', label: 'Treatment Adherence', color: '#f59e0b' },
]

function getMetricConfig(metricId: string) {
  const config = availableMetricsForDisplay.find((m) => m.id === metricId)
  return config || { label: metricId, color: '#6366f1' } // Default
}

// Helper functions to get default date ranges
function getDefaultStartDate(): string {
  const date = new Date()
  date.setMonth(date.getMonth() - 3)
  return date.toISOString().split('T')[0]
}

function getDefaultEndDate(): string {
  return new Date().toISOString().split('T')[0]
}

// Prepares chart data from the API response
function prepareChartData(progressData: ComparativeProgressResult | null) {
  if (
    !progressData ||
    !progressData.userProgressSnapshots ||
    progressData.userProgressSnapshots.length === 0
  ) {
    return { labels: [], userData: [], benchmarkData: [] }
  }

  const sortedSnapshots = [...progressData.userProgressSnapshots].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  const labels = sortedSnapshots.map((snapshot) => {
    const date = new Date(snapshot.date)
    return `${date.getMonth() + 1}/${date.getDate()}`
  })

  const userData = sortedSnapshots.map((snapshot) => snapshot.metricValue)

  const benchmarkValues = progressData.benchmarkData
    ? Array(labels.length).fill(progressData.benchmarkData.averageValue)
    : []

  return { labels, userData, benchmarkData: benchmarkValues }
}

// Maps data trend to alert type for InsightMessage
function trendToAlertType(
  trend?: 'improving' | 'declining' | 'stable' | 'insufficient_data',
): 'info' | 'success' | 'warning' {
  if (trend === 'improving') {
    return 'success'
  }
  if (trend === 'declining') {
    return 'warning'
  }
  return 'info' // Default for stable, insufficient_data, or undefined
}

/**
 * Clamps a number between a minimum and maximum value
 */
function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function ComparativeProgressDisplay({
  userId,
  defaultMetric = 'phq9_score',
  defaultCohort = 'all_users',
  className = '',
}: ComparativeProgressDisplayProps) {
  const [metric, setMetric] = useState(defaultMetric)
  const [cohort, setCohort] = useState(defaultCohort)
  const [dateRange, setDateRange] = useState({
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
  })

  const { data, loading, error, refetch } = useComparativeProgress(
    userId,
    metric,
    cohort,
    dateRange,
  )

  const {
    labels,
    userData,
    benchmarkData: chartBenchmarkData,
  } = prepareChartData(data)
  const { label: metricLabel, color: chartColor } = getMetricConfig(metric)

  // Placeholder for availableCohorts - replace with actual data
  const availableCohorts = [
    { id: 'all_users', label: 'All Users' },
    { id: 'similar_age', label: 'Similar Age Group' },
    { id: 'similar_condition', label: 'Similar Condition' },
  ]

  return (
    <div className={`space-y-6 ${className}`}>
      <ComparativeProgressControls
        metric={metric}
        setMetric={setMetric}
        cohort={cohort}
        setCohort={setCohort}
        dateRange={dateRange}
        setDateRange={setDateRange}
        isLoading={loading}
        availableMetrics={availableMetricsForDisplay}
        availableCohorts={availableCohorts}
      />

      {loading && <LoadingSpinner />}
      {error && !loading && <ErrorState message={error} retry={refetch} />}

      {!loading &&
        !error &&
        (!data ||
          !data.userProgressSnapshots ||
          data.userProgressSnapshots.length === 0) && <EmptyState />}

      {!loading &&
        !error &&
        data &&
        data.userProgressSnapshots &&
        data.userProgressSnapshots.length > 0 && (
          <div className="space-y-6">
            <ProgressDataDisplay
              labels={labels}
              userData={userData}
              benchmarkData={chartBenchmarkData}
              color={chartColor}
              title={`${metricLabel} Progress`}
              benchmarkLabel={
                data.benchmarkData?.benchmarkDescription || 'Average'
              }
            />
            {data.comparisonInsights?.narrativeSummary && (
              <InsightMessage
                summary={data.comparisonInsights.narrativeSummary}
                trend={trendToAlertType(data.comparisonInsights.trend)}
              />
            )}
            {data.comparisonInsights?.percentileRank != null && (
              <PercentileBar
                rank={clampValue(
                  data.comparisonInsights.percentileRank,
                  0,
                  100,
                )}
              />
            )}
          </div>
        )}
    </div>
  )
}
