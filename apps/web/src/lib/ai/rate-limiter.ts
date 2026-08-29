/**
 * Token-bucket rate limiter for AI provider API calls.
 *
 * Each provider gets its own bucket. The bucket refills at a configurable
 * rate (tokens per interval) up to a maximum capacity. When a request
 * arrives and no token is available, the caller waits until one refills
 * (bounded by a max wait) or throws immediately if `throwOnLimit` is set.
 *
 * Configuration is sourced from environment variables per provider:
 *   <PROVIDER>_RATE_LIMIT_RPM   — requests per minute (default: 60)
 *   <PROVIDER>_RATE_LIMIT_BURST — burst capacity (default: RPM)
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('ai-rate-limiter')

interface RateLimiterConfig {
  /** Maximum tokens the bucket can hold (burst capacity). */
  capacity: number
  /** Tokens added per millisecond. */
  refillRatePerMs: number
  /** Max time (ms) to wait for a token before throwing. Default 30_000. */
  maxWaitMs: number
}

interface RateLimitOptions {
  /** Requests per minute. Default 60. */
  requestsPerMinute?: number
  /** Burst capacity. Defaults to requestsPerMinute. */
  burst?: number
  /** Max wait time in ms. Default 30_000. */
  maxWaitMs?: number
}

/** Custom error so callers can distinguish rate-limit rejections. */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly retryAfterMs: number,
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}

/**
 * Token-bucket rate limiter. Thread-safe via async mutex on `acquire`.
 */
export class TokenBucketRateLimiter {
  private tokens: number
  private lastRefillTime: number
  private readonly config: RateLimiterConfig
  private readonly provider: string
  private waitQueue: Array<{ resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }> = []
  private processing = false

  constructor(provider: string, config: RateLimiterConfig) {
    this.provider = provider
    this.config = config
    this.tokens = config.capacity
    this.lastRefillTime = Date.now()
  }

  /** Refill tokens based on elapsed time since last refill. */
  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefillTime
    if (elapsed <= 0) return
    const refilled = elapsed * this.config.refillRatePerMs
    this.tokens = Math.min(this.config.capacity, this.tokens + refilled)
    this.lastRefillTime = now
  }

  /** Try to acquire a token without waiting. Returns true on success. */
  tryAcquire(): boolean {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return true
    }
    return false
  }

  /**
   * Acquire a token, waiting up to `maxWaitMs` if the bucket is empty.
   * Throws `RateLimitError` if no token becomes available in time.
   */
  async acquire(): Promise<void> {
    if (this.tryAcquire()) return

    // Estimate wait time: time for 1 token to refill
    const waitMs = Math.ceil(1 / this.config.refillRatePerMs)
    if (waitMs > this.config.maxWaitMs) {
      throw new RateLimitError(
        `Rate limit exceeded for ${this.provider}; retry after ${waitMs}ms`,
        this.provider,
        waitMs,
      )
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeFromQueue(entry)
        reject(
          new RateLimitError(
            `Rate limit wait timed out for ${this.provider} after ${this.config.maxWaitMs}ms`,
            this.provider,
            this.config.maxWaitMs,
          ),
        )
      }, this.config.maxWaitMs)

      const entry = { resolve, reject, timer }
      this.waitQueue.push(entry)
      this.processQueue()
    })
  }

  /** Process the wait queue, distributing refilled tokens. */
  private processQueue(): void {
    if (this.processing) return
    this.processing = true
    try {
      while (this.waitQueue.length > 0) {
        this.refill()
        if (this.tokens < 1) break
        this.tokens -= 1
        const entry = this.waitQueue.shift()!
        clearTimeout(entry.timer)
        entry.resolve()
      }
    } finally {
      this.processing = false
    }
    // If there are still waiters, schedule a check after the estimated refill time
    if (this.waitQueue.length > 0) {
      const waitMs = Math.ceil(1 / this.config.refillRatePerMs)
      setTimeout(() => this.processQueue(), Math.min(waitMs, 100))
    }
  }

  private removeFromQueue(target: { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }): void {
    const idx = this.waitQueue.indexOf(target)
    if (idx >= 0) {
      this.waitQueue.splice(idx, 1)
    }
  }

  /** Current available tokens (for observability/testing). */
  get availableTokens(): number {
    this.refill()
    return Math.floor(this.tokens)
  }

  /** Reset bucket to full capacity (for testing). */
  reset(): void {
    this.tokens = this.config.capacity
    this.lastRefillTime = Date.now()
    this.waitQueue.forEach((e) => {
      clearTimeout(e.timer)
      e.resolve()
    })
    this.waitQueue = []
  }
}

// ---------------------------------------------------------------------------
// Per-provider limiter registry
// ---------------------------------------------------------------------------

const limiters = new Map<string, TokenBucketRateLimiter>()

const PROVIDER_ENV_KEYS: Record<string, { rpm: string; burst: string }> = {
  anthropic: { rpm: 'ANTHROPIC_RATE_LIMIT_RPM', burst: 'ANTHROPIC_RATE_LIMIT_BURST' },
  openai: { rpm: 'OPENAI_RATE_LIMIT_RPM', burst: 'OPENAI_RATE_LIMIT_BURST' },
  'azure-openai': { rpm: 'AZURE_OPENAI_RATE_LIMIT_RPM', burst: 'AZURE_OPENAI_RATE_LIMIT_BURST' },
  llm: { rpm: 'LLM_RATE_LIMIT_RPM', burst: 'LLM_RATE_LIMIT_BURST' },
  nvidia: { rpm: 'NVIDIA_RATE_LIMIT_RPM', burst: 'NVIDIA_RATE_LIMIT_BURST' },
  huggingface: { rpm: 'HUGGINGFACE_RATE_LIMIT_RPM', burst: 'HUGGINGFACE_RATE_LIMIT_BURST' },
  local: { rpm: 'LOCAL_RATE_LIMIT_RPM', burst: 'LOCAL_RATE_LIMIT_BURST' },
}

function getEnvVar(key: string): string | undefined {
  const metaEnv = import.meta.env as Record<string, string> | undefined
  return process.env[key] ?? metaEnv?.[key]
}

function getLimiter(provider: string): TokenBucketRateLimiter {
  let limiter = limiters.get(provider)
  if (limiter) return limiter

  const envKeys = PROVIDER_ENV_KEYS[provider]
  const rpm = envKeys ? Number(getEnvVar(envKeys.rpm) ?? 60) : 60
  const burst = envKeys ? Number(getEnvVar(envKeys.burst) ?? rpm) : rpm
  const maxWaitMs = Number(getEnvVar('AI_RATE_LIMIT_MAX_WAIT_MS') ?? 30_000)

  const safeRpm = Math.max(1, rpm)
  const safeBurst = Math.max(1, burst)

  limiter = new TokenBucketRateLimiter(provider, {
    capacity: safeBurst,
    refillRatePerMs: safeRpm / 60_000,
    maxWaitMs,
  })
  limiters.set(provider, limiter)
  logger.info(`Rate limiter for ${provider}: ${safeRpm} rpm, burst ${safeBurst}`)
  return limiter
}

/**
 * Acquire a rate-limit token for the given provider.
 * Throws `RateLimitError` if the limit is exceeded and cannot be waited for.
 */
export async function acquireRateLimit(provider: string): Promise<void> {
  const limiter = getLimiter(provider)
  await limiter.acquire()
}

/**
 * Try to acquire a rate-limit token without waiting.
 * Returns true on success, false if the bucket is empty.
 */
export function tryAcquireRateLimit(provider: string): boolean {
  const limiter = getLimiter(provider)
  return limiter.tryAcquire()
}

/** Get the rate limiter instance for a provider (for testing). */

/** Reset all limiters (for testing). */
export function resetAllRateLimiters(): void {
  for (const limiter of limiters.values()) {
    limiter.reset()
  }
  limiters.clear()
}

/** Create a rate limiter with explicit options (for testing). */
export function createRateLimiter(provider: string, options: RateLimitOptions): TokenBucketRateLimiter {
  const rpm = options.requestsPerMinute ?? 60
  const burst = options.burst ?? rpm
  const maxWaitMs = options.maxWaitMs ?? 30_000
  const limiter = new TokenBucketRateLimiter(provider, {
    capacity: burst,
    refillRatePerMs: rpm / 60_000,
    maxWaitMs,
  })
  limiters.set(provider, limiter)
  return limiter
}
