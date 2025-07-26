import * as React from 'react'
import { DashboardWidget } from './DashboardWidget'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

export interface MetricWidgetProps {
  title: string
  description?: string
  metricName: string
  value?: number | string
  previousValue?: number | string
  format?: 'number' | 'currency' | 'percentage' | 'duration'
  prefix?: string
  suffix?: string
  isLoading?: boolean
  variant?: 'default' | 'compact'
  className?: string
  refreshInterval?: number
  fetchMetric?: (metricName: string) => Promise<{
    value: number | string
    previousValue?: number | string
  }>
}

export function MetricWidget({
  title,
  description,
  metricName,
  value,
  previousValue,
  format = 'number',
  prefix = '',
  suffix = '',
  isLoading: initialLoading = false,
  variant = 'default',
  className = '',
  refreshInterval,
  fetchMetric,
}: MetricWidgetProps) {
  const [currentValue, setCurrentValue] = React.useState<
    number | string | undefined
  >(value)
  const [prevValue, setPrevValue] = React.useState<number | string | undefined>(
    previousValue,
  )
  const [isLoading, setIsLoading] = React.useState(initialLoading || !value)

  React.useEffect(() => {
    const loadData = async () => {
      if (fetchMetric) {
        try {
          setIsLoading(true)
          const result = await fetchMetric(metricName)
          setCurrentValue(result.value)
          setPrevValue(result.previousValue)
        } catch (error) {
          console.error(`Error fetching metric ${metricName}:`, error)
        } finally {
          setIsLoading(false)
        }
      }
    }

    loadData()

    if (refreshInterval && fetchMetric) {
      const interval = setInterval(loadData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [metricName, fetchMetric, refreshInterval])

  // Calculate percentage change
  const calculateChange = (): number | null => {
    if (currentValue === undefined || prevValue === undefined) {
      return null
    }

    const current =
      typeof currentValue === 'string' ? parseFloat(currentValue) : currentValue
    const previous =
      typeof prevValue === 'string' ? parseFloat(prevValue) : prevValue

    if (isNaN(current) || isNaN(previous) || previous === 0) {
      return null
    }

    return ((current - previous) / previous) * 100
  }

  const percentChange = calculateChange()

  const formatValue = (val: number | string | undefined): string => {
    if (val === undefined) {
      return 'N/A'
    }

    const numValue = typeof val === 'string' ? parseFloat(val) : val

    if (isNaN(numValue)) {
      return 'N/A'
    }

    let hours, minutes, seconds

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(numValue)
      case 'percentage':
        return `${numValue.toFixed(1)}%`
      case 'duration':
        // Format as mm:ss if under an hour, hh:mm:ss otherwise
        hours = Math.floor(numValue / 3600)
        minutes = Math.floor((numValue % 3600) / 60)
        seconds = Math.floor(numValue % 60)

        if (hours > 0) {
          return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
      default:
        return numValue.toLocaleString()
    }
  }

  const handleRefresh = async () => {
    if (fetchMetric) {
      try {
        setIsLoading(true)
        const result = await fetchMetric(metricName)
        setCurrentValue(result.value)
        setPrevValue(result.previousValue)
      } catch (error) {
        console.error(`Error refreshing metric ${metricName}:`, error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <DashboardWidget
      title={title}
      description={description}
      isLoading={isLoading}
      onRefresh={fetchMetric ? handleRefresh : undefined}
      className={className}
      variant={variant}
    >
      <div className="space-y-2">
        <div className="text-3xl font-bold" aria-live="polite">
          <span className="sr-only">{title} value</span>
          {prefix}
          {formatValue(currentValue)}
          {suffix}
        </div>

        {percentChange !== null && (
          <div className="flex items-center text-sm">
            <span className="mr-1 text-gray-500">vs previous:</span>
            <span
              className={`flex items-center font-medium ${
                percentChange > 0
                  ? 'text-green-500'
                  : percentChange < 0
                    ? 'text-red-500'
                    : 'text-gray-500'
              }`}
            >
              {percentChange > 0 ? (
                <ArrowUpRight className="h-4 w-4 mr-1" />
              ) : percentChange < 0 ? (
                <ArrowDownRight className="h-4 w-4 mr-1" />
              ) : (
                <Minus className="h-4 w-4 mr-1" />
              )}
              {Math.abs(percentChange || 0).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </DashboardWidget>
  )
}
