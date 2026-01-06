/**
 * Sentry Utilities for Manual Error Reporting and Metrics
 *
 * This file provides utilities for manually capturing errors,
 * messages, metrics, and performance data in the Pixelated Empathy application.
 *
 * Metrics API: https://docs.sentry.io/platforms/javascript/guides/astro/metrics/
 *
 * IMPORTANT: Do NOT import '@sentry/astro' at runtime in browser code.
 * Some pages (e.g. docs) include plain module scripts which must not contain
 * bare module specifiers. We instead use a safe global shim when available.
 */

type SentryShim = {
  captureException: (error: unknown) => void
  captureMessage: (message: string) => void
  setUser: (user: Record<string, unknown>) => void
  addBreadcrumb: (crumb: {
    message: string
    category?: string
    data?: Record<string, unknown>
    timestamp?: number
    level?: 'info' | 'error' | 'warning' | 'debug'
  }) => void
  withScope: (cb: (scope: {
    setContext: (key: string, value: Record<string, unknown>) => void
    setTag: (key: string, value: string) => void
    setLevel: (level: 'debug' | 'info' | 'warning' | 'error') => void
  }) => void) => void
  metrics: {
    count: (name: string, value: number, options?: { attributes?: Record<string, unknown> }) => void
    gauge: (name: string, value: number, options?: { attributes?: Record<string, unknown>; unit?: string }) => void
    distribution: (
      name: string,
      value: number,
      options?: { attributes?: Record<string, unknown>; unit?: string },
    ) => void
  }
}

function getSentry(): SentryShim | null {
  try {
    // Prefer global Sentry if present (initialized via public scripts)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      return (window as any).Sentry as SentryShim
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Sentry] Failed to access global Sentry object:', error)
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
 * Set user context for Sentry
 */
export function setUserContext(user: {
  id?: string
  email?: string
  username?: string
  [key: string]: unknown
}) {
  const Sentry = getSentry()
  if (!Sentry) return
  Sentry.setUser(user)
}

/**
 * Add breadcrumb for user action tracking
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
) {
  const Sentry = getSentry()
  if (!Sentry) return
  Sentry.addBreadcrumb({
    message,
    category,
    ...(data ? { data } : {}),
    timestamp: Date.now() / 1000,
    level: 'info',
  })
}

/**
 * Start a performance transaction
 *
 * @deprecated Sentry Astro does not support manual transactions. This is a no-op.
 */
export function startTransaction(
  _name: string,
  _operation: string,
): { setData: () => void; finish: () => void } {
  // Sentry Astro does not support manual transactions.
  // This function is a no-op for compatibility.
  if (import.meta.env.DEV) {
    console.warn(
      '[Sentry] startTransaction is not supported in @sentry/astro and will be ignored.',
    )
  }
  return {
    setData: () => { },
    finish: () => { },
  }
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
      environment: import.meta.env.MODE,
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

/**
 * Performance monitoring utilities
 *
 * @deprecated Sentry Astro does not support manual performance transactions.
 * These methods are no-ops and kept for compatibility.
 */
export const performance = {
  /**
   * Measure page load performance (no-op)
   */
  measurePageLoad: (
    _pageName: string,
  ): { setData: () => void; finish: () => void } => {
    if (import.meta.env.DEV) {
      console.warn(
        '[Sentry] measurePageLoad is not supported in @sentry/astro and will be ignored.',
      )
    }
    return {
      setData: () => { },
      finish: () => { },
    }
  },

  /**
   * Measure API call performance (no-op)
   */
  measureApiCall: (
    _endpoint: string,
    _method: string = 'GET',
  ): { setData: () => void; finish: () => void } => {
    if (import.meta.env.DEV) {
      console.warn(
        '[Sentry] measureApiCall is not supported in @sentry/astro and will be ignored.',
      )
    }
    return {
      setData: () => { },
      finish: () => { },
    }
  },
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
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Sentry Metrics] Failed to emit count metric:', error)
    }
  }
}

/**
 * Gauge metric - track values that can go up and down
 * Use for: queue depths, memory usage, active sessions, concurrent users
 *
 * @example
 * ```ts
 * // Track active sessions
 * gaugeMetric('active_sessions', 42, { region: 'us-west' })
 *
 * // Track queue depth
 * gaugeMetric('bias_analysis_queue', 15, { priority: 'high' })
 *
 * // Track memory usage in MB
 * gaugeMetric('memory_usage', 512, { unit: 'megabyte', service: 'main' })
 * ```
 */
export function gaugeMetric(
  name: string,
  value: number,
  attributes?: MetricAttributes,
  unit?: string,
): void {
  try {
    const Sentry = getSentry()
    if (!Sentry) return
    Sentry.metrics.gauge(name, value, { attributes, unit })
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Sentry Metrics] Failed to emit gauge metric:', error)
    }
  }
}

/**
 * Distribution metric - track value distributions (percentiles: p50, p90, p99)
 * Use for: response times, request sizes, processing durations
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
export function distributionMetric(
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
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Sentry Metrics] Failed to emit distribution metric:', error)
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
  scoreDistribution(
    emotionType: string,
    score: number,
    model: string,
  ): void {
    distributionMetric('emotion.score', score, {
      attributes: { emotion_type: emotionType, model },
    })
  },
}

/**
 * Track bias detection metrics
 */
export const biasMetrics = {
  /**
   * Track when a bias analysis is performed
   */
  analysisPerformed(attributes: {
    layer: string
    sessionId?: string
    success?: boolean
  }): void {
    countMetric('bias.analysis_performed', 1, {
      layer: attributes.layer,
      success: attributes.success ?? true,
    })
  },

  /**
   * Track bias analysis latency
   */
  analysisLatency(durationMs: number, layer: string): void {
    distributionMetric('bias.analysis_latency', durationMs, {
      attributes: { layer },
      unit: 'millisecond',
    })
  },

  /**
   * Track bias score distribution
   */
  scoreDistribution(biasType: string, score: number): void {
    distributionMetric('bias.score', score, {
      attributes: { bias_type: biasType },
    })
  },

  /**
   * Track bias alert levels
   */
  alertTriggered(level: 'low' | 'warning' | 'high' | 'critical'): void {
    countMetric('bias.alert_triggered', 1, { alert_level: level })
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
  responseTime(endpoint: string, durationMs: number, method: string = 'GET'): void {
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

/**
 * Track therapeutic session metrics
 */
export const sessionMetrics = {
  /**
   * Track session started
   */
  started(sessionType: string): void {
    countMetric('session.started', 1, { session_type: sessionType })
  },

  /**
   * Track session completed
   */
  completed(sessionType: string, durationMinutes: number): void {
    countMetric('session.completed', 1, { session_type: sessionType })
    distributionMetric('session.duration', durationMinutes, {
      attributes: { session_type: sessionType },
      unit: 'minute',
    })
  },

  /**
   * Track active sessions gauge
   */
  activeSessions(count: number): void {
    gaugeMetric('session.active_count', count)
  },
}

/**
 * Flush all pending metrics to Sentry
 * Call this before process exit or page unload if needed
 */
export async function flushMetrics(): Promise<void> {
  try {
    const client = getSentry() as any
    if (client && typeof client.flush === 'function') {
      await client.flush()
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Sentry Metrics] Failed to flush metrics:', error)
    }
  }
}

// Re-export wrappers that perform safe checking
export {
  captureError as captureException,
  captureMessage as sentryCaptureMessage,
}

