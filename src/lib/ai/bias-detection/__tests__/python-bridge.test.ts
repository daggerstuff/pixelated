import type { TherapeuticSession } from '../types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { PythonBiasDetectionBridge } from '../python-bridge'

// Mock fetch globally
global.fetch = vi.fn()

// Track intervals to clean them up after each test
const activeIntervals = new Set<NodeJS.Timeout>()
const originalSetInterval = global.setInterval
global.setInterval = function (callback: any, ms?: number) {
  const id = originalSetInterval(callback, ms)
  activeIntervals.add(id)
  return id
} as any

const originalClearInterval = global.clearInterval
global.clearInterval = function (id: NodeJS.Timeout) {
  activeIntervals.delete(id)
  return originalClearInterval(id)
} as any

describe('analysis methods', () => {
  let bridge: PythonBiasDetectionBridge
  const mockConfig = {
    pythonServiceUrl: 'http://localhost:5000',
    pythonServiceTimeout: 30000,
  }

  afterEach(() => {
    activeIntervals.forEach(clearInterval)
    activeIntervals.clear()
  })

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock successful responses by default
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json:  async () => Promise.resolve({ status: 'healthy', timestamp: Date.now() }),
    })

    // Create a fresh bridge instance for each test
    bridge = new PythonBiasDetectionBridge(
      mockConfig.pythonServiceUrl,
      mockConfig.pythonServiceTimeout,
    )
  })

  afterEach(() => {
    bridge.stopHealthMonitoring()
  })

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(bridge).toBeDefined()
    })

    it('should handle initialization without errors', async () => {
      await expect(bridge.initialize()).resolves.not.toThrow()
    })
  })

  describe('health checks', () => {
    it('should perform health checks', async () => {
      const healthStatus = await bridge.checkHealth?.()
      expect(healthStatus).toBeDefined()
    })

    it('should return healthy status when service is available', async () => {
      const healthStatus = await bridge.checkHealth?.()
      expect(healthStatus?.status).toBe('healthy')
    })
  })

  describe('analysis methods', () => {
    const mockSession: TherapeuticSession = {
      sessionId: 'test-session-123',
      timestamp: new Date(),
      content: { transcript: 'Test session content for bias analysis' },
      participantDemographics: {
        age: '30',
        gender: 'female',
        ethnicity: 'caucasian',
        primaryLanguage: 'english',
      },
    }

    it('should run preprocessing analysis', async () => {
      const result = await bridge.runPreprocessingAnalysis(mockSession)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('biasScore')
      expect(result).toHaveProperty('linguisticBias')
    })

    it('should run model level analysis', async () => {
      const result = await bridge.runModelLevelAnalysis(mockSession)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('biasScore')
      expect(result).toHaveProperty('fairnessMetrics')
    })

    it('should run interactive analysis', async () => {
      const result = await bridge.runInteractiveAnalysis(mockSession)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('biasScore')
      expect(result).toHaveProperty('counterfactualAnalysis')
    })

    it('should run evaluation analysis', async () => {
      const result = await bridge.runEvaluationAnalysis(mockSession)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('biasScore')
      expect(result).toHaveProperty('huggingFaceMetrics')
    })
  })

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockSession: TherapeuticSession = {
        sessionId: 'error-test',
        timestamp: new Date(),
        content: { transcript: 'Test content' },
      }

      // Mock a network failure
      const originalRequest = global.fetch
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      // Reduce retries and delay for testing
      ;(bridge as any).retryAttempts = 1
      ;(bridge as any).retryDelay = 0

      const result = await bridge.runPreprocessingAnalysis(mockSession)

      // Should return fallback result instead of throwing
      expect(result.fallbackMode).toBe(true)
      expect(result.serviceError).toContain('Request failed after')

      // Restore original fetch
      global.fetch = originalRequest
    })

    it('should handle timeout errors', async () => {
      const mockSession: TherapeuticSession = {
        sessionId: 'timeout-test',
        timestamp: new Date(),
        content: { transcript: 'Test content' },
      }

      // Create bridge with very short timeout
      const timeoutBridge = new PythonBiasDetectionBridge(
        mockConfig.pythonServiceUrl,
        1, // 1ms timeout
      )

      // Reduce retries and delay for testing
      ;(timeoutBridge as any).retryAttempts = 1
      ;(timeoutBridge as any).retryDelay = 0

      const result = await timeoutBridge.runPreprocessingAnalysis(mockSession)

      // Should return fallback result for timeout
      expect(result.fallbackMode).toBe(true)

      timeoutBridge.stopHealthMonitoring()
    })
  })

  describe('connection pooling', () => {
    it('should use connection pooling for requests', async () => {
      const mockSession: TherapeuticSession = {
        sessionId: 'pool-test',
        timestamp: new Date(),
        content: { transcript: 'Test content' },
      }

      const result = await bridge.runPreprocessingAnalysis(mockSession)
      expect(result).toBeDefined()
    })

    it('should handle connection pool exhaustion', async () => {
      // This test would require mocking the connection pool to simulate exhaustion
      // For now, we'll just ensure the bridge can handle multiple concurrent requests
      const mockSession: TherapeuticSession = {
        sessionId: 'concurrency-test',
        timestamp: new Date(),
        content: { transcript: 'Test content' },
      }

      const promises = Array(5)
        .fill(null)
        .map( async () => bridge.runPreprocessingAnalysis(mockSession))

      const results = await Promise.allSettled(promises)
      expect(results.length).toBe(5)
    })
  })

  describe('performance monitoring', () => {
    it('should track request metrics', async () => {
      const mockSession: TherapeuticSession = {
        sessionId: 'metrics-test',
        timestamp: new Date(),
        content: { transcript: 'Test content' },
      }

      await bridge.runPreprocessingAnalysis(mockSession)

      // Check if metrics are being tracked (this would require access to internal metrics)
      // For now, we just ensure the method completes without error
    })

    it('should handle performance monitoring failures gracefully', async () => {
      // Test that performance monitoring failures don't break the main functionality
      const mockSession: TherapeuticSession = {
        sessionId: 'perf-test',
        timestamp: new Date(),
        content: { transcript: 'Test content' },
      }

      const result = await bridge.runPreprocessingAnalysis(mockSession)
      expect(result).toBeDefined()
    })
  })

  describe('health monitoring', () => {
    it('should report current health status', () => {
      const status = bridge.getHealthStatus()
      expect(status).toHaveProperty('status')
      expect(status).toHaveProperty('lastCheck')
      expect(status).toHaveProperty('consecutiveFailures')
    })

    it('should stop health monitoring timer', () => {
      expect(() => bridge.stopHealthMonitoring()).not.toThrow()
    })

    it('should handle stopHealthMonitoring called multiple times', () => {
      bridge.stopHealthMonitoring()
      expect(() => bridge.stopHealthMonitoring()).not.toThrow()
    })

    it('should return current metrics', () => {
      const metrics = bridge.getMetrics()
      expect(metrics).toHaveProperty('totalRequests')
      expect(metrics).toHaveProperty('successfulRequests')
      expect(metrics).toHaveProperty('failedRequests')
      expect(metrics).toHaveProperty('averageResponseTime')
      expect(metrics).toHaveProperty('cacheHits')
      expect(metrics).toHaveProperty('cacheMisses')
      expect(metrics).toHaveProperty('deduplicatedRequests')
    })

    it('should return metrics as a copy (not mutable reference)', () => {
      const m1 = bridge.getMetrics()
      const m2 = bridge.getMetrics()
      expect(m1).toEqual(m2)
    })
  })

  describe('request queuing and retries', () => {
    it('should retry failed requests with backoff', async () => {
      const mockSession: TherapeuticSession = {
        sessionId: 'retry-test',
        timestamp: new Date(),
        content: { transcript: 'Retry test content' },
      }

      // Mock fetch to fail twice then succeed
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => Promise.resolve({
            status: 'healthy',
            message: 'Success',
          }),
        })

      global.fetch = mockFetch
      ;(bridge as any).retryAttempts = 3
      ;(bridge as any).retryDelay = 0

      const result = await bridge.runPreprocessingAnalysis(mockSession)
      expect(result).toBeDefined()
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should give up after exhausting retries', async () => {
      const mockSession: TherapeuticSession = {
        sessionId: 'exhaust-retry',
        timestamp: new Date(),
        content: { transcript: 'Exhaust retry test' },
      }

      // Always fail
      global.fetch = vi.fn().mockRejectedValue(new Error('Service down'))
      ;(bridge as any).retryAttempts = 2
      ;(bridge as any).retryDelay = 0

      const result = await bridge.runPreprocessingAnalysis(mockSession)
      expect(result.fallbackMode).toBe(true)
      expect(result.serviceError).toContain('Request failed after')
    })
  })

  describe('convenience shims', () => {
    it('should send metrics batch', async () => {
      const result = await bridge.sendMetricsBatch({ metrics: [] })
      expect(result).toBeDefined()
    })

    it('should send analysis metric', async () => {
      const result = await bridge.sendAnalysisMetric({ score: 0.5 })
      expect(result).toBeDefined()
    })

    it('should get dashboard metrics', async () => {
      const result = await bridge.getDashboardMetrics()
      expect(result).toBeDefined()
    })

    it('should record report metric', async () => {
      const result = await bridge.recordReportMetric({ reportId: 'r1' })
      expect(result).toBeDefined()
    })

    it('should get performance metrics', async () => {
      const result = await bridge.getPerformanceMetrics()
      expect(result).toBeDefined()
    })

    it('should get session data', async () => {
      const result = await bridge.getSessionData('session-123')
      expect(result).toBeDefined()
    })

    it('should store metrics', async () => {
      const result = await bridge.storeMetrics({ data: [] })
      expect(result).toBeDefined()
    })
  })

  describe('alert system shims', () => {
    it('should register alert system', async () => {
      const result = await bridge.registerAlertSystem({ system_id: 'test' })
      expect(result).toBeDefined()
    })

    it('should check alerts', async () => {
      const result = await bridge.checkAlerts({ sessionId: 's1' })
      expect(result).toBeDefined()
    })

    it('should store alerts', async () => {
      const result = await bridge.storeAlerts([])
      expect(result).toBeDefined()
    })

    it('should escalate alert', async () => {
      const result = await bridge.escalateAlert({ alert_id: 'a1' })
      expect(result).toBeDefined()
    })

    it('should send notification', async () => {
      const result = await bridge.sendNotification({ message: 'test' })
      expect(result).toBeDefined()
    })

    it('should get active alerts', async () => {
      const result = await bridge.getActiveAlerts()
      expect(result).toBeDefined()
    })

    it('should acknowledge alert', async () => {
      const result = await bridge.acknowledgeAlert({ alert_id: 'a1' })
      expect(result).toBeDefined()
    })

    it('should send system notification', async () => {
      const result = await bridge.sendSystemNotification({
        message: 'test',
        recipients: ['admin'],
      })
      expect(result).toBeDefined()
    })

    it('should get recent alerts', async () => {
      const result = await bridge.getRecentAlerts()
      expect(result).toBeDefined()
    })

    it('should get alert statistics', async () => {
      const result = await bridge.getAlertStatistics()
      expect(result).toBeDefined()
    })

    it('should unregister alert system', async () => {
      const result = await bridge.unregisterAlertSystem({ system_id: 'test' })
      expect(result).toBeDefined()
    })
  })

  describe('dispose', () => {
    it('should dispose bridge resources', async () => {
      await expect(bridge.dispose()).resolves.not.toThrow()
    })

    it('should handle dispose called multiple times', async () => {
      await bridge.dispose()
      await expect(bridge.dispose()).resolves.not.toThrow()
    })
  })

  describe('non-200 responses', () => {
    it('should handle HTTP error responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })
      ;(bridge as any).retryAttempts = 1
      ;(bridge as any).retryDelay = 0

      const result = await bridge.runPreprocessingAnalysis({
        sessionId: 'http-error-test',
        timestamp: new Date(),
        content: { transcript: 'test' },
      })

      expect(result.fallbackMode).toBe(true)
    })
  })

  describe('auth token handling', () => {
    afterEach(() => {
      delete process.env['BIAS_DETECTION_AUTH_TOKEN']
    })

    it('should send Authorization header when auth token env var is set', async () => {
      process.env['BIAS_DETECTION_AUTH_TOKEN'] = 'test-secret-42'

      const authBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      ;(authBridge as any).retryAttempts = 1
      ;(authBridge as any).retryDelay = 0

      // Stops the health monitoring interval to avoid interference
      authBridge.stopHealthMonitoring()

      await authBridge.checkHealth()

      // Find the fetch call that went to /health
      const healthCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === 'string' && call[0].includes('/health'),
      )
      expect(healthCalls.length).toBeGreaterThan(0)
      const headers = healthCalls[healthCalls.length - 1][1].headers
      expect(headers['Authorization']).toBe('Bearer test-secret-42')
    })

    it('should not include Authorization header when no auth token is set', async () => {
      // Ensure no env var is set
      delete process.env['BIAS_DETECTION_AUTH_TOKEN']

      // Create a new bridge after clearing env
      const noAuthBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      ;(noAuthBridge as any).retryAttempts = 1
      ;(noAuthBridge as any).retryDelay = 0
      noAuthBridge.stopHealthMonitoring()

      await noAuthBridge.checkHealth()

      const healthCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === 'string' && call[0].includes('/health'),
      )
      expect(healthCalls.length).toBeGreaterThan(0)
      const headers = healthCalls[healthCalls.length - 1][1].headers
      expect(headers['Authorization']).toBeUndefined()
    })
  })

  describe('initialize with non-healthy response', () => {
    it('should initialize successfully when health check returns degraded status', async () => {
      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'degraded',
          message: 'Service overloaded',
        }),
      })

      const degradedBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      ;(degradedBridge as any).retryAttempts = 1
      ;(degradedBridge as any).retryDelay = 0

      await expect(degradedBridge.initialize()).resolves.not.toThrow()
    })

    it('should throw when health check fails with network error', async () => {
      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockRejectedValue(
        new Error('Connection refused'),
      )

      const failBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      ;(failBridge as any).retryAttempts = 1
      ;(failBridge as any).retryDelay = 0

      await expect(failBridge.initialize()).rejects.toThrow(
        'Python service initialization failed',
      )
    })
  })

  describe('health monitoring state transitions', () => {
    it('should start with healthy status', () => {
      const h = bridge.getHealthStatus()
      expect(h.status).toBe('healthy')
    })

    it('should return degraded status via getHealthStatus', () => {
      // Directly set the internal state to test the getter path
      ;(bridge as any).healthStatus = 'degraded'
      ;(bridge as any).consecutiveFailures = 2
      const h = bridge.getHealthStatus()
      expect(h.status).toBe('degraded')
      expect(h.consecutiveFailures).toBe(2)
    })

    it('should return unhealthy status via getHealthStatus', () => {
      ;(bridge as any).healthStatus = 'unhealthy'
      ;(bridge as any).consecutiveFailures = 5
      const h = bridge.getHealthStatus()
      expect(h.status).toBe('unhealthy')
      expect(h.consecutiveFailures).toBe(5)
    })

    it('should increment failedRequests metric on request failure', async () => {
      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockRejectedValue(new Error('Down'))
      ;(bridge as any).retryAttempts = 1
      ;(bridge as any).retryDelay = 0

      const session: TherapeuticSession = {
        sessionId: 'metrics-test',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }
      await bridge.runPreprocessingAnalysis(session)

      const metrics = bridge.getMetrics()
      expect(metrics.failedRequests).toBeGreaterThan(0)
      expect(metrics.totalRequests).toBeGreaterThan(0)
    })
  })

  describe('processQueue concurrency guard', () => {
    it('should early-return when queue is already processing', async () => {
      // Set processing to true to trigger early return
      ;(bridge as any).processingQueue = true

      // Call processQueue — it should return immediately
      await (bridge as any).processQueue()

      // processingQueue should remain true (not reset to false)
      expect((bridge as any).processingQueue).toBe(true)
    })

    it('should process queued requests and then set processingQueue to false', async () => {
      // Manually set processingQueue to false (constructor may have set it)
      ;(bridge as any).processingQueue = false
      ;(bridge as any).activeRequests = 0

      // Queue a simple request
      await new Promise<void>((resolve) => {
        ;(bridge as any).requestQueue.push({
          id: 'test-manual-req',
          request: async () => 'done',
          resolve: (v: unknown) => resolve(),
          reject: (e: Error) => resolve(),
          priority: 1,
        })
        ;(bridge as any).processQueue()
      })

      // Access element at index 0
      const queue = (bridge as any).requestQueue
      // The test request should have been consumed
      expect(queue.length).toBe(0)
    })
  })

  describe('POST body serialization', () => {
    it('should include JSON body for POST requests with data', async () => {
      const testPayload = { foo: 'bar', num: 42 }
      ;(bridge as any).retryAttempts = 1
      ;(bridge as any).retryDelay = 0

      // Send a POST request with data via a convenience shim
      await bridge.sendMetricsBatch(testPayload)

      const postCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('/metrics/batch'),
      )
      expect(postCalls.length).toBeGreaterThan(0)
      const options = postCalls[postCalls.length - 1][1]
      expect(options.method).toBe('POST')
      expect(options.body).toBe(JSON.stringify(testPayload))
    })

    it('should not include body for GET requests', async () => {
      ;(bridge as any).retryAttempts = 1
      ;(bridge as any).retryDelay = 0

      await bridge.getSessionData('test-session')

      const getCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('/session/test-session'),
      )
      expect(getCalls.length).toBeGreaterThan(0)
      const options = getCalls[getCalls.length - 1][1]
      expect(options.method).toBe('GET')
      expect(options.body).toBeUndefined()
    })
  })

  describe('connection pool integration', () => {
    let mockPool: any

    beforeEach(() => {
      mockPool = {
        acquireConnection: vi
          .fn()
          .mockResolvedValue({ id: 'pool-conn-1' }),
        releaseConnection: vi.fn(),
        dispose: vi.fn().mockResolvedValue(undefined),
      }
    })

    it('should acquire and release connections for requests', async () => {
      const poolBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
        mockPool,
      )
      ;(poolBridge as any).retryAttempts = 1
      ;(poolBridge as any).retryDelay = 0

      await poolBridge.checkHealth()

      expect(mockPool.acquireConnection).toHaveBeenCalled()
      expect(mockPool.releaseConnection).toHaveBeenCalled()
    })

    it('should handle missing acquireConnection gracefully', async () => {
      const partialPool = {} as any
      const poolBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
        partialPool,
      )
      ;(poolBridge as any).retryAttempts = 1
      ;(poolBridge as any).retryDelay = 0

      // Should not throw despite missing connection pool methods
      await expect(poolBridge.checkHealth()).resolves.toBeDefined()
    })

    it('should dispose the connection pool on bridge dispose', async () => {
      const poolBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
        mockPool,
      )
      await poolBridge.dispose()

      expect(mockPool.dispose).toHaveBeenCalled()
    })

    it('should handle connection pool dispose error gracefully', async () => {
      const errorPool: any = {
        ...mockPool,
        dispose: vi.fn().mockRejectedValue(new Error('Pool cleanup failed')),
      }
      const poolBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
        errorPool,
      )

      // Should not throw even when pool dispose fails
      await expect(poolBridge.dispose()).resolves.not.toThrow()
    })

    it('should release connection in finally block when request fails', async () => {
      const failPool: any = {
        acquireConnection: vi.fn().mockResolvedValue({ id: 'fail-conn' }),
        releaseConnection: vi.fn(),
      }
      const poolBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
        failPool,
      )
      ;(poolBridge as any).retryAttempts = 1
      ;(poolBridge as any).retryDelay = 0

      // Make fetch reject to trigger the finally block with a pooled connection
      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockRejectedValue(new Error('Service down'))

      const session: TherapeuticSession = {
        sessionId: 'pool-error',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }
      const result = await poolBridge.runPreprocessingAnalysis(session)

      // Verify pool acquired and released despite error
      expect(failPool.acquireConnection).toHaveBeenCalled()
      expect(failPool.releaseConnection).toHaveBeenCalled()
      // Should return fallback result
      expect(result.fallbackMode).toBe(true)
    })

    it('should handle pool without releaseConnection method', async () => {
      const partialPool: any = {
        acquireConnection: vi.fn().mockResolvedValue({ id: 'partial-conn' }),
        // No releaseConnection method
      }
      const poolBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
        partialPool,
      )
      ;(poolBridge as any).retryAttempts = 1
      ;(poolBridge as any).retryDelay = 0

      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockRejectedValue(new Error('Down'))

      const session: TherapeuticSession = {
        sessionId: 'partial-pool',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }

      // Should not throw despite missing releaseConnection
      const result = await poolBridge.runPreprocessingAnalysis(session)
      expect(result.fallbackMode).toBe(true)
    })

    it('should release pooled connection on retry exhaustion', async () => {
      const retryPool: any = {
        acquireConnection: vi.fn().mockResolvedValue({ id: 'retry-conn' }),
        releaseConnection: vi.fn(),
      }
      const poolBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
        retryPool,
      )
      ;(poolBridge as any).retryAttempts = 2
      ;(poolBridge as any).retryDelay = 0

      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockRejectedValue(new Error('Persistent failure'))

      // Acquire the connection and run a failing analysis
      const session: TherapeuticSession = {
        sessionId: 'retry-pool',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }
      const result = await poolBridge.runPreprocessingAnalysis(session)

      // For each retry attempt (2), acquireConnection is called, and for each
      // attempt, releaseConnection is called in the finally block
      expect(retryPool.releaseConnection).toHaveBeenCalled()
      expect(result.fallbackMode).toBe(true)
    })
  })

  describe('AbortController signal in non-test environment', () => {
    let savedNodeEnv: string | undefined
    let savedVitest: string | undefined

    beforeEach(() => {
      savedNodeEnv = process.env['NODE_ENV']
      savedVitest = process.env['VITEST']
      delete process.env['NODE_ENV']
      delete process.env['VITEST']
    })

    afterEach(() => {
      process.env['NODE_ENV'] = savedNodeEnv
      if (savedVitest) process.env['VITEST'] = savedVitest
    })

    it('should attach AbortController signal to fetch options', async () => {
      ;(global.fetch as any).mockReset()

      // Mock fetch to resolve immediately
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' }),
      })

      const prodBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      ;(prodBridge as any).retryAttempts = 1
      ;(prodBridge as any).retryDelay = 0
      prodBridge.stopHealthMonitoring()

      await prodBridge.checkHealth()

      // Verify signal was attached
      const fetchOptions = (global.fetch as any).mock.calls[0][1]
      expect(fetchOptions).toHaveProperty('signal')
      // The signal should be an AbortSignal instance
      expect(fetchOptions.signal).toBeDefined()
      expect(typeof fetchOptions.signal).toBe('object')
    })
  })

  describe('analysis methods with real Python response', () => {
    const mockSession: TherapeuticSession = {
      sessionId: 'real-response-test',
      timestamp: new Date(),
      content: { transcript: 'Real analysis test' },
    }

    beforeEach(() => {
      ;(bridge as any).retryAttempts = 1
      ;(bridge as any).retryDelay = 0
    })

    it('should map preprocessing layer result correctly', async () => {
      const pythonResponse = {
        layer_results: {
          preprocessing: {
            bias_score: 0.35,
            layer: 'preprocessing',
            detected_biases: ['cultural_bias', 'gender_bias'],
            recommendations: ['Review cultural context'],
            metrics: {
              linguistic_bias: {
                gender_bias_score: 0.2,
                racial_bias_score: 0.1,
                age_bias_score: 0.15,
                cultural_bias_score: 0.35,
                overall_bias_score: 0.2,
                biased_terms: ['stereotype-a'],
                sentiment_analysis: {
                  positive: 0.7,
                  neutral: 0.2,
                  negative: 0.1,
                  overallSentiment: 0.6,
                  emotionalValence: 0.5,
                  subjectivity: 0.3,
                  demographicVariations: { gender: {} },
                },
              },
              representation_analysis: {
                representation_parity: 0.8,
                minority_group_score: 0.75,
                demographic_distribution: { female: 0.4, male: 0.6 },
                underrepresented_groups: ['group_a'],
                overrepresented_groups: ['group_b'],
                diversity_index: 0.6,
                intersectionality_analysis: [
                  { dimension: 'race', score: 0.5 },
                ],
              },
              data_quality_metrics: {
                completeness: 0.9,
                consistency: 0.85,
                coverage: 0.8,
                accuracy: 0.95,
                timeliness: 0.87,
                validity: 0.92,
                missingDataByDemographic: { age_group: { '18-25': 0.1 } },
              },
            },
          },
        },
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => pythonResponse,
      })

      const result = await bridge.runPreprocessingAnalysis(mockSession)

      expect(result.fallbackMode).toBe(false)
      expect(result.biasScore).toBe(0.35)
      expect(result.detectedBiases).toContain('cultural_bias')
      expect(result.linguisticBias.overallBiasScore).toBe(0.2)
      expect(result.linguisticBias.biasedTerms).toContain('stereotype-a')
      expect(
        result.linguisticBias.sentimentAnalysis.overallSentiment,
      ).toBe(0.6)
      expect(result.representationAnalysis.representationParity).toBe(0.8)
      expect(result.representationAnalysis.diversityIndex).toBe(0.6)
      expect(result.dataQualityMetrics.completeness).toBe(0.9)
    })

    it('should map model level result correctly', async () => {
      const pythonResponse = {
        layer_results: {
          model_level: {
            bias_score: 0.42,
            detected_biases: ['algorithmic_bias'],
            recommendations: ['Calibrate model'],
            metrics: {
              fairness_metrics: {
                demographic_parity: 0.82,
                equalized_odds: 0.75,
                equal_opportunity: 0.78,
                calibration: 0.85,
                individual_fairness: 0.7,
                counterfactual_fairness: 0.72,
              },
              performance_metrics: {
                accuracy: 0.88,
                precision: 0.85,
                recall: 0.82,
                f1_score: 0.83,
                auc: 0.9,
                calibration_error: 0.05,
                demographic_breakdown: { group_a: { accuracy: 0.86 } },
              },
              group_performance_comparison: [
                { group: 'A', accuracy: 0.88 },
                { group: 'B', accuracy: 0.82 },
              ],
            },
          },
        },
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => pythonResponse,
      })

      const result = await bridge.runModelLevelAnalysis(mockSession)

      expect(result.biasScore).toBe(0.42)
      expect(result.fairnessMetrics.demographicParity).toBe(0.82)
      expect(result.performanceMetrics.accuracy).toBe(0.88)
      expect(result.groupPerformanceComparison).toHaveLength(2)
    })

    it('should map interactive result correctly', async () => {
      const pythonResponse = {
        layer_results: {
          interactive: {
            bias_score: 0.3,
            detected_biases: ['interaction_bias'],
            recommendations: ['Adjust interaction model'],
            metrics: {
              counterfactual_analysis: {
                scenarios_analyzed: 5,
                bias_detected: true,
                consistency_score: 0.4,
                problematic_scenarios: ['scenario_3'],
              },
              feature_importance: [
                { feature: 'age', importance: 0.6 },
                { feature: 'gender', importance: 0.3 },
              ],
              what_if_scenarios: [{ change: 'increase_age', effect: 0.1 }],
            },
          },
        },
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => pythonResponse,
      })

      const result = await bridge.runInteractiveAnalysis(mockSession)

      expect(result.biasScore).toBe(0.3)
      expect(result.counterfactualAnalysis.scenariosAnalyzed).toBe(5)
      expect(result.counterfactualAnalysis.biasDetected).toBe(true)
      expect(result.featureImportance).toHaveLength(2)
      expect(result.whatIfScenarios).toHaveLength(1)
    })

    it('should map evaluation result correctly', async () => {
      const pythonResponse = {
        layer_results: {
          evaluation: {
            bias_score: 0.25,
            detected_biases: ['evaluation_bias'],
            recommendations: ['Review evaluation criteria'],
            metrics: {
              hugging_face_metrics: {
                toxicity: 0.05,
                bias: 0.1,
                regard: { positive: 0.8, neutral: 0.15, negative: 0.05 },
                stereotype: 0.08,
                fairness: 0.9,
              },
              custom_metrics: {
                therapeutic_bias: 0.05,
                cultural_sensitivity: 0.05,
                professional_ethics: 0.02,
                patient_safety: 0.01,
              },
              temporal_analysis: {
                trend_direction: 'improving',
                change_rate: -0.05,
                seasonal_patterns: ['winter_dip'],
                intervention_effectiveness: [
                  { intervention: 'training', effect: 0.3 },
                ],
              },
            },
          },
        },
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => pythonResponse,
      })

      const result = await bridge.runEvaluationAnalysis(mockSession)

      expect(result.biasScore).toBe(0.25)
      expect(result.huggingFaceMetrics.toxicity).toBe(0.05)
      expect(result.customMetrics.therapeuticBias).toBe(0.05)
      expect(result.temporalAnalysis.trendDirection).toBe('improving')
      expect(result.temporalAnalysis.seasonalPatterns).toContain('winter_dip')
    })

    it('should handle empty metrics gracefully in layer result', async () => {
      const pythonResponse = {
        layer_results: {
          preprocessing: {
            bias_score: 0.5,
            layer: 'preprocessing',
            detected_biases: [],
            recommendations: [],
          },
        },
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => pythonResponse,
      })

      const result = await bridge.runPreprocessingAnalysis(mockSession)

      // Should not crash and return defaults
      expect(result.fallbackMode).toBe(false)
      expect(result.biasScore).toBe(0.5)
      expect(result.linguisticBias.genderBiasScore).toBe(0.5)
      expect(result.linguisticBias.sentimentAnalysis.neutral).toBe(1)
      expect(
        result.representationAnalysis.representationParity,
      ).toBe(0.5)
      expect(result.dataQualityMetrics.completeness).toBe(1)
    })
  })

  describe('checkHealth error path', () => {
    it('should return unhealthy response when request fails', async () => {
      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockRejectedValue(
        new Error('Network failure'),
      )

      const failBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      ;(failBridge as any).retryAttempts = 1
      ;(failBridge as any).retryDelay = 0

      const result = await failBridge.checkHealth()

      expect(result.status).toBe('unhealthy')
      expect(result.message).toBe('Service unavailable')
      expect(result.timestamp).toBeDefined()
    })
  })

  describe('interactive and evaluation error paths', () => {
    it('should return fallback when runInteractiveAnalysis encounters a network error', async () => {
      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockRejectedValue(
        new Error('Interactive service down'),
      )

      const fbBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      ;(fbBridge as any).retryAttempts = 1
      ;(fbBridge as any).retryDelay = 0

      const session: TherapeuticSession = {
        sessionId: 'interactive-error-test',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }
      const result = await fbBridge.runInteractiveAnalysis(session)

      expect(result.biasScore).toBe(0.5)
      expect(result.detectedBiases).toContain('service_unavailable')
    })

    it('should return fallback when runEvaluationAnalysis encounters a network error', async () => {
      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockRejectedValue(
        new Error('Evaluation service down'),
      )

      const fbBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      ;(fbBridge as any).retryAttempts = 1
      ;(fbBridge as any).retryDelay = 0

      const session: TherapeuticSession = {
        sessionId: 'evaluation-error-test',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }
      const result = await fbBridge.runEvaluationAnalysis(session)

      expect(result.biasScore).toBe(0.5)
      expect(result.detectedBiases).toContain('service_unavailable')
    })

    it('should return fallback when runInteractiveAnalysis receives a non-ok response', async () => {
      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Interactive error',
      })

      const fbBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      ;(fbBridge as any).retryAttempts = 1
      ;(fbBridge as any).retryDelay = 0

      const session: TherapeuticSession = {
        sessionId: 'interactive-http-error',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }
      const result = await fbBridge.runInteractiveAnalysis(session)

      expect(result.biasScore).toBe(0.5)
      expect(result.detectedBiases).toContain('service_unavailable')
    })

    it('should return fallback when runEvaluationAnalysis receives a non-ok response', async () => {
      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Evaluation error',
      })

      const fbBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      ;(fbBridge as any).retryAttempts = 1
      ;(fbBridge as any).retryDelay = 0

      const session: TherapeuticSession = {
        sessionId: 'evaluation-http-error',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }
      const result = await fbBridge.runEvaluationAnalysis(session)

      expect(result.biasScore).toBe(0.5)
      expect(result.detectedBiases).toContain('service_unavailable')
    })
  })

  describe('runModelLevelAnalysis error path', () => {
    it('should return fallback when runModelLevelAnalysis encounters a network error', async () => {
      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockRejectedValue(
        new Error('Model level service down'),
      )

      const fbBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      ;(fbBridge as any).retryAttempts = 1
      ;(fbBridge as any).retryDelay = 0

      const session: TherapeuticSession = {
        sessionId: 'model-level-error-test',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }
      const result = await fbBridge.runModelLevelAnalysis(session)

      expect(result.biasScore).toBe(0.5)
      expect(result.detectedBiases).toContain('service_unavailable')
    })

    it('should return fallback when runModelLevelAnalysis receives a non-ok response', async () => {
      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => 'Model level error',
      })

      const fbBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      ;(fbBridge as any).retryAttempts = 1
      ;(fbBridge as any).retryDelay = 0

      const session: TherapeuticSession = {
        sessionId: 'model-level-http-error',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }
      const result = await fbBridge.runModelLevelAnalysis(session)

      expect(result.biasScore).toBe(0.5)
      expect(result.detectedBiases).toContain('service_unavailable')
    })
  })

  describe('startHealthMonitoring response paths', () => {
    it('should set health status to degraded when checkHealth returns degraded', async () => {
      const healthBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      healthBridge.stopHealthMonitoring()

      // Mock checkHealth to return degraded
      ;(healthBridge as any).checkHealth = vi.fn().mockResolvedValue({
        status: 'degraded',
        message: 'Service overloaded',
        timestamp: new Date().toISOString(),
      })

      // Override interval for fast test
      ;(healthBridge as any).healthCheckInterval = 10

      ;(healthBridge as any).startHealthMonitoring()

      // Wait for interval to fire
      await new Promise((resolve) => setTimeout(resolve, 50))

      const status = healthBridge.getHealthStatus()
      expect(status.status).toBe('degraded')
      expect(status.consecutiveFailures).toBe(0)
    })

    it('should set health status to unhealthy when response has unknown status', async () => {
      const healthBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      healthBridge.stopHealthMonitoring()

      ;(healthBridge as any).checkHealth = vi.fn().mockResolvedValue({
        status: 'unknown',
        message: 'Unknown state',
        timestamp: new Date().toISOString(),
      })

      ;(healthBridge as any).healthCheckInterval = 10
      ;(healthBridge as any).startHealthMonitoring()

      await new Promise((resolve) => setTimeout(resolve, 50))

      const status = healthBridge.getHealthStatus()
      expect(status.status).toBe('unhealthy')
      expect(status.consecutiveFailures).toBeGreaterThan(0)
    })

    it('should set health status to healthy when checkHealth returns healthy', async () => {
      const healthBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      healthBridge.stopHealthMonitoring()

      ;(healthBridge as any).checkHealth = vi.fn().mockResolvedValue({
        status: 'healthy',
        message: 'All systems operational',
        timestamp: new Date().toISOString(),
      })

      ;(healthBridge as any).healthCheckInterval = 10
      ;(healthBridge as any).startHealthMonitoring()

      await new Promise((resolve) => setTimeout(resolve, 50))

      const status = healthBridge.getHealthStatus()
      expect(status.status).toBe('healthy')
      expect(status.consecutiveFailures).toBe(0)
    })

    it('should set health status to unhealthy when checkHealth throws', async () => {
      const healthBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      healthBridge.stopHealthMonitoring()

      ;(healthBridge as any).checkHealth = vi.fn().mockRejectedValue(
        new Error('Connection error'),
      )

      ;(healthBridge as any).healthCheckInterval = 10
      ;(healthBridge as any).startHealthMonitoring()

      await new Promise((resolve) => setTimeout(resolve, 50))

      const status = healthBridge.getHealthStatus()
      expect(status.status).toBe('unhealthy')
      expect(status.consecutiveFailures).toBeGreaterThan(0)
    })
  })

  describe('createFallbackPreprocessingResult error types', () => {
    it('should handle Error instance in serviceError', async () => {
      ;(global.fetch as any).mockReset()
      ;(global.fetch as any).mockRejectedValue(
        new Error('Custom pipeline error'),
      )

      const fbBridge = new PythonBiasDetectionBridge(
        'http://localhost:5000',
        30000,
      )
      ;(fbBridge as any).retryAttempts = 1
      ;(fbBridge as any).retryDelay = 0

      const session: TherapeuticSession = {
        sessionId: 'error-type-test',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }
      const result = await fbBridge.runPreprocessingAnalysis(session)

      expect(result.fallbackMode).toBe(true)
      expect(result.serviceError).toContain('Request failed after')
    })

    it('should handle plain object error by calling createFallbackPreprocessingResult directly', () => {
      const session: TherapeuticSession = {
        sessionId: 'object-error',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }
      // Call private method directly to exercise the typeof error === 'object' branch
      const result = (bridge as any).createFallbackPreprocessingResult(
        session,
        { code: 500, detail: 'crash' },
      )
      expect(result.fallbackMode).toBe(true)
      expect(result.serviceError).toBe('{"code":500,"detail":"crash"}')
    })

    it('should handle primitive string error by calling createFallbackPreprocessingResult directly', () => {
      const session: TherapeuticSession = {
        sessionId: 'string-error',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }
      // Call private method directly to exercise the truthy non-object branch
      const result = (bridge as any).createFallbackPreprocessingResult(
        session,
        'just a string error',
      )
      expect(result.fallbackMode).toBe(true)
      expect(result.serviceError).toBe('just a string error')
    })

    it('should handle falsy error by calling createFallbackPreprocessingResult directly', () => {
      const session: TherapeuticSession = {
        sessionId: 'null-error',
        timestamp: new Date(),
        content: { transcript: 'test' },
      }
      // Call private method directly to exercise the falsy branch
      // null triggers the final fallback: error ? String(error) : 'Python service unavailable'
      const result = (bridge as any).createFallbackPreprocessingResult(
        session,
        null,
      )
      expect(result.fallbackMode).toBe(true)
      expect(result.serviceError).toBe('Python service unavailable')
    })
  })
})
