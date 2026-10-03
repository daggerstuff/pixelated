import type { ReviewProvider, ReviewRequest, ReviewResult } from './types'

export interface ProviderStep {
  provider: ReviewProvider
  /** Number of attempts allowed for this provider before falling through. */
  retries: number
}

export interface ChainAttempt {
  provider: string
  attempt: number
  outcome: 'success' | 'failure'
  error?: string
}

export interface ChainResult {
  result: ReviewResult
  /** Name of the provider that ultimately produced the result. */
  provider: string
  /** Total attempts made across all providers. */
  attempts: number
  /** True when a fallback provider (not the first step) produced the result. */
  degraded: boolean
  /** Ordered log of every attempt, for observability. */
  attemptsLog: ChainAttempt[]
}

export interface FailoverChainOptions {
  steps: ProviderStep[]
  /** Optional streaming sink for attempt-level events. */
  logger?: (attempt: ChainAttempt) => void
}

/**
 * Runs a list of providers in order, retrying each one before falling
 * through to the next. The last provider is expected to be a deterministic
 * fallback (the rule-based provider) so a review is always produced.
 *
 * Ordering and retry counts come from `config.ts`; this class is agnostic to
 * where the providers come from.
 */
export class FailoverChain {
  private readonly steps: ProviderStep[]
  private readonly logger: ((attempt: ChainAttempt) => void) | undefined

  constructor(options: FailoverChainOptions) {
    if (options.steps.length === 0) {
      throw new Error('FailoverChain requires at least one provider step')
    }
    this.steps = options.steps
    this.logger = options.logger
  }

  async review(request: ReviewRequest): Promise<ChainResult> {
    const attemptsLog: ChainAttempt[] = []
    let totalAttempts = 0
    let lastError: unknown

    for (let stepIndex = 0; stepIndex < this.steps.length; stepIndex++) {
      const step = this.steps[stepIndex]
      for (let attempt = 1; attempt <= step.retries; attempt++) {
        totalAttempts += 1
        try {
          const result = await step.provider.review(request)
          this.record(attemptsLog, step.provider.name, attempt, 'success')
          return {
            result,
            provider: step.provider.name,
            attempts: totalAttempts,
            degraded: stepIndex > 0,
            attemptsLog,
          }
        } catch (error) {
          lastError = error
          this.record(
            attemptsLog,
            step.provider.name,
            attempt,
            'failure',
            describeError(error),
          )
        }
      }
    }

    throw new Error(`All review providers failed: ${describeError(lastError)}`)
  }

  private record(
    log: ChainAttempt[],
    provider: string,
    attempt: number,
    outcome: 'success' | 'failure',
    error?: string,
  ): void {
    const entry: ChainAttempt = { provider, attempt, outcome, error }
    log.push(entry)
    this.logger?.(entry)
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
