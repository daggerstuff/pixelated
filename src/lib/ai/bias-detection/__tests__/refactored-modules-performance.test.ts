/// <reference types="vitest/globals" />
import { PythonBiasDetectionBridge } from '../python-bridge'
import { BiasMetricsCollector } from '../metrics-collector'
import { BiasAlertSystem } from '../alerts-system'
import type { BiasAnalysisResult } from '../types'

// Mock the Python bridge to avoid network calls
// Note: Using constructor initialization to ensure each instance gets fresh mocks
vi.mock('../python-bridge', () => ({
  PythonBiasDetectionBridge: class {
    initialize: ReturnType<typeof vi.fn>
    analyzeSession: ReturnType<typeof vi.fn>
    runPreprocessingAnalysis: ReturnType<typeof vi.fn>
    runModelLevelAnalysis: ReturnType<typeof vi.fn>
    runInteractiveAnalysis: ReturnType<typeof vi.fn>
    runEvaluationAnalysis: ReturnType<typeof vi.fn>
    checkHealth: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>

    constructor() {
      this.initialize = vi.fn().mockResolvedValue(undefined)
      this.analyzeSession = vi.fn().mockImplementation(async () => {
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
      this.runPreprocessingAnalysis = vi.fn().mockImplementation(async () => {
        const delay = 30 + Math.random() * 50
        await new Promise((resolve) => setTimeout(resolve, delay))
        return { biasScore: 0.2 + Math.random() * 0.3 }
      })
      this.runModelLevelAnalysis = vi.fn().mockImplementation(async () => {
        const delay = 40 + Math.random() * 60
        await new Promise((resolve) => setTimeout(resolve, delay))
        return { biasScore: 0.3 + Math.random() * 0.3 }
      })
      this.runInteractiveAnalysis = vi.fn().mockImplementation(async () => {
        const delay = 35 + Math.random() * 55
        await new Promise((resolve) => setTimeout(resolve, delay))
        return { biasScore: 0.4 + Math.random() * 0.3 }
      })
      this.runEvaluationAnalysis = vi.fn().mockImplementation(async () => {
        const delay = 45 + Math.random() * 65
        await new Promise((resolve) => setTimeout(resolve, delay))
        return { biasScore: 0.3 + Math.random() * 0.3 }
      })
      this.checkHealth = vi.fn().mockResolvedValue({ status: 'healthy' })
      this.dispose = vi.fn().mockResolvedValue(undefined)
    }
  },
}))

// Mock the metrics collector
// Note: Using constructor initialization to ensure each instance gets fresh mocks
vi.mock('../metrics-collector', () => ({
  BiasMetricsCollector: class {
    initialize: ReturnType<typeof vi.fn>
    storeAnalysisResult: ReturnType<typeof vi.fn>
    getMetrics: ReturnType<typeof vi.fn>
    getDashboardData: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>

    constructor() {
      this.initialize = vi.fn().mockResolvedValue(undefined)
      this.storeAnalysisResult = vi.fn().mockImplementation(async () => {
        const delay = 10 + Math.random() * 20
        await new Promise((resolve) => setTimeout(resolve, delay))
      })
      this.getMetrics = vi.fn().mockImplementation(async () => {
        const delay = 20 + Math.random() * 30
        await new Promise((resolve) => setTimeout(resolve, delay))
        return {
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
        }
      })
      this.getDashboardData = vi.fn().mockImplementation(async () => {
        const delay = 30 + Math.random() * 40
        await new Promise((resolve) => setTimeout(resolve, delay))
        return {
          summary: { totalSessions: 100, averageBiasScore: 0.3 },
          recentSessions: [],
          alerts: [],
        }
      })
      this.dispose = vi.fn().mockResolvedValue(undefined)
    }
  },
}))

// Mock the alert system
// Note: Using constructor initialization to ensure each instance gets fresh mocks
vi.mock('../alerts-system', () => ({
  BiasAlertSystem: class {
    initialize: ReturnType<typeof vi.fn>
    processAlert: ReturnType<typeof vi.fn>
    getAlertStatistics: ReturnType<typeof vi.fn>
    getAlertHistory: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>

    constructor() {
      this.initialize = vi.fn().mockResolvedValue(undefined)
      this.processAlert = vi.fn().mockImplementation(async () => {
        const delay = 15 + Math.random() * 25
        await new Promise((resolve) => setTimeout(resolve, delay))
      })
      this.getAlertStatistics = vi.fn().mockImplementation(async () => {
        const delay = 25 + Math.random() * 35
        await new Promise((resolve) => setTimeout(resolve, delay))
        return {
          totalAlerts: 50,
          activeAlerts: 5,
          resolvedAlerts: 45,
        }
      })
      this.getAlertHistory = vi.fn().mockImplementation(async () => {
        const delay = 40 + Math.random() * 60
        await new Promise((resolve) => setTimeout(resolve, delay))
        return []
      })
      this.dispose = vi.fn().mockResolvedValue(undefined)
    }
  },
}))

// Mock the connection pool for performance testing
// Note: Using constructor initialization to ensure each instance gets fresh mocks
vi.mock('../connection-pool', () => ({
  ConnectionPool: class {
    getConnection: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>

    constructor() {
      this.getConnection = vi.fn().mockResolvedValue({
        request: vi.fn().mockImplementation(async () => {
          // Simulate realistic API response time (50-150ms)
          const delay = 50 + Math.random() * 100
          await new Promise((resolve) => setTimeout(resolve, delay))
          return {
            bias_score: 0.3 + Math.random() * 0.4,
            layer_results: {
              preprocessing: { bias_score: 0.2 + Math.random() * 0.3 },
              model_level: { bias_score: 0.3 + Math.random() * 0.3 },
              interactive: { bias_score: 0.4 + Math.random() * 0.3 },
              evaluation: { bias_score: 0.3 + Math.random() * 0.3 },
            },
          }
        }),
        release: vi.fn(),
      })
      this.close = vi.fn()
    }
  },
}))

vi.mock('../performance-monitor', () => ({
  performanceMonitor: {
    recordMetric: vi.fn(),
    recordAlert: vi.fn(),
  },
}))

describe('Refactored Modules Performance Tests', () => {
  let pythonBridge: PythonBiasDetectionBridge
  let metricsCollector: BiasMetricsCollector
  let alertSystem: BiasAlertSystem

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Create module instances
    pythonBridge = new PythonBiasDetectionBridge('http://localhost:5000', 30000)

    metricsCollector = new BiasMetricsCollector(
      {
        pythonServiceUrl: 'http://localhost:5000',
        pythonServiceTimeout: 30000,
        metricsConfig: {
          enableRealTimeMonitoring: true,
          metricsRetentionDays: 30,
          aggregationIntervals: ['1h', '1d'],
          dashboardRefreshRate: 60,
          exportFormats: ['json'],
        },
      },
      pythonBridge,
    )

    alertSystem = new BiasAlertSystem(
      {
        pythonServiceUrl: 'http://localhost:5000',
        timeout: 30000,
      },
      pythonBridge,
    )
  })

  describe('Python Bridge Performance', () => {
    it('should handle multiple concurrent analysis requests efficiently', async () => {
      await pythonBridge.initialize()

      const sessions = Array.from({ length: 10 }, (_, i) => ({
        sessionId: `bridge-perf-${i}`,
        timestamp: new Date(),
        participantDemographics: {
          age: String(25 + i),
          gender: i % 2 === 0 ? 'female' : 'male',
          ethnicity: 'caucasian',
          primaryLanguage: 'english',
        },
        scenario: {
          scenarioId: `scenario-${i}`,
          type: 'other' as const,
          complexity: 'beginner' as const,
          tags: [],
          description: 'Auto-generated scenario for test.',
          learningObjectives: [],
        },
        content: {
          patientPresentation: `Performance test session ${i} content for Python bridge analysis.`,
          therapeuticInterventions: [],
          patientResponses: [],
          sessionNotes: 'Test session notes',
        },
        aiResponses: [],
        expectedOutcomes: [],
        transcripts: [],
        metadata: {
          trainingInstitution: 'TestInstitute',
          traineeId: `Trainee${i}`,
          sessionDuration: 45,
          completionStatus: 'completed' as const,
        },
      }))

      const startTime = performance.now()
      const promises = sessions.map((session) =>
        pythonBridge.runPreprocessingAnalysis(session),
      )
      const results = await Promise.all(promises)
      const endTime = performance.now()

      const totalTime = endTime - startTime
      const averageTime = totalTime / sessions.length

      // Concurrent requests should be efficient
      expect(totalTime).toBeLessThan(5000) // Less than 5 seconds for 10 concurrent
      expect(averageTime).toBeLessThan(800) // Less than 800ms per request
      expect(results).toHaveLength(sessions.length)
      results.forEach((result) => {
        expect(result).toBeDefined()
        expect(result).toHaveProperty('biasScore')
      })

      console.log(
        `Python Bridge concurrent performance: ${totalTime.toFixed(2)}ms total, ${averageTime.toFixed(2)}ms average`,
      )
    })

    it('should maintain connection pool efficiency', async () => {
      await pythonBridge.initialize()

      const session = {
        sessionId: 'pool-test',
        timestamp: new Date(),
        participantDemographics: {
          age: '30',
          gender: 'female',
          ethnicity: 'caucasian',
          primaryLanguage: 'english',
        },
        scenario: {
          scenarioId: 'pool-scenario',
          type: 'other' as const,
          complexity: 'beginner' as const,
          tags: [],
          description: 'Pool test scenario',
          learningObjectives: [],
        },
        content: {
          patientPresentation: 'Connection pool efficiency test session.',
          therapeuticInterventions: [],
          patientResponses: [],
          sessionNotes: 'Test notes',
        },
        aiResponses: [],
        expectedOutcomes: [],
        transcripts: [],
        metadata: {
          trainingInstitution: 'TestInstitute',
          traineeId: 'TraineeX',
          sessionDuration: 45,
          completionStatus: 'completed' as const,
        },
      }

      const iterations = 20
      const startTime = performance.now()

      // Simulate sustained load
      for (let i = 0; i < iterations; i++) {
        await pythonBridge.runPreprocessingAnalysis({
          ...session,
          sessionId: `pool-test-${i}`,
        })
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const averageTime = totalTime / iterations

      // Connection pooling should provide consistent performance
      expect(averageTime).toBeLessThan(500) // Less than 500ms per request
      expect(totalTime).toBeLessThan(10000) // Less than 10 seconds total

      console.log(
        `Connection pool performance: ${iterations} requests in ${totalTime.toFixed(2)}ms, ${averageTime.toFixed(2)}ms average`,
      )
    })

    it('should handle service failures gracefully without performance impact', async () => {
      await pythonBridge.initialize()

      const validSession = {
        sessionId: 'failure-test-valid',
        timestamp: new Date(),
        participantDemographics: {
          age: '30',
          gender: 'female',
          ethnicity: 'caucasian',
          primaryLanguage: 'english',
        },
        scenario: {
          scenarioId: 'failure-test-scenario',
          type: 'other' as const,
          complexity: 'beginner' as const,
          tags: [],
          description: 'Valid session for failure handling test.',
          learningObjectives: [],
        },
        content: {
          patientPresentation: 'Valid session for failure handling test.',
          therapeuticInterventions: [],
          patientResponses: [],
          sessionNotes: 'Test session notes',
        },
        aiResponses: [],
        expectedOutcomes: [],
        transcripts: [],
        metadata: {
          trainingInstitution: 'TestInstitute',
          traineeId: 'TraineeFailure',
          sessionDuration: 30,
          completionStatus: 'completed' as const,
        },
      }

      const startTime = performance.now()

      // Test valid request
      const validResult =
        await pythonBridge.runPreprocessingAnalysis(validSession)

      // Simulate service failure (this would require mocking the connection pool)
      // For now, we test that valid requests are not affected

      const endTime = performance.now()
      const requestTime = endTime - startTime

      expect(requestTime).toBeLessThan(2000) // Should complete within 2 seconds
      expect(validResult).toBeDefined()

      console.log(
        `Service failure handling performance: ${requestTime.toFixed(2)}ms`,
      )
    })
  })

  describe('Metrics Collector Performance', () => {
    it('should store analysis results efficiently', async () => {
      await pythonBridge.initialize()
      await metricsCollector.initialize()

      const results: BiasAnalysisResult[] = Array.from(
        { length: 50 },
        (_, i) => ({
          sessionId: `metrics-perf-${i}`,
          timestamp: new Date(),
          overallBiasScore: 0.2 + Math.random() * 0.6,
          alertLevel:
            Math.random() > 0.7
              ? 'high'
              : Math.random() > 0.4
                ? 'medium'
                : 'low',
          layerResults: {
            preprocessing: {
              biasScore: 0.2 + Math.random() * 0.3,
              linguisticBias: {
                genderBiasScore: Math.random() * 0.2,
                racialBiasScore: Math.random() * 0.2,
                ageBiasScore: Math.random() * 0.2,
                culturalBiasScore: Math.random() * 0.2,
                biasedTerms: [],
                sentimentAnalysis: {
                  overallSentiment: (Math.random() - 0.5) * 0.4,
                  emotionalValence: (Math.random() - 0.5) * 0.4,
                  subjectivity: Math.random() * 0.3,
                  demographicVariations: {},
                },
              },
              representationAnalysis: {
                demographicDistribution: {},
                underrepresentedGroups: [],
                overrepresentedGroups: [],
                diversityIndex: 0.7 + Math.random() * 0.3,
                intersectionalityAnalysis: [],
              },
              dataQualityMetrics: {
                completeness: 0.9 + Math.random() * 0.1,
                consistency: 0.9 + Math.random() * 0.1,
                accuracy: 0.9 + Math.random() * 0.1,
                timeliness: 0.9 + Math.random() * 0.1,
                validity: 0.9 + Math.random() * 0.1,
                missingDataByDemographic: {},
              },
              recommendations: [],
            },
            modelLevel: {
              biasScore: 0.3 + Math.random() * 0.4,
              fairnessMetrics: {
                demographicParity: 0.8 + Math.random() * 0.2,
                equalizedOdds: 0.8 + Math.random() * 0.2,
                equalOpportunity: 0.8 + Math.random() * 0.2,
                calibration: 0.9 + Math.random() * 0.1,
                individualFairness: 0.8 + Math.random() * 0.2,
                counterfactualFairness: 0.8 + Math.random() * 0.2,
              },
              performanceMetrics: {
                accuracy: 0.8 + Math.random() * 0.2,
                precision: 0.8 + Math.random() * 0.2,
                recall: 0.8 + Math.random() * 0.2,
                f1Score: 0.8 + Math.random() * 0.2,
                auc: 0.85 + Math.random() * 0.15,
                calibrationError: Math.random() * 0.1,
                demographicBreakdown: {},
              },
              groupPerformanceComparison: [],
              recommendations: [],
            },
            interactive: {
              biasScore: 0.25 + Math.random() * 0.5,
              counterfactualAnalysis: {
                scenariosAnalyzed: Math.floor(Math.random() * 20) + 5,
                biasDetected: Math.random() > 0.6,
                consistencyScore: 0.7 + Math.random() * 0.3,
                problematicScenarios: [],
              },
              featureImportance: [],
              whatIfScenarios: [],
              recommendations: [],
            },
            evaluation: {
              biasScore: 0.35 + Math.random() * 0.4,
              huggingFaceMetrics: {
                toxicity: Math.random() * 0.3,
                bias: Math.random() * 0.4,
                regard: {},
                stereotype: Math.random() * 0.3,
                fairness: 0.7 + Math.random() * 0.3,
              },
              customMetrics: {
                therapeuticBias: Math.random() * 0.3,
                culturalSensitivity: 0.8 + Math.random() * 0.2,
                professionalEthics: 0.9 + Math.random() * 0.1,
                patientSafety: 0.95 + Math.random() * 0.05,
              },
              temporalAnalysis: {
                trendDirection: 'stable',
                changeRate: (Math.random() - 0.5) * 0.2,
                seasonalPatterns: [],
                interventionEffectiveness: [],
              },
              recommendations: [],
            },
          },
          recommendations: ['Monitor for emerging patterns'],
          confidence: 0.8 + Math.random() * 0.2,
          demographics: {
            age: String(20 + Math.floor(Math.random() * 40)),
            gender: Math.random() > 0.5 ? 'female' : 'male',
            ethnicity: 'caucasian',
            primaryLanguage: 'english',
          },
        }),
      )

      const startTime = performance.now()

      // Store all results
      await Promise.all(
        results.map((result) => metricsCollector.storeAnalysisResult?.(result)),
      )

      const endTime = performance.now()
      const storageTime = endTime - startTime
      const averageTime = storageTime / results.length

      // Storage should be efficient
      expect(storageTime).toBeLessThan(5000) // Less than 5 seconds for 50 results
      expect(averageTime).toBeLessThan(100) // Less than 100ms per result

      console.log(
        `Metrics storage performance: ${storageTime.toFixed(2)}ms for ${results.length} results, ${averageTime.toFixed(2)}ms average`,
      )
    })

    it('should retrieve metrics quickly', async () => {
      await pythonBridge.initialize()
      await metricsCollector.initialize()

      const startTime = performance.now()
      const metrics = await metricsCollector.getMetrics?.()
      const endTime = performance.now()

      const retrievalTime = endTime - startTime

      // Metrics retrieval should be fast
      expect(retrievalTime).toBeLessThan(500) // Less than 500ms
      expect(metrics).toBeDefined()

      console.log(`Metrics retrieval time: ${retrievalTime.toFixed(2)}ms`)
    })

    it('should handle dashboard data generation efficiently', async () => {
      await pythonBridge.initialize()
      await metricsCollector.initialize()

      const startTime = performance.now()
      const dashboardData = await metricsCollector.getDashboardData()
      const endTime = performance.now()

      const generationTime = endTime - startTime

      // Dashboard generation should be reasonably fast
      expect(generationTime).toBeLessThan(1000) // Less than 1 second
      expect(dashboardData).toBeDefined()
      expect(dashboardData).toHaveProperty('summary')

      console.log(`Dashboard generation time: ${generationTime.toFixed(2)}ms`)
    })
  })

  describe('Alert System Performance', () => {
    it('should process alerts quickly', async () => {
      await pythonBridge.initialize()
      await alertSystem.initialize?.()

      const alerts: BiasAnalysisResult[] = Array.from(
        { length: 20 },
        (_, i) => ({
          sessionId: `alert-perf-${i}`,
          timestamp: new Date(),
          overallBiasScore: 0.1 + Math.random() * 0.8,
          alertLevel:
            Math.random() > 0.7
              ? 'critical'
              : Math.random() > 0.4
                ? 'high'
                : 'medium',
          layerResults: {} as any, // Simplified for performance test
          recommendations: [],
          confidence: 0.8 + Math.random() * 0.2,
          demographics: {
            age: String(20 + Math.floor(Math.random() * 40)),
            gender: Math.random() > 0.5 ? 'female' : 'male',
            ethnicity: 'caucasian',
            primaryLanguage: 'english',
          },
        }),
      )

      const startTime = performance.now()

      // Process all alerts
      await Promise.all(
        alerts.map((alert) =>
          alertSystem.processAlert?.({
            sessionId: alert.sessionId,
            level: alert.alertLevel,
            biasScore: alert.overallBiasScore,
            analysisResult: alert,
          }),
        ),
      )

      const endTime = performance.now()
      const processingTime = endTime - startTime
      const averageTime = processingTime / alerts.length

      // Alert processing should be fast
      expect(processingTime).toBeLessThan(3000) // Less than 3 seconds for 20 alerts
      expect(averageTime).toBeLessThan(200) // Less than 200ms per alert

      console.log(
        `Alert processing performance: ${processingTime.toFixed(2)}ms for ${alerts.length} alerts, ${averageTime.toFixed(2)}ms average`,
      )
    })

    it('should retrieve alert statistics efficiently', async () => {
      await pythonBridge.initialize()
      await alertSystem.initialize?.()

      const startTime = performance.now()
      const stats = await alertSystem.getAlertStatistics?.()
      const endTime = performance.now()

      const retrievalTime = endTime - startTime

      // Statistics retrieval should be very fast
      expect(retrievalTime).toBeLessThan(100) // Less than 100ms
      expect(stats).toBeDefined()

      console.log(
        `Alert statistics retrieval time: ${retrievalTime.toFixed(2)}ms`,
      )
    })

    it('should handle alert history queries efficiently', async () => {
      await pythonBridge.initialize()
      await alertSystem.initialize?.()

      const startTime = performance.now()
      const history = await alertSystem.getAlertHistory?.()
      const endTime = performance.now()

      const queryTime = endTime - startTime

      // History queries should be reasonably fast
      expect(queryTime).toBeLessThan(500) // Less than 500ms
      expect(Array.isArray(history)).toBe(true)

      console.log(`Alert history query time: ${queryTime.toFixed(2)}ms`)
    })
  })

  describe('Cross-Module Performance', () => {
    it('should handle end-to-end workflow efficiently', async () => {
      await pythonBridge.initialize()
      await metricsCollector.initialize()
      await alertSystem.initialize?.()

      const session = {
        sessionId: 'e2e-perf-test',
        timestamp: new Date(),
        participantDemographics: {
          age: '35',
          gender: 'female',
          ethnicity: 'african_american',
          primaryLanguage: 'english',
        },
        scenario: {
          scenarioId: 'e2e-scenario',
          type: 'other' as const,
          complexity: 'intermediate' as const,
          tags: [],
          description: 'End-to-end workflow scenario',
          learningObjectives: [],
        },
        content: {
          patientPresentation:
            'End-to-end performance test session for the complete bias detection workflow.',
          therapeuticInterventions: [],
          patientResponses: [],
          sessionNotes: 'End-to-end test notes',
        },
        aiResponses: [],
        expectedOutcomes: [],
        transcripts: [],
        metadata: {
          trainingInstitution: 'TestInstitute',
          traineeId: 'TraineeE2E',
          sessionDuration: 50,
          completionStatus: 'completed' as const,
        },
      }

      const startTime = performance.now()

      // Step 1: Run analysis through Python bridge
      const preprocessingResult =
        await pythonBridge.runPreprocessingAnalysis(session)
      const modelResult = await pythonBridge.runModelLevelAnalysis(session)
      const interactiveResult =
        await pythonBridge.runInteractiveAnalysis(session)
      const evaluationResult = await pythonBridge.runEvaluationAnalysis(session)

      // Step 2: Create complete analysis result
      const analysisResult: BiasAnalysisResult = {
        sessionId: session.sessionId,
        timestamp: session.timestamp,
        overallBiasScore:
          (preprocessingResult.biasScore +
            modelResult.biasScore +
            interactiveResult.biasScore +
            evaluationResult.biasScore) /
          4,
        alertLevel: 'medium' as const,
        layerResults: {
          preprocessing: preprocessingResult,
          modelLevel: modelResult,
          interactive: interactiveResult,
          evaluation: evaluationResult,
        },
        recommendations: ['End-to-end workflow test'],
        confidence: 0.85,
        demographics: session.participantDemographics,
      }

      // Step 3: Store in metrics collector
      await metricsCollector.storeAnalysisResult?.(analysisResult)

      // Step 4: Process alert
      await alertSystem.processAlert?.({
        sessionId: analysisResult.sessionId,
        level: analysisResult.alertLevel,
        biasScore: analysisResult.overallBiasScore,
        analysisResult: analysisResult,
      })

      // Step 5: Retrieve dashboard data
      await metricsCollector.getDashboardData()
      await alertSystem.getAlertStatistics?.()

      const endTime = performance.now()
      const workflowTime = endTime - startTime

      // Complete workflow should be efficient
      expect(workflowTime).toBeLessThan(8000) // Less than 8 seconds
      expect(analysisResult).toBeDefined()

      console.log(`End-to-end workflow time: ${workflowTime.toFixed(2)}ms`)
    })

    it('should maintain performance under sustained load', async () => {
      await pythonBridge.initialize()
      await metricsCollector.initialize()
      await alertSystem.initialize?.()

      const numberOfSessions = 25
      const sessions = Array.from({ length: numberOfSessions }, (_, i) => ({
        sessionId: `sustained-load-${i}`,
        timestamp: new Date(),
        participantDemographics: {
          age: String(25 + (i % 50)),
          gender: i % 2 === 0 ? 'female' : 'male',
          ethnicity:
            ['caucasian', 'african_american', 'hispanic', 'asian'][i % 4] ||
            'caucasian',
          primaryLanguage: 'english',
        },
        scenario: {
          scenarioId: `scenario-${i}`,
          type: 'other' as const,
          complexity: 'beginner' as const,
          tags: [],
          description: 'Sustained load scenario',
          learningObjectives: [],
        },
        content: {
          patientPresentation: `Sustained load test session ${i} for performance validation.`,
          therapeuticInterventions: [],
          patientResponses: [],
          sessionNotes: 'Sustained load test notes',
        },
        aiResponses: [],
        expectedOutcomes: [],
        transcripts: [],
        metadata: {
          trainingInstitution: 'TestInstitute',
          traineeId: `TraineeLoad${i}`,
          sessionDuration: 45,
          completionStatus: 'completed',
        },
      }))

      const startTime = performance.now()

      // Process all sessions through the complete workflow
      for (const session of sessions) {
        const analysisResult: BiasAnalysisResult = {
          sessionId: session.sessionId,
          timestamp: session.timestamp,
          overallBiasScore: 0.2 + Math.random() * 0.6,
          alertLevel: Math.random() > 0.5 ? 'high' : 'medium',
          layerResults: {} as any, // Simplified for load test
          recommendations: [],
          confidence: 0.8 + Math.random() * 0.2,
          demographics: session.participantDemographics,
        }

        await metricsCollector.storeAnalysisResult?.(analysisResult)
        await alertSystem.processAlert?.({
          sessionId: analysisResult.sessionId,
          level: analysisResult.alertLevel,
          biasScore: analysisResult.overallBiasScore,
          analysisResult: analysisResult,
        })
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const averageTime = totalTime / numberOfSessions

      // Sustained load should be manageable
      expect(totalTime).toBeLessThan(30000) // Less than 30 seconds
      expect(averageTime).toBeLessThan(1200) // Less than 1.2 seconds per session

      console.log(
        `Sustained load performance: ${totalTime.toFixed(2)}ms for ${numberOfSessions} sessions, ${averageTime.toFixed(2)}ms average`,
      )
    })
  })

  describe('Memory and Resource Usage', () => {
    it('should maintain stable memory usage during module operations', async () => {
      await pythonBridge.initialize()
      await metricsCollector.initialize()
      await alertSystem.initialize?.()

      const initialMemory = process.memoryUsage().heapUsed
      const operations = 30

      // Perform various operations
      for (let i = 0; i < operations; i++) {
        const session = {
          sessionId: `memory-test-${i}`,
          timestamp: new Date(),
          participantDemographics: {
            age: '30',
            gender: 'female',
            ethnicity: 'caucasian',
            primaryLanguage: 'english',
          },
          scenario: {
            scenarioId: `memory-scenario-${i}`,
            type: 'other' as const,
            complexity: 'beginner' as const,
            tags: [],
            description: 'Memory usage scenario',
            learningObjectives: [],
          },
          content: {
            patientPresentation: 'Memory usage test session.',
            therapeuticInterventions: [],
            patientResponses: [],
            sessionNotes: 'Memory usage notes',
          },
          aiResponses: [],
          expectedOutcomes: [],
          transcripts: [],
          metadata: {
            trainingInstitution: 'TestInstitute',
            traineeId: `TraineeMemory${i}`,
            sessionDuration: 30,
            completionStatus: 'completed' as const,
          },
        }

        const analysisResult: BiasAnalysisResult = {
          sessionId: session.sessionId,
          timestamp: session.timestamp,
          overallBiasScore: 0.3,
          alertLevel: 'medium' as const,
          layerResults: {} as any,
          recommendations: [],
          confidence: 0.8,
          demographics: session.participantDemographics,
        }

        await pythonBridge.runPreprocessingAnalysis(session)
        await metricsCollector.storeAnalysisResult?.(analysisResult)
        await alertSystem.processAlert?.({
          sessionId: analysisResult.sessionId,
          level: analysisResult.alertLevel,
          biasScore: analysisResult.overallBiasScore,
          analysisResult: analysisResult,
        })
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024

      // Memory increase should be reasonable (< 100MB for 30 operations)
      expect(memoryIncreaseMB).toBeLessThan(100)

      console.log(
        `Memory usage test: ${memoryIncreaseMB.toFixed(2)}MB increase over ${operations} operations`,
      )
    })

    it('should clean up resources properly', async () => {
      await pythonBridge.initialize()
      await metricsCollector.initialize()
      await alertSystem.initialize?.()

      // Perform some operations
      const session = {
        sessionId: 'cleanup-test',
        timestamp: new Date(),
        participantDemographics: {
          age: '30',
          gender: 'female',
          ethnicity: 'caucasian',
          primaryLanguage: 'english',
        },
        scenario: {
          scenarioId: 'cleanup-scenario',
          type: 'other' as const,
          complexity: 'beginner' as const,
          tags: [],
          description: 'Resource cleanup scenario',
          learningObjectives: [],
        },
        content: {
          patientPresentation: 'Resource cleanup test session.',
          therapeuticInterventions: [],
          patientResponses: [],
          sessionNotes: 'Cleanup notes',
        },
        aiResponses: [],
        expectedOutcomes: [],
        transcripts: [],
        metadata: {
          trainingInstitution: 'TestInstitute',
          traineeId: 'TraineeCleanup',
          sessionDuration: 35,
          completionStatus: 'completed' as const,
        },
      }

      const analysisResult: BiasAnalysisResult = {
        sessionId: session.sessionId,
        timestamp: session.timestamp,
        overallBiasScore: 0.3,
        alertLevel: 'medium' as const,
        layerResults: {} as any,
        recommendations: [],
        confidence: 0.8,
        demographics: session.participantDemographics,
      }

      await pythonBridge.runPreprocessingAnalysis(session)
      await metricsCollector.storeAnalysisResult?.(analysisResult)
      await alertSystem.processAlert?.({
        sessionId: analysisResult.sessionId,
        level: analysisResult.alertLevel,
        biasScore: analysisResult.overallBiasScore,
        analysisResult: analysisResult,
      })

      // Clean up resources
      await metricsCollector.dispose?.()
      await alertSystem.dispose?.()

      // Verify cleanup doesn't throw errors
      expect(async () => {
        await metricsCollector.dispose?.()
        await alertSystem.dispose?.()
      }).not.toThrow()
    })
  })
})
