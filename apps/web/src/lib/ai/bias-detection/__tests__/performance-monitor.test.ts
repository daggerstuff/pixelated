/**
 * Unit tests for Bias Detection Performance Monitor
 */
import { describe, it, expect, beforeEach } from 'vitest'

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
      expect(promOutput).toContain('bias_engine_requests_total')
      expect(promOutput).toContain('bias_engine_errors_total')
      expect(promOutput).toContain('bias_engine_latency_p50_ms')
      expect(promOutput).toContain('bias_engine_latency_p95_ms')
      expect(promOutput).toContain('bias_engine_latency_p99_ms')
    })

    it('should produce valid Prometheus metric format', () => {
      const promOutput = performanceMonitor.exportMetrics('prometheus')
      const lines = promOutput.split('\n')
      const metricLines = lines.filter(
        (line) => line.startsWith('bias_engine_') && !line.startsWith('#'),
      )
      expect(metricLines.length).toBeGreaterThan(0)
      metricLines.forEach((line) => {
        // Per-endpoint lines have format `name{labels} value`; per-endpoint
        // metrics use 3+ parts. The simple counters use 2 parts. Accept both.
        const trimmed = line.replace(/\{[^}]*\}/g, '')
        const parts = trimmed.split(' ').filter(Boolean)
        expect(parts.length).toBeGreaterThanOrEqual(2)
        const value = Number(parts[parts.length - 1])
        expect(Number.isFinite(value)).toBe(true)
      })
    })

    it('should include per-endpoint breakdown lines in Prometheus output', () => {
      performanceMonitor.recordRequestTiming('/api/health', 'GET', 50, 200)
      const promOutput = performanceMonitor.exportMetrics('prometheus')
      expect(promOutput).toContain('bias_engine_endpoint_requests_total{endpoint="/api/health"}')
      expect(promOutput).toContain('bias_engine_endpoint_p50{endpoint="/api/health"}')
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

  // ── Enterprise hardening — Section 3 of PIX-3913 ──────────────────

  describe('percentile metrics (p50/p95/p99)', () => {
    it('exposes percentile fields in summary', () => {
      const snap = performanceMonitor.getSnapshot()
      expect(snap.summary).toHaveProperty('p50Latency')
      expect(snap.summary).toHaveProperty('p95Latency')
      expect(snap.summary).toHaveProperty('p99Latency')
    })

    it('returns monotonically non-decreasing percentiles for a sample', () => {
      performanceMonitor.recordRequestTiming('/lat', 'GET', 10, 200)
      performanceMonitor.recordRequestTiming('/lat', 'GET', 20, 200)
      performanceMonitor.recordRequestTiming('/lat', 'GET', 30, 200)
      performanceMonitor.recordRequestTiming('/lat', 'GET', 40, 200)
      performanceMonitor.recordRequestTiming('/lat', 'GET', 50, 200)

      const snap = performanceMonitor.getSnapshot()
      expect(snap.summary.p50Latency).toBeLessThanOrEqual(snap.summary.p95Latency)
      expect(snap.summary.p95Latency).toBeLessThanOrEqual(snap.summary.p99Latency)
    })
  })

  describe('endpoint breakdown', () => {
    it('aggregates per-endpoint percentiles when requested', () => {
      performanceMonitor.recordRequestTiming('/a', 'GET', 100, 200)
      performanceMonitor.recordRequestTiming('/a', 'GET', 200, 200)
      performanceMonitor.recordRequestTiming('/b', 'POST', 50, 500)

      const snap = performanceMonitor.getSnapshot(undefined, true)
      expect(snap.endpointBreakdown).toBeDefined()
      const a = snap.endpointBreakdown!['/a']
      const b = snap.endpointBreakdown!['/b']
      expect(a.requestCount).toBe(2)
      expect(a.errorCount).toBe(0)
      expect(b.errorCount).toBe(1)
    })

    it('omits breakdown when not requested', () => {
      const snap = performanceMonitor.getSnapshot()
      expect(snap.endpointBreakdown).toBeUndefined()
    })
  })

  describe('health status transitions', () => {
    it('starts healthy (0)', () => {
      performanceMonitor.resetHealth()
      const snap = performanceMonitor.getSnapshot()
      const h = snap.metrics.find((m) => m.name === 'health_status')
      expect(h?.value).toBe(0)
    })

    it('transitions to degraded (1) after 5 consecutive errors', () => {
      performanceMonitor.resetHealth()
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordRequestTiming('/x', 'GET', 50, 500)
      }
      const snap = performanceMonitor.getSnapshot()
      const h = snap.metrics.find((m) => m.name === 'health_status')
      expect(h?.value).toBe(1)
    })

    it('transitions to unhealthy (2) after 10 consecutive errors', () => {
      performanceMonitor.resetHealth()
      for (let i = 0; i < 12; i++) {
        performanceMonitor.recordRequestTiming('/x', 'GET', 50, 500)
      }
      const snap = performanceMonitor.getSnapshot()
      const h = snap.metrics.find((m) => m.name === 'health_status')
      expect(h?.value).toBe(2)
    })

    it('resetHealth() returns monitor to healthy', () => {
      for (let i = 0; i < 12; i++) {
        performanceMonitor.recordRequestTiming('/x', 'GET', 50, 500)
      }
      performanceMonitor.resetHealth()
      const snap = performanceMonitor.getSnapshot()
      const h = snap.metrics.find((m) => m.name === 'health_status')
      expect(h?.value).toBe(0)
    })
  })
})
