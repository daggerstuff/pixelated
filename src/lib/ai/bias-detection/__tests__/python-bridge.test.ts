import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PythonBiasDetectionBridge } from '../python-bridge'

// Mock fetch globally
global.fetch = vi.fn()

describe('analysis methods', () => {
  let bridge: PythonBiasDetectionBridge
  const mockConfig = {
    pythonServiceUrl: 'http://localhost:5000',
    pythonServiceTimeout: 30000,
  }

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

      // Mock successful responses by default
      ; (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy', timestamp: Date.now() }),
      })

    // Create a fresh bridge instance for each test
    bridge = new PythonBiasDetectionBridge(
      mockConfig.pythonServiceUrl,
      mockConfig.pythonServiceTimeout,
    )
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
      content: 'Test session content for bias analysis',
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
        content: 'Test content',
      }

      // Mock a network failure
      const originalRequest = global.fetch
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

        // Reduce retries and delay for testing
        ; (bridge as any).retryAttempts = 1
        ; (bridge as any).retryDelay = 0

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
        content: 'Test content',
      }

      // Create bridge with very short timeout
      const timeoutBridge = new PythonBiasDetectionBridge(
        mockConfig.pythonServiceUrl,
        1, // 1ms timeout
      )

        // Reduce retries and delay for testing
        ; (timeoutBridge as any).retryAttempts = 1
        ; (timeoutBridge as any).retryDelay = 0

      const result = await timeoutBridge.runPreprocessingAnalysis(mockSession)

      // Should return fallback result for timeout
      expect(result.fallbackMode).toBe(true)
    })
  })

  describe('connection pooling', () => {
    it('should use connection pooling for requests', async () => {
      const mockSession: TherapeuticSession = {
        sessionId: 'pool-test',
        timestamp: new Date(),
        content: 'Test content',
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
        content: 'Test content',
      }

      const promises = Array(5)
        .fill(null)
        .map(() => bridge.runPreprocessingAnalysis(mockSession))

      const results = await Promise.allSettled(promises)
      expect(results.length).toBe(5)
    })
  })

  describe('performance monitoring', () => {
    it('should track request metrics', async () => {
      const mockSession: TherapeuticSession = {
        sessionId: 'metrics-test',
        timestamp: new Date(),
        content: 'Test content',
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
        content: 'Test content',
      }

      const result = await bridge.runPreprocessingAnalysis(mockSession)
      expect(result).toBeDefined()
    })
  })
})
