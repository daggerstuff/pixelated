
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { BiasDetectionEngine } from '../BiasDetectionEngine'
import type { BiasDetectionConfig, TherapeuticSession } from '../types'

// Define mocks using vi.hoisted to ensure they are available for vi.mock factory
const { mockPythonBridge, mockMetricsCollector, mockAlertSystem } = vi.hoisted(() => {
  const mockPythonBridge = {
    initialize: vi.fn().mockResolvedValue(undefined),
    runPreprocessingAnalysis: vi.fn().mockImplementation(async () => {
      // Simulate realistic processing time
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 + 10))
      return {
        biasScore: Math.random() * 0.5,
        linguisticBias: Math.random() * 0.3,
        confidence: 0.8 + Math.random() * 0.2,
      }
    }),
    runModelLevelAnalysis: vi.fn().mockImplementation(async () => {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 100 + 20),
      )
      return {
        biasScore: Math.random() * 0.6,
        fairnessMetrics: {
          equalizedOdds: 0.7 + Math.random() * 0.3,
          demographicParity: 0.6 + Math.random() * 0.4,
        },
        confidence: 0.85 + Math.random() * 0.15,
      }
    }),
    runInteractiveAnalysis: vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 75 + 15))
      return {
        biasScore: Math.random() * 0.4,
        counterfactualAnalysis: {
          scenarios: 3,
          improvements: Math.random() * 0.2,
        },
        confidence: 0.8 + Math.random() * 0.2,
      }
    }),
    runEvaluationAnalysis: vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 60 + 25))
      return {
        biasScore: Math.random() * 0.5,
        nlpBiasMetrics: {
          sentimentBias: Math.random() * 0.2,
          toxicityBias: Math.random() * 0.1,
        },
        confidence: 0.9 + Math.random() * 0.1,
      }
    }),
    analyze_session: vi
      .fn()
      .mockImplementation(async (session: TherapeuticSession) => {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 200 + 50),
        )
        const biasScore = Math.random() * 0.6
        // Use the session parameter to avoid unused variable warning
        void session
        return {
          session_id: 'test-session',
          overall_bias_score: biasScore,
          alert_level:
            biasScore < 0.3 ? 'low' : biasScore < 0.6 ? 'medium' : 'high',
          layer_results: {
            preprocessing: { bias_score: Math.random() * 0.5 },
            model_level: { bias_score: Math.random() * 0.6 },
            interactive: { bias_score: Math.random() * 0.4 },
            evaluation: { bias_score: Math.random() * 0.5 },
          },
          recommendations: ['System performing within acceptable parameters'],
          confidence: 0.8 + Math.random() * 0.2,
        }
      }),
    healthCheck: vi
      .fn()
      .mockResolvedValue({ status: 'healthy', latency: Math.random() * 50 + 10 }),
    dispose: vi.fn().mockResolvedValue(undefined),
  }

  const mockMetricsCollector = {
    initialize: vi.fn().mockResolvedValue(undefined),
    recordAnalysis: vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 20 + 5))
    }),
    getMetrics: vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 30 + 10))
      return {
        totalAnalyses: Math.floor(Math.random() * 1000),
        averageBiasScore: Math.random() * 0.5,
        alertDistribution: {
          low: Math.floor(Math.random() * 50) + 50,
          medium: Math.floor(Math.random() * 30) + 20,
          high: Math.floor(Math.random() * 15) + 5,
          critical: Math.floor(Math.random() * 5),
        },
        responseTimeMetrics: {
          average: Math.random() * 100 + 50,
          p95: Math.random() * 150 + 100,
          p99: Math.random() * 200 + 150,
        },
      }
    }),
    dispose: vi.fn().mockResolvedValue(undefined),
  }

  const mockAlertSystem = {
    initialize: vi.fn().mockResolvedValue(undefined),
    checkAlerts: vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 15 + 5))
    }),
    getActiveAlerts: vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 25 + 5))
      return []
    }),
    dispose: vi.fn().mockResolvedValue(undefined),
  }

  return { mockPythonBridge, mockMetricsCollector, mockAlertSystem }
})

// Mock the Python bridge to avoid network calls
// Use regular function to allow 'new' usage
vi.mock('../python-bridge', () => ({
  PythonBiasDetectionBridge: vi.fn().mockImplementation(function() { return mockPythonBridge }),
}))

// Mock the metrics collector
vi.mock('../metrics-collector', () => ({
  BiasMetricsCollector: vi.fn().mockImplementation(function() { return mockMetricsCollector }),
}))

// Mock the alert system
vi.mock('../alerts-system', () => ({
  BiasAlertSystem: vi.fn().mockImplementation(function() { return mockAlertSystem }),
}))

// Allow CI to skip performance-heavy tests
const SKIP_PERF = process.env['SKIP_PERFORMANCE_TESTS'] === 'true'
const ddescribe = SKIP_PERF ? describe.skip : describe

// Performance testing utilities
interface PerformanceMetrics {
  executionTime: number
  memoryUsage: {
    before: number
    after: number
    delta: number
  }
  cpuUsage?: number
}

interface BenchmarkResult {
  method: string
  metrics: PerformanceMetrics
  iterations: number
  averageTime: number
  minTime: number
  maxTime: number
  success: boolean
  errorCount: number
}

const PerformanceBenchmark = {
  getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return 0
  },

  async measureMethod<T>(
    method: () => Promise<T>,
    iterations: number = 1,
  ): Promise<BenchmarkResult> {
    const results: number[] = []
    let errorCount = 0
    const methodName = method.name || 'anonymous'

    const memoryBefore = this.getMemoryUsage()

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()
      try {
        await method()
        const endTime = performance.now()
        results.push(endTime - startTime)
      } catch (error: unknown) {
        errorCount++
        console.error(`Benchmark iteration ${i + 1} failed:`, error)
      }
    }

    const memoryAfter = this.getMemoryUsage()

    const averageTime =
      results.length > 0
        ? results.reduce((a, b) => a + b, 0) / results.length
        : 0
    const minTime = results.length > 0 ? Math.min(...results) : 0
    const maxTime = results.length > 0 ? Math.max(...results) : 0

    return {
      method: methodName,
      metrics: {
        executionTime: averageTime,
        memoryUsage: {
          before: memoryBefore,
          after: memoryAfter,
          delta: memoryAfter - memoryBefore,
          memoryUsage: {
            before: memoryBefore,
            after: memoryAfter,
            delta: memoryAfter - memoryBefore,
          }
        },
      },
      iterations,
      averageTime,
      minTime,
      maxTime,
      success: errorCount === 0,
      errorCount,
    }
  },

  async measureConcurrentLoad<T>(
    method: () => Promise<T>,
    concurrentRequests: number,
    totalRequests: number,
  ): Promise<{
    throughput: number
    averageResponseTime: number
    successRate: number
    errors: number
  }> {
    const startTime = performance.now()
    let completedRequests = 0
    let errors = 0
    const responseTimes: number[] = []

    const batches = Math.ceil(totalRequests / concurrentRequests)

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(
        concurrentRequests,
        totalRequests - batch * concurrentRequests,
      )
      const promises: Promise<void>[] = []

      for (let i = 0; i < batchSize; i++) {
        const requestStartTime = performance.now()
        promises.push(
          method()
            .then(() => {
              const requestEndTime = performance.now()
              responseTimes.push(requestEndTime - requestStartTime)
              completedRequests++
            })
            .catch(() => {
              errors++
            }),
        )
      }

      await Promise.allSettled(promises)
    }

    const endTime = performance.now()
    const totalTime = endTime - startTime
    const throughput = (completedRequests / totalTime) * 1000 // requests per second
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0
    const successRate = completedRequests / totalRequests

    return {
      throughput,
      averageResponseTime,
      successRate,
      errors,
    }
  },
} as const

// Mock the Python service classes
vi.mock('../python-bridge', () => ({
  PythonBiasDetectionBridge: vi.fn().mockImplementation(function() { return mockPythonBridge }),
}))

vi.mock('../BiasMetricsCollector', () => ({
  BiasMetricsCollector: vi.fn().mockImplementation(function() { return mockMetricsCollector }),
}))

vi.mock('../BiasAlertSystem', () => ({
  BiasAlertSystem: vi.fn().mockImplementation(function() { return mockAlertSystem }),
}))

ddescribe('BiasDetectionEngine Performance Benchmarks', () => {
  let biasEngine: BiasDetectionEngine
  let mockConfig: BiasDetectionConfig
  let mockSessionData: TherapeuticSession
  const performanceResults: BenchmarkResult[] = []

  // Performance thresholds (in milliseconds)
  const IS_CI = process.env['CI'] === 'true'
  const MULTIPLIER = IS_CI ? 2.5 : 1.0 // Relax thresholds in CI

  const PERFORMANCE_THRESHOLDS = {
    analyzeSession: 500 * MULTIPLIER, // Core analysis should complete under 1250ms in CI
    getMetrics: 100 * MULTIPLIER, // Metrics retrieval should be fast
    getSessionAnalysis: 50 * MULTIPLIER, // Cached data retrieval should be very fast
    startMonitoring: 30 * MULTIPLIER, // Monitoring setup should be quick
    stopMonitoring: 20 * MULTIPLIER, // Monitoring teardown should be quick
    explainBiasDetection: 200 * MULTIPLIER, // Explanation generation should be reasonable
    updateThresholds: 50 * MULTIPLIER, // Configuration updates should be fast
    generateBiasReport: 300 * MULTIPLIER, // Report generation can take a bit longer
    dispose: 100 * MULTIPLIER, // Cleanup should be quick
  }

  beforeAll(() => {
    // Initialize performance monitoring
    console.log('🚀 Starting BiasDetectionEngine Performance Benchmarks')
    console.log('Performance Thresholds:', PERFORMANCE_THRESHOLDS)
  })

  beforeEach(async () => {
    mockConfig = {
      thresholds: {
        warning: 0.3,
        high: 0.6,
        critical: 0.8,
      },
      hipaaCompliant: true,
      auditLogging: true,
      layerWeights: {
        preprocessing: 0.25,
        modelLevel: 0.25,
        interactive: 0.25,
        evaluation: 0.25,
      },
    } as BiasDetectionConfig

    mockSessionData = {
      sessionId: `perf-test-session-${Date.now()}`,
      sessionDate: new Date().toISOString(),
      participantDemographics: {
        age: '25-35',
        gender: 'female',
        ethnicity: 'hispanic',
        primaryLanguage: 'en',
      },
      scenario: {
        scenarioId: 'anxiety-001',
        type: 'anxiety',
      },
      content: {
        transcript: 'Patient expresses feeling overwhelmed with work stress and anxiety symptoms...',
        aiResponses: [],
        userInputs: [],
      },
      aiResponses: [
        {
          responseId: 'response-1',
          timestamp: new Date(),
          text: "I understand you're feeling stressed. Let's explore some coping strategies.",
          metadata: {
            confidence: 0.9,
            modelUsed: 'gpt-4',
          },
        },
      ],
      expectedOutcomes: [
        {
          outcomeId: 'outcome-1',
          description: 'therapeutic-alliance',
          achieved: true,
        },
      ],
      transcripts: [
        {
          speaker: 'user',
          timestamp: new Date(),
          text: 'I feel overwhelmed with work and personal responsibilities',
        },
      ],
      userInputs: [],
      metadata: {
        sessionStartTime: new Date(),
        sessionEndTime: new Date(),
        tags: [],
      },
    }

    biasEngine = new BiasDetectionEngine(mockConfig)
    await biasEngine.initialize()
  })

  afterEach(async () => {
    if (biasEngine) {
      await biasEngine.dispose()
    }
    vi.clearAllMocks()
  })

  afterAll(() => {
    // Print performance summary
    console.log('\n📊 Performance Benchmark Results Summary')
    console.log('='.repeat(50))

    performanceResults.forEach((result) => {
      const threshold =
        PERFORMANCE_THRESHOLDS[
        result.method as keyof typeof PERFORMANCE_THRESHOLDS
        ]
      const status = result.averageTime <= threshold ? '✅ PASS' : '❌ FAIL'

      console.log(
        `${result.method}: ${result.averageTime.toFixed(2)}ms (threshold: ${threshold}ms) ${status}`,
      )
      console.log(
        `  Min: ${result.minTime.toFixed(2)}ms, Max: ${result.maxTime.toFixed(2)}ms`,
      )
      console.log(
        `  Memory Delta: ${(result.metrics.memoryUsage.delta / 1024 / 1024).toFixed(2)}MB`,
      )
      console.log(
        `  Success Rate: ${result.success ? '100%' : `${(((result.iterations - result.errorCount) / result.iterations) * 100).toFixed(1)}%`}`,
      )
      console.log('')
    })
  })

  describe('Core Method Performance', () => {
    it('should benchmark analyzeSession method performance', async () => {
      const result = await PerformanceBenchmark.measureMethod(
        async () => await biasEngine.analyzeSession(mockSessionData),
        10,
      )

      performanceResults.push(result)

      expect(result.success).toBe(true)
      expect(result.averageTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.analyzeSession,
      )
      expect(result.errorCount).toBe(0)

      // Memory usage should be reasonable (less than 50MB increase)
      expect(result.metrics.memoryUsage.delta).toBeLessThan(50 * 1024 * 1024)
    })

    it('should benchmark getMetrics method performance', async () => {
      const result = await PerformanceBenchmark.measureMethod(
        async () =>
          await biasEngine.getMetrics({
            timeRange: {
              start: new Date(Date.now() - 86400000),
              end: new Date(),
            },
          }),
        20,
      )

      performanceResults.push(result)

      expect(result.success).toBe(true)
      expect(result.averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.getMetrics)
    })

    it('should benchmark getSessionAnalysis method performance', async () => {
      // First analyze a session to populate cache
      await biasEngine.analyzeSession(mockSessionData)

      const result = await PerformanceBenchmark.measureMethod(
        async () =>
          await biasEngine.getSessionAnalysis(mockSessionData.sessionId),
        50,
      )

      performanceResults.push(result)

      expect(result.success).toBe(true)
      expect(result.averageTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.getSessionAnalysis,
      )
    })

    it('should benchmark startMonitoring and stopMonitoring performance', async () => {
      const startResult = await PerformanceBenchmark.measureMethod(
        async () => await biasEngine.startMonitoring(() => { }),
        10,
      )

      const stopResult = await PerformanceBenchmark.measureMethod(
        async () => await biasEngine.stopMonitoring(),
        10,
      )

      performanceResults.push({ ...startResult, method: 'startMonitoring' })
      performanceResults.push({ ...stopResult, method: 'stopMonitoring' })

      expect(startResult.averageTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.startMonitoring,
      )
      expect(stopResult.averageTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.stopMonitoring,
      )
    })

    it('should benchmark explainBiasDetection method performance', async () => {
      // First analyze a session to have results to explain
      const analysisResult = await biasEngine.analyzeSession(mockSessionData)

      const result = await PerformanceBenchmark.measureMethod(
        async () => await biasEngine.explainBiasDetection(analysisResult),
        15,
      )

      performanceResults.push(result)

      expect(result.success).toBe(true)
      expect(result.averageTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.explainBiasDetection,
      )
    })

    it('should benchmark updateThresholds method performance', async () => {
      const newThresholds = {
        warning: 0.35,
        high: 0.65,
        critical: 0.85,
      }

      const result = await PerformanceBenchmark.measureMethod(
        async () => await biasEngine.updateThresholds(newThresholds),
        25,
      )

      performanceResults.push(result)

      expect(result.success).toBe(true)
      expect(result.averageTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.updateThresholds,
      )
    })

    it('should benchmark generateBiasReport method performance', async () => {
      // First analyze some sessions to have data for reporting
      await biasEngine.analyzeSession(mockSessionData)
      await biasEngine.analyzeSession({
        ...mockSessionData,
        sessionId: `${mockSessionData.sessionId}-2`,
      })

      const result = await PerformanceBenchmark.measureMethod(
        async () =>
          await biasEngine.generateBiasReport(
            [mockSessionData],
            {
              start: new Date(Date.now() - 24 * 60 * 60 * 1000),
              end: new Date(),
            },
            { format: 'json' },
          ),
        8,
      )

      performanceResults.push(result)

      expect(result.success).toBe(true)
      expect(result.averageTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.generateBiasReport,
      )
    })

    it('should benchmark dispose method performance', async () => {
      // Create a fresh engine for disposal testing
      const testEngine = new BiasDetectionEngine(mockConfig)
      await testEngine.initialize()

      const result = await PerformanceBenchmark.measureMethod(
        async () => await testEngine.dispose(),
        5,
      )

      performanceResults.push(result)

      expect(result.success).toBe(true)
      expect(result.averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.dispose)
    })
  })

  describe('Concurrent Load Testing', () => {
    it('should handle concurrent analyzeSession requests efficiently', async () => {
      const loadResult = await PerformanceBenchmark.measureConcurrentLoad(
        async () => {
          const sessionData = {
            ...mockSessionData,
            sessionId: `concurrent-test-${Date.now()}-${Math.random()}`,
          }
          return await biasEngine.analyzeSession(sessionData)
        },
        5, // 5 concurrent requests
        25, // 25 total requests
      )

      expect(loadResult.successRate).toBeGreaterThan(0.95) // 95% success rate
      expect(loadResult.throughput).toBeGreaterThan(1) // At least 1 request per second
      expect(loadResult.averageResponseTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.analyzeSession * 2,
      )

      console.log(`Concurrent Load Test Results:
        Throughput: ${loadResult.throughput.toFixed(2)} requests/second
        Average Response Time: ${loadResult.averageResponseTime.toFixed(2)}ms
        Success Rate: ${(loadResult.successRate * 100).toFixed(1)}%
        Errors: ${loadResult.errors}`)
    })

    it('should handle burst traffic without degradation', async () => {
      const burstResult = await PerformanceBenchmark.measureConcurrentLoad(
        async () =>
          await biasEngine.getMetrics({
            timeRange: {
              start: new Date(Date.now() - 86400000),
              end: new Date(),
            },
          }),
        10, // 10 concurrent requests
        50, // 50 total requests
      )

      expect(burstResult.successRate).toBeGreaterThan(0.98) // 98% success rate for lighter operations
      expect(burstResult.throughput).toBeGreaterThan(5) // At least 5 requests per second for metrics
      expect(burstResult.errors).toBeLessThan(2) // Very few errors acceptable
    })
  })

  describe('Memory Usage and Resource Management', () => {
    it('should maintain stable memory usage during extended operation', async () => {
      const initialMemory = process.memoryUsage?.().heapUsed || 0

      // Perform many operations to test for memory leaks
      for (let i = 0; i < 20; i++) {
        const sessionData = {
          ...mockSessionData,
          sessionId: `memory-test-${i}`,
        }
        await biasEngine.analyzeSession(sessionData)

        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }

      const finalMemory = process.memoryUsage?.().heapUsed || 0
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (less than 100MB for 20 operations)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)

      console.log(`Memory Usage Test:
        Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
        Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB
        Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
    })

    it('should handle rapid initialization and disposal cycles', async () => {
      const cycles = 10
      const startTime = performance.now()

      for (let i = 0; i < cycles; i++) {
        const testEngine = new BiasDetectionEngine(mockConfig)
        await testEngine.initialize()
        await testEngine.dispose()
      }

      const totalTime = performance.now() - startTime
      const averageTimePerCycle = totalTime / cycles

      // Each init/dispose cycle should be reasonable
      expect(averageTimePerCycle).toBeLessThan(200) // Less than 200ms per cycle

      console.log(`Initialization/Disposal Cycles:
        Total Time: ${totalTime.toFixed(2)}ms
        Average per Cycle: ${averageTimePerCycle.toFixed(2)}ms
        Cycles: ${cycles}`)
    })
  })

  describe('Scalability Testing', () => {
    it('should scale analysis performance linearly with session complexity', async () => {
      const complexityLevels = [
        { transcripts: 5, responses: 3, name: 'simple' },
        { transcripts: 20, responses: 10, name: 'medium' },
        { transcripts: 50, responses: 25, name: 'complex' },
      ]

      const scalabilityResults: { [key: string]: number } = {}

      for (const level of complexityLevels) {
        const complexSessionData: TherapeuticSession = {
          ...mockSessionData,
          sessionId: `scalability-${level.name}`,
          transcripts: Array.from({ length: level.transcripts }, (_, i) => ({
            speaker: i % 2 === 0 ? 'user' : 'ai',
            text: `This is transcript ${i + 1} with varying complexity and length`,
            timestamp: new Date(Date.now() + i * 1000),
          })),
          aiResponses: Array.from({ length: level.responses }, (_, i) => ({
            responseId: `response-${i + 1}`,
            timestamp: new Date(Date.now() + i * 2000),
            text: `AI response ${i + 1} with detailed therapeutic guidance and recommendations`,
            metadata: {
              confidence: 0.8 + Math.random() * 0.2,
              modelUsed: 'gpt-4',
            },
          })),
        }

        const result = await PerformanceBenchmark.measureMethod(
          async () => await biasEngine.analyzeSession(complexSessionData),
          5,
        )

        scalabilityResults[level.name] = result.averageTime
      }

      // Performance should not degrade exponentially
      const simpleTime = scalabilityResults['simple']
      const complexTime = scalabilityResults['complex']
      const scalingFactor = (complexTime || 0) / (simpleTime || 1)

      expect(scalingFactor).toBeLessThan(10) // Should not be more than 10x slower for 10x complexity

      console.log(`Scalability Test Results:
        Simple: ${scalabilityResults['simple']?.toFixed(2)}ms
        Medium: ${scalabilityResults['medium']?.toFixed(2)}ms
        Complex: ${scalabilityResults['complex']?.toFixed(2)}ms
        Scaling Factor: ${scalingFactor.toFixed(2)}x`)
    })
  })
})
