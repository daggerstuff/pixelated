import { describe, expect, it, vi } from 'vitest'

import { buildChainFromEnv, defaultProviderFactory } from './chain-factory'
import { RuleBasedProvider } from './providers/rule-based'
import type { ReviewProvider, ReviewRequest, ReviewResult } from './types'

function stubProvider(name: string, fail = false): ReviewProvider {
  return {
    name,
    async review(): Promise<ReviewResult> {
      if (fail) {
        throw new Error(`${name} down`)
      }
      return { summary: `ok ${name}`, comments: [] }
    },
  }
}

const request: ReviewRequest = { diff: 'x' }

describe('buildChainFromEnv', () => {
  it('wires providers in env order with rule-based last', () => {
    const factory = vi.fn((name: string) => stubProvider(name))
    const chain = buildChainFromEnv(
      { LLM_PRIMARY: 'a', LLM_SECONDARY: 'b' },
      factory,
    )
    expect(factory.mock.calls.map((call) => call[0])).toEqual([
      'a',
      'b',
      'rule-based',
    ])
    expect(chain).toBeDefined()
  })

  it('fails over through the env-configured chain', async () => {
    const factory = (name: string) => {
      if (name === 'primary') {
        return stubProvider('primary', true)
      }
      if (name === 'secondary') {
        return stubProvider('secondary')
      }
      return new RuleBasedProvider()
    }
    const chain = buildChainFromEnv(
      { LLM_PRIMARY: 'primary', LLM_SECONDARY: 'secondary' },
      factory,
    )
    const out = await chain.review(request)
    expect(out.provider).toBe('secondary')
  })

  it('falls back to rule-based when both LLM providers fail', async () => {
    const factory = (name: string) =>
      name === 'rule-based' ? new RuleBasedProvider() : stubProvider(name, true)
    const chain = buildChainFromEnv(
      { LLM_PRIMARY: 'primary', LLM_SECONDARY: 'secondary' },
      factory,
    )
    const out = await chain.review(request)
    expect(out.provider).toBe('rule-based')
  })

  it('throws for an unknown provider name', () => {
    expect(() =>
      buildChainFromEnv({ LLM_PRIMARY: 'unknown-provider' }, () => undefined),
    ).toThrow(/Unknown review provider/)
  })

  it('uses only rule-based when no LLM env is set', () => {
    const factory = vi.fn(() => new RuleBasedProvider())
    const chain = buildChainFromEnv({}, factory)
    expect(factory.mock.calls.map((call) => call[0])).toEqual(['rule-based'])
  })
})

describe('defaultProviderFactory', () => {
  it('resolves known provider names to instances with stable names', () => {
    expect(defaultProviderFactory('anthropic')?.name).toBe('anthropic')
    expect(defaultProviderFactory('openai')?.name).toBe('openai')
    expect(defaultProviderFactory('rule-based')?.name).toBe('rule-based')
    expect(defaultProviderFactory('nope')).toBeUndefined()
  })
})
