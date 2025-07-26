/**
 * Bias Detection Engine - Performance Monitor
 *
 * Lightweight stub implementation for deployment compatibility.
 * TODO: Implement full performance monitoring when ready for full feature.
 */

import type { PerformanceSnapshot } from './types'

class PerformanceMonitor {
  private startTime = Date.now()
  private requestCount = 0
  private errorCount = 0
  private totalResponseTime = 0

  /**
   * Get performance snapshot for the specified time range
   */
  getSnapshot(_timeRange?: number): PerformanceSnapshot {
    const now = Date.now()
    const uptime = now - this.startTime
    const memoryUsage = process.memoryUsage().heapUsed

    return {
      timestamp: now,
      metrics: [
        { name: 'uptime', value: uptime, unit: 'ms' },
        { name: 'requests_total', value: this.requestCount, unit: 'count' },
        { name: 'errors_total', value: this.errorCount, unit: 'count' },
        { name: 'memory_usage', value: memoryUsage, unit: 'bytes' },
      ],
      summary: {
        averageResponseTime:
          this.requestCount > 0
            ? this.totalResponseTime / this.requestCount
            : 0,
        requestCount: this.requestCount,
        errorRate:
          this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      },
    }
  }

  /**
   * Record request timing
   */
  recordRequestTiming(
    _endpoint: string,
    _method: string,
    duration: number,
    statusCode: number,
  ): void {
    this.requestCount++
    this.totalResponseTime += duration
    if (statusCode >= 400) {
      this.errorCount++
    }
    // In full implementation, this would store detailed metrics
  }

  /**
   * Record bias analysis performance
   */
  recordAnalysis(duration: number, _biasScore: number): void {
    this.requestCount++
    this.totalResponseTime += duration
    // In full implementation, this would store analysis-specific metrics
    // such as duration, bias score distribution, etc.
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
        `bias_detection_errors_total ${this.errorCount}`,
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
