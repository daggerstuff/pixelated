/**
 * API Route Metrics Helper
 *
 * Provides utilities for instrumenting Astro API routes with Sentry metrics.
 * Use this to consistently track request counts, response times, and errors.
 */

import { apiMetrics } from '@/lib/sentry/utils'

/**
 * Track API request metrics manually
 * Use this when you need more control over metric collection
 */
export function trackApiRequest(
  endpoint: string,
  method: string,
  statusCode: number,
  durationMs: number,
): void {
  apiMetrics.request(endpoint, method, statusCode)
  apiMetrics.responseTime(endpoint, durationMs, method)

  if (statusCode >= 400) {
    const errorType = statusCode >= 500 ? 'ServerError' : 'ClientError'
    apiMetrics.error(endpoint, errorType)
  }
}

/**
 * Track API error metrics
 */
export function trackApiError(
  endpoint: string,
  errorType: string,
  method: string = 'POST',
): void {
  apiMetrics.error(endpoint, errorType)
  apiMetrics.request(endpoint, method, 500)
}
