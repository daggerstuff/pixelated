import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'

import { buildReviewPrompt, LlmProvider, reviewResultSchema } from './llm'

/** Default primary model (matches the existing OpenHands review model id). */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929'

/**
 * Anthropic (Claude) review provider. Requires `ANTHROPIC_API_KEY` in the
 * environment at review time.
 */
export function createAnthropicReviewProvider(
  modelId = DEFAULT_ANTHROPIC_MODEL,
): LlmProvider {
  return new LlmProvider({
    name: 'anthropic',
    generate: async (request) => {
      const { object } = await generateObject({
        model: anthropic(modelId),
        schema: reviewResultSchema,
        prompt: buildReviewPrompt(request),
      })
      return object
    },
  })
}
