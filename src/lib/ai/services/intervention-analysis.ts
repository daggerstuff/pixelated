import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const appLogger = createBuildSafeLogger('app')
import type { AIMessage, AIService, AIServiceOptions } from '../models/ai-types'

export interface InterventionAnalysisOptions {
  customPrompt?: string
  aiOptions?: AIServiceOptions
}

export interface InterventionAnalysisResult {
  // Align with existing test expectations
  effectiveness_score: number
  user_receptiveness: string
  emotional_impact: string
  key_insights: string[]
  improvement_suggestions: string[]
  /** Added metadata */
  model: string
  processingTime: number
}

export interface InterventionAnalysisBatchItem {
  conversation: AIMessage[]
  interventionMessage: string
  userResponse: string
  options?: InterventionAnalysisOptions
}

export interface InterventionAnalysisServiceConfig {
  aiService: AIService
  model?: string
  /** Optional system prompt that prefixes every analysis request */
  systemPrompt?: string
}

/**
 * Service responsible for analysing the effectiveness of therapeutic interventions.
 * It leverages an underlying AIService implementation to obtain structured JSON feedback.
 */
export class InterventionAnalysisService {
  private readonly aiService: AIService
  private readonly model: string
  private readonly systemPrompt: string

  constructor(config: InterventionAnalysisServiceConfig) {
    const {
      aiService,
      model = 'mistralai/Mixtral-8x7B-Instruct-v0.2',
      systemPrompt = 'You are an expert mental-health assistant. Return ONLY valid JSON with the requested keys, no markdown or additional commentary.',
    } = config

    this.aiService = aiService
    this.model = model
    this.systemPrompt = systemPrompt
  }

  /**
   * Analyse a single intervention.
   */
  async analyzeIntervention(
    conversation: AIMessage[],
    interventionMessage: string,
    userResponse: string,
    options: InterventionAnalysisOptions = {},
  ): Promise<InterventionAnalysisResult> {
    const startTime = Date.now()

    // Build user prompt
    const basePrompt =
      'Please analyse the effectiveness of the following therapeutic intervention within the context of the conversation provided.  Return **ONLY** valid JSON with these exact keys: effectiveness_score (1-10), user_receptiveness (low/medium/high), emotional_impact (positive/neutral/negative), key_insights (array of strings), improvement_suggestions (array of strings).'
    const mergedPrompt = options.customPrompt
      ? `${basePrompt}\n\n${options.customPrompt}`
      : basePrompt

    const userContent = `${mergedPrompt}

Conversation:
${JSON.stringify(conversation, null, 2)}

Intervention message:
"${interventionMessage}"

User response:
"${userResponse}"`

    const messages: AIMessage[] = [
      { role: 'system', content: this.systemPrompt, name: 'system' },
      { role: 'user', content: userContent, name: 'user' },
    ]

    try {
      // Some AIService implementations expose createChatCompletion, others expose generateCompletion.
      const completionProvider =
        (this.aiService.createChatCompletion?.bind(this.aiService) as
          | typeof this.aiService.createChatCompletion
          | undefined) ||
        (this.aiService.generateCompletion?.bind(this.aiService) as
          | typeof this.aiService.generateCompletion
          | undefined)

      if (!completionProvider) {
        throw new Error(
          'Provided AI service does not support createChatCompletion or generateCompletion.',
        )
      }

      const completion = await completionProvider(messages, {
        model: this.model,
        ...options.aiOptions,
      })

      // Extract content from common response shapes
      const completionRecord = completion as unknown as Record<string, unknown>
      const rawContent =
        (completionRecord['content'] as string | undefined) ||
        (
          completionRecord['choices'] as unknown as
            | Array<{ message?: { content?: string } }>
            | undefined
        )?.[0]?.message?.content ||
        ''

      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(rawContent) as unknown as Record<string, unknown>
      } catch (err: unknown) {
        appLogger.error('Failed to parse AI response as JSON', {
          content: rawContent,
          error: err,
        })
        throw err
      }

      const processingTime = Date.now() - startTime

      const result: InterventionAnalysisResult = {
        ...(parsed as unknown as {
          effectiveness_score: number
          user_receptiveness: string
          emotional_impact: string
          key_insights: string[]
          improvement_suggestions: string[]
        }),
        model: this.model,
        processingTime,
      }

      return result
    } catch (error: unknown) {
      // Add contextual logging before propagating
      appLogger.error('Intervention analysis failed', { error })
      throw error
    }
  }

  /**
   * Analyse multiple interventions concurrently.
   */
  async analyzeBatch(
    batch: InterventionAnalysisBatchItem[],
  ): Promise<InterventionAnalysisResult[]> {
    return Promise.all(
      batch.map((item) =>
        this.analyzeIntervention(
          item.conversation,
          item.interventionMessage,
          item.userResponse,
          item.options,
        ),
      ),
    )
  }
}
