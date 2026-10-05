import { z } from 'zod'

import type { ReviewProvider, ReviewRequest, ReviewResult } from '../types'

/**
 * Structured review the LLM must produce. Shape matches `ReviewResult` so the
 * adapter maps it back without transformation.
 */
export const reviewResultSchema = z.object({
  summary: z.string(),
  comments: z.array(
    z.object({
      path: z.string(),
      line: z.number().int().nullable(),
      body: z.string(),
    }),
  ),
})

export type LlmReview = z.infer<typeof reviewResultSchema>

/** Injected generation function; the concrete provider wires `generateObject`. */
export type GenerateReview = (request: ReviewRequest) => Promise<LlmReview>

export interface LlmProviderOptions {
  name: string
  generate: GenerateReview
}

/**
 * Adapts an LLM completion backend to the `ReviewProvider` interface. The
 * generation call is injected so the mapping is unit-testable without network
 * or API keys.
 */
export class LlmProvider implements ReviewProvider {
  readonly name: string
  private readonly generate: GenerateReview

  constructor(options: LlmProviderOptions) {
    this.name = options.name
    this.generate = options.generate
  }

  async review(request: ReviewRequest): Promise<ReviewResult> {
    const review = await this.generate(request)
    return { summary: review.summary, comments: review.comments }
  }
}

/** Builds the review prompt sent to the LLM for a given diff. */
export function buildReviewPrompt(request: ReviewRequest): string {
  const context = request.context
    ? `\n\n## Pull request context\n${request.context}`
    : ''
  return [
    'You are an automated code reviewer. Review the diff below and report only concrete, actionable issues.',
    'Focus on bugs, correctness, security, and clear mistakes. Skip stylistic preferences.',
    'Return a short summary and a list of comments; each comment must include the file path, a 1-based line number (or null for a file-level note), and the comment body.',
    '',
    '## Diff',
    '```diff',
    request.diff,
    '```',
    context,
  ].join('\n')
}
