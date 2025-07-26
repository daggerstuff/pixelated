import { useState } from 'react'
import {
  AnalyticsService,
  EventType,
} from '@/lib/services/analytics/AnalyticsService'

type TimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year'

interface MetricData {
  value: number
  previousValue?: number | undefined
}

interface ChartData {
  labels: string[]
  series: unknown[]
}

interface TableData {
  data: Record<string, unknown>[]
}

// Initialize analytics service
const analyticsService = new AnalyticsService()

export function useAnalyticsData() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Fetch metric data
  const fetchMetricData = async (metricName: string): Promise<MetricData> => {
    setIsLoading(true)
    setError(null)

    try {
      // Get current time range
      const now = Date.now()
      const dayInMs = 24 * 60 * 60 * 1000

      // Current period data
      const currentMetrics = await analyticsService.getMetrics({
        name: metricName,
        startTime: now - 7 * dayInMs, // Last 7 days
        endTime: now,
      })

      // Previous period data for comparison
      const previousMetrics = await analyticsService.getMetrics({
        name: metricName,
        startTime: now - 14 * dayInMs, // Previous 7 days
        endTime: now - 7 * dayInMs,
      })

      // Calculate current value (average or sum based on metric type)
      let currentValue = 0
      if (currentMetrics.length > 0) {
        currentValue = currentMetrics.reduce(
          (sum, metric) => sum + metric.value,
          0,
        )

        // For some metrics, calculate average instead of sum
        if (
          [
            'engagement_rate',
            'conversion_rate',
            'avg_session_duration',
          ].includes(metricName)
        ) {
          currentValue /= currentMetrics.length
        }
      }

      // Calculate previous value for comparison
      let previousValue = 0
      if (previousMetrics.length > 0) {
        previousValue = previousMetrics.reduce(
          (sum, metric) => sum + metric.value,
          0,
        )

        // For some metrics, calculate average instead of sum
        if (
          [
            'engagement_rate',
            'conversion_rate',
            'avg_session_duration',
          ].includes(metricName)
        ) {
          previousValue /= previousMetrics.length
        }
      }

      return {
        value: currentValue,
        previousValue: previousValue > 0 ? previousValue : undefined,
      }
    } catch (error) {
      console.error(`Error fetching metric data for ${metricName}:`, error)
      setError(
        error instanceof Error
          ? error
          : new Error('Failed to fetch metric data'),
      )
      return { value: 0 }
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch chart data
  const fetchChartData = async (
    metricName: string,
    range: TimeRange = 'week',
  ): Promise<ChartData> => {
    setIsLoading(true)
    setError(null)

    try {
      // Calculate time range
      const now = Date.now()
      const dayInMs = 24 * 60 * 60 * 1000

      // Determine start time based on range
      let startTime: number
      let interval: 'day' | 'week' | 'month'

      switch (range) {
        case 'day':
          startTime = now - dayInMs
          interval = 'day'
          break
        case 'week':
          startTime = now - 7 * dayInMs
          interval = 'day'
          break
        case 'month':
          startTime = now - 30 * dayInMs
          interval = 'day'
          break
        case 'quarter':
          startTime = now - 90 * dayInMs
          interval = 'week'
          break
        case 'year':
          startTime = now - 365 * dayInMs
          interval = 'month'
          break
        default:
          startTime = now - 7 * dayInMs
          interval = 'day'
      }

      // Get metrics
      const metrics = await analyticsService.getMetrics({
        name: metricName,
        startTime,
        endTime: now,
      })

      // Initialize results
      const labels: string[] = []
      const data: number[] = []

      if (metrics.length > 0) {
        // Sort metrics by timestamp
        metrics.sort((a, b) => a.timestamp - b.timestamp)

        // Group metrics by interval
        const groupedMetrics: Record<string, number[]> = {}

        metrics.forEach((metric) => {
          const date = new Date(metric.timestamp)
          let groupKey: string

          if (interval === 'day') {
            groupKey = `${date.getMonth() + 1}-${date.getDate()}`
          } else if (interval === 'week') {
            // Get the week number
            const weekNumber = Math.floor((date.getDate() - 1) / 7) + 1
            groupKey = `${date.getMonth() + 1}-W${weekNumber}`
          } else {
            groupKey = `${date.getMonth() + 1}`
          }

          if (!groupedMetrics[groupKey]) {
            groupedMetrics[groupKey] = []
          }

          ;(groupedMetrics[groupKey] ??= []).push(metric.value)
        })

        // Calculate average for each group
        Object.entries(groupedMetrics).forEach(([key, values]) => {
          labels.push(key)

          // Calculate average or sum
          const isAverageMetric = [
            'engagement_rate',
            'conversion_rate',
            'avg_session_duration',
          ].includes(metricName)

          if (isAverageMetric) {
            // Calculate average
            data.push(values.reduce((sum, val) => sum + val, 0) / values.length)
          } else {
            // Calculate sum
            data.push(values.reduce((sum, val) => sum + val, 0))
          }
        })
      }

      return {
        labels,
        series: [
          {
            name: metricName,
            data,
          },
        ],
      }
    } catch (error) {
      console.error(`Error fetching chart data for ${metricName}:`, error)
      setError(
        error instanceof Error
          ? error
          : new Error('Failed to fetch chart data'),
      )
      return { labels: [], series: [] }
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch table data
  const fetchTableData = async (
    eventType: string,
    limit: number = 10,
  ): Promise<TableData> => {
    setIsLoading(true)
    setError(null)

    try {
      // Calculate date range (last 24 hours)
      const now = Date.now()
      const dayInMs = 24 * 60 * 60 * 1000

      // Get events
      const events = await analyticsService.getEvents({
        type: eventType as EventType,
        startTime: now - dayInMs,
        endTime: now,
        limit,
      })

      // Map events to table data
      const tableData = events.map((event) => ({
        ...event.properties,
        timestamp: event.timestamp,
        type: event.type,
        userId: event.userId,
      }))

      return { data: tableData }
    } catch (error) {
      console.error(`Error fetching table data for ${eventType}:`, error)
      setError(
        error instanceof Error
          ? error
          : new Error('Failed to fetch table data'),
      )
      return { data: [] }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isLoading,
    error,
    fetchMetricData,
    fetchChartData,
    fetchTableData,
  }
}
