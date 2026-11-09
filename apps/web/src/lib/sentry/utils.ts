import { createBuildSafeLogger } from '../logging/build-safe-logger'
const logger = createBuildSafeLogger('utils')

/**
 * Sentry Utilities for Manual Error Reporting and Metrics
 *
 * This file provides utilities for manually capturing errors,
 * messages, metrics, and performance data in the Pixelated Empathy application.
 *
 * Metrics API: https://docs.sentry.io/platforms/javascript/guides/astro/metrics/
 *
 * The bundled @sentry/astro SDK is the primary Sentry interface. We also
 * check window.Sentry as a fallback for pages that load the SDK via a
 * standalone script tag.
 */
import * as SentrySDK from '@sentry/astro'

const IS_DEV = import.meta?.env
  ? import.meta.env.DEV
  : typeof process !== 'undefined' &&
    process.env?.['NODE_ENV'] === 'development'
const ENV_MODE = import.meta?.env
  ? import.meta.env.MODE
  : ((typeof process !== 'undefined' && process.env?.['NODE_ENV']) ??
    'production')

type SentryShim = {
  captureException: (error: unknown) => void
  captureMessage: (message: string) => void
  withScope: (
    cb: (scope: {
      setContext: (key: string, value: Record<string, unknown>) => void
      setTag: (key: string, value: string) => void
      setLevel: (level: 'debug' | 'info' | 'warning' | 'error') => void
    }) => void,
  ) => void
  metrics: {
    count: (
      name: string,
      value: number,
      options?: { attributes?: Record<string, unknown> },
    ) => void
    distribution: (
      name: string,
      value: number,
      options?: { attributes?: Record<string, unknown>; unit?: string },
    ) => void
  }
}

function getSentry(): SentryShim | null {
  // Primary: use the bundled @sentry/astro SDK
  if (
    SentrySDK &&
    typeof (SentrySDK as Record<string, unknown>).captureException ===
      'function'
  ) {
    return SentrySDK
  }
  // Fallback: window.Sentry global (for pages that load Sentry via script tag)
  try {
    const w = window as Window & typeof globalThis & { Sentry?: unknown }
    if (w?.Sentry) {
      return w.Sentry as SentryShim
    }
  } catch (error: unknown) {
    if (IS_DEV) {
      logger.warn('[Sentry] Failed to access global Sentry object:', error)
    }
  }
  return null
}

/**
 * Manually capture an error with additional context
 */
export function captureError(
  error: Error,
  context?: Record<string, unknown>,
): void {
  const Sentry = getSentry()
  if (!Sentry) return
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value as Record<string, unknown>)
      })
    }
    scope.setTag('source', 'manual')
    scope.setLevel('error')
    Sentry.captureException(error)
  })
}

/**
 * Manually capture a message with additional context
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>,
): void {
  const Sentry = getSentry()
  if (!Sentry) return
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value as Record<string, unknown>)
      })
    }
    scope.setTag('source', 'manual')
    scope.setLevel(level)
    Sentry.captureMessage(message)
  })
}

/**
 * Test Sentry integration
 */
export function testSentryIntegration() {
  // Create a test error
  const testError = new Error('Sentry integration test - this is expected')

  // Capture with context
  captureError(testError, {
    test: {
      timestamp: new Date().toISOString(),
      purpose: 'Integration test',
      environment: ENV_MODE,
    },
  })

  // Capture a test message
  captureMessage('Sentry integration test message', 'info', {
    test: {
      type: 'message',
      timestamp: new Date().toISOString(),
    },
  })
}

// ============================================
// Sentry Metrics API
// ============================================
// Reference: https://docs.sentry.io/platforms/javascript/guides/astro/metrics/

/**
 * Sentry metrics attributes for adding context to metrics
 */
export interface MetricAttributes {
  [key: string]: string | number | boolean
}

/**
 * Counter metric - track incrementing values
 * Use for: button clicks, API calls, feature usage, error counts
 *
 * @example
 * ```ts
 * // Track button clicks
 * countMetric('button_click', 1, { button: 'submit', page: 'login' })
 *
 * // Track API calls
 * countMetric('api_call', 1, { endpoint: '/api/analyze', method: 'POST' })
 *
 * // Track emotional analysis completions
 * countMetric('emotion_analysis_completed', 1, {
 *   session_type: 'therapy',
 *   model: 'mental-llama'
 * })
 * ```
 */
export function countMetric(
  name: string,
  value: number = 1,
  attributes?: MetricAttributes,
): void {
  try {
    const Sentry = getSentry()
    if (!Sentry) return
    Sentry.metrics.count(name, value, { attributes })
  } catch (error: unknown) {
    if (IS_DEV) {
      logger.warn('[Sentry Metrics] Failed to emit count metric:', error)
    }
  }
}

/**
 * Distribution metric - track value distributions (percentiles: p50, p90, p99)
 * Use for: response times, request sizes, processing durations
 *
 * Internal helper: consumers should use the domain helpers below
 * (`emotionMetrics`, `apiMetrics`) rather than calling this directly.
 *
 * @example
 * ```ts
 * // Track API response time
 * distributionMetric('api_response_time', 187.5, {
 *   attributes: { endpoint: '/api/analyze' },
 *   unit: 'millisecond'
 * })
 *
 * // Track bias score distribution
 * distributionMetric('bias_score', 0.45, {
 *   attributes: { analysis_type: 'preprocessing' }
 * })
 *
 * // Track emotion analysis latency
 * distributionMetric('emotion_analysis_latency', 234, {
 *   attributes: { model: 'emotion-llama' },
 *   unit: 'millisecond'
 * })
 * ```
 */
function distributionMetric(
  name: string,
  value: number,
  options?: {
    attributes?: MetricAttributes
    unit?: string
  },
): void {
  try {
    const Sentry = getSentry()
    if (!Sentry) return
    Sentry.metrics.distribution(name, value, {
      attributes: options?.attributes,
      unit: options?.unit,
    })
  } catch (error: unknown) {
    if (IS_DEV) {
      logger.warn('[Sentry Metrics] Failed to emit distribution metric:', error)
    }
  }
}

// ============================================
// Domain-specific Metric Helpers
// ============================================

/**
 * Track emotion analysis metrics
 */
export const emotionMetrics = {
  /**
   * Track when an emotion analysis is performed
   */
  analysisPerformed(attributes: {
    model: string
    sessionType?: string
    success?: boolean
  }): void {
    countMetric('emotion.analysis_performed', 1, {
      model: attributes.model,
      session_type: attributes.sessionType ?? 'unknown',
      success: attributes.success ?? true,
    })
  },

  /**
   * Track emotion analysis latency
   */
  analysisLatency(durationMs: number, model: string): void {
    distributionMetric('emotion.analysis_latency', durationMs, {
      attributes: { model },
      unit: 'millisecond',
    })
  },

  /**
   * Track emotion score distribution
   */
  scoreDistribution(emotionType: string, score: number, model: string): void {
    distributionMetric('emotion.score', score, {
      attributes: { emotion_type: emotionType, model },
    })
  },
}

/**
 * Track API performance metrics
 */
export const apiMetrics = {
  /**
   * Track API request
   */
  request(endpoint: string, method: string, statusCode?: number): void {
    countMetric('api.request', 1, {
      endpoint,
      method,
      status_code: statusCode ?? 0,
    })
  },

  /**
   * Track API response time
   */
  responseTime(
    endpoint: string,
    durationMs: number,
    method: string = 'GET',
  ): void {
    distributionMetric('api.response_time', durationMs, {
      attributes: { endpoint, method },
      unit: 'millisecond',
    })
  },

  /**
   * Track API errors
   */
  error(endpoint: string, errorType: string): void {
    countMetric('api.error', 1, { endpoint, error_type: errorType })
  },
}
