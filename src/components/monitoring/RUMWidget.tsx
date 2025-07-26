import React, { useEffect } from 'react'
import { useRUMData, getPerformanceIndicator } from '../../lib/monitoring/hooks'

interface RUMWidgetProps {
  compact?: boolean
  showTitle?: boolean
  refreshInterval?: number
  className?: string
}

/**
 * A compact widget to display key RUM metrics in React components
 */
export default function RUMWidget({
  compact = false,
  showTitle = true,
  refreshInterval = 60000,
  className = '',
}: RUMWidgetProps) {
  const {
    loadingPerformance,
    interactivityMetrics,
    visualStability,
    isLoading,
    lastUpdated,
    refreshData,
  } = useRUMData()

  // Set up refresh interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshData()
    }, refreshInterval)

    return () => clearInterval(intervalId)
  }, [refreshData, refreshInterval])

  // Helper function to render a metric with color coding
  const renderMetric = (name: string, value: number, unit: string = 'ms') => {
    const status = getPerformanceIndicator(name, value)
    const statusColors = {
      'good': 'text-green-500',
      'needs-improvement': 'text-yellow-500',
      'poor': 'text-red-500',
    }

    return (
      <div className="flex justify-between items-center">
        <span className="text-gray-600 dark:text-gray-300 text-sm">
          {name}:
        </span>
        <span className={`${statusColors[status]} font-medium`}>
          {value}
          {unit}
        </span>
      </div>
    )
  }

  // Compact view shows just critical metrics
  if (compact) {
    return (
      <div
        className={`rum-widget p-2 bg-white dark:bg-gray-800 rounded-md shadow-sm ${className}`}
      >
        {showTitle && (
          <div className="text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">
            Real User Metrics
          </div>
        )}
        <div className="space-y-1">
          {isLoading ? (
            <div className="text-gray-400 dark:text-gray-500 text-sm">
              Loading...
            </div>
          ) : (
            <>
              {renderMetric('LCP', loadingPerformance['lcp'] || 0)}
              {renderMetric('CLS', visualStability['cls'] || 0, '')}
              {renderMetric('FID', interactivityMetrics['fid'] || 0)}
            </>
          )}
        </div>
      </div>
    )
  }

  // Full view shows all metrics organized by category
  return (
    <div
      className={`rum-widget p-3 bg-white dark:bg-gray-800 rounded-lg shadow-md ${className}`}
    >
      {showTitle && (
        <div className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Real User Monitoring
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400 dark:text-gray-500 py-2">
          Loading metrics...
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">
              Loading
            </div>
            <div className="space-y-1">
              {renderMetric('TTFB', loadingPerformance['ttfb'] || 0)}
              {renderMetric('FCP', loadingPerformance['fcp'] || 0)}
              {renderMetric('LCP', loadingPerformance['lcp'] || 0)}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">
              Interactivity
            </div>
            <div className="space-y-1">
              {renderMetric('FID', interactivityMetrics['fid'] || 0)}
              {renderMetric('TBT', interactivityMetrics['tbt'] || 0)}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">
              Stability
            </div>
            <div className="space-y-1">
              {renderMetric('CLS', visualStability['cls'] || 0, '')}
            </div>
          </div>
        </div>
      )}

      {lastUpdated && !isLoading && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-400 dark:text-gray-500">
              Updated: {lastUpdated.toLocaleTimeString()}
            </div>
            <button
              onClick={() => refreshData()}
              className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
