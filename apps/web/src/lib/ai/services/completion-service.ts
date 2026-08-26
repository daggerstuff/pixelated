import { createLLMService } from './llm-provider'
import type { AIMessage, AIUsage } from '@/lib/ai/models/ai-types'
import { createAuditLog, AuditEventType, AuditEventStatus } from '@/lib/audit'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
const logger = createBuildSafeLogger('completion-service')

/**
 * Service for handling AI completion requests.
 * Separates AI service interactions from the API route handler.
 */

export interface CompletionServiceConfig {
  apiKey: string
  providerApiKey?: string
  providerBaseUrl?: string
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
  private readonly aiService: ReturnType<typeof createLLMService>

  constructor(config: CompletionServiceConfig) {
    if (!config.apiKey) {
      throw new Error('CompletionService initialization failed: apiKey is required')
    }

    this.aiService = createLLMService({
      apiKey: config.apiKey,
      baseUrl: config.providerBaseUrl,
    })
  }

  /**
   * Format messages to ensure they conform to AIMessage type
   */
  public formatMessages(
    messages: Array<{ role?: string; content?: string; name?: string }>,
  ): AIMessage[] {
    return messages.map((msg) => ({
      role: (msg.role ?? 'user') as 'user' | 'assistant' | 'system',
      content: msg.content ?? '',
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
        let emittedAssistantRole = false
        try {
          const stream = await aiService.createStreamingChatCompletion(messages, {
            model: options.model,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
          })

          try {
            if (!emittedAssistantRole) {
              const rolePayload = {
                choices: [{ delta: { role: 'assistant' } }],
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(rolePayload)}\n\n`))
              emittedAssistantRole = true
            }

            for await (const chunk of stream) {
              if (!chunk.content) {
                continue
              }

              const payload = `data: ${JSON.stringify({
                choices: [{ delta: { content: chunk.content } }],
              })}\n\n`
              controller.enqueue(encoder.encode(payload))
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (streamError) {
            logger.error('Stream processing error:', streamError)
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
          logger.error('Error creating streaming completion:', error)
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
        logger.info('Stream cancelled by client')
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
