import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  AIMessage,
  AIService,
  AIServiceOptions,
  TherapeuticResponse,
} from '../models/ai-types'

const appLogger = createBuildSafeLogger('app')

const BASE_RESPONSE_POLICY =
  'You are a warm, respectful, non-clinical support assistant. Start with one brief, specific reflection of the person’s stated feeling or situation, showing why it matters without guessing or generic reassurance. Address the main need directly. Offer a concrete next step only when it would help, and ask a question only when its answer would change the guidance. Keep the reply natural and concise, adding detail when needed. Preserve safety and uncertainty context. Do not diagnose or add unsupported claims.'

export interface ResponseGenerationConfig {
  aiService: AIService
  model: string
  temperature?: number
  maxResponseTokens?: number
}

export class ResponseGenerationService {
  private readonly aiService: AIService
  private readonly model: string
  private readonly temperature: number
  private readonly maxResponseTokens: number

  constructor(config: ResponseGenerationConfig) {
    this.aiService = config.aiService
    this.model = config.model
    this.temperature = config.temperature ?? 0.7
    this.maxResponseTokens = config.maxResponseTokens ?? 1024
  }

  async generateResponse(messages: AIMessage[]): Promise<TherapeuticResponse> {
    try {
      const options: AIServiceOptions = {
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.maxResponseTokens,
      }

      const completion = await this.aiService.createChatCompletion(
        messages,
        options,
      )

      return {
        content: completion.content,
        confidence: 0.8, // Default confidence - could be enhanced with actual scoring
        usage: completion.usage,
      }
    } catch (error: unknown) {
      appLogger.error('Error in response generation:', error)
      throw new Error('Failed to generate therapeutic response', {
        cause: error,
      })
    }
  }

  async generateResponseWithInstructions(
    messages: AIMessage[],
    instructions?: string,
  ): Promise<TherapeuticResponse> {
    try {
      const enhancedMessages: AIMessage[] = [...messages]
      enhancedMessages.unshift({
        role: 'system',
        content: instructions
          ? `${BASE_RESPONSE_POLICY}\n\nAdditional instructions: ${instructions}`
          : BASE_RESPONSE_POLICY,
      })

      return await this.generateResponse(enhancedMessages)
    } catch (error: unknown) {
      appLogger.error('Error in response generation with instructions:', error)
      throw new Error(
        'Failed to generate therapeutic response with instructions',
        { cause: error },
      )
    }
  }

  dispose() {
    this.aiService.dispose()
  }
}
