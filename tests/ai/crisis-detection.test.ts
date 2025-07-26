import type {
  CrisisDetectionOptions,
  CrisisDetectionResult,
} from '../../lib/ai/crisis/types.js'
import type { AICompletion } from '../../lib/ai/AIService.js'
// LOG: Updated imports to use relative paths matching actual file structure

// Mock the entire modules
vi.mock('../../lib/ai/AIService.js')
vi.mock('../../lib/logger/getAppLogger.js', () => ({
  getAppLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))
// LOG: Updated mocks to use relative paths

describe('crisisDetectionService', () => {
  let crisisService: any // Using 'any' to simplify dynamic import gymnastics
  let getAppLogger: any // Will hold the dynamically imported mock
  const mockAIService = {
    createChatCompletion: vi.fn(),
    // Add other methods as needed for the tests
  }
  // LOG: Use plain object for mockAIService since AIService is a type, not a class

  beforeEach(async () => {
    // Must reset modules to ensure we get a fresh, mockable instance of the service and its dependencies
    vi.resetModules()

    // Dynamically import the modules AFTER resetting
    const loggerModule = await import('../../lib/logger/getAppLogger.js')
    getAppLogger = loggerModule.getAppLogger

    const serviceModule = await import(
      '../../lib/ai/services/crisis-detection.js'
    )
    crisisService = new serviceModule.CrisisDetectionService({
      aiService: mockAIService,
    })
    // LOG: Updated dynamic imports to use relative paths

    // Clear mocks before each test run
    vi.clearAllMocks()
  })

  describe('detectCrisis', () => {
    it('should detect high-risk crisis correctly', async () => {
      const text = 'I want to kill myself right now'
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'high',
        userId: 'user123',
        source: 'test',
      }

      vi.mocked(mockAIService.createChatCompletion).mockResolvedValue({
        content: JSON.stringify({
          score: 0.9,
          category: 'suicide_risk',
          severity: 'critical',
          indicators: ['kill myself', 'right now'],
          recommendations: ['Contact emergency services'],
        }),
      } as AICompletion)

      const result: CrisisDetectionResult = await crisisService.detectCrisis(
        text,
        options,
      )

      expect(result.isCrisis).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.category).toBe('suicide_risk')
      expect(result.riskLevel).toBe('critical')
    })

    it('should detect medium-risk crisis correctly', async () => {
      const text = 'I feel so hopeless and worthless'
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'medium',
        userId: 'user123',
        source: 'test',
      }

      vi.mocked(mockAIService.createChatCompletion).mockResolvedValue({
        content: JSON.stringify({ score: 0.6, category: 'severe_depression' }),
      } as AICompletion)

      const result = await crisisService.detectCrisis(text, options)

      expect(result.isCrisis).toBe(true)
      expect(result.confidence).toBeCloseTo(0.6)
      expect(result.category).toBe('severe_depression')
      expect(result.riskLevel).toBe('high')
    })

    it('should detect low-risk crisis correctly', async () => {
      const text = 'I am feeling very sad and overwhelmed'
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'low',
        userId: 'user123',
        source: 'test',
      }

      vi.mocked(mockAIService.createChatCompletion).mockResolvedValue({
        content: JSON.stringify({ score: 0.3, category: 'moderate_concern' }),
      } as AICompletion)

      const result = await crisisService.detectCrisis(text, options)

      expect(result.isCrisis).toBe(false)
      expect(result.confidence).toBeGreaterThan(0.3)
    })

    it('should correctly identify non-crisis text', async () => {
      const text = 'I am having a great day'
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'high',
        userId: 'user123',
        source: 'test',
      }

      const result = await crisisService.detectCrisis(text, options)

      expect(result.isCrisis).toBe(false)
      expect(result.confidence).toBe(0)
    })

    it('should handle invalid JSON responses from AI', async () => {
      const text = 'I am in immediate danger'
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'high',
        userId: 'user123',
        source: 'test',
      }

      vi.mocked(mockAIService.createChatCompletion).mockResolvedValue({
        content: 'This is not valid JSON',
      } as AICompletion)

      const result = await crisisService.detectCrisis(text, options)

      expect(result).toBeDefined()
      expect(result.isCrisis).toBe(true) // Based on keyword
      expect(result.category).toBe('emergency') // Fallback to keyword analysis is correct
      expect(result.riskLevel).toBe('critical')
    })

    it('should handle AI service errors', async () => {
      const text = 'I want to hurt myself'
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'high',
        userId: 'user123',
        source: 'test',
      }
      const errorMessage = 'AI service is down'
      vi.mocked(mockAIService.createChatCompletion).mockRejectedValue(
        new Error(errorMessage),
      )

      await expect(crisisService.detectCrisis(text, options)).rejects.toThrow(
        'Crisis detection analysis failed',
      )

      expect(getAppLogger.error).toHaveBeenCalledWith(
        'Error in crisis detection:',
        expect.objectContaining({
          message: 'Crisis detection analysis failed',
        }),
      )
    })

    it('should respect sensitivity level', async () => {
      const text = 'I am struggling and cant cope'
      const lowSensOptions: CrisisDetectionOptions = {
        sensitivityLevel: 'low',
        userId: 'user123',
        source: 'test',
      }
      const highSensOptions: CrisisDetectionOptions = {
        sensitivityLevel: 'high',
        userId: 'user123',
        source: 'test',
      }

      const resultLow = await crisisService.detectCrisis(text, lowSensOptions)
      const resultHigh = await crisisService.detectCrisis(text, highSensOptions)

      expect(resultLow.isCrisis).toBe(false) // Score might be ~0.4, not crisis for low
      expect(resultHigh.isCrisis).toBe(true) // Score ~0.4 is crisis for high
    })

    it('should handle batch processing correctly', async () => {
      const texts = [
        'I want to end my life',
        'I am feeling great today',
        'I am in unbearable pain',
      ]
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'high',
        userId: 'user123',
        source: 'test',
      }

      vi.mocked(mockAIService.createChatCompletion)
        .mockResolvedValueOnce({
          content: JSON.stringify({ score: 0.9 }),
        } as AICompletion)
        .mockResolvedValueOnce({
          content: JSON.stringify({ score: 0.1 }),
        } as AICompletion)
        .mockResolvedValueOnce({
          content: JSON.stringify({ score: 0.7 }),
        } as AICompletion)

      const results = await crisisService.detectBatch(texts, options)

      expect(results).toHaveLength(3)
      expect(results[0].isCrisis).toBe(true)
      expect(results[1].isCrisis).toBe(false)
      expect(results[2].isCrisis).toBe(true)

      // AI service should be called for each text
      expect(mockAIService.createChatCompletion).toHaveBeenCalledTimes(3)
    })
  })
})
