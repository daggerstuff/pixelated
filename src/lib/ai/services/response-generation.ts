import type {
  AIMessage,
  AIService,
  AIServiceOptions,
  TherapeuticResponse,
} from '../models/ai-types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const appLogger = createBuildSafeLogger('app')

export interface ResponseGenerationConfig {
  aiService: AIService
  model: string
  temperature?: number
  maxResponseTokens?: number
}

export class ResponseGenerationService {
  private aiService: AIService
  private model: string
  private temperature: number
  private maxResponseTokens: number

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
      throw new Error('Failed to generate therapeutic response', { cause: error })
    }
  }

  async generateResponseWithInstructions(
    messages: AIMessage[],
    instructions?: string,
  ): Promise<TherapeuticResponse> {
    try {
      const enhancedMessages: AIMessage[] = [...messages]

      if (instructions) {
        enhancedMessages.unshift({
          role: 'system',
          content: `You are a therapeutic AI assistant. Follow these instructions: ${instructions}`,
        })
      } else {
        enhancedMessages.unshift({
          role: 'system',
          content:
            'You are a therapeutic AI assistant. Provide empathetic, supportive responses that help users process their emotions and thoughts.',
        })
      }

      return await this.generateResponse(enhancedMessages)
    } catch (error: unknown) {
      appLogger.error('Error in response generation with instructions:', error)
      throw new Error(
        'Failed to generate therapeutic response with instructions', { cause: error },
      )
    }
  }

  dispose() {
    this.aiService.dispose()
  }
}
