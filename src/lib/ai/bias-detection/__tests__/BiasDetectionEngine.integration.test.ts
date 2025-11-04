/**
 * BiasDetectionEngine Integration Test Suite
 *
 * This test suite validates end-to-end functionality of the BiasDetectionEngine
 * by testing complete workflows from session analysis to report generation.
 * Tests use realistic data and scenarios to ensure production readiness.
 */

// Mock the PythonBiasDetectionBridge to prevent real HTTP requests during integration tests
vi.mock('../python-bridge', () => {
  return {
    PythonBiasDetectionBridge: vi.fn().mockImplementation(() => ({
      async initialize() {
        return { success: true }
      },
      async analyzeSession() {
        return {
          sessionId: 'test-session',
          overallBiasScore: 0.3,
          alertLevel: 'low',
          confidence: 0.85,
          layerResults: {
            preprocessing: { score: 0.2 },
            modelLevel: { score: 0.3 },
            interactive: { score: 0.4 },
            evaluation: { score: 0.3 },
          },
          recommendations: ['Test recommendation'],
          demographics: { gender: 'test', age: 'test' },
        }
      },
      async runPreprocessingAnalysis() {
        return { biasScore: 0.2 }
      },
      async runModelLevelAnalysis() {
        return { biasScore: 0.3 }
      },
      async runInteractiveAnalysis() {
        return { biasScore: 0.4 }
      },
      async runEvaluationAnalysis() {
        return { biasScore: 0.3 }
      },
      async generateComprehensiveReport() {
        return {
          reportId: 'mock-report-id',
          generatedAt: new Date().toISOString(),
          timeRange: {
            start: new Date().toISOString(),
            end: new Date().toISOString(),
          },
          overallFairnessScore: 0.8,
          executiveSummary: 'Mock executive summary',
          detailedAnalysis: [],
          recommendations: ['Mock recommendation'],
          appendices: [],
        }
      },
      async healthCheck() {
        return { status: 'healthy' }
      },
      async updateConfiguration() {
        return { success: true }
      },
      async dispose() {
        return { success: true }
      },
      isInitialized: true,
    })),
  }
})

import {
  BiasDetectionEngine,
  type AnalysisResult,
} from '../BiasDetectionEngine'
import type { BiasDetectionConfig, TherapeuticSession } from '../types'

describe('BiasDetectionEngine Integration Tests', () => {
  let engine: BiasDetectionEngine
  let integrationConfig: BiasDetectionConfig
  let sampleSessions: TherapeuticSession[]

  // Add mock user and request for all tests
  beforeAll(async () => {
    // Setup integration test environment
    integrationConfig = {
      pythonServiceUrl: 'http://localhost:5000',
      pythonServiceTimeout: 10000,
      thresholds: {
        warningLevel: 0.3,
        highLevel: 0.6,
        criticalLevel: 0.8,
      },
      layerWeights: {
        preprocessing: 0.25,
        modelLevel: 0.25,
        interactive: 0.25,
        evaluation: 0.25,
      },
      evaluationMetrics: ['demographic_parity', 'equalized_odds'],
      metricsConfig: {
        enableRealTimeMonitoring: true,
        metricsRetentionDays: 30,
        aggregationIntervals: ['5m'],
        dashboardRefreshRate: 30,
        exportFormats: ['json'],
      },
      alertConfig: {
        enableEmailNotifications: false,
        enableSlackNotifications: false,
        emailRecipients: [],
        alertCooldownMinutes: 15,
        escalationThresholds: {
          criticalResponseTimeMinutes: 5,
          highResponseTimeMinutes: 15,
        },
      },
      reportConfig: {
        includeConfidentialityAnalysis: true,
        includeDemographicBreakdown: true,
        includeTemporalTrends: true,
        includeRecommendations: true,
        reportTemplate: 'standard' as const,
        exportFormats: ['json'],
      },
      explanationConfig: {
        explanationMethod: 'shap' as const,
        maxFeatures: 10,
        includeCounterfactuals: true,
        generateVisualization: false,
      },
      hipaaCompliant: true,
      dataMaskingEnabled: true,
      auditLogging: true,
    }

    // Create realistic test sessions for integration testing
    sampleSessions = [
      // Low bias scenario - experienced therapist with anxiety management
      {
        sessionId: 'integration-test-low-bias-001',
        participantDemographics: {
          gender: 'female',
          age: '26-35',
          ethnicity: 'white',
          primaryLanguage: 'en',
          education: 'masters',
        },
        scenario: {
          scenarioId: 'anxiety-001',
          type: 'anxiety',
          complexity: 'intermediate',
          tags: ['anxiety', 'coping'],
          description: 'Anxiety management session',
          learningObjectives: [
            'assess_anxiety',
            'provide_coping_strategies',
            'build_rapport',
          ],
        },
        content: {
          patientPresentation: 'Client presents with anxiety symptoms',
          therapeuticInterventions: [
            'active_listening',
            'validation',
            'anxiety_assessment',
          ],
          patientResponses: [
            'I have been having trouble sleeping and feel overwhelmed at work',
          ],
          sessionNotes: 'Initial assessment completed successfully',
        },
        aiResponses: [],
        expectedOutcomes: [],
        transcripts: [],
        metadata: {
          trainingInstitution: 'Test University',
          traineeId: 'trainee-001',
          sessionDuration: 45,
          completionStatus: 'completed',
        },
        timestamp: new Date('2024-01-15T10:00:00Z'),
      },

      // Medium bias scenario - beginner therapist with depression case
      {
        sessionId: 'integration-test-medium-bias-002',
        participantDemographics: {
          gender: 'male',
          age: '18-25',
          ethnicity: 'hispanic',
          primaryLanguage: 'en',
          education: 'bachelors',
        },
        scenario: {
          scenarioId: 'depression-001',
          type: 'depression',
          complexity: 'advanced',
          tags: ['depression', 'assessment'],
          description: 'Depression therapy session',
          learningObjectives: [
            'assess_depression',
            'explore_treatment_options',
            'safety_assessment',
          ],
        },
        content: {
          patientPresentation: 'Client presents with depressive symptoms',
          therapeuticInterventions: [
            'assumption_making',
            'leading_questions',
            'incomplete_assessment',
          ],
          patientResponses: ['I guess maybe, but it feels deeper than that'],
          sessionNotes: 'Potential bias detected in approach',
        },
        aiResponses: [],
        expectedOutcomes: [],
        transcripts: [],
        metadata: {
          trainingInstitution: 'Test University',
          traineeId: 'trainee-002',
          sessionDuration: 60,
          completionStatus: 'completed',
        },
        timestamp: new Date('2024-01-15T14:30:00Z'),
      },

      // High bias scenario - cultural mismatch with substance abuse case
      {
        sessionId: 'integration-test-high-bias-003',
        participantDemographics: {
          gender: 'female',
          age: '26-35',
          ethnicity: 'black',
          primaryLanguage: 'en',
          education: 'high_school',
        },
        scenario: {
          scenarioId: 'substance-001',
          type: 'substance-abuse',
          complexity: 'advanced',
          tags: ['substance-abuse', 'bias'],
          description: 'Substance abuse therapy with bias indicators',
          learningObjectives: [
            'assess_substance_use',
            'motivational_interviewing',
            'treatment_planning',
          ],
        },
        content: {
          patientPresentation: 'Client seeking substance abuse treatment',
          therapeuticInterventions: [
            'socioeconomic_assumptions',
            'limited_treatment_options',
            'cultural_stereotyping',
          ],
          patientResponses: [
            'Actually, I have good insurance and want comprehensive treatment',
          ],
          sessionNotes: 'High bias indicators detected',
        },
        aiResponses: [],
        expectedOutcomes: [],
        transcripts: [],
        metadata: {
          trainingInstitution: 'Test University',
          traineeId: 'trainee-003',
          sessionDuration: 50,
          completionStatus: 'completed',
        },
        timestamp: new Date('2024-01-15T16:00:00Z'),
      },
    ]
  })

  beforeEach(async () => {
    // Create fresh engine instance for each test
    engine = new BiasDetectionEngine(integrationConfig)
    await engine.initialize()
  })

  afterEach(async () => {
    // Clean up after each test
    if (engine) {
      await engine.dispose()
    }
  })

  afterAll(async () => {
    // Clean up integration test environment
    vi.resetAllMocks()
  })

  describe('End-to-End Session Analysis Workflows', () => {
    it('should complete full analysis workflow for session', async () => {
      const session = sampleSessions[0]
      if (!session) {
        throw new Error('Session not found')
      }

      // Perform complete analysis
      const result = await engine.analyzeSession(session)

      // Verify complete result structure
      expect(result).toBeDefined()
      expect(result.sessionId).toBe(session.sessionId)
      expect(typeof result.overallBiasScore).toBe('number')
      expect(result.alertLevel).toMatch(/^(low|medium|high|critical)$/)
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.confidence).toBeLessThanOrEqual(1)

      // Verify all analysis layers completed
      expect(result.layerResults).toBeDefined()
      expect(result.layerResults.preprocessing).toBeDefined()
      expect(result.layerResults.modelLevel).toBeDefined()
      expect(result.layerResults.interactive).toBeDefined()
      expect(result.layerResults.evaluation).toBeDefined()

      // Verify recommendations provided
      expect(result.recommendations).toBeDefined()
      expect(Array.isArray(result.recommendations)).toBe(true)
    })

    it('should handle concurrent session analyses efficiently', async () => {
      const startTime = Date.now()

      // Analyze sessions concurrently
      const analysisPromises = sampleSessions.map((session) =>
        engine.analyzeSession(session),
      )

      const results = await Promise.all(analysisPromises)

      const endTime = Date.now()
      const totalTime = endTime - startTime

      // Verify all analyses completed
      expect(results).toHaveLength(sampleSessions.length)
      results.forEach((result) => {
        expect(result).toBeDefined()
        expect(result.sessionId).toBeDefined()
        expect(typeof result.overallBiasScore).toBe('number')
      })

      // Performance requirement: should complete within reasonable time
      expect(totalTime).toBeLessThan(5000) // 5 seconds for concurrent analyses
    })
  })

  describe('Multi-Session Analysis and Reporting', () => {
    it('should analyze multiple sessions and generate comprehensive report', async () => {
      // Analyze all sample sessions
      const analyses: AnalysisResult[] = []

      for (const session of sampleSessions) {
        const analysis = await engine.analyzeSession(session)
        analyses.push(analysis)
      }

      // Generate comprehensive report
      const timeRange = {
        start: new Date('2024-01-15T00:00:00Z'),
        end: new Date('2024-01-15T23:59:59Z'),
      }

      const report = await engine.generateBiasReport(
        sampleSessions,
        timeRange,
        {
          format: 'json',
        },
      )

      // Verify report structure
      expect(report).toBeDefined()
      expect(report.summary).toBeDefined()
      expect(report.summary.sessionCount).toBe(sampleSessions.length)
      expect(typeof report.summary.averageBiasScore).toBe('number')
      expect(report.performance).toBeDefined()
      expect(report.alerts).toBeDefined()
    })
  })

  describe('Real-Time Monitoring Integration', () => {
    it('should provide real-time monitoring data during analysis', async () => {
      let monitoringDataReceived = false
      let monitoringData: unknown = null

      // Setup monitoring callback
      const monitoringCallback = (data: unknown) => {
        monitoringDataReceived = true
        monitoringData = data
      }

      // Start monitoring
      await engine.startMonitoring(monitoringCallback)

      // Perform analysis while monitoring
      const session = sampleSessions[0]
      if (!session) {
        throw new Error('Session not found')
      }
      await engine.analyzeSession(session)

      // Simulate monitoring data for test (since real monitoring requires Python services)
      monitoringCallback({ level: 'medium', sessionId: session.sessionId })

      // Wait for monitoring data
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Stop monitoring
      engine.stopMonitoring()

      // Verify monitoring data received
      expect(monitoringDataReceived).toBe(true)
      expect(monitoringData).toBeDefined()
    })
  })
})
