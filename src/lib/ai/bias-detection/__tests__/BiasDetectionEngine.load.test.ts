// Vitest globals are available due to globals: true in vitest.config.ts
import { BiasDetectionEngine } from '../BiasDetectionEngine'
import type { TherapeuticSession } from '../types'
import { baselineAnxietyScenario, ageBiasYoungPatient } from './fixtures'

// Mock the Python bridge to avoid network calls
vi.mock('../python-bridge', () => ({
  PythonBiasDetectionBridge: class {
    initialize = vi.fn().mockResolvedValue(undefined)
    analyzeSession = vi.fn().mockImplementation(async () => {
      // Simulate realistic API response time (50-150ms)
      const delay = 50 + Math.random() * 100
      await new Promise((resolve) => setTimeout(resolve, delay))
      return {
        sessionId: 'test-session',
        overallBiasScore: 0.3 + Math.random() * 0.4,
        alertLevel: 'medium',
        layerResults: {
          preprocessing: { biasScore: 0.2 + Math.random() * 0.3 },
          modelLevel: { biasScore: 0.3 + Math.random() * 0.3 },
          interactive: { biasScore: 0.4 + Math.random() * 0.3 },
          evaluation: { biasScore: 0.3 + Math.random() * 0.3 },
        },
      }
    })
    checkHealth = vi.fn().mockResolvedValue({ status: 'healthy' })
    dispose = vi.fn().mockResolvedValue(undefined)
  },
}))

// Mock the metrics collector
vi.mock('../metrics-collector', () => ({
  BiasMetricsCollector: class {
    initialize = vi.fn().mockResolvedValue(undefined)
    getMetrics = vi.fn().mockResolvedValue({
      overall_stats: {
        total_sessions: 100,
        average_bias_score: 0.3,
        alert_distribution: {
          low: 50,
          medium: 30,
          high: 15,
          critical: 5,
        },
      },
    })
    dispose = vi.fn().mockResolvedValue(undefined)
  },
}))

// Mock the alert system
vi.mock('../alerts-system', () => ({
  BiasAlertSystem: class {
    initialize = vi.fn().mockResolvedValue(undefined)
    processAlert = vi.fn().mockResolvedValue(undefined)
    dispose = vi.fn().mockResolvedValue(undefined)
  },
}))

/**
 * Load Testing Suite for Bias Detection Engine
 * Tests concurrent session analysis performance and system stability
 */

interface LoadTestMetrics {
  totalSessions: number
  totalExecutionTime: number
  averageResponseTime: number
  successRate: number
  throughput: number
  memoryDelta: number
  errors: string[]
}

// Load testing utilities
async function runConcurrentSessions(
  engine: BiasDetectionEngine,
  sessions: TherapeuticSession[],
): Promise<{ results: unknown[]; metrics: LoadTestMetrics }> {
  const startTime = Date.now()
  const startMemory = process.memoryUsage()

  const results = await Promise.allSettled(
    sessions.map((session) => engine.analyzeSession(session)),
  )

  const endTime = Date.now()
  const endMemory = process.memoryUsage()

  const successful = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected')
  const executionTime = endTime - startTime

  const metrics: LoadTestMetrics = {
    totalSessions: sessions.length,
    totalExecutionTime: executionTime,
    averageResponseTime: executionTime / sessions.length,
    successRate: (successful / sessions.length) * 100,
    throughput: sessions.length / (executionTime / 1000),
    memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
    errors: failed.map((f) => f.reason?.message || 'Unknown error'),
  }

  return {
    results: results.map((r) => (r.status === 'fulfilled' ? r.value : null)),
    metrics,
  }
}

function generateTestSessions(
  baseSession: TherapeuticSession,
  count: number,
): TherapeuticSession[] {
  return Array.from({ length: count }, (_, i) => ({
    ...baseSession,
    sessionId: `${baseSession.sessionId}-load-${i}`,
    metadata: {
      ...baseSession.metadata,
      timestamp: new Date(Date.now() + i * 100),
    },
  }))
}

function logMetrics(metrics: LoadTestMetrics, testName: string): void {
  console.log(`\n=== ${testName} ===`)
  console.log(`Sessions: ${metrics.totalSessions}`)
  console.log(`Execution Time: ${metrics.totalExecutionTime}ms`)
  console.log(`Average Response: ${metrics.averageResponseTime.toFixed(2)}ms`)
  console.log(`Success Rate: ${metrics.successRate.toFixed(1)}%`)
  console.log(`Throughput: ${metrics.throughput.toFixed(2)} sessions/sec`)
  console.log(
    `Memory Delta: ${(metrics.memoryDelta / 1024 / 1024).toFixed(2)} MB`,
  )
  if (metrics.errors.length > 0) {
    console.log(`Errors: ${metrics.errors.length}`)
  }
}

describe('Bias Detection Engine - Load Testing', () => {
  let biasEngine: BiasDetectionEngine

  beforeAll(async () => {
    // Initialize engine
    biasEngine = new BiasDetectionEngine({
      pythonServiceUrl: 'http://localhost:5000',
      thresholds: {
        warningLevel: 0.3,
        highLevel: 0.6,
        criticalLevel: 0.8,
      },
    })

    try {
      await biasEngine.initialize()
    } catch {
      console.warn('Python service not available, using fallback mode')
    }
  })

  afterAll(async () => {
    await biasEngine.dispose()
  })

  describe('Light Load Testing (5-10 concurrent sessions)', () => {
    it('should handle 5 concurrent sessions efficiently', async () => {
      const sessions = generateTestSessions(baselineAnxietyScenario, 5)

      const { metrics } = await runConcurrentSessions(biasEngine, sessions)
      logMetrics(metrics, 'Light Load (5 sessions)')

      expect(metrics.successRate).toBeGreaterThan(80)
      expect(metrics.averageResponseTime).toBeLessThan(30000) // 30 seconds max
      expect(metrics.throughput).toBeGreaterThan(0.05) // At least 0.05 sessions/second
    })

    it('should handle 10 mixed scenario sessions', async () => {
      const sessions = [
        ...generateTestSessions(baselineAnxietyScenario, 5),
        ...generateTestSessions(ageBiasYoungPatient, 5),
      ]

      const { metrics } = await runConcurrentSessions(biasEngine, sessions)
      logMetrics(metrics, 'Mixed Load (10 sessions)')

      expect(metrics.totalSessions).toBe(10)
      expect(metrics.successRate).toBeGreaterThan(70)
    })
  })

  describe('Moderate Load Testing (25 concurrent sessions)', () => {
    it('should maintain performance with 25 concurrent sessions', async () => {
      const sessions = generateTestSessions(baselineAnxietyScenario, 25)

      const { metrics } = await runConcurrentSessions(biasEngine, sessions)
      logMetrics(metrics, 'Moderate Load (25 sessions)')

      expect(metrics.successRate).toBeGreaterThan(60)
      expect(metrics.averageResponseTime).toBeLessThan(45000) // 45 seconds max
      expect(metrics.memoryDelta).toBeLessThan(200 * 1024 * 1024) // Less than 200MB
    }, 300000) // 5 minute timeout
  })

  describe('Performance Benchmarking', () => {
    it('should meet minimum performance requirements', async () => {
      const singleSession = [baselineAnxietyScenario]
      const multiSession = generateTestSessions(baselineAnxietyScenario, 5)

      // Measure single session performance
      const { metrics: singleMetrics } = await runConcurrentSessions(
        biasEngine,
        singleSession,
      )

      // Measure concurrent session performance
      const { metrics: multiMetrics } = await runConcurrentSessions(
        biasEngine,
        multiSession,
      )

      logMetrics(singleMetrics, 'Single Session Baseline')
      logMetrics(multiMetrics, 'Concurrent Sessions')

      // Concurrent processing shouldn't be more than 3x slower per session
      const performanceDegradation =
        multiMetrics.averageResponseTime / singleMetrics.averageResponseTime

      expect(performanceDegradation).toBeLessThan(3)
      expect(multiMetrics.successRate).toBeGreaterThan(80)
    })

    it('should handle resource contention gracefully', async () => {
      const sessions = generateTestSessions(ageBiasYoungPatient, 15)

      const { metrics } = await runConcurrentSessions(biasEngine, sessions)
      logMetrics(metrics, 'Resource Contention Test (15 sessions)')

      // Even under contention, should maintain reasonable success rate
      expect(metrics.successRate).toBeGreaterThan(50)
      expect(metrics.errors.length).toBeLessThan(8) // Less than half should fail
    }, 180000) // 3 minute timeout
  })
})
