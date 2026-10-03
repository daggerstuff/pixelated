/**
 * Core shared types for the AutoReview bot.
 *
 * The `ReviewProvider` interface is the provider abstraction the failover
 * chain works against: primary LLM, secondary LLM, and the deterministic
 * rule-based fallback all implement it so the chain can treat them uniformly.
 */

export interface ReviewComment {
  /** File path the comment applies to. */
  path: string
  /** 1-based line number, or `null` for a file-level comment. */
  line: number | null
  /** Comment body (markdown). */
  body: string
}

export interface ReviewResult {
  /** Structured review comments. */
  comments: ReviewComment[]
  /** Human-readable summary of the review. */
  summary: string
}

export interface ReviewRequest {
  /** Unified diff text to review. */
  diff: string
  /** Optional PR context (title, description). */
  context?: string
}

/**
 * A review backend. Throwing signals a failed attempt, which lets the
 * failover chain retry the provider or fall through to the next one.
 */
export interface ReviewProvider {
  /** Stable provider identifier used in attempt logs (e.g. "anthropic"). */
  readonly name: string
  review(request: ReviewRequest): Promise<ReviewResult>
}
