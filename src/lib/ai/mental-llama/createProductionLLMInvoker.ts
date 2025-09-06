import { CircuitBreaker } from './utils/CircuitBreaker.ts'
import { LLMInvokerMetrics } from './utils/LLMInvokerMetrics.ts'
import type {
  LLMInvoker,
  LLMInvocationOptions,
  LLMResponse,
} from './types/mentalLLaMATypes.ts'
import type { IModelProvider } from './providers/types.ts'
import { DEFAULT_PRODUCTION_CONFIG } from './config.ts'
import { getServiceLogger } from '@/lib/logging/standardized-logger.ts'

/**
 * Enhanced error types for better error handling
 */
enum LLMInvokerErrorType {
  PROVIDER_UNAVAILABLE = 'provider_unavailable',
  TIMEOUT = 'timeout',
  RATE_LIMITED = 'rate_limited',
  INVALID_RESPONSE = 'invalid_response',
  PARSING_ERROR = 'parsing_error',
  NETWORK_ERROR = 'network_error',
  VALIDATION_ERROR = 'validation_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Creates a production-grade LLM invoker with comprehensive error handling,
 * retry logic, circuit breaker, timeout management, and monitoring.
 *
 * This function returns an LLMInvoker that maintains type compatibility while
 * providing robust production features. The router expects JSON responses,
 * so this invoker handles the JSON parsing and returns the content as a string
 * that the router can then parse.
 */
export async function createProductionLLMInvoker(
  modelProvider: IModelProvider | undefined,
  routerConfig: typeof DEFAULT_PRODUCTION_CONFIG.router,
): Promise<LLMInvoker> {
  const logger = getServiceLogger('llm-invoker')

  const circuitBreaker = routerConfig.enableCircuitBreaker
    ? new CircuitBreaker(
        routerConfig.circuitBreakerFailureThreshold,
        routerConfig.circuitBreakerResetTimeoutMs,
      )
    : null

  const metrics = new LLMInvokerMetrics()

  /**
   * Validates routing response structure
   */
  const validateRoutingResponse = (response: unknown): boolean => {
    if (!response || typeof response !== 'object') {
      return false
    }

    const r = response as Record<string, unknown>

    // Required fields for routing
    if (
      typeof r['category'] !== 'string' ||
      r['category'].trim().length === 0
    ) {
      logger.warn('Invalid category in routing response', {
        category: r['category'],
      })
      return false
    }

    if (
      typeof r['confidence'] !== 'number' ||
      r['confidence'] < 0 ||
      r['confidence'] > 1
    ) {
      logger.warn('Invalid confidence in routing response', {
        confidence: r['confidence'],
      })
      return false
    }

    if (
      typeof r['reasoning'] !== 'string' ||
      r['reasoning'].trim().length < 5
    ) {
      logger.warn('Invalid reasoning in routing response', {
        reasoning:
          typeof r['reasoning'] === 'string'
            ? r['reasoning'].slice(0, 50)
            : r['reasoning'],
      })
      return false
    }

    return true
  }

  /**
   * Creates a fallback routing response
   */
  const createFallbackRoutingResponse = (
    errorType: LLMInvokerErrorType,
    errorMessage: string,
    hasModelProvider: boolean,
  ): Record<string, unknown> => {
    const baseResponse = {
      category: 'general_mental_health',
      confidence: hasModelProvider ? 0.1 : 0.05,
      reasoning: `Fallback response due to ${errorType}: ${errorMessage}`,
      is_critical_intent: false,
    }

    // Adjust response based on error type
    switch (errorType) {
      case LLMInvokerErrorType.TIMEOUT:
        baseResponse.confidence = 0.15
        baseResponse.reasoning =
          'LLM request timed out, using conservative fallback classification'
        break
      case LLMInvokerErrorType.RATE_LIMITED:
        baseResponse.confidence = 0.2
        baseResponse.reasoning =
          'LLM rate limited, using fallback classification'
        break
      case LLMInvokerErrorType.PROVIDER_UNAVAILABLE:
        baseResponse.confidence = hasModelProvider ? 0.1 : 0.05
        baseResponse.reasoning = hasModelProvider
          ? 'Model provider temporarily unavailable, using fallback'
          : 'No model provider configured, using stub response'
        break
      default:
        // Keep base response
        break
    }

    return baseResponse
  }

  /**
   * Implements exponential backoff with jitter
   */
  const calculateRetryDelay = (attempt: number): number => {
    const exponentialDelay = Math.min(1000 * Math.pow(2, attempt), 10000)

    // Add jitter (±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5)
    return Math.max(100, exponentialDelay + jitter)
  }

  /**
   * Determines if an error is retryable
   */
  const isRetryableError = (error: unknown): boolean => {
    if (!error) {
      return false
    }

    const errorMessage =
      error instanceof Error
        ? String(error).toLowerCase()
        : String(error).toLowerCase()

    // Network errors are generally retryable
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection')
    ) {
      return true
    }

    // Timeout errors are retryable
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out')
    ) {
      return true
    }

    // Rate limiting is retryable with backoff
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return true
    }

    // Server errors (5xx) are generally retryable
    if (
      errorMessage.includes('500') ||
      errorMessage.includes('502') ||
      errorMessage.includes('503') ||
      errorMessage.includes('504')
    ) {
      return true
    }

    // Client errors (4xx except rate limiting) are generally not retryable
    if (
      errorMessage.includes('400') ||
      errorMessage.includes('401') ||
      errorMessage.includes('403') ||
      errorMessage.includes('404')
    ) {
      return false
    }

    return true // Default to retryable for unknown errors
  }

  /**
   * Categorizes error type for better handling
   */
  const categorizeError = (error: unknown): LLMInvokerErrorType => {
    if (!error) {
      return LLMInvokerErrorType.UNKNOWN_ERROR
    }

    const errorMessage =
      error instanceof Error
        ? String(error).toLowerCase()
        : String(error).toLowerCase()

    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out')
    ) {
      return LLMInvokerErrorType.TIMEOUT
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return LLMInvokerErrorType.RATE_LIMITED
    }

    if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection')
    ) {
      return LLMInvokerErrorType.NETWORK_ERROR
    }

    if (errorMessage.includes('parse') || errorMessage.includes('json')) {
      return LLMInvokerErrorType.PARSING_ERROR
    }

    if (errorMessage.includes('validation')) {
      return LLMInvokerErrorType.VALIDATION_ERROR
    }

    return LLMInvokerErrorType.UNKNOWN_ERROR
  }

  /**
   * Main production LLM invoker implementation
   */
  return async function productionLLMInvoker(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: LLMInvocationOptions,
  ): Promise<LLMResponse> {
    const startTime = Date.now()
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.debug('Production LLM invocation started', {
      requestId,
      messagesCount: messages.length,
      hasModelProvider: !!modelProvider,
      circuitBreakerState: circuitBreaker?.getState(),
      options: options ? { ...options, apiKey: undefined } : undefined,
    })

    // Input validation
    if (!messages || messages.length === 0) {
      const error = 'No messages provided to LLM invoker'
      logger.error(error, { requestId })
      metrics.recordRequest(false, Date.now() - startTime)

      const fallbackResponse = createFallbackRoutingResponse(
        LLMInvokerErrorType.VALIDATION_ERROR,
        error,
        !!modelProvider,
      )

      return {
        content: JSON.stringify(fallbackResponse),
        model: 'fallback',
        metadata: { requestId, error, errorType: 'validation_error' },
      }
    }

    // Validate message structure
    for (const message of messages) {
      if (
        !message.role ||
        !message.content ||
        typeof message.content !== 'string'
      ) {
        const error = 'Invalid message structure'
        logger.error(error, { requestId, invalidMessage: message })
        metrics.recordRequest(false, Date.now() - startTime)

        const fallbackResponse = createFallbackRoutingResponse(
          LLMInvokerErrorType.VALIDATION_ERROR,
          error,
          !!modelProvider,
        )

        return {
          content: JSON.stringify(fallbackResponse),
          model: 'fallback',
          metadata: { requestId, error, errorType: 'validation_error' },
        }
      }
    }

    // Check circuit breaker
    if (circuitBreaker && !circuitBreaker.canExecute()) {
      const error = 'Circuit breaker is open'
      logger.warn(error, {
        requestId,
        circuitBreakerState: circuitBreaker.getState(),
      })
      metrics.recordRequest(false, Date.now() - startTime)

      const fallbackResponse = createFallbackRoutingResponse(
        LLMInvokerErrorType.PROVIDER_UNAVAILABLE,
        error,
        !!modelProvider,
      )

      return {
        content: JSON.stringify(fallbackResponse),
        model: 'circuit-breaker',
        metadata: { requestId, error, errorType: 'circuit_breaker_open' },
      }
    }

    // Handle case where no model provider is available
    if (!modelProvider) {
      logger.warn('No model provider available, using stub response', {
        requestId,
      })

      // Simulate processing time for consistency
      await new Promise((resolve) =>
        setTimeout(resolve, 50 + Math.random() * 100),
      )

      const fallbackResponse = createFallbackRoutingResponse(
        LLMInvokerErrorType.PROVIDER_UNAVAILABLE,
        'No model provider configured',
        false,
      )

      metrics.recordRequest(true, Date.now() - startTime)

      return {
        content: JSON.stringify(fallbackResponse),
        model: 'stub',
        metadata: { requestId, isStub: true },
      }
    }

    // Retry logic with exponential backoff
    let lastError: unknown = null

    for (let attempt = 0; attempt <= routerConfig.maxRetries; attempt++) {
      try {
        // Calculate timeout for this attempt
        const timeoutMs = Math.min(
          routerConfig.llmTimeoutMs + attempt * 5000,
          routerConfig.llmTimeoutMs * 2,
        )

        logger.debug(
          `LLM invocation attempt ${attempt + 1}/${routerConfig.maxRetries + 1}`,
          {
            requestId,
            timeoutMs,
            provider: modelProvider.getProviderName(),
          },
        )

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Request timed out after ${timeoutMs}ms`)),
            timeoutMs,
          )
        })

        // Prepare chat completion options with production settings
        const chatOptions = {
          temperature: 0.1, // Low temperature for consistent routing decisions
          max_tokens: 500, // Sufficient for routing response
          top_p: 0.9,
          ...options,
          // Ensure JSON response format if provider supports it
          providerSpecificParams: {
            response_format: { type: 'json_object' },
            ...options?.providerSpecificParams,
          },
        }

        // Execute LLM call with timeout
        const response = await Promise.race([
          modelProvider.chatCompletion(messages, chatOptions),
          timeoutPromise,
        ])

        // Check for provider-level errors
        if (response.error) {
          throw new Error(`Provider error: ${response.String(error)}`)
        }

        // Validate response structure
        if (!response.choices || response.choices.length === 0) {
          throw new Error('No choices returned from model provider')
        }

        const choice = response.choices[0]
        if (!choice?.message?.content) {
          throw new Error('No content in model response')
        }

        // Parse and validate response content for routing
        let parsedResponse: unknown
        try {
          parsedResponse = JSON.parse(choice.message.content) as unknown
        } catch (parseError) {
          // If JSON parsing fails, create a structured fallback
          logger.warn(
            'Failed to parse LLM response as JSON, creating structured fallback',
            {
              requestId,
              content: choice.message.content.slice(0, 200),
              parseError:
                parseError instanceof Error
                  ? parseError.message
                  : String(parseError),
            },
          )

          parsedResponse = {
            category: 'general_mental_health',
            confidence: 0.3,
            reasoning: `LLM response was not in JSON format. Raw content: ${choice.message.content.slice(0, 100)}`,
            raw: choice.message.content,
          }
        }

        // Validate parsed response for routing requirements
        if (!validateRoutingResponse(parsedResponse)) {
          throw new Error('LLM response failed routing validation')
        }

        // Success - record metrics and return
        const latency = Date.now() - startTime
        metrics.recordRequest(true, latency)
        circuitBreaker?.onSuccess()

        logger.info('Production LLM invocation successful', {
          requestId,
          category: (parsedResponse as Record<string, unknown>)['category'],
          confidence: (parsedResponse as Record<string, unknown>)['confidence'],
          latencyMs: latency,
          attempt: attempt + 1,
          provider: modelProvider.getProviderName(),
        })

        // Return as LLMResponse with JSON content for the router to parse
        const result: LLMResponse = {
          content: JSON.stringify(parsedResponse),
          model: response.model,
          metadata: {
            requestId,
            attempt: attempt + 1,
            latencyMs: latency,
            id: response.id,
            created: response.created,
          },
        }

        if (choice.finish_reason) {
          result.finishReason = choice.finish_reason as
            | 'stop'
            | 'length'
            | 'content_filter'
            | 'function_call'
        }

        if (response.usage) {
          result.tokenUsage = {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        }

        return result
      } catch (error: unknown) {
        lastError = error
        const errorType = categorizeError(error)
        const errorMessage =
          error instanceof Error ? String(error) : String(error)

        logger.warn(`Production LLM invocation attempt ${attempt + 1} failed`, {
          requestId,
          error: errorMessage,
          errorType,
          attempt: attempt + 1,
          isRetryable: isRetryableError(error),
          provider: modelProvider.getProviderName(),
        })

        // Record failure in circuit breaker
        circuitBreaker?.onFailure()

        // Check if we should retry
        if (attempt < routerConfig.maxRetries && isRetryableError(error)) {
          const delayMs = calculateRetryDelay(attempt)
          logger.debug(`Retrying after ${delayMs}ms`, {
            requestId,
            nextAttempt: attempt + 2,
          })
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          continue
        }

        // Final attempt failed or error is not retryable
        break
      }
    }

    // All attempts failed
    const finalErrorType = categorizeError(lastError)
    const finalErrorMessage =
      lastError instanceof Error ? lastError.message : String(lastError)

    logger.error('All production LLM invocation attempts failed', {
      requestId,
      totalAttempts: routerConfig.maxRetries + 1,
      finalError: finalErrorMessage,
      finalErrorType,
      latencyMs: Date.now() - startTime,
      provider: modelProvider.getProviderName(),
    })

    metrics.recordRequest(false, Date.now() - startTime)

    const fallbackResponse = createFallbackRoutingResponse(
      finalErrorType,
      finalErrorMessage,
      true,
    )

    return {
      content: JSON.stringify(fallbackResponse),
      model: 'fallback',
      metadata: {
        requestId,
        error: finalErrorMessage,
        errorType: finalErrorType,
        totalAttempts: routerConfig.maxRetries + 1,
      },
    }
  }
}
