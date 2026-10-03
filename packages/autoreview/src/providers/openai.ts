import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'

import { buildReviewPrompt, LlmProvider, reviewResultSchema } from './llm'

/** Default secondary model. */
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

/**
 * OpenAI review provider. Requires `OPENAI_API_KEY` in the environment at
 * review time.
 */
export function createOpenaiReviewProvider(
  modelId = DEFAULT_OPENAI_MODEL,
): LlmProvider {
  return new LlmProvider({
    name: 'openai',
    generate: async (request) => {
      const { object } = await generateObject({
        model: openai(modelId),
        schema: reviewResultSchema,
        prompt: buildReviewPrompt(request),
      })
      return object
    },
  })
}
