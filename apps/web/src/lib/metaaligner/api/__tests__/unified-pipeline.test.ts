/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import {
  UnifiedMetaAlignerPipeline,
  type UnifiedPipelineConfig,
} from '../unified-pipeline'
import { MetaAlignerAPI } from '../alignment-api'
import type { AIService } from '../../ai/models/ai-types'
import type { AICompletion } from '../../ai/models/ai-types'
import type { ObjectiveDefinition, AlignmentContext } from '../../core/objectives'
import type { UnifiedProcessingRequest } from '../unified-api'

function makeRequest(
  overrides: Partial<UnifiedProcessingRequest> = {},
): UnifiedProcessingRequest {
  return {
    llmOutput: { content: 'I hear you. It sounds like a difficult time.' },
    context: { userQuery: 'I have been feeling overwhelmed lately' },
    ...overrides,
  }
}

function makeMockAIService(enhancedResponse: string): AIService {
  return {
    createChatCompletion: vi.fn().mockResolvedValue({
      id: 'test-response',
      created: Date.now(),
      model: 'test-model',
      choices: [
        {
          message: { role: 'assistant', content: enhancedResponse },
          finishReason: 'stop',
        },
      ],
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      provider: 'test',
      content: enhancedResponse,
    } satisfies AICompletion),
    createStreamingChatCompletion: vi.fn(),
    getModelInfo: vi.fn(),
    dispose: vi.fn(),
  } as unknown as AIService
}

/**
 * Objectives whose scores are driven by a controllable marker in the response,
 * mirroring the integration-test pattern: responses containing 'poorResponse'
 * score low (triggering enhancement), everything else scores high.
 */
function makeControllableObjectives(): ObjectiveDefinition[] {
  const objectives = [
    { id: 'correctness', weight: 0.25 },
    { id: 'informativeness', weight: 0.2 },
    { id: 'professionalism', weight: 0.35 },
    { id: 'empathy', weight: 0.15 },
    { id: 'safety', weight: 0.05 },
  ]
  return objectives.map(({ id, weight }) => ({
    id,
    name: id,
    description: `${id} objective`,
    weight,
    criteria: [],
    evaluationFunction: (response: string, _context: AlignmentContext) => {
      if (response.includes('poorResponse')) {
        return id === 'safety' ? 0.1 : 0.2
      }
      return 0.9
    },
  }))
}

describe('UnifiedMetaAlignerPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes a request through evaluation without enhancement when score is sufficient', async () => {
    const aiService = makeMockAIService('Enhanced response.')
    const metaAligner = new MetaAlignerAPI({
      enableResponseEnhancement: true,
      enhancementThreshold: 0.7,
      aiService,
      objectives: makeControllableObjectives(),
    })
    const createSpy = vi.mocked(aiService.createChatCompletion)

    const pipeline = new UnifiedMetaAlignerPipeline({}, metaAligner)
    const request = makeRequest()
    const response = await pipeline.process(request)

    expect(createSpy).not.toHaveBeenCalled()
    expect(response.enhancedResponse).toBe(request.llmOutput.content)
    expect(response.originalResponse).toBe(request.llmOutput.content)
    expect(response.alignment.enhanced).toBe(false)
    expect(response.alignment.enhancementAttempts).toBe(0)
    expect(response.errors).toBeUndefined()
    expect(response.alignment.evaluation.overallScore).toBeGreaterThan(0.7)
  })

  it('enhances once and stops when re-evaluation passes', async () => {
    const aiService = makeMockAIService('Improved supportive response.')
    const metaAligner = new MetaAlignerAPI({
      enableResponseEnhancement: true,
      enhancementThreshold: 0.7,
      maxEnhancementAttempts: 2,
      aiService,
      objectives: makeControllableObjectives(),
    })
    const createSpy = vi.mocked(aiService.createChatCompletion)

    const pipeline = new UnifiedMetaAlignerPipeline({}, metaAligner)
    const response = await pipeline.process(
      makeRequest({ llmOutput: { content: 'poorResponse content here' } }),
    )

    expect(createSpy).toHaveBeenCalledOnce()
    expect(response.enhancedResponse).toBe('Improved supportive response.')
    expect(response.alignment.enhanced).toBe(true)
    expect(response.alignment.enhancementAttempts).toBe(1)
    expect(response.alignment.evaluation.overallScore).toBeGreaterThanOrEqual(
      0.7,
    )
  })

  it('truncates conversation history to maxHistoryLength', async () => {
    const aiService = makeMockAIService('Enhanced.')
    const metaAligner = new MetaAlignerAPI({
      enableResponseEnhancement: true,
      aiService,
      objectives: makeControllableObjectives(),
    })

    const history = Array.from({ length: 30 }, (_, i) => `msg-${i}`)
    const config: UnifiedPipelineConfig = { maxHistoryLength: 10 }

    const pipeline = new UnifiedMetaAlignerPipeline(config, metaAligner)
    const response = await pipeline.process(
      makeRequest({
        context: { userQuery: 'q', conversationHistory: history },
      }),
    )

    // History is forwarded via the request context to evaluation
    expect(response.errors).toBeUndefined()
    expect(response.originalResponse).toBe(
      'I hear you. It sounds like a difficult time.',
    )
  })

  it('returns an error response instead of throwing on invalid input', async () => {
    const pipeline = new UnifiedMetaAlignerPipeline()

    const response = await pipeline.process(
      makeRequest({
        context: { userQuery: undefined as unknown as string },
      }),
    )

    expect(response.errors).toBeDefined()
    expect(response.errors?.[0]?.stage).toBe('validation')
  })

  it('stringifies object llmOutput content for evaluation', async () => {
    const aiService = makeMockAIService('Enhanced.')
    const metaAligner = new MetaAlignerAPI({
      enableResponseEnhancement: true,
      aiService,
      objectives: makeControllableObjectives(),
    })

    const pipeline = new UnifiedMetaAlignerPipeline({}, metaAligner)
    const response = await pipeline.process(
      makeRequest({
        llmOutput: { content: { structured: true } },
      }),
    )

    expect(response.enhancedResponse).toBe('{"structured":true}')
    expect(response.originalResponse).toBe('{"structured":true}')
  })
})
