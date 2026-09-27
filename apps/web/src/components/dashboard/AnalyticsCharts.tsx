import { useState, useCallback, useMemo, memo } from 'react'
import type { FC } from 'react'

import { useAnalyticsDashboard } from '@/hooks/useAnalyticsDashboard'
import type {
  SessionData,
  SkillProgressData,
  MetricSummary,
  AnalyticsError,
  TimeRange,
  AnalyticsFilters,
} from '@/types/analytics'

// Loading skeleton component
const LoadingSkeleton: FC = () => (
  <div className="animate-pulse" role="status">
    <div className="mb-4 h-4 w-3/4 rounded-none bg-secondary"></div>
    <div className="space-y-2">
      <div className="h-3 rounded-none bg-secondary"></div>
      <div className="h-3 w-5/6 rounded-none bg-secondary"></div>
      <div className="h-3 w-4/6 rounded-none bg-secondary"></div>
    </div>
    <span className="sr-only">Loading data...</span>
  </div>
)

// Error boundary component
interface ErrorDisplayProps {
  error: AnalyticsError
  onRetry: () => void
}

const ErrorDisplay: FC<ErrorDisplayProps> = ({ error, onRetry }) => (
  <div
    className="rounded-none border border-ring bg-secondary p-4"
    role="alert"
  >
    <div className="flex items-center justify-between">
      <div>
        <h4 className="font-medium text-foreground">
          Unable to load analytics data
        </h4>
        <p className="mt-1 text-sm text-foreground">
          {error instanceof Error
            ? error.message
            : typeof error === 'object' && error !== null && 'message' in error
              ? error.message
              : typeof error === 'object'
                ? 'An unknown error occurred.'
                : String(error)}
        </p>
      </div>
      <button
        onClick={onRetry}
        className="rounded-none bg-primary px-3 py-1 text-sm text-primary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Retry
      </button>
    </div>
  </div>
)

// Time range selector options
const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
]

// Time range selector component
interface TimeRangeSelectorProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
}

/**
 * Memoized time range selector to prevent unnecessary re-renders. (Review suggestion)
 */
const TimeRangeSelector: FC<TimeRangeSelectorProps> = memo(
  ({ value, onChange }) => {
    return (
      <div
        className="flex space-x-2"
        role="group"
        aria-label="Time range filters"
      >
        {TIME_RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`rounded-none px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              value === option.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:bg-accent'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    )
  },
)
TimeRangeSelector.displayName = 'TimeRangeSelector'

// Session activity chart component
interface SessionChartProps {
  data: SessionData[]
  isLoading: boolean
}

const SessionChart: FC<SessionChartProps> = ({ data, isLoading }) => {
  const chartData = useMemo(() => {
    const maxSessions = Math.max(...data.map((d) => d.sessions), 1)

    return data.map((day) => {
      const dateObj = new Date(day.date)
      return {
        ...day,
        dateString: dateObj.toLocaleDateString(),
        shortWeekday: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        heightPct: `${(day.sessions / maxSessions) * 100}%`,
      }
    })
  }, [data])

  if (isLoading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="rounded-none border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Session Activity</h3>
      <div className="flex h-48 items-end space-x-2">
        {chartData.map((day) => (
          <div key={day.date} className="flex flex-1 flex-col items-center">
            <div
              role="img"
              aria-label={`${day.sessions} sessions on ${day.dateString}`}
              className="w-full rounded-none bg-primary transition-all duration-300"
              style={{
                height: day.heightPct,
                minHeight: '4px',
              }}
              title={`${day.sessions} sessions on ${day.dateString}`}
            />
            <span className="mt-2 text-xs text-muted-foreground">
              {day.shortWeekday}
            </span>
            <span className="text-xs text-muted-foreground">
              {day.sessions}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Skill progress component
interface SkillProgressProps {
  data: SkillProgressData[]
  isLoading: boolean
}

// Performance optimization: Extract static maps outside component to prevent recreation on every render and enable O(1) lookups
const TREND_ICONS: Record<'up' | 'down' | 'stable', string> = {
  up: '↗',
  down: '↘',
  stable: '→',
}

const TREND_COLORS: Record<'up' | 'down' | 'stable', string> = {
  up: 'text-foreground',
  down: 'text-muted-foreground',
  stable: 'text-muted-foreground',
}

const SkillProgress: FC<SkillProgressProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return <LoadingSkeleton />
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') =>
    TREND_ICONS[trend] ?? TREND_ICONS.stable
  const getTrendColor = (trend: 'up' | 'down' | 'stable') =>
    TREND_COLORS[trend] ?? TREND_COLORS.stable

  return (
    <div className="rounded-none border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Skill Progress</h3>
      <div className="space-y-4">
        {data.map((skill) => (
          <div key={skill.skill}>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">{skill.skill}</span>
                <span
                  className={`text-sm ${getTrendColor(skill.trend)}`}
                  aria-hidden="true"
                  title={`Trend: ${skill.trend}`}
                >
                  {getTrendIcon(skill.trend)}
                </span>
                <span className="sr-only">Trend: {skill.trend}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {skill.score}%
              </span>
            </div>
            <div
              className="h-2 w-full rounded-none bg-secondary"
              role="progressbar"
              aria-label={`${skill.skill} progress`}
              aria-valuenow={skill.score}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-2 rounded-none bg-primary transition-all duration-500"
                style={{ width: `${skill.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Performance optimization: Extract static map outside component to prevent recreation on every render and enable O(1) lookups
const COLOR_CLASSES_MAP: Record<string, string> = {
  blue: 'text-foreground',
  green: 'text-foreground',
  purple: 'text-foreground',
  orange: 'text-foreground',
  red: 'text-foreground',
}

// Summary stats component
interface SummaryStatsProps {
  data: MetricSummary[]
  isLoading: boolean
}

const SummaryStats: FC<SummaryStatsProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-none border border-border bg-card p-4"
          >
            <LoadingSkeleton />
          </div>
        ))}
      </div>
    )
  }

  const getColorClasses = (color?: string) => {
    if (color === undefined) {
      throw new Error('Not implemented yet: undefined case')
    }
    return COLOR_CLASSES_MAP[color] ?? 'text-muted-foreground'
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {data.map((stat) => (
        <div
          key={stat.label}
          className="rounded-none border border-border bg-card p-4 text-center"
        >
          <div className={`text-2xl font-bold ${getColorClasses(stat.color)}`}>
            {typeof stat.value === 'number'
              ? stat.value.toLocaleString()
              : stat.value}
          </div>
          <div className="text-sm text-muted-foreground">{stat.label}</div>
          {stat.trend && (
            <div className="mt-1 text-xs text-muted-foreground">
              <span
                className={
                  stat.trend.direction === 'up'
                    ? 'text-foreground'
                    : stat.trend.direction === 'down'
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground'
                }
              >
                {stat.trend.direction === 'up'
                  ? '↗'
                  : stat.trend.direction === 'down'
                    ? '↘'
                    : '→'}{' '}
                {stat.trend.value}%
              </span>
              <span className="ml-1">{stat.trend.period}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Main analytics charts component
export const AnalyticsCharts: FC = () => {
  // State for filters
  const [filters, setFilters] = useState<AnalyticsFilters>({
    timeRange: '7d',
    userSegment: 'all',
  })

  // Use production-grade analytics hook
  const { data, isLoading, error, refetch } = useAnalyticsDashboard(filters, {
    refreshInterval: 300000, // 5 minutes
    enableAutoRefresh: true,
  })

  // Handle retry
  const handleRetry = useCallback(() => {
    void refetch()
  }, [refetch])

  // Handle time range change
  const handleTimeRangeChange = useCallback((timeRange: TimeRange) => {
    setFilters((prev) => ({ ...prev, timeRange }))
  }, [])

  return (
    <div className="analytics-charts space-y-6">
      {/* Persistent ARIA live region for assertive announcements like errors */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {error && !isLoading ? 'Unable to load analytics data' : ''}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Analytics Overview</h2>
        <TimeRangeSelector
          value={filters.timeRange}
          onChange={handleTimeRangeChange}
        />
      </div>

      {/* Render error state */}
      {error && !isLoading ? (
        <ErrorDisplay error={error} onRetry={handleRetry} />
      ) : (
        <>
          {/* Summary Statistics */}
          <SummaryStats data={data?.summaryStats ?? []} isLoading={isLoading} />

          {/* Session Activity Chart */}
          <SessionChart
            data={data?.sessionMetrics ?? []}
            isLoading={isLoading}
          />

          {/* Skill Progress */}
          <SkillProgress
            data={data?.skillProgress ?? []}
            isLoading={isLoading}
          />

          {/* Data freshness indicator */}
          {data && !isLoading && (
            <div className="text-center text-xs text-muted-foreground">
              Data updated {new Date().toLocaleTimeString()}
            </div>
          )}
        </>
      )}
    </div>
  )
}
