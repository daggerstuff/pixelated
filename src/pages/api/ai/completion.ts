// import type { AIMessage } from '@/lib/ai/models/types'
import type { SessionData } from '@/lib/auth/session'
import type { APIRoute, APIContext } from 'astro'
import { createAuditLog, AuditEventType, AuditEventStatus } from '@/lib/audit'
import { handleApiError } from '@/lib/ai/error-handling'
import { createTogetherAIService } from '@/lib/ai/services/together'
import { getSession } from '@/lib/auth/session'
import { validateRequestBody } from '@/lib/validation/index'
import { CompletionRequestSchema } from '@/lib/validation/schemas'
import { applyRateLimit } from '@/lib/api/rate-limit'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

// Define AIMessage interface locally
interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Initialize logger
const logger = createBuildSafeLogger('ai-completion')

// Use the shared Astro API types to avoid duplication and ensure consistency

/**
 * API route for AI chat completions
 * Secured by authentication and input validation
 */

// GET handler - returns information about the completion endpoint
export const GET: APIRoute = async ({ request }: APIContext) => {
  try {
    // Verify session for security
    const session = await getSession(request)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    // Return endpoint information
    return new Response(
      JSON.stringify({
        name: 'AI Completion API',
        description: 'Endpoint for AI chat completions',
        methods: ['POST'],
        version: '1.0.0',
        status: 'active',
        authentication: 'required',
        rateLimit: {
          admin: '120 requests/minute',
          therapist: '80 requests/minute',
          user: '40 requests/minute',
          anonymous: '10 requests/minute',
        },
        maxPayloadSize: '50KB',
        supportedModels: ['gpt-4', 'claude-3'],
        features: ['streaming', 'caching', 'rate-limiting'],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
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
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}

export const POST: APIRoute = async ({ request }: APIContext) => {
  // Define session outside try block to make it accessible in catch block
  let session: SessionData | null = null

  try {
    logger.info('Processing AI completion request')
    // Verify session
    session = await getSession(request)
    if (!session?.user) {
      logger.warn('Unauthorized access attempt to AI completion endpoint')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    // Apply enhanced rate limiting with suspicious activity tracking for AI endpoints
    const rateLimit = await applyRateLimit(request, '/api/ai/completion', {
      limits: {
        admin: 120, // 120 requests per minute for admins
        therapist: 80, // 80 requests per minute for therapists
        user: 40, // 40 requests per minute for regular users
        anonymous: 10, // 10 requests per minute for unauthenticated users
      },
      windowMs: 60 * 1000, // 1 minute window
      trackSuspiciousActivity: true,
    })

    // Check if request is rate limited
    const errorResponse = rateLimit.createErrorResponse()
    if (errorResponse) {
      return errorResponse
    }

    // Validate request body against schema
    const [data, validationError] = await validateRequestBody(
      request,
      CompletionRequestSchema,
    )

    if (validationError) {
      // Create audit log for validation error
      await createAuditLog(
        AuditEventType.AI_OPERATION, // eventType
        'ai.completion.validation_error', // action
        session?.user?.id || 'anonymous', // userId
        'ai-completion', // resource
        {
          // details
          error: validationError.error,
          details: JSON.stringify(validationError.details),
        },
        AuditEventStatus.FAILURE, // status
      )

      return new Response(JSON.stringify(validationError), {
        status: validationError.status,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    // Check input size to prevent abuse
    const totalInputSize = JSON.stringify(data).length
    const maxAllowedSize = 1024 * 50 // 50KB limit

    if (totalInputSize > maxAllowedSize) {
      return new Response(
        JSON.stringify({
          error: 'Payload too large',
          message: 'The request payload exceeds the maximum allowed size',
        }),
        {
          status: 413,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Create AI service
    const aiService = createTogetherAIService({
      apiKey: import.meta.env['TOGETHER_API_KEY'] || 'example-api-key',
      togetherApiKey: import.meta.env['TOGETHER_API_KEY'],
      togetherBaseUrl: import.meta.env['TOGETHER_BASE_URL'],
    })

    // Create audit log for the request
    await createAuditLog(
      AuditEventType.AI_OPERATION, // eventType
      'ai.completion.request', // action
      session?.user?.id || 'anonymous', // userId
      'ai-completion', // resource
      {
        // details
        model: data?.model,
        messageCount: data?.messages?.length,
        inputSize: totalInputSize,
      },
      AuditEventStatus.SUCCESS, // status
    )

    // Format messages to ensure they conform to AIMessage type
    const formattedMessages: AIMessage[] = (data?.messages || []).map(
      (msg) => ({
        role: msg.role || 'user',
        content: msg.content || '',
        // Include name if provided, but ensure it's optional
        ...(msg.name && { name: msg.name }),
      }),
    )

    // Handle streaming response
    if (data?.stream) {
      // Create a readable stream for the response
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            const stream = await aiService.createStreamingChatCompletion(
              formattedMessages,
              {
                model: data?.model,
                temperature: data?.temperature,
                maxTokens: data?.max_tokens,
              },
            )

            // Handle the async generator stream
            try {
              for await (const chunk of stream) {
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({
                      choices: [{ delta: { content: chunk.content } }],
                    })}\n\n`,
                  ),
                )
              }

              // Stream completed successfully
              controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
              controller.close()
            } catch (streamError) {
              console.error('Stream processing error:', streamError)
              controller.error(streamError)

              // Log streaming error
              await createAuditLog(
                AuditEventType.AI_OPERATION, // eventType
                'ai.completion.stream_error', // action
                session?.user?.id || 'anonymous', // userId
                'ai-completion', // resource
                {
                  // details
                  error:
                    streamError instanceof Error
                      ? streamError.message
                      : String(streamError),
                },
                AuditEventStatus.FAILURE, // status
              )
            }
          } catch (error: unknown) {
            console.error('Error creating streaming completion:', error)
            controller.error(error)

            // Create audit log for streaming error
            await createAuditLog(
              AuditEventType.AI_OPERATION, // eventType
              'ai.completion.stream_error', // action
              session?.user?.id || 'anonymous', // userId
              'ai-completion', // resource
              {
                // details
                error: error instanceof Error ? String(error) : String(error),
              },
              AuditEventStatus.FAILURE, // status
            )
          }
        },

        cancel() {
          // Handle stream cancellation
          console.log('Stream cancelled by client')
        },
      })

      return new Response(readableStream as unknown as BodyInit, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          ...Object.fromEntries(rateLimit.headers.entries()),
        },
      })
    }

    // Handle non-streaming response
    const completion = await aiService.createChatCompletion(formattedMessages, {
      model: data?.model,
      temperature: data?.temperature,
      maxTokens: data?.max_tokens,
    })

    // Create audit log for the completion
    await createAuditLog(
      AuditEventType.AI_OPERATION, // eventType
      'ai.completion.response', // action
      session?.user?.id || 'anonymous', // userId
      'ai-completion', // resource
      {
        // details
        model: completion.model,
        contentLength: completion.content.length,
      },
      AuditEventStatus.SUCCESS, // status
    )

    return new Response(JSON.stringify(completion), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        ...Object.fromEntries(rateLimit.headers.entries()),
      },
    })
  } catch (error: unknown) {
    logger.error(
      'Error in AI completion API:',
      error instanceof Error
        ? { message: String(error), stack: (error as Error)?.stack }
        : { message: String(error) },
    )
    console.error('Error in AI completion API:', error)

    // Create audit log for the error
    await createAuditLog(
      AuditEventType.AI_OPERATION, // eventType
      'ai.completion.error', // action
      session?.user?.id || 'anonymous', // userId
      'ai-completion', // resource
      {
        // details
        error: error instanceof Error ? error?.message : String(error),
        stack: error instanceof Error ? error?.stack : undefined,
      },
      AuditEventStatus.FAILURE, // status
    )

    // Use the standardized error handling
    return handleApiError(error)
  }
}
