import type { APIRoute, APIContext } from 'astro'

import { handleApiError } from '@/lib/ai/error-handling'
import { applyRateLimit } from '@/lib/api/rate-limit'
import { createAuditLog, AuditEventType, AuditEventStatus } from '@/lib/audit'
import { getSession, isSessionValid } from '@/lib/auth/session'
import type { Session } from '@/lib/auth/session'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { validateRequestBody } from '@/lib/validation/index'
import { CompletionRequestSchema } from '@/lib/validation/schemas'
import { CompletionService } from '@/lib/ai/services/completion-service'

// Initialize logger
const logger = createBuildSafeLogger('ai-completion')

// Constants
const RATE_LIMIT_CONFIG = {
  limits: {
    admin: 120,
    therapist: 80,
    user: 40,
    anonymous: 10,
  },
  windowMs: 60 * 1000,
  trackSuspiciousActivity: true,
} as const

const MAX_PAYLOAD_SIZE = 1024 * 50 // 50KB

/**
 * API route for AI chat completions
 * Secured by authentication and input validation
 */

// GET handler - returns information about the completion endpoint
export const GET: APIRoute = async ({ request }: APIContext) => {
  try {
    const session = await getSession(request)
    if (!session?.user || !isSessionValid(session)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

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
 * POST handler - process AI completion request
 *
 * Responsibilities:
 * 1. Session verification
 * 2. Rate limiting
 * 3. Request validation
 * 4. Delegate AI processing to completion service
 * 5. Handle HTTP response construction (Response/Headers)
 */
export const POST: APIRoute = async ({ request }: APIContext) => {
  let session: Session | null = null

  try {
    logger.info('Processing AI completion request')

    // 1. Perform pre-processing checks (Auth, Rate Limit, Validation, Audit)
    const {
      session: validatedSession,
      data,
      rateLimitHeaders,
      errorResponse,
    } = await performRequestPrechecks(request)

    if (errorResponse) return errorResponse

    // Ensure we have the required data for subsequent steps
    if (!validatedSession || !data) {
      throw new Error('Invalid state after prechecks')
    }

    session = validatedSession

    // 2. Initialize and configure AI service
    const togetherApiKey = import.meta.env['TOGETHER_API_KEY']
    if (!togetherApiKey) {
      logger.error('TOGETHER_API_KEY is not configured')
      return new Response(
        JSON.stringify({
          error: 'Configuration error',
          message: 'The AI service is not properly configured',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const completionService = new CompletionService({
      apiKey: togetherApiKey,
      togetherApiKey: togetherApiKey,
      togetherBaseUrl: import.meta.env['TOGETHER_BASE_URL'],
    })

    const formattedMessages = completionService.formatMessages(data?.messages || [])
    const sessionUserId = session.user.id

    // 3. Execute AI completion (Streaming or Non-streaming)
    if (data?.stream) {
      const stream = await completionService.handleStreamingCompletion(
        formattedMessages,
        {
          model: data?.model,
          temperature: data?.temperature,
          maxTokens: data?.max_tokens,
        },
        sessionUserId,
      )

      const responseHeaders = new Headers({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      })

      mergeHeaders(responseHeaders, rateLimitHeaders)

      return new Response(stream, {
        status: 200,
        headers: responseHeaders,
      })
    } else {
      const completion = await completionService.handleNonStreamingCompletion(
        formattedMessages,
        {
          model: data?.model,
          temperature: data?.temperature,
          maxTokens: data?.max_tokens,
        },
        sessionUserId,
      )

      const responseHeaders = new Headers({
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      })

      mergeHeaders(responseHeaders, rateLimitHeaders)

      return new Response(JSON.stringify(completion), {
        status: 200,
        headers: responseHeaders,
      })
    }
  } catch (error: unknown) {
    logger.error(
      'Error in AI completion API:',
      error instanceof Error
        ? { message: String(error), stack: (error as Error).stack }
        : { message: String(error) },
    )
    console.error('Error in AI completion API:', error)

    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.completion.error',
      session?.user?.id || 'anonymous',
      'ai-completion',
      {
        error: error instanceof Error ? error?.message : String(error),
        stack: error instanceof Error ? error?.stack : undefined,
      },
      AuditEventStatus.FAILURE,
    )

    return handleApiError(error)
  }
}

/**
 * Handle validation error response
 */
async function handleValidationError(
  validationError: any,
  userId: string | undefined,
): Promise<Response> {
  const details =
    typeof validationError.details === 'string'
      ? validationError.details
      : JSON.stringify(validationError.details)

  await createAuditLog(
    AuditEventType.AI_OPERATION,
    'ai.completion.validation_error',
    userId || 'anonymous',
    'ai-completion',
    {
      error: 'Validation failed',
      details,
    },
    AuditEventStatus.FAILURE,
  )

  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      details,
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

/**
 * Merges extra headers into the target Headers object.
 * Handles both Headers instances and plain Record objects.
 */
function mergeHeaders(
  target: Headers,
  source?: Headers | Record<string, unknown>,
): void {
  if (!source) return

  if (source instanceof Headers) {
    source.forEach((value, key) => target.append(key, value))
  } else {
    Object.entries(source).forEach(([key, value]) =>
      target.append(key, String(value)),
    )
  }
}

/**
 * Performs all necessary pre-checks for the AI completion request:
 * 1. Session verification
 * 2. Rate limiting
 * 3. Body validation
 * 4. Payload size constraints
 * 5. Initial audit logging
 */
async function performRequestPrechecks(request: Request): Promise<{
  session?: Session
  data?: any
  rateLimitHeaders?: Headers
  errorResponse?: Response
}> {
  // 1. Verify session
  const session = await getSession(request)
  if (!session?.user || !isSessionValid(session)) {
    logger.warn('Unauthorized access attempt to AI completion endpoint')
    return {
      errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    }
  }

  // 2. Apply rate limiting
  const rateLimit = await applyRateLimit(
    request,
    '/api/ai/completion',
    RATE_LIMIT_CONFIG,
  )

  const errorResponse = rateLimit.createErrorResponse()
  if (errorResponse) return { errorResponse }

  // 3. Validate request body
  const [data, validationError] = await validateRequestBody(
    request,
    CompletionRequestSchema,
  )

  if (validationError) {
    return {
      errorResponse: await handleValidationError(validationError, session.user.id),
    }
  }

  // 4. Check input size
  const totalInputSize = JSON.stringify(data).length
  if (totalInputSize > MAX_PAYLOAD_SIZE) {
    return {
      errorResponse: new Response(
        JSON.stringify({
          error: 'Payload too large',
          message: 'The request payload exceeds the maximum allowed size',
        }),
        {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    }
  }

  // 5. Create audit log for the request
  await createAuditLog(
    AuditEventType.AI_OPERATION,
    'ai.completion.request',
    session.user.id,
    'ai-completion',
    {
      model: data?.model,
      messageCount: data?.messages?.length,
      inputSize: totalInputSize,
    },
    AuditEventStatus.SUCCESS,
  )

  return { session, data, rateLimitHeaders: rateLimit.headers }
}
