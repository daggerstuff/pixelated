import { createTogetherAIService } from './together'
import type { AIMessage, AIUsage } from '@/lib/ai/models/ai-types'
import { createAuditLog, AuditEventType, AuditEventStatus } from '@/lib/audit'

/**
 * Service for handling AI completion requests.
 * Separates AI service interactions from the API route handler.
 */

export interface CompletionServiceConfig {
  apiKey: string
  togetherApiKey?: string
  togetherBaseUrl?: string
}

export interface CompletionRequest {
  messages: Array<{ role?: string; content?: string; name?: string }>
  model?: string
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export interface CompletionResult {
  model: string
  content: string
  usage?: AIUsage
}

/**
 * Service class for AI completions
 */
export class CompletionService {
  private aiService: ReturnType<typeof createTogetherAIService>

  constructor(config: CompletionServiceConfig) {
    if (!config.apiKey) {
      throw new Error('CompletionService initialization failed: apiKey is required')
    }

    this.aiService = createTogetherAIService({
      apiKey: config.apiKey,
      togetherApiKey: config.togetherApiKey || config.apiKey,
      togetherBaseUrl: config.togetherBaseUrl,
    })
  }

  /**
   * Format messages to ensure they conform to AIMessage type
   */
  public formatMessages(
    messages: Array<{ role?: string; content?: string; name?: string }>,
  ): AIMessage[] {
    return messages.map((msg) => ({
      role: (msg.role || 'user') as 'user' | 'assistant' | 'system',
      content: msg.content || '',
      ...(msg.name && { name: msg.name }),
    }))
  }

  /**
   * Handle streaming completion request
   * Returns a ReadableStream of Uint8Array for standard web Response usage
   */
  public async handleStreamingCompletion(
    messages: AIMessage[],
    options: { model?: string; temperature?: number; maxTokens?: number },
    sessionId: string,
  ): Promise<ReadableStream<Uint8Array>> {
    const encoder = new TextEncoder()
    const aiService = this.aiService

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const stream = await aiService.createStreamingChatCompletion(messages, {
            model: options.model,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
          })

          try {
            for await (const chunk of stream) {
              const payload = `data: ${JSON.stringify({
                choices: [{ delta: { content: chunk.content } }],
              })}\n\n`
              controller.enqueue(encoder.encode(payload))
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (streamError) {
            console.error('Stream processing error:', streamError)
            controller.error(streamError)

            await createAuditLog(
              AuditEventType.AI_OPERATION,
              'ai.completion.stream_error',
              sessionId,
              'ai-completion',
              {
                error:
                  streamError instanceof Error
                    ? streamError.message
                    : String(streamError),
              },
              AuditEventStatus.FAILURE,
            )
          }
        } catch (error: unknown) {
          console.error('Error creating streaming completion:', error)
          controller.error(error)

          await createAuditLog(
            AuditEventType.AI_OPERATION,
            'ai.completion.stream_error',
            sessionId,
            'ai-completion',
            {
              error: error instanceof Error ? String(error) : String(error),
            },
            AuditEventStatus.FAILURE,
          )
        }
      },

      cancel() {
        console.log('Stream cancelled by client')
      },
    })
  }

  /**
   * Handle non-streaming completion request
   */
  public async handleNonStreamingCompletion(
    messages: AIMessage[],
    options: { model?: string; temperature?: number; maxTokens?: number },
    sessionId: string,
  ): Promise<CompletionResult> {
    const completion = await this.aiService.createChatCompletion(messages, {
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    })

    // Create audit log for the completion
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.completion.response',
      sessionId,
      'ai-completion',
      {
        model: completion.model,
        contentLength: completion.content.length,
      },
      AuditEventStatus.SUCCESS,
    )

    return completion
  }
}
