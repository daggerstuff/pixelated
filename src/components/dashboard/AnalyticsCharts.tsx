import { useState, useCallback, useMemo } from 'react'
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
  <div className='animate-pulse'>
    <div className='bg-gray-200 mb-4 h-4 w-3/4 rounded'></div>
    <div className='space-y-2'>
      <div className='bg-gray-200 h-3 rounded'></div>
      <div className='bg-gray-200 h-3 w-5/6 rounded'></div>
      <div className='bg-gray-200 h-3 w-4/6 rounded'></div>
    </div>
  </div>
)

// Error boundary component
interface ErrorDisplayProps {
  error: AnalyticsError
  onRetry: () => void
}

const ErrorDisplay: FC<ErrorDisplayProps> = ({ error, onRetry }) => (
  <div className='bg-red-50 border-red-200 rounded-lg border p-4'>
    <div className='flex items-center justify-between'>
      <div>
        <h4 className='text-red-800 font-medium'>
          Unable to load analytics data
        </h4>
        <p className='text-red-600 mt-1 text-sm'>{String(error)}</p>
      </div>
      <button
        onClick={onRetry}
        className='bg-red-600 text-white hover:bg-red-700 rounded px-3 py-1 text-sm transition-colors'
      >
        Retry
      </button>
    </div>
  </div>
)

// Time range selector component
interface TimeRangeSelectorProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
}

const TimeRangeSelector: FC<TimeRangeSelectorProps> = ({ value, onChange }) => {
  const options: { value: TimeRange; label: string }[] = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ]

  return (
    <div className='flex space-x-2'>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`rounded px-3 py-1 text-sm transition-colors ${
            value === option.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// Session activity chart component
interface SessionChartProps {
  data: SessionData[]
  isLoading: boolean
}

const SessionChart: FC<SessionChartProps> = ({ data, isLoading }) => {
  const maxSessions = useMemo(() => {
    return Math.max(...data.map((d) => d.sessions), 1)
  }, [data])

  if (isLoading) {
    return <LoadingSkeleton />
  }

  return (
    <div className='bg-white rounded-lg p-6 shadow'>
      <h3 className='mb-4 text-lg font-semibold'>Session Activity</h3>
      <div className='flex h-48 items-end space-x-2'>
        {data.map((day) => (
          <div key={day.date} className='flex flex-1 flex-col items-center'>
            <div
              className='bg-blue-500 hover:bg-blue-600 w-full rounded-t transition-all duration-300'
              style={{
                height: `${(day.sessions / maxSessions) * 100}%`,
                minHeight: '4px',
              }}
              title={`${day.sessions} sessions on ${new Date(day.date).toLocaleDateString()}`}
            />
            <span className='text-gray-600 mt-2 text-xs'>
              {new Date(day.date).toLocaleDateString('en-US', {
                weekday: 'short',
              })}
            </span>
            <span className='text-gray-500 text-xs'>{day.sessions}</span>
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

const SkillProgress: FC<SkillProgressProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return <LoadingSkeleton />
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return '↗'
      case 'down':
        return '↘'
      case 'stable':
        return '→'
    }
  }

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      case 'stable':
        return 'text-gray-600'
    }
  }

  return (
    <div className='bg-white rounded-lg p-6 shadow'>
      <h3 className='mb-4 text-lg font-semibold'>Skill Progress</h3>
      <div className='space-y-4'>
        {data.map((skill) => (
          <div key={skill.skill}>
            <div className='mb-2 flex items-center justify-between'>
              <div className='flex items-center space-x-2'>
                <span className='text-sm font-medium'>{skill.skill}</span>
                <span className={`text-sm ${getTrendColor(skill.trend)}`}>
                  {getTrendIcon(skill.trend)}
                </span>
              </div>
              <span className='text-gray-600 text-sm'>{skill.score}%</span>
            </div>
            <div className='bg-gray-200 h-2 w-full rounded-full'>
              <div
                className='bg-green-500 h-2 rounded-full transition-all duration-500'
                style={{ width: `${skill.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Summary stats component
interface SummaryStatsProps {
  data: MetricSummary[]
  isLoading: boolean
}

const SummaryStats: FC<SummaryStatsProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        {[1, 2, 3].map((i) => (
          <div key={i} className='bg-white rounded-lg p-4 shadow'>
            <LoadingSkeleton />
          </div>
        ))}
      </div>
    )
  }

  const getColorClasses = (color?: string) => {
    switch (color) {
      case 'blue':
        return 'text-blue-600'
      case 'green':
        return 'text-green-600'
      case 'purple':
        return 'text-purple-600'
      case 'orange':
        return 'text-orange-600'
      case 'red':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
      {data.map((stat) => (
        <div
          key={stat.label}
          className='bg-white rounded-lg p-4 text-center shadow'
        >
          <div className={`text-2xl font-bold ${getColorClasses(stat.color)}`}>
            {typeof stat.value === 'number'
              ? stat.value.toLocaleString()
              : stat.value}
          </div>
          <div className='text-gray-600 text-sm'>{stat.label}</div>
          {stat.trend && (
            <div className='text-gray-500 mt-1 text-xs'>
              <span
                className={
                  stat.trend.direction === 'up'
                    ? 'text-green-600'
                    : stat.trend.direction === 'down'
                      ? 'text-red-600'
                      : 'text-gray-600'
                }
              >
                {stat.trend.direction === 'up'
                  ? '↗'
                  : stat.trend.direction === 'down'
                    ? '↘'
                    : '→'}{' '}
                {stat.trend.value}%
              </span>
              <span className='ml-1'>{stat.trend.period}</span>
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

  // Render error state
  if (error && !isLoading) {
    return (
      <div className='analytics-charts space-y-6'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold'>Analytics Overview</h2>
          <TimeRangeSelector
            value={filters.timeRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <ErrorDisplay error={error} onRetry={handleRetry} />
      </div>
    )
  }

  return (
    <div className='analytics-charts space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>Analytics Overview</h2>
        <TimeRangeSelector
          value={filters.timeRange}
          onChange={handleTimeRangeChange}
        />
      </div>

      {/* Summary Statistics */}
      <SummaryStats data={data?.summaryStats || []} isLoading={isLoading} />

      {/* Session Activity Chart */}
      <SessionChart data={data?.sessionMetrics || []} isLoading={isLoading} />

      {/* Skill Progress */}
      <SkillProgress data={data?.skillProgress || []} isLoading={isLoading} />

      {/* Data freshness indicator */}
      {data && !isLoading && (
        <div className='text-gray-500 text-center text-xs'>
          Data updated {new Date().toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
