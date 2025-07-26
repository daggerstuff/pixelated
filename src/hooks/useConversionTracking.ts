import { useCallback, useEffect } from 'react'

import { useAnalytics } from './useAnalytics'

// Types for our conversion tracking system
export interface StageConfig {
  id: string
  index: number
}

export interface FunnelConfig {
  id: string
  stages: StageConfig[]
}

export interface ConversionTrackingOptions {
  funnels?: FunnelConfig[]
  debug?: boolean
}

interface EventData {
  [key: string]: unknown
}

// Hook for conversion tracking
export default function useConversionTracking(
  options: ConversionTrackingOptions = {},
) {
  const { funnels = [], debug = false } = options

  const { trackEvent } = useAnalytics()

  // Debug logger
  const log = useCallback(
    (message: string, data?: unknown) => {
      if (debug) {
        console.log(`🔍 Conversion Tracking: ${message}`, data || '')
      }
    },
    [debug],
  )

  // Initialize tracking on mount
  useEffect(() => {
    log('Initialized conversion tracking', { funnels })

    // Send initial page view event
    const path = window.location.pathname
    trackEvent('page_view', { path })

    // Initialize any funnels
    funnels.forEach((funnel) => {
      log(`Registered funnel: ${funnel.id}`, funnel)
    })

    // Cleanup
    return () => {
      log('Cleaning up conversion tracking')
    }
  }, [funnels, log, trackEvent])

  // Track a generic event
  const trackEventGeneric = useCallback(
    (eventName: string, data: EventData = {}) => {
      try {
        log(`Event tracked: ${eventName}`, data)

        // Here you would integrate with actual analytics systems
        // Examples:
        // - Google Analytics: gtag('event', eventName, data)
        // - Segment: analytics.track(eventName, data)
        // - Mixpanel: mixpanel.track(eventName, data)

        // For demonstration, we're just logging to console
        if (typeof window !== 'undefined' && window.dataLayer) {
          window.dataLayer.push({
            event: eventName,
            ...data,
          })
        }
      } catch (error) {
        console.error('Error tracking event:', error)
      }
    },
    [log],
  )

  // Track a conversion (e.g. signup, purchase)
  const trackConversion = useCallback(
    (conversionName: string, value?: number, data: EventData = {}) => {
      try {
        const conversionData = {
          ...data,
          ...(value !== undefined ? { value } : {}),
        }

        log(`Conversion tracked: ${conversionName}`, conversionData)

        // Track as a regular event first
        trackEventGeneric(`conversion_${conversionName}`, conversionData)

        // Here you would implement conversion-specific tracking
        // Examples:
        // - Google Analytics: gtag('event', 'conversion', { send_to: 'AW-CONVERSION_ID/CONVERSION_LABEL', value, currency: 'USD' })
        // - Facebook Pixel: fbq('track', conversionName, { value, currency: 'USD', ...data })
      } catch (error) {
        console.error('Error tracking conversion:', error)
      }
    },
    [trackEventGeneric, log],
  )

  // Track a specific stage in a funnel
  const trackFunnelStage = useCallback(
    (funnelId: string, stageId: string, data: EventData = {}) => {
      try {
        // Find the funnel
        const funnel = funnels.find((f) => f.id === funnelId)
        if (!funnel) {
          console.warn(`Funnel with ID "${funnelId}" not found`)
          return
        }

        // Find the stage
        const stage = funnel.stages.find((s) => s.id === stageId)
        if (!stage) {
          console.warn(
            `Stage with ID "${stageId}" not found in funnel "${funnelId}"`,
          )
          return
        }

        log(
          `Funnel stage tracked: ${funnelId} > ${stageId} (${stage.index})`,
          data,
        )

        // Track funnel stage event
        trackEventGeneric(`funnel_${funnelId}_stage_${stageId}`, {
          funnel_id: funnelId,
          stage_id: stageId,
          stage_index: stage.index,
          ...data,
        })
      } catch (error) {
        console.error('Error tracking funnel stage:', error)
      }
    },
    [funnels, trackEventGeneric, log],
  )

  // Public API
  return {
    trackEvent: trackEventGeneric,
    trackConversion,
    trackFunnelStage,
  }
}

// Add TypeScript declaration for dataLayer
declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}
