import {
  createAuditLog,
  AuditEventType,
  AuditEventStatus,
} from '../../../lib/audit'
import type { APIRoute } from 'astro'
import { aiRepository } from '@/lib/db/ai'
import { trackApiRequest, trackApiError } from '@/lib/sentry/api-metrics'
import { apiMetrics, countMetric } from '@/lib/sentry/utils'
import { getUserById } from '@/services/auth0.service'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import type {
  AIMessage,
  AIService,
  AIServiceOptions,
  AIStreamChunk,
  TherapeuticResponse,
  AICompletion,
  AIUsage,
} from '@/lib/ai/models/ai-types'
import { createTogetherAIService } from '@/lib/ai/services/together'
import { ResponseGenerationService } from '@/lib/ai/services/response-generation'

/**
 * GET handler - returns information about the AI response endpoint
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get user from Auth0
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
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
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        error: 'Failed to get endpoint information',
        message: error instanceof Error ? String(error) : 'Unknown error',
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
export const POST: APIRoute = async ({
  request,
  locals,
}) => {
  const startTime = Date.now()
  const endpoint = '/api/ai/response'
  let userId: string | null = null

  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get user from Auth0
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    userId = user.id

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
        const generator = async function*() {
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
      userId || 'anonymous',
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

    // Track metrics
    trackApiRequest(endpoint, 'POST', 200, latencyMs)
    apiMetrics.responseTime(endpoint, latencyMs, 'POST')
    countMetric('ai.response.generated', 1, {
      model: modelId || 'mistralai/Mixtral-8x7B-Instruct-v0.2',
      provider: 'together',
      success: true,
    })

    // Store the result in the database
    await aiRepository.storeResponseGeneration({
      userId: userId || 'anonymous',
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
      userId || 'anonymous',
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
    const durationMs = Date.now() - startTime
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError'

    console.error('Error in response generation API:', error)

    // Track error metrics
    trackApiError(endpoint, errorType, 'POST')
    apiMetrics.responseTime(endpoint, durationMs, 'POST')
    countMetric('ai.response.error', 1, {
      error_type: errorType,
      endpoint,
    })

    // Create audit log for the error
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.response.error',
      userId || 'anonymous',
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