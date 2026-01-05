/**
 * Bias Detection Engine - Performance Monitor
 *
 * Lightweight stub implementation for deployment compatibility.
 * Full implementation: Tracks per-endpoint/method metrics, detailed timing stats, and Supports historical queries.
 */

import type { PerformanceSnapshot } from './types'

class PerformanceMonitor {
  private startTime = Date.now()

  // Granular stats for endpoints/methods
  private requestCount = 0
  private errorCount = 0
  private totalResponseTime = 0
  private requestDetails: {
    endpoint: string
    method: string
    duration: number
    statusCode: number
    timestamp: number
  }[] = []
  private analysisDetails: {
    duration: number
    biasScore: number
    timestamp: number
  }[] = []

  /**
   * Get performance snapshot for the specified time range
   */
  getSnapshot(timeWindowMs?: number): PerformanceSnapshot {
    const now = Date.now()
    const uptime = now - this.startTime
    const memoryUsage = process.memoryUsage().heapUsed

    // Determine slice for history if a window is specified
    let recentRequests = this.requestDetails
    if (timeWindowMs !== undefined) {
      const cutoff = now - timeWindowMs
      recentRequests = this.requestDetails.filter((r) => r.timestamp >= cutoff)
    }

    const requestCount = recentRequests.length
    const errorCount = recentRequests.filter((r) => r.statusCode >= 400).length
    const totalResponseTime = recentRequests.reduce(
      (sum, r) => sum + r.duration,
      0,
    )

    return {
      timestamp: now,
      metrics: [
        { name: 'uptime', value: uptime, unit: 'ms' },
        { name: 'requests_total', value: requestCount, unit: 'count' },
        { name: 'errors_total', value: errorCount, unit: 'count' },
        { name: 'memory_usage', value: memoryUsage, unit: 'bytes' },
      ],
      summary: {
        averageResponseTime:
          requestCount > 0 ? totalResponseTime / requestCount : 0,
        requestCount,
        errorRate: requestCount > 0 ? errorCount / requestCount : 0,
      },
    }
  }

  /**
   * Record request timing—granular event log
   */
  recordRequestTiming(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number,
  ): void {
    this.requestCount++
    this.totalResponseTime += duration
    if (statusCode >= 400) {
      this.errorCount++
    }
    this.requestDetails.push({
      endpoint,
      method,
      duration,
      statusCode,
      timestamp: Date.now(),
    })
    if (this.requestDetails.length > 1000) {
      this.requestDetails.shift()
    }
  }

  /**
   * Record bias analysis performance
   */
  recordAnalysis(duration: number, biasScore: number): void {
    this.requestCount++
    this.totalResponseTime += duration
    this.analysisDetails.push({
      duration,
      biasScore,
      timestamp: Date.now(),
    })
    if (this.analysisDetails.length > 1000) {
      this.analysisDetails.shift()
    }
  }

  /**
   * Export metrics in specified format
   */
  exportMetrics(format: 'json' | 'prometheus'): string {
    const snapshot = this.getSnapshot()

    if (format === 'prometheus') {
      return [
        '# HELP bias_detection_requests_total Total number of requests',
        '# TYPE bias_detection_requests_total counter',
        `bias_detection_requests_total ${snapshot.summary.requestCount}`,
        '',
        '# HELP bias_detection_errors_total Total number of errors',
        '# TYPE bias_detection_errors_total counter',
        `bias_detection_errors_total ${snapshot.metrics.find((m) => m.name === 'errors_total')?.value ?? 0}`,
        '',
        '# HELP bias_detection_response_time_avg Average response time',
        '# TYPE bias_detection_response_time_avg gauge',
        `bias_detection_response_time_avg ${snapshot.summary.averageResponseTime}`,
      ].join('\n')
    }

    return JSON.stringify(snapshot, null, 2)
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor()
