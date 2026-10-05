import { describe, expect, it } from 'vitest'

import { createAnthropicReviewProvider } from './anthropic'
import { buildReviewPrompt, LlmProvider, reviewResultSchema } from './llm'
import { createOpenaiReviewProvider } from './openai'

describe('LlmProvider', () => {
  it('maps a structured LLM review to a ReviewResult', async () => {
    const provider = new LlmProvider({
      name: 'test-llm',
      generate: async () => ({
        summary: 'looks good',
        comments: [{ path: 'a.ts', line: 4, body: 'check this' }],
      }),
    })
    const result = await provider.review({ diff: '...' })
    expect(result).toEqual({
      summary: 'looks good',
      comments: [{ path: 'a.ts', line: 4, body: 'check this' }],
    })
  })

  it('exposes its provider name', () => {
    const provider = new LlmProvider({
      name: 'anthropic',
      generate: async () => ({ summary: 'ok', comments: [] }),
    })
    expect(provider.name).toBe('anthropic')
  })
})

describe('buildReviewPrompt', () => {
  it('includes the diff, instructions, and optional context', () => {
    const prompt = buildReviewPrompt({ diff: '+foo()', context: 'fix the bug' })
    expect(prompt).toContain('+foo()')
    expect(prompt).toContain('fix the bug')
    expect(prompt).toContain('automated code reviewer')
  })

  it('omits the context section when context is absent', () => {
    const prompt = buildReviewPrompt({ diff: '+foo()' })
    expect(prompt).not.toContain('Pull request context')
  })
})

describe('reviewResultSchema', () => {
  it('accepts a valid review', () => {
    const parsed = reviewResultSchema.safeParse({
      summary: 'ok',
      comments: [{ path: 'a.ts', line: 1, body: 'x' }],
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts a null line for file-level comments', () => {
    const parsed = reviewResultSchema.safeParse({
      summary: 'ok',
      comments: [{ path: 'a.ts', line: null, body: 'x' }],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects a comment missing its body', () => {
    const parsed = reviewResultSchema.safeParse({
      summary: 'ok',
      comments: [{ path: 'a.ts', line: 1 }],
    })
    expect(parsed.success).toBe(false)
  })
})

describe('concrete provider factories', () => {
  it('construct Anthropic and OpenAI providers with stable names', () => {
    expect(createAnthropicReviewProvider().name).toBe('anthropic')
    expect(createOpenaiReviewProvider().name).toBe('openai')
  })
})
