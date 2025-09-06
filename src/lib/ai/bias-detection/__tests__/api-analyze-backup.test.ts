/**
 * Unit tests for the Session Analysis API Endpoint
 */

/// <reference types="vitest/globals" />

import { BiasDetectionEngine } from '../index'
import { getAuditLogger } from '../audit'
import { getCacheManager } from '../cache'

import type { TherapeuticSession, BiasAnalysisResult } from '../index'

// Type definitions for test mocks
interface MockLogger {
  info: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
  debug: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
}

interface MockAuditLogger {
  logAuthentication: ReturnType<typeof vi.fn>
  logAction: ReturnType<typeof vi.fn>
  logBiasAnalysis: ReturnType<typeof vi.fn>
}

interface MockCacheManager {
  analysisCache: {
    getAnalysisResult: ReturnType<typeof vi.fn>
    cacheAnalysisResult: ReturnType<typeof vi.fn>
  }
}

interface MockBiasEngine {
  analyzeSession: ReturnType<typeof vi.fn>
  getSessionAnalysis: ReturnType<typeof vi.fn>
}

interface MockRequest {
  json: ReturnType<typeof vi.fn>
  headers: {
    get: ReturnType<typeof vi.fn>
  }
  url?: string
}

interface APIContext {
  request: MockRequest
}

// Handler function types
type PostHandler = (context: APIContext) => Promise<Response>
type GetHandler = (context: APIContext) => Promise<Response>

// Mock all dependencies
vi.mock('../index', () => ({
  BiasDetectionEngine: vi.fn(),
}))
vi.mock('../utils')
vi.mock('../audit')
vi.mock('../cache')
vi.mock('../performance-monitor', () => ({
  performanceMonitor: {
    recordRequestTiming: vi.fn(),
    recordAnalysis: vi.fn(),
  },
}))
vi.mock('../../../utils/logger')

// Mock the missing utility functions
const validateTherapeuticSession = vi.fn()
const generateAnonymizedId = vi.fn()

// Helper function to serialize mock data like JSON.stringify does for dates
function serializeForComparison(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj) as unknown)
}

// Import the actual handlers - using dynamic import inside test functions
let POST: PostHandler, GET: GetHandler

describe('Session Analysis API Endpoint', () => {
  let mockLogger: MockLogger
  let mockAuditLogger: MockAuditLogger
  let mockCacheManager: MockCacheManager
  let mockBiasEngine: MockBiasEngine

  const mockSession: TherapeuticSession = {
    sessionId: '123e4567-e89b-12d3-a456-426614174000',
    timestamp: new Date('2024-01-15T10:00:00.000Z'),
    participantDemographics: {
      age: '25-35',
      gender: 'female',
      ethnicity: 'hispanic',
      primaryLanguage: 'en',
    },
    scenario: {
      scenarioId: 'scenario-1',
      type: 'anxiety',
      complexity: 'intermediate',
      tags: ['anxiety', 'therapy'],
      description: 'Anxiety therapy session',
      learningObjectives: ['Identify triggers', 'Develop coping strategies'],
    },
    content: {
      patientPresentation: 'Patient presents with anxiety symptoms',
      therapeuticInterventions: ['CBT techniques', 'Breathing exercises'],
      patientResponses: ['Engaged well', 'Showed improvement'],
      sessionNotes: 'Productive session with good outcomes',
    },
    aiResponses: [
      {
        responseId: 'resp-1',
        timestamp: new Date('2024-01-15T10:05:00Z'),
        type: 'diagnostic',
        content: 'Patient shows signs of generalized anxiety',
        confidence: 0.85,
        modelUsed: 'gpt-4',
      },
    ],
    expectedOutcomes: [],
    transcripts: [],
    metadata: {
      trainingInstitution: 'University Hospital',
      traineeId: 'trainee-123',
      sessionDuration: 60,
      completionStatus: 'completed',
    },
  }

  const mockSessionForRequest = {
    sessionId: '123e4567-e89b-12d3-a456-426614174000',
    timestamp: '2024-01-15T10:00:00Z',
    participantDemographics: {
      age: '25-35',
      gender: 'female',
      ethnicity: 'hispanic',
      primaryLanguage: 'en',
    },
    scenario: {
      scenarioId: 'scenario-1',
      type: 'anxiety',
      complexity: 'intermediate',
      tags: ['anxiety', 'therapy'],
      description: 'Anxiety therapy session',
      learningObjectives: ['Identify triggers', 'Develop coping strategies'],
    },
    content: {
      patientPresentation: 'Patient presents with anxiety symptoms',
      therapeuticInterventions: ['CBT techniques', 'Breathing exercises'],
      patientResponses: ['Engaged well', 'Showed improvement'],
      sessionNotes: 'Productive session with good outcomes',
    },
    aiResponses: [
      {
        responseId: 'resp-1',
        timestamp: '2024-01-15T10:05:00Z',
        type: 'diagnostic',
        content: 'Patient shows signs of generalized anxiety',
        confidence: 0.85,
        modelUsed: 'gpt-4',
      },
    ],
    expectedOutcomes: [],
    transcripts: [],
    metadata: {
      trainingInstitution: 'University Hospital',
      traineeId: 'trainee-123',
      sessionDuration: 60,
      completionStatus: 'completed',
    },
  }

  const mockAnalysisResult: BiasAnalysisResult = {
    sessionId: '123e4567-e89b-12d3-a456-426614174000',
    timestamp: new Date('2024-01-15T10:00:00.000Z'),
    overallBiasScore: 0.25,
    layerResults: {
      preprocessing: {
        biasScore: 0.2,
        linguisticBias: {
          genderBiasScore: 0.1,
          racialBiasScore: 0.1,
          ageBiasScore: 0.05,
          culturalBiasScore: 0.05,
          biasedTerms: [],
          sentimentAnalysis: {
            overallSentiment: 0.5,
            emotionalValence: 0.6,
            subjectivity: 0.4,
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
          completeness: 0.9,
          consistency: 0.85,
          accuracy: 0.9,
          timeliness: 0.95,
          validity: 0.9,
          missingDataByDemographic: {},
        },
        recommendations: [],
      },
      modelLevel: {
        biasScore: 0.3,
        fairnessMetrics: {
          demographicParity: 0.1,
          equalizedOdds: 0.15,
          equalOpportunity: 0.12,
          calibration: 0.08,
          individualFairness: 0.1,
          counterfactualFairness: 0.09,
        },
        performanceMetrics: {
          accuracy: 0.85,
          precision: 0.82,
          recall: 0.88,
          f1Score: 0.85,
          auc: 0.9,
          calibrationError: 0.05,
          demographicBreakdown: {},
        },
        groupPerformanceComparison: [],
        recommendations: [],
      },
      interactive: {
        biasScore: 0.2,
        counterfactualAnalysis: {
          scenariosAnalyzed: 10,
          biasDetected: false,
          consistencyScore: 0.8,
          problematicScenarios: [],
        },
        featureImportance: [],
        whatIfScenarios: [],
        recommendations: [],
      },
      evaluation: {
        biasScore: 0.25,
        huggingFaceMetrics: {
          toxicity: 0.1,
          bias: 0.2,
          regard: {},
          stereotype: 0.15,
          fairness: 0.8,
        },
        customMetrics: {
          therapeuticBias: 0.2,
          culturalSensitivity: 0.8,
          professionalEthics: 0.9,
          patientSafety: 0.95,
        },
        temporalAnalysis: {
          trendDirection: 'stable',
          changeRate: 0.02,
          seasonalPatterns: [],
          interventionEffectiveness: [],
        },
        recommendations: [],
      },
    },
    demographics: mockSession.participantDemographics,
    recommendations: ['Regular bias monitoring recommended'],
    alertLevel: 'low',
    confidence: 0.88,
  }

  beforeEach(async () => {
    // Import handlers if not already imported
    if (!POST || !GET) {
      const module = await import(
        '../../../../pages/api/bias-detection/analyze'
      )
      POST = module.POST
      GET = module.GET as unknown as GetHandler
    }

    // Reset all mocks
    vi.clearAllMocks()

    // Setup logger mocks
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    }
    // @ts-expect-error - Mock setup
    getLogger.mockReturnValue(mockLogger)

    // Setup global Response mock with default behavior
    global.Response = vi
      .fn()
      .mockImplementation((body: string, init: { status: number }) => {
        let responseData
        try {
          responseData = JSON.parse(body) as unknown
        } catch {
          responseData = { message: body }
        }
        return {
          status: init.status,
          json: vi.fn().mockResolvedValue(responseData),
          headers: {
            get: vi.fn(),
          },
        }
      }) as unknown as typeof Response

    // Setup audit logger mocks
    mockAuditLogger = {
      logAuthentication: vi.fn().mockResolvedValue(undefined),
      logAction: vi.fn().mockResolvedValue(undefined),
      logBiasAnalysis: vi.fn().mockResolvedValue(undefined),
    }
    // @ts-expect-error - Mock setup
    getAuditLogger.mockReturnValue(mockAuditLogger)

    // Setup cache manager mocks
    mockCacheManager = {
      analysisCache: {
        getAnalysisResult: vi.fn().mockResolvedValue(null),
        cacheAnalysisResult: vi.fn().mockResolvedValue(undefined),
      },
    }
    // @ts-expect-error - Mock setup
    getCacheManager.mockReturnValue(mockCacheManager)

    // Setup bias engine mocks
    mockBiasEngine = {
      analyzeSession: vi.fn().mockResolvedValue(mockAnalysisResult),
      getSessionAnalysis: vi.fn().mockResolvedValue(mockAnalysisResult),
    }
    // @ts-expect-error - Mock setup
    BiasDetectionEngine.mockImplementation(() => mockBiasEngine)

    // Setup utility mocks
    validateTherapeuticSession.mockImplementation(
      (session: Record<string, unknown>) => {
        // Convert string timestamps to Date objects
        const sessionWithDates = {
          ...session,
          timestamp:
            typeof session['timestamp'] === 'string'
              ? new Date(session['timestamp'])
              : session['timestamp'],
          aiResponses:
            (session['aiResponses'] as Array<Record<string, unknown>>)?.map(
              (resp: Record<string, unknown>) => ({
                ...resp,
                timestamp:
                  typeof resp['timestamp'] === 'string'
                    ? new Date(resp['timestamp'])
                    : resp['timestamp'],
              }),
            ) || [],
        }
        return sessionWithDates as TherapeuticSession
      },
    )
    generateAnonymizedId.mockReturnValue('anon-123')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/bias-detection/analyze', () => {
    const createMockRequest = (
      body: Record<string, unknown>,
      headers: Record<string, string> = {},
    ) => {
      const defaultHeaders: Record<string, string> = {
        'content-type': 'application/json',
        'authorization': 'Bearer valid-token',
        ...headers,
      }

      return {
        json: vi.fn().mockResolvedValue(body),
        headers: {
          get: vi.fn(
            (key: string) => defaultHeaders[key.toLowerCase()] || null,
          ),
        },
      } as MockRequest
    }

    it('should successfully analyze a session with valid input', async () => {
      const requestBody = {
        session: mockSessionForRequest,
        options: { includeExplanation: true },
      }

      const request = createMockRequest(requestBody)

      const response = await POST({ request })

      expect(response.status).toBe(200)

      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.data).toEqual(
        serializeForComparison(mockAnalysisResult),
      )
      expect(responseData.cacheHit).toBe(false)
      expect(typeof responseData.processingTime).toBe('number')

      // Verify bias engine was called
      expect(mockBiasEngine.analyzeSession).toHaveBeenCalledWith(mockSession)

      // Verify audit logging
      expect(mockAuditLogger.logBiasAnalysis).toHaveBeenCalled()
    })

    it('should return cached result when available', async () => {
      mockCacheManager.analysisCache.getAnalysisResult.mockResolvedValue(
        mockAnalysisResult,
      )

      const requestBody = { session: mockSessionForRequest }
      const request = createMockRequest(requestBody)
      const response = await POST({ request })

      expect(response.status).toBe(200)

      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.cacheHit).toBe(true)
      expect(responseData.data).toEqual(
        serializeForComparison(mockAnalysisResult),
      )

      // Verify cache was checked
      expect(
        mockCacheManager.analysisCache.getAnalysisResult,
      ).toHaveBeenCalledWith(mockSession.sessionId)

      // Verify bias engine was not called
      expect(mockBiasEngine.analyzeSession).not.toHaveBeenCalled()
    })

    it('should return 401 for missing authorization', async () => {
      const requestBody = { session: mockSessionForRequest }
      const request = createMockRequest(requestBody, { authorization: '' })

      const response = await POST({ request })

      expect(response.status).toBe(401)

      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Unauthorized')

      // Verify authentication failure was logged
      expect(mockAuditLogger.logAuthentication).toHaveBeenCalledWith(
        'unknown',
        'unknown@example.com',
        'login',
        expect.any(Object),
        false,
        'Missing or invalid authorization token',
      )
    })

    it('should return 400 for validation errors', async () => {
      const invalidSession = {
        ...mockSessionForRequest,
        sessionId: 'invalid-uuid', // Invalid UUID
      }

      const requestBody = { session: invalidSession }
      const request = createMockRequest(requestBody)

      const response = await POST({ request })

      expect(response.status).toBe(400)

      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Validation Error')
      expect(responseData.message).toContain('Session ID must be a valid UUID')
    })

    it('should handle bias detection engine errors', async () => {
      const error = new Error('Python service unavailable')
      mockBiasEngine.analyzeSession.mockRejectedValue(error)

      const requestBody = { session: mockSessionForRequest }
      const request = createMockRequest(requestBody)

      const response = await POST({ request })

      expect(response.status).toBe(500)

      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Analysis Failed')
      expect(responseData.message).toBe('Python service unavailable')

      // Verify bias engine was called and failed
      expect(mockBiasEngine.analyzeSession).toHaveBeenCalledWith(mockSession)
    })
  })

  describe('GET /api/bias-detection/analyze', () => {
    const createMockGetRequest = (
      searchParams: Record<string, string> = {},
      headers: Record<string, string> = {},
    ) => {
      const url = new URL('http://localhost:3000/api/bias-detection/analyze')
      Object.entries(searchParams).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })

      const defaultHeaders: Record<string, string> = {
        authorization: 'Bearer valid-token',
        ...headers,
      }

      return {
        url: url.toString(),
        headers: {
          get: vi.fn(
            (key: string) => defaultHeaders[key.toLowerCase()] || null,
          ),
        },
      } as MockRequest
    }

    it('should successfully retrieve analysis results', async () => {
      mockBiasEngine.getSessionAnalysis.mockResolvedValue(mockAnalysisResult)

      const request = createMockGetRequest({
        sessionId: mockSession.sessionId,
        includeCache: 'true',
      })

      const response = await GET({ request })

      expect(response.status).toBe(200)

      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.data).toEqual(
        serializeForComparison(mockAnalysisResult),
      )

      // Verify audit logging
      expect(mockAuditLogger.logAction).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          type: 'read',
          category: 'bias-analysis',
        }),
        'bias-analysis-retrieval',
        expect.any(Object),
        expect.any(Object),
        mockSession.sessionId,
      )
    })

    it('should return 401 for missing authorization', async () => {
      const request = createMockGetRequest(
        { sessionId: mockSession.sessionId },
        { authorization: '' },
      )

      const response = await GET({ request })

      expect(response.status).toBe(401)

      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Unauthorized')
    })

    it('should return 400 for invalid sessionId', async () => {
      const request = createMockGetRequest({
        sessionId: 'invalid-uuid',
      })

      const response = await GET({ request })

      expect(response.status).toBe(400)

      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Validation Error')
      expect(responseData.message).toContain('Session ID must be a valid UUID')
    })

    it('should return 404 when analysis not found', async () => {
      mockCacheManager.analysisCache.getAnalysisResult.mockResolvedValue(null)
      mockBiasEngine.getSessionAnalysis.mockResolvedValue(null)

      const request = createMockGetRequest({
        sessionId: mockSession.sessionId,
      })

      const response = await GET({ request })

      expect(response.status).toBe(404)

      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Not Found')
      expect(responseData.message).toBe('Session analysis not found')
    })
  })
})
