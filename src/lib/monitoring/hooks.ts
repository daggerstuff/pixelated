import { useCallback, useEffect, useState } from 'react'
import { MonitoringService } from './service'

// Extended hook for monitoring service with RUM capabilities
export function useMonitoring() {
  useEffect(() => {
    const monitoringService = MonitoringService.getInstance()
    monitoringService.initialize().catch((error) => {
      console.error('Failed to initialize monitoring service:', error)
    })
  }, [])

  const trackEvent = useCallback(
    (eventName: string, properties?: Record<string, unknown>) => {
      // @ts-expect-error - Faro is loaded globally
      if (window.faro) {
        // @ts-expect-error - Faro is loaded globally
        window.faro.api.pushEvent(eventName, properties)
      }
    },
    [],
  )

  const trackError = useCallback(
    (error: Error, context?: Record<string, unknown>) => {
      // @ts-expect-error - Faro is loaded globally
      if (window.faro) {
        // @ts-expect-error - Faro is loaded globally
        window.faro.api.pushError(error, context)
      }
    },
    [],
  )

  const trackMetric = useCallback(
    (name: string, value: number, unit?: string) => {
      // @ts-expect-error - Faro is loaded globally
      if (window.faro) {
        // @ts-expect-error - Faro is loaded globally
        window.faro.api.pushMeasurement(name, {
          value,
          unit,
        })
      }
    },
    [],
  )

  // New function to track user interactions
  const trackUserInteraction = useCallback(
    (element: string, action: string, details?: Record<string, unknown>) => {
      trackEvent('user_interaction', {
        element,
        action,
        ...details,
        timestamp: Date.now(),
      })
    },
    [trackEvent],
  )

  // New function to track page views with additional context
  const trackPageView = useCallback(
    (path: string, referrer?: string, details?: Record<string, unknown>) => {
      trackEvent('page_view', {
        path,
        referrer: referrer || document.referrer,
        title: document.title,
        ...details,
        timestamp: Date.now(),
      })
    },
    [trackEvent],
  )

  return {
    trackEvent,
    trackError,
    trackMetric,
    trackUserInteraction,
    trackPageView,
  }
}

// New hook for accessing RUM data
export function useRUMData() {
  const [loadingPerformance, setLoadingPerformance] = useState<
    Record<string, number>
  >({})
  const [interactivityMetrics, setInteractivityMetrics] = useState<
    Record<string, number>
  >({})
  const [visualStability, setVisualStability] = useState<
    Record<string, number>
  >({})
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Function to fetch RUM data from monitoring service
  const fetchRUMData = useCallback(async () => {
    setIsLoading(true)
    try {
      // In a real implementation, you would fetch this from your RUM provider's API
      // For now, we'll use mock data similar to what we use in the Astro component

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      const randomFactor = 0.8 + Math.random() * 0.4 // Random value between 0.8 and 1.2

      // Update loading performance metrics
      setLoadingPerformance({
        ttfb: Math.round(120 * randomFactor),
        fcp: Math.round(850 * randomFactor),
        lcp: Math.round(2200 * randomFactor),
        speedIndex: Math.round(1600 * randomFactor),
      })

      // Update interactivity metrics
      setInteractivityMetrics({
        fid: Math.round(80 * randomFactor),
        tbt: Math.round(180 * randomFactor),
        tti: Math.round(3500 * randomFactor),
      })

      // Update visual stability metrics
      setVisualStability({
        cls: parseFloat((0.09 * randomFactor).toFixed(2)),
      })

      setLastUpdated(new Date())
    } catch (error: unknown) {
      console.error('Failed to fetch RUM data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch data on mount and provide refresh function
  useEffect(() => {
    fetchRUMData()
  }, [fetchRUMData])

  return {
    loadingPerformance,
    interactivityMetrics,
    visualStability,
    isLoading,
    lastUpdated,
    refreshData: fetchRUMData,
  }
}

// Utility function to determine performance indicator based on metric values
export function getPerformanceIndicator(
  metricName: string,
  value: number,
): 'good' | 'needs-improvement' | 'poor' {
  // Based on the performance budgets in docs/performance-testing.md
  switch (metricName.toLowerCase()) {
    case 'ttfb':
      return value < 300 ? 'good' : value < 600 ? 'needs-improvement' : 'poor'
    case 'fcp':
      return value < 1800 ? 'good' : value < 3000 ? 'needs-improvement' : 'poor'
    case 'lcp':
      return value < 2500 ? 'good' : value < 4000 ? 'needs-improvement' : 'poor'
    case 'cls':
      return value < 0.1 ? 'good' : value < 0.25 ? 'needs-improvement' : 'poor'
    case 'fid':
      return value < 100 ? 'good' : value < 300 ? 'needs-improvement' : 'poor'
    case 'tbt':
      return value < 200 ? 'good' : value < 600 ? 'needs-improvement' : 'poor'
    case 'jssize':
      return value < 500 ? 'good' : value < 1000 ? 'needs-improvement' : 'poor'
    case 'csssize':
      return value < 100 ? 'good' : value < 200 ? 'needs-improvement' : 'poor'
    case 'requests':
      return value < 50 ? 'good' : value < 80 ? 'needs-improvement' : 'poor'
    default:
      return 'needs-improvement'
  }
}
