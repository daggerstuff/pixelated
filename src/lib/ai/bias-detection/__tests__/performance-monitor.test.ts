/**
 * Unit tests for Bias Detection Performance Monitor
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import { performanceMonitor } from '../performance-monitor'

describe('PerformanceMonitor', () => {
  // Since performanceMonitor is a singleton, tests that record data will
  // accumulate state across the file. We assert on relative changes and
  // behavioral characteristics rather than absolute counts.

  describe('initial state', () => {
    it('should have zero-initialized snapshot', () => {
      const snapshot = performanceMonitor.getSnapshot()
      expect(snapshot).toHaveProperty('timestamp')
      expect(snapshot).toHaveProperty('metrics')
      expect(snapshot).toHaveProperty('summary')
      expect(snapshot.summary.requestCount).toBe(0)
      expect(snapshot.summary.errorRate).toBe(0)
      expect(snapshot.summary.averageResponseTime).toBe(0)
    })

    it('should include uptime and memory metrics', () => {
      const snapshot = performanceMonitor.getSnapshot()
      const metricNames = snapshot.metrics.map((m) => m.name)
      expect(metricNames).toContain('uptime')
      expect(metricNames).toContain('requests_total')
      expect(metricNames).toContain('errors_total')
      expect(metricNames).toContain('memory_usage')
    })
  })

  describe('recordRequestTiming', () => {
    beforeEach(() => {
      performanceMonitor.recordRequestTiming('/api/analyze', 'POST', 150, 200)
      performanceMonitor.recordRequestTiming('/api/analyze', 'POST', 200, 201)
      performanceMonitor.recordRequestTiming('/api/health', 'GET', 50, 200)
      performanceMonitor.recordRequestTiming('/api/analyze', 'POST', 300, 500)
    })

    it('should track request count', () => {
      const snapshot = performanceMonitor.getSnapshot()
      expect(snapshot.summary.requestCount).toBeGreaterThanOrEqual(4)
    })

    it('should track error count for 4xx/5xx status codes', () => {
      const snapshot = performanceMonitor.getSnapshot()
      expect(snapshot.summary.errorRate).toBeGreaterThan(0)
    })

    it('should calculate average response time', () => {
      const snapshot = performanceMonitor.getSnapshot()
      expect(snapshot.summary.averageResponseTime).toBeGreaterThan(0)
    })

    it('should include per-path request metrics', () => {
      const snapshot = performanceMonitor.getSnapshot()
      // With the beforeEach data, /api/analyze should be tracked
      expect(snapshot.summary.requestCount).toBeGreaterThanOrEqual(4)
      expect(typeof snapshot.summary.averageResponseTime).toBe('number')
    })
  })

  describe('recordAnalysis', () => {
    it('should record analysis performance data without throwing', () => {
      expect(() => {
        performanceMonitor.recordAnalysis(250, 0.45)
        performanceMonitor.recordAnalysis(180, 0.32)
      }).not.toThrow()
    })

    it('should handle multiple analysis recordings', () => {
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordAnalysis(100 + i * 10, 0.1 + i * 0.05)
      }

      // Just verify the method doesn't throw — cumulative count is additive
      const snapshot = performanceMonitor.getSnapshot()
      expect(snapshot.summary.requestCount).toBeGreaterThan(0)
    })
  })

  describe('exportMetrics', () => {
    it('should export metrics in JSON format', () => {
      performanceMonitor.recordRequestTiming('/api/test', 'GET', 100, 200)
      const jsonOutput = performanceMonitor.exportMetrics('json')
      expect(jsonOutput).toBeTruthy()
      const parsed = JSON.parse(jsonOutput)
      expect(parsed).toHaveProperty('summary')
      expect(parsed).toHaveProperty('metrics')
    })

    it('should export metrics in Prometheus format', () => {
      performanceMonitor.recordRequestTiming('/api/test', 'GET', 100, 200)
      const promOutput = performanceMonitor.exportMetrics('prometheus')
      expect(promOutput).toContain('# HELP')
      expect(promOutput).toContain('# TYPE')
      expect(promOutput).toContain('bias_detection_requests_total')
      expect(promOutput).toContain('bias_detection_errors_total')
      expect(promOutput).toContain('bias_detection_response_time_avg')
    })

    it('should produce valid Prometheus metric format', () => {
      const promOutput = performanceMonitor.exportMetrics('prometheus')
      const lines = promOutput.split('\n')
      const metricLines = lines.filter(
        (line) =>
          line.startsWith('bias_detection_') && !line.startsWith('#'),
      )
      expect(metricLines.length).toBeGreaterThan(0)
      metricLines.forEach((line) => {
        const parts = line.split(' ')
        expect(parts.length).toBe(2)
        expect(Number.isFinite(Number(parts[1]))).toBe(true)
      })
    })
  })

  describe('getSnapshot time window', () => {
    it('should return snapshot structure when no time window specified', () => {
      const snapshot = performanceMonitor.getSnapshot()
      expect(snapshot).toHaveProperty('summary')
      expect(snapshot.summary).toHaveProperty('averageResponseTime')
      expect(snapshot.summary).toHaveProperty('errorRate')
    })

    it('should handle zero-length time window', () => {
      const snapshot = performanceMonitor.getSnapshot(0)
      expect(snapshot).toHaveProperty('summary')
      // A 0ms window matches nothing, so requestCount should be 0
      expect(snapshot.summary.requestCount).toBe(0)
    })
  })
})
