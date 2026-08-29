/**
 * Provider fallback and retry logic.
 *
 * When a primary provider fails (network error, 5xx, rate limit), the
 * fallback manager tries the next provider in the configured chain.
 * Retries with exponential backoff are attempted for transient errors
 * before moving to the fallback provider.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import type { AIMessage, AIServiceOptions, AICompletion, AIStreamChunk } from './models/ai-types'
import type { AIProviderType } from './providers'

const logger = createBuildSafeLogger('ai-fallback')

export interface FallbackConfig {
  /** Ordered list of providers to try. */
  providers: AIProviderType[]
  /** Max retry attempts per provider before falling over. Default 2. */
  maxRetries?: number
  /** Initial backoff in ms. Default 500. */
  initialBackoffMs?: number
  /** Max backoff in ms. Default 8000. */
  maxBackoffMs?: number
  /** Jitter factor (0..1) applied to backoff. Default 0.25. */
  jitterFactor?: number
}

/** Error wrapping a failed provider attempt. */
class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: AIProviderType,
    public readonly isRetryable: boolean,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

/**
 * Determine if an error is retryable.
 * Retryable: network errors, 429, 5xx, rate limit errors.
 * Non-retryable: 4xx (except 429), validation errors.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof ProviderError) return error.isRetryable

  const msg = error instanceof Error ? error.message : String(error)

  // Rate limit errors are retryable
  if (msg.includes('429') || msg.includes('Rate limit')) return true

  // 5xx server errors are retryable
  if (/\b5\d\d\b/.test(msg)) return true

  // Network errors (fetch failed, ECONNRESET, ETIMEDOUT, etc.) are retryable
  if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|ERR_NETWORK|socket hang up/i.test(msg)) {
    return true
  }

  // 4xx client errors (except 429, handled above) are non-retryable
  if (/\b4\d\d\b/.test(msg)) return false

  // Default: retry on unknown errors (safer fallback)
  return true
}

/** Sleep with exponential backoff + jitter. */
function backoff(attempt: number, initialMs: number, maxMs: number, jitter: number): Promise<void> {
  const exp = Math.min(initialMs * Math.pow(2, attempt), maxMs)
  const jitterAmount = exp * jitter * (Math.random() * 2 - 1)
  const delay = Math.max(0, Math.round(exp + jitterAmount))
  return new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * Type for the service-creation function injected from providers.ts
 * to avoid a circular import.
 */
export type ServiceResolver = (provider: AIProviderType) => {
  createChatCompletion(messages: AIMessage[], options?: AIServiceOptions): Promise<AICompletion>
  createStreamingChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AsyncGenerator<AIStreamChunk, void, void>>
} | null

/**
 * Execute a chat completion with fallback across providers.
 *
 * Tries each provider in order. Within each provider, retries up to
 * `maxRetries` with exponential backoff. On exhaustion, moves to the
 * next provider.
 */
export async function executeWithFallback(
  resolveService: ServiceResolver,
  config: FallbackConfig,
  messages: AIMessage[],
  options?: AIServiceOptions,
): Promise<AICompletion> {
  const maxRetries = config.maxRetries ?? 2
  const initialBackoff = config.initialBackoffMs ?? 500
  const maxBackoff = config.maxBackoffMs ?? 8000
  const jitter = config.jitterFactor ?? 0.25

  const errors: Array<{ provider: AIProviderType; error: unknown }> = []

  for (const provider of config.providers) {
    const service = resolveService(provider)
    if (!service) {
      logger.warn(`Provider ${provider} not available, skipping`)
      continue
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await service.createChatCompletion(messages, options)
        if (attempt > 0) {
          logger.info(`${provider} succeeded on attempt ${attempt + 1}`)
        }
        return result
      } catch (error: unknown) {
        const retryable = isRetryableError(error)
        logger.warn(`${provider} attempt ${attempt + 1}/${maxRetries + 1} failed: ${error instanceof Error ? error.message : String(error)}`, {
          retryable,
          attempt,
        })
        errors.push({ provider, error })

        if (!retryable) {
          // Non-retryable — move to next provider immediately
          break
        }

        if (attempt < maxRetries) {
          await backoff(attempt, initialBackoff, maxBackoff, jitter)
        }
      }
    }
  }

  // All providers exhausted
  const lastError = errors[errors.length - 1]
  throw new ProviderError(
    `All providers failed: ${errors.map((e) => e.provider).join(' → ')}`,
    lastError?.provider ?? config.providers[0],
    false,
    undefined,
    lastError?.error,
  )
}

/**
 * Execute a streaming chat completion with fallback.
 *
 * Streaming fallback is more nuanced: once the first chunk is received
 * from a provider, we commit to that provider for the rest of the stream.
 * If the first chunk fails, we fall over to the next provider.
 */
export async function executeStreamingWithFallback(
  resolveService: ServiceResolver,
  config: FallbackConfig,
  messages: AIMessage[],
  options?: AIServiceOptions,
): Promise<AsyncGenerator<AIStreamChunk, void, void>> {
  const maxRetries = config.maxRetries ?? 2
  const initialBackoff = config.initialBackoffMs ?? 500
  const maxBackoff = config.maxBackoffMs ?? 8000
  const jitter = config.jitterFactor ?? 0.25

  for (const provider of config.providers) {
    const service = resolveService(provider)
    if (!service) {
      logger.warn(`Provider ${provider} not available, skipping`)
      continue
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const stream = await service.createStreamingChatCompletion(messages, options)
        // Consume the first chunk to verify the stream started successfully.
        const firstResult = await stream.next()
        if (firstResult.done) {
          // Stream ended immediately — treat as empty response, try next
          throw new ProviderError(
            `Provider ${provider} returned an empty stream`,
            provider,
            true,
          )
        }

        // First chunk received — return a composite generator that yields
        // the first chunk then delegates to the rest of the stream.
        const firstChunk = firstResult.value
        return (async function* (): AsyncGenerator<AIStreamChunk, void, void> {
          yield firstChunk
          yield* stream
        })()
      } catch (error: unknown) {
        const retryable = isRetryableError(error)
        logger.warn(`${provider} stream attempt ${attempt + 1}/${maxRetries + 1} failed: ${error instanceof Error ? error.message : String(error)}`, {
          retryable,
          attempt,
        })

        if (!retryable) break
        if (attempt < maxRetries) {
          await backoff(attempt, initialBackoff, maxBackoff, jitter)
        }
      }
    }
  }

  throw new ProviderError(
    `All providers failed for streaming: ${config.providers.join(' → ')}`,
    config.providers[0],
    false,
  )
}

/**
 * Build a default fallback chain from available providers.
 * Prefers the given primary provider, then tries others in order.
 */
export function buildFallbackChain(
  primary: AIProviderType,
  available: AIProviderType[],
): AIProviderType[] {
  const chain = [primary]
  for (const p of available) {
    if (p !== primary && !chain.includes(p)) {
      chain.push(p)
    }
  }
  return chain
}
