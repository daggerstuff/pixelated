import type {
  EmotionAnalysis,
  PatternRecognitionService,
  TherapySession,
} from '../../../ai/services/pattern-recognition-types'
import { createPatternRecognitionService } from '../../../ai/services/PatternRecognitionFactory'


// Mock FHE service for testing
const mockFHEService: ExtendedFHEService = {
  encrypt: async (_: unknown) => 'encrypted_data',
  decrypt: async (_: string) => 'decrypted_data',
  encryptText: async (text: string) => text,
  decryptText: async (text: string) => text,
  generateHash: async (data: string) => data,
  processPatterns: async () => ({
    data: 'encrypted_data',
    metadata: { operation: 'test', timestamp: Date.now() },
  }),
  decryptPatterns: async () => [
    {
      type: 'recurring_anxiety',
      startTime: new Date(),
      endTime: new Date(),
      significance: 0.8,
      confidence: 0.9,
      description: 'Test pattern',
      relatedFactors: ['anxiety'],
      recommendations: [],
    },
  ],
  analyzeCrossSessions: async () => ({
    data: 'encrypted_data',
    metadata: { operation: 'test', timestamp: Date.now() },
  }),
  decryptCrossSessionAnalysis: async () => [
    {
      type: 'sleep_anxiety_correlation',
      sessions: ['session1', 'session2'],
      pattern: 'test pattern',
      frequency: 0.8,
      confidence: 0.9,
      impact: 'high',
      recommendations: [],
    },
  ],
  processRiskCorrelations: async () => ({
    data: 'encrypted_data',
    metadata: { operation: 'test', timestamp: Date.now() },
  }),
  decryptRiskCorrelations: async () => [
    {
      primaryFactor: 'anxiety',
      correlatedFactors: [
        {
          factor: 'sleep',
          correlation: 0.8,
          confidence: 0.9,
        },
      ],
      timeFrame: {
        start: new Date(),
        end: new Date(),
      },
      severity: 'high',
      actionRequired: true,
    },
  ],
}

vi.mock('../../../fhe/pattern-recognition-factory', () => ({
  createPatternRecognitionFHEService: vi.fn(async () => mockFHEService),
}))


describe('patternRecognition Integration', () => {
  let patternService: PatternRecognitionService
  const testId = 'test-id'

  beforeEach(async () => {
    patternService = await createPatternRecognitionService()
  })

  describe('pattern Detection', () => {
    it('should detect simple patterns', async () => {
      const userId = 'user123'
      const startDate = new Date(Date.now() - 3000)
      const endDate = new Date()

      const patterns = await patternService.analyzeLongTermTrends(
        userId,
        startDate,
        endDate,
      )
      expect(patterns).toContainEqual(
        expect.objectContaining({
          type: 'recurring_anxiety',
          confidence: expect.any(Number),
        }),
      )
    })

    it('should detect complex patterns', async () => {
      const userId = 'user123'
      const sessions: TherapySession[] = [
        {
          sessionId: '1',
          clientId: testId,
          therapistId: 'therapist1',
          startTime: new Date(),
          status: 'completed',
          emotionAnalysisEnabled: true,
        },
        {
          sessionId: '2',
          clientId: testId,
          therapistId: 'therapist1',
          startTime: new Date(),
          status: 'completed',
          emotionAnalysisEnabled: true,
        },
      ]

      const patterns = await patternService.detectCrossSessionPatterns(
        userId,
        sessions,
      )
      expect(patterns).toContainEqual(
        expect.objectContaining({
          type: 'behavioral',
          confidence: expect.any(Number),
        }),
      )
    })
  })

  describe('pattern Analysis', () => {
    it('should analyze risk factor correlations', async () => {
      const userId = 'user123'
      const analyses: EmotionAnalysis[] = [
        {
          timestamp: new Date(),
          emotions: [{ type: 'anxiety', confidence: 0.8, intensity: 0.7 }],
          overallSentiment: 0.5,
          riskFactors: [{ type: 'anxiety', severity: 0.7, confidence: 0.8 }],
          requiresAttention: false,
        },
        {
          timestamp: new Date(),
          emotions: [{ type: 'anxiety', confidence: 0.9, intensity: 0.8 }],
          overallSentiment: 0.4,
          riskFactors: [{ type: 'anxiety', severity: 0.8, confidence: 0.9 }],
          requiresAttention: true,
        },
      ]

      const correlations = await patternService.analyzeRiskFactorCorrelations(
        userId,
        analyses,
      )
      expect(correlations).toContainEqual(
        expect.objectContaining({
          primaryFactor: 'anxiety',
          correlatedFactors: expect.arrayContaining([
            expect.objectContaining({
              factor: 'sleep',
              correlation: expect.any(Number),
            }),
          ]),
        }),
      )
    })
  })
})
