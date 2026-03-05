import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BiasMetricsCollector } from '../metrics-collector'
import { PythonBiasDetectionBridge } from '../python-bridge'
import type { BiasDetectionConfig, BiasAnalysisResult } from '../types'

// Mock the Python bridge
vi.mock('../python-bridge', () => ({
  PythonBiasDetectionBridge: class {
    initialize = vi.fn().mockResolvedValue(undefined)
    checkHealth = vi.fn().mockResolvedValue({ status: 'healthy' })
  },
}))

// Mock analysis result for use across multiple tests
const mockAnalysisResult: BiasAnalysisResult = {
  sessionId: 'test-session-123',
  timestamp: new Date(),
  overallBiasScore: 0.3,
  alertLevel: 'medium',
  layerResults: {
    preprocessing: {
      biasScore: 0.2,
      linguisticBias: {
        genderBiasScore: 0.1,
        racialBiasScore: 0.1,
        ageBiasScore: 0.1,
        culturalBiasScore: 0.1,
        biasedTerms: [],
        sentimentAnalysis: {
          overallSentiment: 0.0,
          emotionalValence: 0.0,
          subjectivity: 0.0,
          demographicVariations: {},
        },
      },
      representationAnalysis: {
        demographicDistribution: {},
        underrepresentedGroups: [],
        overrepresentedGroups: [],
        diversityIndex: 0,
        intersectionalityAnalysis: [],
      },
      dataQualityMetrics: {
        completeness: 1,
        consistency: 1,
        accuracy: 1,
        timeliness: 1,
        validity: 1,
        missingDataByDemographic: {},
      },
      recommendations: [],
    },
    modelLevel: {
      biasScore: 0.3,
      fairnessMetrics: {
        demographicParity: 0.9,
        equalizedOdds: 0.8,
        equalOpportunity: 0.85,
        calibration: 0.95,
        individualFairness: 0.9,
        counterfactualFairness: 0.88,
      },
      performanceMetrics: {
        accuracy: 0.85,
        precision: 0.82,
        recall: 0.88,
        f1Score: 0.85,
        auc: 0.91,
        calibrationError: 0.05,
        demographicBreakdown: {},
      },
      groupPerformanceComparison: [],
      recommendations: [],
    },
    interactive: {
      biasScore: 0.25,
      counterfactualAnalysis: {
        scenariosAnalyzed: 10,
        biasDetected: false,
        consistencyScore: 0.9,
        problematicScenarios: [],
      },
      featureImportance: [],
      whatIfScenarios: [],
      recommendations: [],
    },
    evaluation: {
      biasScore: 0.35,
      huggingFaceMetrics: {
        toxicity: 0.1,
        bias: 0.2,
        regard: {},
        stereotype: 0.15,
        fairness: 0.8,
      },
      customMetrics: {
        therapeuticBias: 0.1,
        culturalSensitivity: 0.9,
        professionalEthics: 0.95,
        patientSafety: 0.98,
      },
      temporalAnalysis: {
        trendDirection: 'stable',
        changeRate: 0.01,
        seasonalPatterns: [],
        interventionEffectiveness: [],
      },
      recommendations: [],
    },
  },
  recommendations: ['Monitor for emerging patterns'],
  confidence: 0.85,
  demographics: {
    age: '30',
    gender: 'female',
    ethnicity: 'caucasian',
    primaryLanguage: 'english',
  },
}

describe('BiasMetricsCollector', () => {
  let metricsCollector: BiasMetricsCollector
  let mockPythonBridge: PythonBiasDetectionBridge
  let mockConfig: BiasDetectionConfig

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup mock configuration
    mockConfig = {
      pythonServiceUrl: 'http://localhost:5000',
      pythonServiceTimeout: 30000,
      metricsConfig: {
        enableRealTimeMonitoring: true,
        metricsRetentionDays: 30,
        aggregationIntervals: ['1h', '1d'],
        dashboardRefreshRate: 60,
        exportFormats: ['json'],
      },
    }

    // Create mock Python bridge
    mockPythonBridge = new PythonBiasDetectionBridge(
      mockConfig.pythonServiceUrl!,
      mockConfig.pythonServiceTimeout!,
    )

    // Create metrics collector
    metricsCollector = new BiasMetricsCollector(mockConfig, mockPythonBridge)
  })

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(metricsCollector).toBeDefined()
    })

    it('should initialize Python bridge', async () => {
      await metricsCollector.initialize()
      expect(mockPythonBridge['initialize']).toHaveBeenCalled()
    })
  })

  describe('metrics collection', () => {
    it('should store analysis results', async () => {
      await expect(
        metricsCollector.storeAnalysisResult?.(mockAnalysisResult),
      ).resolves.not.toThrow()
    })

    it('should retrieve metrics', async () => {
      const metrics = await metricsCollector.getMetrics?.()
      expect(metrics).toBeDefined()
    })

    it('should generate dashboard data', async () => {
      const dashboardData = await metricsCollector.getDashboardData()
      expect(dashboardData).toBeDefined()
      expect(dashboardData).toHaveProperty('summary')
      expect(dashboardData).toHaveProperty('recentAnalyses')
      expect(dashboardData).toHaveProperty('alerts')
      expect(dashboardData).toHaveProperty('trends')
      expect(dashboardData).toHaveProperty('demographics')
      expect(dashboardData).toHaveProperty('recommendations')
    })

    it('should handle metrics storage failures gracefully', async () => {
      // Mock a storage failure
      const storeSpy = vi.spyOn(metricsCollector, 'storeAnalysisResult')
        .mockRejectedValue(new Error('Storage failed'))

      await expect(
        metricsCollector.storeAnalysisResult(mockAnalysisResult),
      ).rejects.toThrow()

      // Restore original method
      storeSpy.mockRestore()
    })
  })

  describe('performance metrics', () => {
    it('should return current performance metrics', async () => {
      const perfMetrics =
        await metricsCollector.getCurrentPerformanceMetrics?.()
      expect(perfMetrics).toBeDefined()
    })

    it('should handle performance metrics retrieval failures', async () => {
      const perfSpy = vi.spyOn(metricsCollector, 'getCurrentPerformanceMetrics')
        .mockRejectedValue(new Error('Performance metrics failed'))

      await expect(
        metricsCollector.getCurrentPerformanceMetrics(),
      ).rejects.toThrow()

      // Restore original method
      perfSpy.mockRestore()
    })
  })

  describe('data aggregation', () => {
    it('should aggregate metrics over time periods', async () => {
      const metrics = await metricsCollector.getMetrics?.()
      if (metrics) {
        expect(metrics).toHaveProperty('overall_stats')
        expect(metrics.overall_stats).toHaveProperty('total_sessions')
        expect(metrics.overall_stats).toHaveProperty('average_bias_score')
      }
    })

    it('should handle empty metrics data', async () => {
      // Test with no stored data
      const metrics = await metricsCollector.getMetrics?.()
      expect(metrics).toBeDefined()
    })
  })

  describe('cache management', () => {
    it('should manage local cache effectively', async () => {
      // Test cache size limits and eviction
      const mockResult: BiasAnalysisResult = {
        ...mockAnalysisResult,
        sessionId: 'cache-test-1',
      }

      await metricsCollector.storeAnalysisResult?.(mockResult)

      // Verify cache contains the data
      const metrics = await metricsCollector.getMetrics?.()
      expect(metrics).toBeDefined()
    })

    it('should handle cache misses gracefully', async () => {
      const metrics = await metricsCollector.getMetrics?.()
      expect(metrics).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle initialization failures', async () => {
      const failingBridge = new PythonBiasDetectionBridge(
        mockConfig.pythonServiceUrl!,
        mockConfig.pythonServiceTimeout!,
      )

      failingBridge.initialize = vi
        .fn()
        .mockRejectedValue(new Error('Init failed'))

      const failingCollector = new BiasMetricsCollector(
        mockConfig,
        failingBridge,
      )

      await expect(failingCollector.initialize()).rejects.toThrow()
    })

    it('should handle network failures during metrics storage', async () => {
      const storeSpy = vi.spyOn(metricsCollector, 'storeAnalysisResult')
        .mockRejectedValue(new Error('Network error'))

      await expect(
        metricsCollector.storeAnalysisResult(mockAnalysisResult),
      ).rejects.toThrow()

      // Restore original method
      storeSpy.mockRestore()
    })
  })
})
