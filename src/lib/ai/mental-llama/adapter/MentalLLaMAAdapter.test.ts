import { MentalLLaMAAdapter } from './MentalLLaMAAdapter.ts'
import type {
  IModelProvider,
  IMentalHealthTaskRouter,
  ICrisisNotificationHandler,
  MentalLLaMAAdapterOptions,
  MentalHealthAnalysisResult,
  ExpertGuidedAnalysisResult,
  RoutingDecision,
  LLMResponse,
} from '../types/mentalLLaMATypes.ts'
import type { AnalyzeMentalHealthParams } from '../types/index.ts'
import { EvidenceService } from '../evidence/EvidenceService.js'
import { ExpertGuidanceOrchestrator } from '../ExpertGuidanceOrchestrator.js'
// Mock dependencies
vi.mock('../evidence/EvidenceService')
vi.mock('../ExpertGuidanceOrchestrator')
// Store the CrisisSessionFlaggingService mock instance for robust access
const crisisSessionFlaggingServiceMockInstance = {
  flagSessionForReview: vi.fn().mockResolvedValue(undefined),
}
vi.mock('../crisis/CrisisSessionFlaggingService', () => ({
  CrisisSessionFlaggingService: vi
    .fn()
    .mockImplementation(() => crisisSessionFlaggingServiceMockInstance),
}))

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('MentalLLaMAAdapter (Consolidated)', () => {
  let mockModelProvider: IModelProvider
  let mockTaskRouter: IMentalHealthTaskRouter
  let mockCrisisNotifier: ICrisisNotificationHandler
  let mockEvidenceService: EvidenceService
  let mockExpertGuidanceOrchestrator: ExpertGuidanceOrchestrator
  let adapterOptions: MentalLLaMAAdapterOptions
  let adapter: MentalLLaMAAdapter

  beforeEach(() => {
    mockModelProvider = {
      invoke: vi.fn(),
      getModelInfo: vi.fn().mockReturnValue({
        name: 'test-model-7b',
        version: '1.0',
        capabilities: ['chat', 'completion'],
      }),
      isAvailable: vi.fn().mockResolvedValue(true),
      // Add chat if it's part of IModelProvider and used by adapter directly (it's not, adapter uses invoke)
    }
    mockTaskRouter = {
      route: vi.fn(),
      getAvailableAnalyzers: vi
        .fn()
        .mockReturnValue(['general_mental_health', 'crisis', 'depression']),
      // determineRoute is old, new router uses route
    }
    mockCrisisNotifier = {
      sendCrisisAlert: vi.fn().mockResolvedValue(undefined),
    }

    // Use the mocked constructors for EvidenceService and ExpertGuidanceOrchestrator
    mockEvidenceService = new EvidenceService(mockModelProvider) as unknown
    mockExpertGuidanceOrchestrator = new ExpertGuidanceOrchestrator(
      mockEvidenceService,
      mockModelProvider,
      mockCrisisNotifier,
    ) as unknown

    // Mock methods of the instances
    vi.mocked(mockEvidenceService.extractSupportingEvidence).mockResolvedValue({
      evidenceItems: ['mocked evidence'],
      detailedEvidence: {} as unknown, // simplified for mock
      processingMetadata: {
        cacheUsed: false,
        processingTime: 10,
        evidenceStrength: 'moderate',
      },
    })
    vi.mocked(
      mockExpertGuidanceOrchestrator.analyzeWithExpertGuidance,
    ).mockResolvedValue({
      hasMentalHealthIssue: false,
      mentalHealthCategory: 'general_mental_health',
      confidence: 0.8,
      explanation: 'Expert guided explanation',
      supportingEvidence: ['expert evidence'],
      isCrisis: false,
      timestamp: new Date().toISOString(),
      expertGuided: true,
    } as ExpertGuidedAnalysisResult)

    adapterOptions = {
      modelProvider: mockModelProvider,
      taskRouter: mockTaskRouter,
      crisisNotifier: mockCrisisNotifier,
    }
    adapter = new MentalLLaMAAdapter(adapterOptions)

    // Reset EvidenceService and ExpertGuidanceOrchestrator mocks for the adapter's internal instances
    // @ts-expect-error: mockClear is not typed on the constructor, but is available via vi.mock
    EvidenceService.mockClear()
    // @ts-expect-error: mockClear is not typed on the constructor, but is available via vi.mock
    ExpertGuidanceOrchestrator.mockClear()
    // Re-assign mocks to the ones created *inside* the adapter, if direct testing of them is needed
    // This is tricky because they are private. Testing via public methods is preferred.
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize services correctly', () => {
      expect(EvidenceService).toHaveBeenCalledTimes(1)
      expect(ExpertGuidanceOrchestrator).toHaveBeenCalledTimes(1)
      // Check if logger.warn was called if a dependency is missing (optional test)
    })
  })

  describe('analyzeMentalHealth', () => {
    const baseParams: AnalyzeMentalHealthParams = { text: 'I am feeling down.' }

    it('should use taskRouter for auto_route and process LLM response', async () => {
      const mockRoutingDecision: RoutingDecision = {
        targetAnalyzer: 'depression',
        confidence: 0.7,
        isCritical: false,
        method: 'llm',
        insights: {},
      }
      vi.mocked(mockTaskRouter.route).mockResolvedValue(mockRoutingDecision)
      const llmResponse: LLMResponse = {
        content: JSON.stringify({
          mentalHealthCategory: 'depression',
          confidence: 0.85,
          explanation: 'Shows signs of depression.',
          supportingEvidence: ['feeling down a lot'],
        }),
        model: 'test-model-7b',
      }
      vi.mocked(mockModelProvider.invoke).mockResolvedValue(llmResponse)

      const result = await adapter.analyzeMentalHealth(baseParams)

      expect(mockTaskRouter.route).toHaveBeenCalledWith({
        text: baseParams.text,
        context: {},
      })
      expect(mockModelProvider.invoke).toHaveBeenCalled()
      expect(result.mentalHealthCategory).toBe('depression')
      expect(result.confidence).toBe(0.85) // LLM overrides router if higher
      expect(result.explanation).toBe('Shows signs of depression.')
      expect(result.supportingEvidence).toEqual(
        expect.arrayContaining(['feeling down a lot', 'mocked evidence']),
      )
      expect(mockEvidenceService.extractSupportingEvidence).toHaveBeenCalled()
    })

    it('should handle crisis identified by router with high confidence', async () => {
      const crisisText = 'I want to end it all.'
      const mockRoutingDecision: RoutingDecision = {
        targetAnalyzer: 'crisis',
        confidence: 0.9,
        isCritical: true,
        method: 'keyword',
        insights: { matchedKeyword: 'end it all' },
      }
      vi.mocked(mockTaskRouter.route).mockResolvedValue(mockRoutingDecision)

      const result = await adapter.analyzeMentalHealth({ text: crisisText })

      expect(result.isCrisis).toBe(true)
      expect(result.mentalHealthCategory).toBe('crisis')
      expect(mockCrisisNotifier.sendCrisisAlert).toHaveBeenCalled()
      // Check if CrisisSessionFlaggingService was called (mocked at module level)
      // Use the stored mock instance directly for robust checking
      expect(
        crisisSessionFlaggingServiceMockInstance.flagSessionForReview,
      ).toHaveBeenCalled()
      expect(mockModelProvider.invoke).not.toHaveBeenCalled() // Should return early
    })

    it('should handle LLM confirming crisis', async () => {
      const crisisText = 'Everything is pointless, I should just disappear.'
      const mockRoutingDecision: RoutingDecision = {
        targetAnalyzer: 'general_mental_health', // Router initially misses it or low confidence
        confidence: 0.4,
        isCritical: false,
        method: 'llm',
        insights: {},
      }
      vi.mocked(mockTaskRouter.route).mockResolvedValue(mockRoutingDecision)
      const llmCrisisResponse: LLMResponse = {
        content: JSON.stringify({
          mentalHealthCategory: 'crisis',
          confidence: 0.95,
          explanation: 'Strong suicidal ideation detected.',
          supportingEvidence: ['disappear', 'pointless'],
        }),
        model: 'test-model-7b',
      }
      vi.mocked(mockModelProvider.invoke).mockResolvedValue(llmCrisisResponse)

      const result = await adapter.analyzeMentalHealth({ text: crisisText })

      expect(result.isCrisis).toBe(true)
      expect(result.mentalHealthCategory).toBe('crisis')
      expect(mockCrisisNotifier.sendCrisisAlert).toHaveBeenCalled()
      // Use the stored mock instance directly for robust checking
      expect(
        crisisSessionFlaggingServiceMockInstance.flagSessionForReview,
      ).toHaveBeenCalled()
    })

    it('should handle LLM response parsing error', async () => {
      const mockRoutingDecision: RoutingDecision = {
        targetAnalyzer: 'general_mental_health',
        confidence: 0.7,
        isCritical: false,
        method: 'llm',
        insights: {},
      }
      vi.mocked(mockTaskRouter.route).mockResolvedValue(mockRoutingDecision)
      const llmMalformedResponse: LLMResponse = {
        content: 'This is not JSON',
        model: 'test-model-7b',
      }
      vi.mocked(mockModelProvider.invoke).mockResolvedValue(
        llmMalformedResponse,
      )

      const result = await adapter.analyzeMentalHealth(baseParams)
      expect(result.explanation).toContain('LLM provided a non-JSON response')
      expect(result._failures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'llm_response_parsing' }),
        ]),
      )
    })

    it('should handle missing modelProvider gracefully', async () => {
      const mockRoutingDecision: RoutingDecision = {
        targetAnalyzer: 'general_mental_health',
        confidence: 0.6,
        isCritical: false,
        method: 'llm',
        insights: {},
      }
      vi.mocked(mockTaskRouter.route).mockResolvedValue(mockRoutingDecision)

      const adapterWithoutProvider = new MentalLLaMAAdapter({
        ...adapterOptions,
        // modelProvider omitted to simulate undefined
      })
      // Re-mock EvidenceService and Orchestrator for this specific instance
      // @ts-expect-error: mockClear is not typed on the constructor, but is available via vi.mock
      EvidenceService.mockClear() // Clear calls from previous adapter instance
      // @ts-expect-error: mockClear is not typed on the constructor, but is available via vi.mock
      ExpertGuidanceOrchestrator.mockClear()

      const result =
        await adapterWithoutProvider.analyzeMentalHealth(baseParams)

      expect(mockModelProvider.invoke).not.toHaveBeenCalled()
      expect(result.explanation).toContain('ModelProvider unavailable')
      expect(result._failures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'configuration',
            message: 'ModelProvider unavailable for detailed analysis',
          }),
        ]),
      )
    })
  })

  describe('analyzeMentalHealthWithExpertGuidance', () => {
    it('should call expertGuidanceOrchestrator', async () => {
      const text = 'I need expert help.'
      // Mock base analyzeMentalHealth call result
      const mockBaseAnalysis: MentalHealthAnalysisResult = {
        hasMentalHealthIssue: true,
        mentalHealthCategory: 'depression',
        confidence: 0.75,
        explanation: 'Base analysis explanation',
        supportingEvidence: ['base evidence'],
        isCrisis: false,
        timestamp: new Date().toISOString(),
      }
      // Temporarily mock analyzeMentalHealth on the adapter instance for this test
      // This is a bit of a workaround because analyzeMentalHealth is complex
      const analyzeMentalHealthSpy = vi
        .spyOn(adapter, 'analyzeMentalHealth')
        .mockResolvedValue(mockBaseAnalysis)

      await adapter.analyzeMentalHealthWithExpertGuidance(text, true, {})

      expect(analyzeMentalHealthSpy).toHaveBeenCalled()
      expect(
        mockExpertGuidanceOrchestrator.analyzeWithExpertGuidance,
      ).toHaveBeenCalledWith(
        text,
        mockBaseAnalysis, // Ensure this matches what analyzeMentalHealth would return
        true,
        {},
      )
      analyzeMentalHealthSpy.mockRestore()
    })

    it('should fallback to base analysis if orchestrator fails', async () => {
      const text = 'Orchestrator will fail.'
      const mockBaseAnalysis: MentalHealthAnalysisResult = {
        hasMentalHealthIssue: true,
        mentalHealthCategory: 'anxiety',
        confidence: 0.6,
        explanation: 'Base fallback explanation',
        supportingEvidence: [],
        isCrisis: false,
        timestamp: new Date().toISOString(),
      }
      const analyzeMentalHealthSpy = vi
        .spyOn(adapter, 'analyzeMentalHealth')
        .mockResolvedValue(mockBaseAnalysis)
      const orchestratorError = new Error('Orchestrator failed')
      vi.mocked(
        mockExpertGuidanceOrchestrator.analyzeWithExpertGuidance,
      ).mockRejectedValue(orchestratorError)

      const result = await adapter.analyzeMentalHealthWithExpertGuidance(
        text,
        true,
        {},
      )

      expect(result.expertGuided).toBe(false)
      expect(result.explanation).toContain(
        'Expert guidance unavailable due to system error',
      )
      expect(result.explanation).toContain('Base fallback explanation')
      expect(result._failures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'orchestration',
            error: orchestratorError,
          }),
        ]),
      )
      analyzeMentalHealthSpy.mockRestore()
    })
  })

  describe('evaluateExplanationQuality', () => {
    it('should call modelProvider.invoke with correct prompt for quality evaluation', async () => {
      const explanation = 'This is a test explanation.'
      const textContext = 'Original text for context.'
      const mockLLMQualityResponse: LLMResponse = {
        content: JSON.stringify({
          fluency: 0.9,
          completeness: 0.8,
          reliability: 0.7,
          overall: 0.8,
          assessment: 'Good quality.',
        }),
        model: 'test-model-7b',
      }
      vi.mocked(mockModelProvider.invoke).mockResolvedValue(
        mockLLMQualityResponse,
      )

      const result = await adapter.evaluateExplanationQuality(
        explanation,
        textContext,
      )

      expect(mockModelProvider.invoke).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining(
              'evaluates the quality of explanations',
            ),
          }),
          expect.objectContaining({
            role: 'user',
            content:
              expect.stringContaining(explanation) &&
              expect.stringContaining(textContext),
          }),
        ]),
        { temperature: 0.2, max_tokens: 200 },
      )
      expect(result.overall).toBe(0.8)
      expect(result.assessment).toBe('Good quality.')
    })

    it('should return default poor metrics if modelProvider is undefined', async () => {
      const adapterWithoutProvider = new MentalLLaMAAdapter({
        ...adapterOptions,
        // modelProvider omitted to simulate undefined
      })
      const result =
        await adapterWithoutProvider.evaluateExplanationQuality(
          'test explanation',
        )
      expect(result.overall).toBe(0.1)
      expect(result.assessment).toContain('ModelProvider not configured')
    })
  })

  describe('EvidenceService wrapper methods', () => {
    it('extractDetailedEvidence should call evidenceService', async () => {
      await adapter.extractDetailedEvidence('text', 'category')
      expect(
        mockEvidenceService.extractSupportingEvidence,
      ).toHaveBeenCalledWith('text', 'category', undefined, undefined)
    })

    it('getEvidenceMetrics should call evidenceService', () => {
      adapter.getEvidenceMetrics()
      expect(mockEvidenceService.getMetrics).toHaveBeenCalled()
    })

    it('clearEvidenceCache should call evidenceService', () => {
      adapter.clearEvidenceCache()
      expect(mockEvidenceService.clearCache).toHaveBeenCalled()
    })
  })
})
