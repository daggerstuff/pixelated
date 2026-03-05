/**
 * API Route Metrics Helper
 *
 * Provides utilities for instrumenting Astro API routes with Sentry metrics.
 * Use this to consistently track request counts, response times, and errors.
 */

import { apiMetrics } from '@/lib/sentry/utils'

/**
 * Wraps an API route handler with automatic metrics collection
 *
 * @example
 * ```ts
 * export const POST: APIRoute = withMetrics('/api/ai/response', async ({ request }) => {
 *   // Your route handler code
 * })
 * ```
 */
export function withMetrics<T extends (...args: any[]) => Promise<Response>>(
  endpoint: string,
  handler: T,
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now()
    let statusCode = 500
    let errorType: string | undefined

    try {
      const response = await handler(...args)
      statusCode = response.status

      // Record metrics
      const durationMs = Date.now() - startTime
      apiMetrics.request(endpoint, 'POST', statusCode)
      apiMetrics.responseTime(endpoint, durationMs, 'POST')

      return response
    } catch (error) {
      errorType = error instanceof Error ? error.constructor.name : 'UnknownError'
      statusCode = 500

      // Record error metrics
      apiMetrics.error(endpoint, errorType)
      apiMetrics.request(endpoint, 'POST', statusCode)

      throw error
    }
  }) as T
}

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
