/**
 * Bias Detection Engine - Metrics API Endpoint
 *
 * This endpoint provides access to performance metrics and monitoring data
 * for the bias detection engine.
 */

export const prerender = false

import { z } from 'zod'

// Schema for validating query parameters
const metricsQuerySchema = z.object({
  timeRange: z.coerce.number().min(60000).max(86400000).optional(),
  format: z.enum(['json', 'prometheus']).optional().default('json'),
  metrics: z.string().optional(),
  aggregation: z.enum(['raw', 'summary']).optional().default('summary'),
})

type MetricsQuery = z.infer<typeof metricsQuerySchema>

// Astro API route export - simplified version
export async function GET({ url }: { url: URL }) {
  const startTime = Date.now()

  try {
    // Only allow GET requests
    const queryParams = Object.fromEntries(url.searchParams.entries())

    // Validate query parameters
    const queryResult = metricsQuerySchema.safeParse(queryParams)
    if (!queryResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid query parameters',
          details: queryResult.error.errors,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const query: MetricsQuery = queryResult.data

    // Mock metrics data - replace with actual bias detection metrics
    const mockMetrics = {
      timestamp: Date.now(),
      timeRange: query.timeRange || 300000,
      summary: {
        totalRequests: 1250,
        averageResponseTime: 120,
        biasDetectionRuns: 45,
        alertsTriggered: 3,
      },
      meta: {
        totalMetrics: 4,
        metricsTypes: ['requests', 'response_time', 'bias_runs', 'alerts'],
        requestDuration: Date.now() - startTime,
      },
    }

    // Handle Prometheus format
    if (query.format === 'prometheus') {
      const prometheusData = `# HELP bias_detection_requests_total Total number of bias detection requests
# TYPE bias_detection_requests_total counter
bias_detection_requests_total ${mockMetrics.summary.totalRequests}

# HELP bias_detection_response_time_avg Average response time in milliseconds  
# TYPE bias_detection_response_time_avg gauge
bias_detection_response_time_avg ${mockMetrics.summary.averageResponseTime}

# HELP bias_detection_runs_total Total bias detection algorithm runs
# TYPE bias_detection_runs_total counter  
bias_detection_runs_total ${mockMetrics.summary.biasDetectionRuns}

# HELP bias_detection_alerts_total Total alerts triggered
# TYPE bias_detection_alerts_total counter
bias_detection_alerts_total ${mockMetrics.summary.alertsTriggered}
`
      return new Response(prometheusData, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    // JSON response
    return new Response(JSON.stringify(mockMetrics, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Metrics endpoint error:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
