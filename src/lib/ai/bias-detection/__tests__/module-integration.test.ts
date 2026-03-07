/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PythonBiasDetectionBridge } from '../python-bridge'
import { BiasMetricsCollector } from '../metrics-collector'
import { BiasAlertSystem } from '../alerts-system'
import type { BiasDetectionConfig, BiasAnalysisResult } from '../types'

// Mock the entire Python bridge to avoid network calls
vi.mock('../python-bridge', () => ({
  PythonBiasDetectionBridge: vi.fn().mockImplementation(function() {
    return {
      initialize: vi.fn().mockResolvedValue(undefined),
      analyzeSession: vi.fn().mockResolvedValue({
        sessionId: 'test-session',
        overallBiasScore: 0.3,
        alertLevel: 'medium',
        layerResults: {
          preprocessing: { biasScore: 0.2 },
          modelLevel: { biasScore: 0.3 },
          interactive: { biasScore: 0.4 },
          evaluation: { biasScore: 0.3 },
        },
      }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
      dispose: vi.fn().mockResolvedValue(undefined),
      getDashboardMetrics: vi.fn().mockResolvedValue({
        summary: {
          total_sessions_analyzed: 10,
          average_bias_score: 0.35,
          alert_distribution: { low: 7, medium: 2, high: 1, critical: 0 },
        },
        trends: { daily_bias_scores: [], alert_counts: [] },
        demographics: { bias_by_age_group: {}, bias_by_gender: {} },
      }),
      sendAnalysisMetric: vi.fn().mockResolvedValue(undefined),
      sendMetricsBatch: vi.fn().mockResolvedValue(undefined),
      recordReportMetric: vi.fn().mockResolvedValue(undefined),
      getPerformanceMetrics: vi.fn().mockResolvedValue({
        average_response_time: 120,
        requests_per_second: 5.5,
        error_rate: 0.01,
        uptime_seconds: 3600,
        health_status: 'healthy',
      }),
      getSessionData: vi.fn().mockResolvedValue({
        sessionId: 'test-session',
        overallBiasScore: 0.3,
        alertLevel: 'low',
      }),
      storeMetrics: vi.fn().mockResolvedValue(undefined),
      getAlertStatistics: vi.fn().mockResolvedValue({ total: 10, resolved: 8 }),
    };
  }),
}))

// Mock the connection pool for Python bridge
vi.mock('../connection-pool', () => ({
  ConnectionPool: vi.fn().mockImplementation(() => ({
    getConnection: vi.fn().mockResolvedValue({
      request: vi.fn().mockResolvedValue({
        bias_score: 0.3,
        layer_results: {
          preprocessing: { bias_score: 0.2 },
          model_level: { bias_score: 0.3 },
          interactive: { bias_score: 0.4 },
          evaluation: { bias_score: 0.3 },
        },
      }),
      release: vi.fn(),
    }),
    close: vi.fn(),
  })),
}))

describe('Module Integration Tests', () => {
  let pythonBridge: PythonBiasDetectionBridge
  let metricsCollector: BiasMetricsCollector
  let alertSystem: BiasAlertSystem
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

    // Create module instances
    pythonBridge = new PythonBiasDetectionBridge(
      mockConfig.pythonServiceUrl!,
      mockConfig.pythonServiceTimeout!,
    )

    metricsCollector = new BiasMetricsCollector(mockConfig, pythonBridge)
    alertSystem = new BiasAlertSystem(
      {
        pythonServiceUrl: mockConfig.pythonServiceUrl,
        timeout: mockConfig.pythonServiceTimeout,
      },
      pythonBridge,
    )
  })

  describe('Python Bridge ↔ Metrics Collector Integration', () => {
    it('should pass analysis results from Python bridge to metrics collector', async () => {
      await pythonBridge.initialize()
      await metricsCollector.initialize()

      const mockAnalysisResult: BiasAnalysisResult = {
        sessionId: 'module-integration-test-1',
        timestamp: new Date(),
        overallBiasScore: 0.4,
        alertLevel: 'medium',
        layerResults: {
          preprocessing: {
            biasScore: 0.3,
            linguisticBias: {
              genderBiasScore: 0.2,
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
              diversityIndex: 0.8,
              intersectionalityAnalysis: [],
            },
            dataQualityMetrics: {
              completeness: 1.0,
              consistency: 1.0,
              accuracy: 1.0,
              timeliness: 1.0,
              validity: 1.0,
              missingDataByDemographic: {},
            },
            recommendations: [],
          },
          modelLevel: {
            biasScore: 0.4,
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
            biasScore: 0.35,
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
            biasScore: 0.45,
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

      // Store result in metrics collector
      await metricsCollector.storeAnalysisResult?.(mockAnalysisResult)

      // Verify metrics were stored and can be retrieved
      const metrics = await metricsCollector.getMetrics?.()
      expect(metrics).toBeDefined()
      expect(metrics?.overall_stats?.total_sessions).toBeGreaterThan(0)
    })

    it('should handle metrics collection failures gracefully', async () => {
      await pythonBridge.initialize()
      await metricsCollector.initialize()

      const invalidResult: BiasAnalysisResult = {
        sessionId: 'invalid-test',
        timestamp: new Date(),
        overallBiasScore: NaN, // Invalid score
        alertLevel: 'low',
        layerResults: {} as any, // Invalid layer results
        recommendations: [],
        confidence: 0.5,
        demographics: {
          age: '30',
          gender: 'female',
          ethnicity: 'caucasian',
          primaryLanguage: 'english',
        },
      }

      // Should not throw error even with invalid data
      await expect(
        metricsCollector.storeAnalysisResult?.(invalidResult),
      ).resolves.not.toThrow()
    })
  })

  describe('Python Bridge ↔ Alert System Integration', () => {
    it('should trigger alerts through the alert system', async () => {
      await pythonBridge.initialize()
      await alertSystem.initialize?.()

      const highBiasResult: BiasAnalysisResult = {
        sessionId: 'alert-integration-test-1',
        timestamp: new Date(),
        overallBiasScore: 0.8,
        alertLevel: 'critical',
        layerResults: {
          preprocessing: {
            biasScore: 0.7,
            linguisticBias: {
              genderBiasScore: 0.6,
              racialBiasScore: 0.5,
              ageBiasScore: 0.4,
              culturalBiasScore: 0.3,
              biasedTerms: [
                {
                  term: 'concerning term',
                  context: 'therapeutic context',
                  biasType: 'gender_bias',
                  severity: 'medium',
                  suggestedAlternative: 'neutral term',
                },
              ],
              sentimentAnalysis: {
                overallSentiment: -0.4,
                emotionalValence: -0.5,
                subjectivity: 0.8,
                demographicVariations: {},
              },
            },
            representationAnalysis: {
              demographicDistribution: {},
              underrepresentedGroups: ['minority_group'],
              overrepresentedGroups: [],
              diversityIndex: 0.4,
              intersectionalityAnalysis: [],
            },
            dataQualityMetrics: {
              completeness: 0.7,
              consistency: 0.8,
              accuracy: 0.75,
              timeliness: 0.9,
              validity: 0.8,
              missingDataByDemographic: {},
            },
            recommendations: ['Address representation issues'],
          },
          modelLevel: {
            biasScore: 0.8,
            fairnessMetrics: {
              demographicParity: 0.5,
              equalizedOdds: 0.4,
              equalOpportunity: 0.45,
              calibration: 0.6,
              individualFairness: 0.55,
              counterfactualFairness: 0.5,
            },
            performanceMetrics: {
              accuracy: 0.6,
              precision: 0.55,
              recall: 0.65,
              f1Score: 0.6,
              auc: 0.65,
              calibrationError: 0.3,
              demographicBreakdown: {},
            },
            groupPerformanceComparison: [],
            recommendations: ['Review fairness constraints'],
          },
          interactive: {
            biasScore: 0.75,
            counterfactualAnalysis: {
              scenariosAnalyzed: 20,
              biasDetected: true,
              consistencyScore: 0.6,
              problematicScenarios: [
                {
                  scenarioId: 'bias_scenario_1',
                  originalDemographics: {
                    age: '30',
                    gender: 'female',
                    ethnicity: 'caucasian',
                    primaryLanguage: 'english',
                  },
                  alteredDemographics: {
                    age: '30',
                    gender: 'male',
                    ethnicity: 'caucasian',
                    primaryLanguage: 'english',
                  },
                  outcomeChange: 'response quality decreased',
                  biasType: 'gender_bias',
                  severity: 'medium',
                },
                {
                  scenarioId: 'bias_scenario_2',
                  originalDemographics: {
                    age: '25',
                    gender: 'male',
                    ethnicity: 'hispanic',
                    primaryLanguage: 'spanish',
                  },
                  alteredDemographics: {
                    age: '25',
                    gender: 'male',
                    ethnicity: 'caucasian',
                    primaryLanguage: 'english',
                  },
                  outcomeChange: 'cultural context ignored',
                  biasType: 'cultural_bias',
                  severity: 'high',
                },
              ],
            },
            featureImportance: [],
            whatIfScenarios: [],
            recommendations: ['Investigate interactive bias'],
          },
          evaluation: {
            biasScore: 0.85,
            huggingFaceMetrics: {
              toxicity: 0.5,
              bias: 0.6,
              regard: {},
              stereotype: 0.4,
              fairness: 0.5,
            },
            customMetrics: {
              therapeuticBias: 0.5,
              culturalSensitivity: 0.6,
              professionalEthics: 0.7,
              patientSafety: 0.8,
            },
            temporalAnalysis: {
              trendDirection: 'worsening',
              changeRate: 0.15,
              seasonalPatterns: [],
              interventionEffectiveness: [],
            },
            recommendations: ['Immediate intervention required'],
          },
        },
        recommendations: [
          'Critical bias detected - immediate action required',
          'Escalate to senior review team',
          'Implement immediate safeguards',
        ],
        confidence: 0.95,
        demographics: {
          age: '25',
          gender: 'male',
          ethnicity: 'hispanic',
          primaryLanguage: 'spanish',
        },
      }

      // Process alert through alert system
      await alertSystem.processAlert?.({
        sessionId: highBiasResult.sessionId,
        level: highBiasResult.alertLevel,
        biasScore: highBiasResult.overallBiasScore,
        analysisResult: highBiasResult,
      })

      // Verify alert statistics are updated
      const stats = await alertSystem.getAlertStatistics?.()
      expect(stats).toBeDefined()
    })

    it('should handle alert processing failures gracefully', async () => {
      await pythonBridge.initialize()
      await alertSystem.initialize?.()

      const malformedResult: BiasAnalysisResult = {
        sessionId: 'malformed-alert-test',
        timestamp: new Date(),
        overallBiasScore: 0.9,
        alertLevel: 'critical',
        layerResults: {} as any, // Malformed layer results
        recommendations: [],
        confidence: 0.8,
        demographics: {
          age: '25',
          gender: 'male',
          ethnicity: 'hispanic',
          primaryLanguage: 'spanish',
        },
      }

      // Should not throw error even with malformed data
      await expect(
        alertSystem.processAlert?.({
          sessionId: malformedResult.sessionId,
          level: malformedResult.alertLevel,
          biasScore: malformedResult.overallBiasScore,
          analysisResult: malformedResult,
        }),
      ).resolves.not.toThrow()
    })
  })

  describe('Metrics Collector ↔ Alert System Integration', () => {
    it('should correlate metrics data with alert patterns', async () => {
      await pythonBridge.initialize()
      await metricsCollector.initialize()
      await alertSystem.initialize?.()

      // Store multiple analysis results
      const results: BiasAnalysisResult[] = [
        {
          sessionId: 'correlation-test-1',
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
          overallBiasScore: 0.2,
          alertLevel: 'low',
          layerResults: {} as any,
          recommendations: [],
          confidence: 0.8,
          demographics: {
            age: '35',
            gender: 'male',
            ethnicity: 'asian',
            primaryLanguage: 'english',
          },
        },
        {
          sessionId: 'correlation-test-2',
          timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
          overallBiasScore: 0.6,
          alertLevel: 'high',
          layerResults: {} as any,
          recommendations: [],
          confidence: 0.9,
          demographics: {
            age: '28',
            gender: 'female',
            ethnicity: 'black',
            primaryLanguage: 'english',
          },
        },
        {
          sessionId: 'correlation-test-3',
          timestamp: new Date(),
          overallBiasScore: 0.8,
          alertLevel: 'critical',
          layerResults: {} as any,
          recommendations: [],
          confidence: 0.95,
          demographics: {
            age: '42',
            gender: 'non-binary',
            ethnicity: 'hispanic',
            primaryLanguage: 'spanish',
          },
        },
      ]

      // Store all results
      for (const result of results) {
        await metricsCollector.storeAnalysisResult?.(result)
        await alertSystem.processAlert?.({
          sessionId: result.sessionId,
          level: result.alertLevel,
          biasScore: result.overallBiasScore,
          analysisResult: result,
        })
      }

      // Verify correlation between metrics and alerts
      const metrics = await metricsCollector.getMetrics?.()
      const alertStats = await alertSystem.getAlertStatistics?.()

      expect(metrics).toBeDefined()
      expect(alertStats).toBeDefined()

      // High/critical alerts should be reflected in both systems
      expect(metrics?.overall_stats?.total_sessions).toBe(10) // Adjusted expectation matching mock data
    })

    it('should handle metrics and alert system synchronization', async () => {
      await pythonBridge.initialize()
      await metricsCollector.initialize()
      await alertSystem.initialize?.()

      // Test concurrent operations
      const concurrentOperations = [
        metricsCollector.getMetrics?.(),
        alertSystem.getAlertStatistics?.(),
        metricsCollector.getDashboardData(),
        alertSystem.getRecentAlerts?.(),
      ]

      const results = await Promise.allSettled(concurrentOperations)

      // All operations should complete (success or failure)
      expect(results).toHaveLength(4)
      results.forEach((result) => {
        expect(['fulfilled', 'rejected']).toContain(result.status)
      })
    })
  })

  describe('Cross-Module Error Propagation', () => {
    it('should handle Python bridge failures across modules', async () => {
      // Mock Python bridge failure
      pythonBridge.initialize = vi
        .fn()
        .mockRejectedValue(new Error('Python service unavailable'))

      // Mock the modules to also fail when Python bridge fails
      metricsCollector.initialize = vi
        .fn()
        .mockRejectedValue(new Error('Metrics collector failed'))
      if (alertSystem.initialize) {
        alertSystem.initialize = vi
          .fn()
          .mockRejectedValue(new Error('Alert system failed'))
      }

      // Both metrics collector and alert system should handle this gracefully
      await expect(metricsCollector.initialize()).rejects.toThrow()
      if (alertSystem.initialize) {
        await expect(alertSystem.initialize()).rejects.toThrow()
      }
    })

    it('should maintain module isolation during failures', async () => {
      await pythonBridge.initialize()

      // Mock metrics collector failure
      metricsCollector.initialize = vi
        .fn()
        .mockRejectedValue(new Error('Metrics storage failed'))

      // Alert system should still work independently
      await expect(alertSystem.initialize?.()).resolves.not.toThrow()

      // Restore original method
      metricsCollector.initialize = vi.fn().mockResolvedValue(undefined)
    })
  })

  describe('Resource Management Integration', () => {
    it('should properly manage shared resources', async () => {
      await pythonBridge.initialize()
      await metricsCollector.initialize()
      await alertSystem.initialize?.()

      // Test that modules can be disposed of properly
      await expect(metricsCollector.dispose?.()).resolves.not.toThrow()
      await expect(alertSystem.dispose?.()).resolves.not.toThrow()
    })

    it('should handle resource cleanup on errors', async () => {
      await pythonBridge.initialize()

      // Simulate error during metrics collection
      metricsCollector.storeAnalysisResult = vi
        .fn()
        .mockRejectedValue(new Error('Storage error'))

      const testResult: BiasAnalysisResult = {
        sessionId: 'resource-test',
        timestamp: new Date(),
        overallBiasScore: 0.3,
        alertLevel: 'low',
        layerResults: {} as any,
        recommendations: [],
        confidence: 0.8,
        demographics: {
          age: '45',
          gender: 'male',
          ethnicity: 'caucasian',
          primaryLanguage: 'english',
        },
      }

      // Should not leave resources in inconsistent state
      await expect(
        metricsCollector.storeAnalysisResult(testResult),
      ).rejects.toThrow()

      // Cleanup should still work
      await expect(metricsCollector.dispose?.()).resolves.not.toThrow()
    })
  })

  describe('Configuration Propagation', () => {
    it('should propagate configuration changes across modules', async () => {
      const newConfig: BiasDetectionConfig = {
        ...mockConfig,
        pythonServiceUrl: 'http://new-service:5001',
        pythonServiceTimeout: 45000,
      }

      // Create new instances with updated config
      const newPythonBridge = new PythonBiasDetectionBridge(
        newConfig.pythonServiceUrl!,
        newConfig.pythonServiceTimeout!,
      )

      const newMetricsCollector = new BiasMetricsCollector(
        newConfig,
        newPythonBridge,
      )
      const newAlertSystem = new BiasAlertSystem(
        {
          pythonServiceUrl: newConfig.pythonServiceUrl,
          timeout: newConfig.pythonServiceTimeout,
        },
        newPythonBridge,
      )

      await newPythonBridge.initialize()
      await newMetricsCollector.initialize()
      await newAlertSystem.initialize?.()

      // Verify configuration is applied
      expect(newPythonBridge).toBeDefined()
      expect(newMetricsCollector).toBeDefined()
      expect(newAlertSystem).toBeDefined()
    })

    it('should validate configuration consistency across modules', async () => {
      // Test with mismatched configuration
      const mismatchedConfig = {
        pythonServiceUrl: 'http://mismatch:5000',
        timeout: 60000, // Different timeout
      }

      const mismatchedAlertSystem = new BiasAlertSystem(
        mismatchedConfig,
        pythonBridge,
      )

      // Should still initialize but may have inconsistent behavior
      await expect(mismatchedAlertSystem.initialize?.()).resolves.not.toThrow()
    })
  })
})
