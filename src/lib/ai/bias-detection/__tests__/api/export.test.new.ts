/**
 * Unit tests for the Bias Detection Export API Endpoint
 */

// All mocks MUST be at the top level and hoisted
vi.mock('@/lib/ai/bias-detection', () => ({
  BiasDetectionEngine: vi.fn(),
}))

vi.mock('@/lib/utils/logger', () => ({
  getLogger: vi.fn(),
}))

import { BiasDetectionEngine } from '@/lib/ai/bias-detection'

import type { BiasDashboardData } from '@/lib/ai/bias-detection'

describe('Bias Detection Export API Endpoint', () => {
  let mockLogger: {
    info: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
    debug: ReturnType<typeof vi.fn>
    warn: ReturnType<typeof vi.fn>
  }
  let mockBiasEngine: {
    getDashboardData: ReturnType<typeof vi.fn>
    exportData: ReturnType<typeof vi.fn>
  }
  let GET: (context: {
    request: Request
    cookies: Record<string, unknown>
  }) => Promise<Response>

  const mockDashboardData: BiasDashboardData = {
    summary: {
      totalSessions: 150,
      averageBiasScore: 0.35,
      alertsLast24h: 8,
      totalAlerts: 12,
      criticalIssues: 2,
      improvementRate: 0.15,
      complianceScore: 0.85,
    },
    alerts: [
      {
        alertId: 'alert-1',
        timestamp: new Date('2024-01-15T09:30:00Z'),
        level: 'high',
        type: 'high_bias',
        message: 'High bias detected in therapeutic session',
        sessionId: 'session-123',
        acknowledged: false,
      },
    ],
    trends: [
      {
        date: new Date('2024-01-14T00:00:00Z'),
        biasScore: 0.32,
        sessionCount: 25,
        alertCount: 3,
        demographicBreakdown: {
          age: 0.1,
          gender: 0.2,
        },
      },
    ],
    demographics: {
      age: { '18-24': 20, '25-34': 35, '35-44': 25, '45-54': 15, '55+': 5 },
      gender: { male: 45, female: 50, other: 5 },
      ethnicity: { asian: 25, black: 20, hispanic: 30, white: 20, other: 5 },
      language: { en: 80, es: 15, other: 5 },
      intersectional: [],
    },
    recentAnalyses: [
      {
        sessionId: 'session-123',
        timestamp: new Date('2024-01-15T09:30:00Z'),
        overallBiasScore: 0.75,
        layerResults: {
          preprocessing: {
            biasScore: 0.3,
            linguisticBias: {
              genderBiasScore: 0.2,
              racialBiasScore: 0.1,
              ageBiasScore: 0.15,
              culturalBiasScore: 0.25,
              biasedTerms: [],
              sentimentAnalysis: {
                overallSentiment: 0.1,
                emotionalValence: 0.2,
                subjectivity: 0.5,
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
              validity: 0.88,
              missingDataByDemographic: {},
            },
            recommendations: [],
          },
          modelLevel: {
            biasScore: 0.4,
            fairnessMetrics: {
              demographicParity: 0.1,
              equalizedOdds: 0.15,
              equalOpportunity: 0.12,
              calibration: 0.08,
              individualFairness: 0.2,
              counterfactualFairness: 0.18,
            },
            performanceMetrics: {
              accuracy: 0.85,
              precision: 0.82,
              recall: 0.78,
              f1Score: 0.8,
              auc: 0.88,
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
              biasDetected: true,
              consistencyScore: 0.7,
              problematicScenarios: [],
            },
            featureImportance: [],
            whatIfScenarios: [],
            recommendations: [],
          },
          evaluation: {
            biasScore: 0.3,
            huggingFaceMetrics: {
              toxicity: 0.1,
              bias: 0.25,
              regard: {},
              stereotype: 0.15,
              fairness: 0.8,
            },
            customMetrics: {
              therapeuticBias: 0.2,
              culturalSensitivity: 0.85,
              professionalEthics: 0.9,
              patientSafety: 0.95,
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
        demographics: {
          age: '25-35',
          gender: 'female',
          ethnicity: 'hispanic',
          primaryLanguage: 'en',
        },
        recommendations: ['Monitor for cultural bias patterns'],
        alertLevel: 'high',
        confidence: 0.85,
      },
    ],
    recommendations: [],
  }

  const createMockRequest = (
    searchParams: Record<string, string> = {},
    headers: Record<string, string> = {},
  ) => {
    const url = new URL('http://localhost:3000/api/bias-detection/export')
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })

    const defaultHeaders: Record<string, string> = {
      'authorization': 'Bearer valid-token',
      'content-type': 'application/json',
      ...headers,
    }

    return {
      url: url.toString(),
      headers: {
        get: vi.fn((key: string) => defaultHeaders[key.toLowerCase()] || null),
      },
    }
  }

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup logger mocks
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    }
    ;(getLogger as ReturnType<typeof vi.fn>).mockReturnValue(mockLogger)

    // Setup bias engine mocks
    mockBiasEngine = {
      getDashboardData: vi.fn().mockResolvedValue(mockDashboardData),
      exportData: vi.fn(),
    }
    ;(
      BiasDetectionEngine as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => mockBiasEngine)

    // Import GET after mocks are setup
    const exportModule = await import('./export')
    GET = exportModule.GET
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('GET /api/bias-detection/export', () => {
    it('should export data as JSON format by default', async () => {
      const request = createMockRequest()

      // Mock Response
      global.Response = vi
        .fn()
        .mockImplementation((body: string, init?: ResponseInit) => ({
          status: init?.status || 200,
          headers: {
            get: vi.fn((key: string) => {
              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Content-Disposition':
                  'attachment; filename="bias-dashboard-data.json"',
              }
              return headers[key] || null
            }),
          },
          blob: vi
            .fn()
            .mockResolvedValue(new Blob([body], { type: 'application/json' })),
        })) as unknown as typeof Response

      const response = await GET({
        request: request as unknown as Request,
        cookies: {} as Record<string, unknown>,
      })

      expect(response.status).toBe(200)

      // Verify bias engine was called
      expect(mockBiasEngine.getDashboardData).toHaveBeenCalledWith({
        timeRange: '24h',
        includeDetails: false,
      })

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Exporting bias detection data',
        {
          format: 'json',
          timeRange: '24h',
          includeDetails: false,
        },
      )
    })

    it('should export data as CSV format when specified', async () => {
      const request = createMockRequest({ format: 'csv' })

      global.Response = vi
        .fn()
        .mockImplementation((body: string, init?: ResponseInit) => ({
          status: init?.status || 200,
          headers: {
            get: vi.fn((key: string) => {
              const headers: Record<string, string> = {
                'Content-Type': 'text/csv',
                'Content-Disposition':
                  'attachment; filename="bias-dashboard-data.csv"',
              }
              return headers[key] || null
            }),
          },
          blob: vi
            .fn()
            .mockResolvedValue(new Blob([body], { type: 'text/csv' })),
        })) as unknown as typeof Response

      const response = await GET({
        request: request as unknown as Request,
        cookies: {} as Record<string, unknown>,
      })

      expect(response.status).toBe(200)

      // Verify bias engine was called
      expect(mockBiasEngine.getDashboardData).toHaveBeenCalledWith({
        timeRange: '24h',
        includeDetails: false,
      })
    })

    it('should export data as PDF format when specified', async () => {
      const request = createMockRequest({ format: 'pdf' })

      global.Response = vi
        .fn()
        .mockImplementation((body: string, init?: ResponseInit) => ({
          status: init?.status || 200,
          headers: {
            get: vi.fn((key: string) => {
              const headers: Record<string, string> = {
                'Content-Type': 'application/pdf',
                'Content-Disposition':
                  'attachment; filename="bias-dashboard-report.pdf"',
              }
              return headers[key] || null
            }),
          },
          blob: vi
            .fn()
            .mockResolvedValue(new Blob([body], { type: 'application/pdf' })),
        })) as unknown as typeof Response

      const response = await GET({
        request: request as unknown as Request,
        cookies: {} as Record<string, unknown>,
      })

      expect(response.status).toBe(200)

      // Verify bias engine was called
      expect(mockBiasEngine.getDashboardData).toHaveBeenCalledWith({
        timeRange: '24h',
        includeDetails: false,
      })
    })

    it('should handle custom time range parameter', async () => {
      const request = createMockRequest({ timeRange: '7d' })

      global.Response = vi.fn().mockImplementation(() => ({
        status: 200,
        headers: { get: vi.fn(() => 'application/json') },
        blob: vi
          .fn()
          .mockResolvedValue(new Blob(['{}'], { type: 'application/json' })),
      })) as unknown as typeof Response

      const response = await GET({
        request: request as unknown as Request,
        cookies: {} as Record<string, unknown>,
      })

      expect(response.status).toBe(200)

      // Verify bias engine was called with custom time range
      expect(mockBiasEngine.getDashboardData).toHaveBeenCalledWith({
        timeRange: '7d',
        includeDetails: false,
      })
    })

    it('should handle includeDetails parameter', async () => {
      const request = createMockRequest({ includeDetails: 'true' })

      global.Response = vi.fn().mockImplementation(() => ({
        status: 200,
        headers: { get: vi.fn(() => 'application/json') },
        blob: vi
          .fn()
          .mockResolvedValue(new Blob(['{}'], { type: 'application/json' })),
      })) as unknown as typeof Response

      const response = await GET({
        request: request as unknown as Request,
        cookies: {} as Record<string, unknown>,
      })

      expect(response.status).toBe(200)

      // Verify bias engine was called with includeDetails
      expect(mockBiasEngine.getDashboardData).toHaveBeenCalledWith({
        timeRange: '24h',
        includeDetails: true,
      })
    })

    it('should handle multiple parameters', async () => {
      const request = createMockRequest({
        format: 'csv',
        timeRange: '30d',
        includeDetails: 'true',
      })

      global.Response = vi.fn().mockImplementation(() => ({
        status: 200,
        headers: { get: vi.fn(() => 'text/csv') },
        blob: vi
          .fn()
          .mockResolvedValue(new Blob(['csv data'], { type: 'text/csv' })),
      })) as unknown as typeof Response

      const response = await GET({
        request: request as unknown as Request,
        cookies: {} as Record<string, unknown>,
      })

      expect(response.status).toBe(200)

      // Verify bias engine was called with all parameters
      expect(mockBiasEngine.getDashboardData).toHaveBeenCalledWith({
        timeRange: '30d',
        includeDetails: true,
      })

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Exporting bias detection data',
        {
          format: 'csv',
          timeRange: '30d',
          includeDetails: true,
        },
      )
    })

    it('should handle bias detection engine errors', async () => {
      const error = new Error('Database connection failed')
      mockBiasEngine.getDashboardData.mockRejectedValue(error)

      const request = createMockRequest()

      global.Response = vi
        .fn()
        .mockImplementation((body: string, init?: ResponseInit) => ({
          status: init?.status || 500,
          json: vi.fn().mockResolvedValue(JSON.parse(body) as unknown),
          headers: { get: vi.fn(() => 'application/json') },
        })) as unknown as typeof Response

      const response = await GET({
        request: request as unknown as Request,
        cookies: {} as Record<string, unknown>,
      })

      expect(response.status).toBe(500)

      // Verify error logging
      expect(mockLogger.error).toHaveBeenCalledWith('Export failed', { error })
    })

    it('should handle invalid format parameter gracefully', async () => {
      const request = createMockRequest({ format: 'invalid' })

      global.Response = vi.fn().mockImplementation(() => ({
        status: 200,
        headers: { get: vi.fn(() => 'application/json') },
        blob: vi
          .fn()
          .mockResolvedValue(new Blob(['{}'], { type: 'application/json' })),
      })) as unknown as typeof Response

      const response = await GET({
        request: request as unknown as Request,
        cookies: {} as Record<string, unknown>,
      })

      expect(response.status).toBe(200)

      // Should fall back to JSON format
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Exporting bias detection data',
        expect.objectContaining({
          format: 'invalid', // API passes through, engine handles validation
        }),
      )
    })
  })
})
