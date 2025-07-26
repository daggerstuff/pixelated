import type { APIRoute } from 'astro'
import type {
  AIMessage,
  AIService,
  AIServiceOptions,
  AIStreamChunk,
  TherapeuticResponse,
} from '../../../lib/ai/models/ai-types.js'
import { ResponseGenerationService } from '../../../lib/ai/services/response-generation.js'
import { createTogetherAIService } from '../../../lib/ai/services/together.js'
import {
  createAuditLog,
  AuditEventType,
  AuditEventStatus,
} from '../../../lib/audit'
import { getSession } from '../../../lib/auth/session'
import { aiRepository } from '../../../lib/db/ai/index.js'

/**
 * GET handler - returns information about the AI response endpoint
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    // Verify session for security
    const session = await getSession(request)
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Return endpoint information
    return new Response(
      JSON.stringify({
        name: 'AI Therapeutic Response API',
        description: 'Endpoint for generating therapeutic AI responses',
        methods: ['POST'],
        version: '1.0.0',
        status: 'active',
        authentication: 'required',
        supportedModels: [
          'mistralai/Mixtral-8x7B-Instruct-v0.2',
          'gpt-4',
          'claude-3',
        ],
        parameters: {
          required: ['messages or currentMessage'],
          optional: [
            'model',
            'temperature',
            'maxResponseTokens',
            'instructions',
          ],
        },
        features: [
          'therapeutic response generation',
          'conversation context awareness',
          'audit logging',
          'token usage tracking',
        ],
        defaultModel: 'mistralai/Mixtral-8x7B-Instruct-v0.2',
        maxTokens: 1024,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to get endpoint information',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

/**
 * API route for therapeutic response generation
 */
export const POST: APIRoute = async ({ request }) => {
  let session: Awaited<ReturnType<typeof getSession>> | null = null

  try {
    // Verify session
    session = await getSession(request)
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const body = await request.json()
    const {
      messages,
      currentMessage,
      model,
      temperature = 0.7,
      maxResponseTokens = 1024,
      instructions,
    } = body

    // Validate required fields
    if (!messages && !currentMessage) {
      return new Response(
        JSON.stringify({
          error: 'Either messages or currentMessage is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Create Together AI service
    const togetherService = createTogetherAIService({
      togetherApiKey: import.meta.env['TOGETHER_API_KEY'] || '',
      togetherBaseUrl:
        import.meta.env['TOGETHER_BASE_URL'] || 'https://api.together.xyz',
      apiKey: '',
    })

    // Use the model from the request or the default
    const modelId = model || 'mistralai/Mixtral-8x7B-Instruct-v0.2'

    // Create an adapter for the AI service
    const serviceAdapter: AIService = {
      createChatCompletion: async (
        messages: AIMessage[],
        options?: AIServiceOptions,
      ) => {
        const response = await togetherService.generateCompletion(
          messages,
          options,
        )
        return {
          id: `together${Date.now()}`,
          created: Date.now(),
          model: options?.model || modelId,
          choices: [
            {
              message: {
                role: 'assistant',
                content:
                  typeof response === 'object' &&
                  response !== null &&
                  'content' in response
                    ? (response as { content: string }).content
                    : '',
                name: 'assistant',
              },
              finishReason: 'stop',
            },
          ],
          usage:
            typeof response === 'object' &&
            response !== null &&
            'usage' in response
              ? {
                  promptTokens: Number(
                    (response.usage as { promptTokens: number })
                      ?.promptTokens || 0,
                  ),
                  completionTokens: Number(
                    (response.usage as { completionTokens: number })
                      ?.completionTokens || 0,
                  ),
                  totalTokens: Number(
                    (response.usage as { totalTokens: number })?.totalTokens ||
                      0,
                  ),
                }
              : {
                  promptTokens: 0,
                  completionTokens: 0,
                  totalTokens: 0,
                },
          provider: 'together',
          content:
            typeof response === 'object' &&
            response !== null &&
            'content' in response
              ? (response as { content: string }).content
              : '',
        }
      },
      createStreamingChatCompletion: async (
        _messages: AIMessage[],
        options?: AIServiceOptions,
      ): Promise<AsyncGenerator<AIStreamChunk, void, void>> => {
        const generator = async function* () {
          // Minimal implementation - streaming not fully supported
          yield {
            id: `together_${Date.now()}`,
            model: options?.model || modelId,
            created: Date.now(),
            content: '',
            done: true,
          } as AIStreamChunk
          throw new Error('Streaming not supported in this implementation')
        }
        return generator()
      },
      getModelInfo: (model: string) => ({
        id: model,
        name: model,
        provider: 'together',
        capabilities: ['chat'],
        contextWindow: 8192,
        maxTokens: 8192,
      }),
      createChatCompletionWithTracking: async (
        messages: AIMessage[],
        options?: AIServiceOptions,
      ) => {
        const response = await togetherService.generateCompletion(
          messages,
          options,
        )
        return {
          id: `together${Date.now()}`,
          created: Date.now(),
          model: options?.model || modelId,
          choices: [
            {
              message: {
                role: 'assistant',
                content:
                  typeof response === 'object' &&
                  response !== null &&
                  'content' in response
                    ? (response as { content: string }).content
                    : '',
                name: 'assistant',
              },
              finishReason: 'stop',
            },
          ],
          usage:
            typeof response === 'object' &&
            response !== null &&
            'usage' in response
              ? {
                  promptTokens: Number(
                    (response.usage as { promptTokens: number })
                      ?.promptTokens || 0,
                  ),
                  completionTokens: Number(
                    (response.usage as { completionTokens: number })
                      ?.completionTokens || 0,
                  ),
                  totalTokens: Number(
                    (response.usage as { totalTokens: number })?.totalTokens ||
                      0,
                  ),
                }
              : {
                  promptTokens: 0,
                  completionTokens: 0,
                  totalTokens: 0,
                },
          provider: 'together',
          content:
            typeof response === 'object' &&
            response !== null &&
            'content' in response
              ? (response as { content: string }).content
              : '',
        }
      },
      // generateCompletion is not required for this adapter in current usage. Omitting to simplify typing.
      dispose: () => {
        togetherService.dispose()
      },
    }

    // Create response generation service
    const responseService = new ResponseGenerationService({
      aiService: serviceAdapter,
      model: modelId,
      temperature,
      maxResponseTokens,
    })
    // Log the request
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.response.request',
      session?.user?.id || 'anonymous',
      'response-generation',
      {
        model: modelId || 'mistralai/Mixtral-8x7B-Instruct-v0.2',
        temperature,
        maxResponseTokens,
        messageCount: messages ? messages.length : 1,
      },
    )

    // Start timer for latency measurement
    const startTime = Date.now()

    // Process the request
    let result: TherapeuticResponse
    if (messages) {
      result = await responseService.generateResponseWithInstructions(
        messages,
        instructions,
      )
    } else {
      result = await responseService.generateResponseWithInstructions(
        [currentMessage],
        instructions,
      )
    }

    const latencyMs = Date.now() - startTime

    // Store the result in the database
    await aiRepository.storeResponseGeneration({
      userId: session?.user?.id || 'anonymous',
      modelId: modelId || 'mistralai/Mixtral-8x7B-Instruct-v0.2',
      modelProvider: 'together',
      latencyMs,
      success: true,
      error: null,
      prompt: currentMessage || (messages ? JSON.stringify(messages) : ''),
      response: result?.content,
      context: '',
      instructions,
      temperature,
      maxTokens: maxResponseTokens,
      requestTokens: result?.usage?.promptTokens || 0,
      responseTokens: result?.usage?.completionTokens || 0,
      totalTokens: result?.usage?.totalTokens || 0,
      metadata: {
        messageCount: messages ? messages.length : 1,
      },
    })

    // Log the response
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.response.response',
      session?.user?.id || 'anonymous',
      'response-generation',
      {
        model: modelId || 'mistralai/Mixtral-8x7B-Instruct-v0.2',
        responseLength: result?.content.length,
        latencyMs,
      },
    )

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error in response generation API:', error)

    // Create audit log for the error
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.response.error',
      session?.user?.id || 'anonymous',
      'response-generation',
      {
        error: error instanceof Error ? error?.message : String(error),
        stack: error instanceof Error ? error?.stack : undefined,
        status: 'error',
      },
      AuditEventStatus.FAILURE,
    )

    return new Response(
      JSON.stringify({
        error: 'An error occurred during response generation',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
