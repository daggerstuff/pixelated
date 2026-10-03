import { describe, expect, it, vi } from 'vitest'

import { providerChainFromEnv } from './config'
import { FailoverChain } from './failover-chain'
import { RuleBasedProvider } from './providers/rule-based'
import type { ReviewProvider, ReviewRequest, ReviewResult } from './types'

type Behavior = 'ok' | 'fail' | 'failOnce'

function makeProvider(name: string, behavior: Behavior): ReviewProvider {
  let calls = 0
  return {
    name,
    async review(): Promise<ReviewResult> {
      calls += 1
      if (behavior === 'ok') {
        return ok(name)
      }
      if (behavior === 'fail') {
        throw new Error(`${name} unavailable`)
      }
      if (calls === 1) {
        throw new Error(`${name} first attempt unavailable`)
      }
      return ok(name)
    },
  }
}

function ok(name: string): ReviewResult {
  return { summary: `ok from ${name}`, comments: [] }
}

const request: ReviewRequest = {
  diff: 'diff --git a/x.ts b/x.ts\n@@ -1,1 +1,1 @@\n- old\n+ new\n',
}

describe('FailoverChain', () => {
  it('uses the primary provider and does not fall through on success', async () => {
    const chain = new FailoverChain({
      steps: [
        { provider: makeProvider('primary', 'ok'), retries: 3 },
        { provider: makeProvider('secondary', 'ok'), retries: 2 },
      ],
    })
    const out = await chain.review(request)
    expect(out.provider).toBe('primary')
    expect(out.degraded).toBe(false)
    expect(out.attempts).toBe(1)
    expect(out.attemptsLog).toHaveLength(1)
  })

  it('retries a provider before falling through', async () => {
    const chain = new FailoverChain({
      steps: [{ provider: makeProvider('primary', 'failOnce'), retries: 3 }],
    })
    const out = await chain.review(request)
    expect(out.provider).toBe('primary')
    expect(out.attempts).toBe(2)
    expect(out.attemptsLog[0].outcome).toBe('failure')
    expect(out.attemptsLog[1].outcome).toBe('success')
  })

  it('fails over to the secondary provider when primary is exhausted', async () => {
    const chain = new FailoverChain({
      steps: [
        { provider: makeProvider('primary', 'fail'), retries: 3 },
        { provider: makeProvider('secondary', 'ok'), retries: 2 },
      ],
    })
    const out = await chain.review(request)
    expect(out.provider).toBe('secondary')
    expect(out.degraded).toBe(true)
    expect(out.attempts).toBe(4)
  })

  it('falls back to rule-based when every LLM provider fails', async () => {
    const chain = new FailoverChain({
      steps: [
        { provider: makeProvider('primary', 'fail'), retries: 3 },
        { provider: makeProvider('secondary', 'fail'), retries: 2 },
        { provider: new RuleBasedProvider(), retries: 1 },
      ],
    })
    const out = await chain.review(request)
    expect(out.provider).toBe('rule-based')
    expect(out.degraded).toBe(true)
    expect(out.attempts).toBe(6)
    expect(out.result.summary).toContain('No rule-based issues')
  })

  it('logs every attempt in order via the logger and attemptsLog', async () => {
    const logger = vi.fn()
    const chain = new FailoverChain({
      steps: [
        { provider: makeProvider('primary', 'fail'), retries: 2 },
        { provider: makeProvider('secondary', 'ok'), retries: 1 },
      ],
      logger,
    })
    const out = await chain.review(request)
    expect(logger).toHaveBeenCalledTimes(3)
    expect(logger.mock.calls.map((call) => call[0].provider)).toEqual([
      'primary',
      'primary',
      'secondary',
    ])
    expect(out.attemptsLog).toHaveLength(3)
    expect(out.provider).toBe('secondary')
  })

  it('throws when every provider fails and no fallback is configured', async () => {
    const chain = new FailoverChain({
      steps: [{ provider: makeProvider('primary', 'fail'), retries: 1 }],
    })
    await expect(chain.review(request)).rejects.toThrow(
      /All review providers failed/,
    )
  })

  it('rejects an empty chain', () => {
    expect(() => new FailoverChain({ steps: [] })).toThrow(
      /at least one provider/,
    )
  })
})

describe('providerChainFromEnv', () => {
  it('orders primary, secondary, then rule-based fallback', () => {
    const spec = providerChainFromEnv({
      LLM_PRIMARY: 'anthropic',
      LLM_SECONDARY: 'openai',
    })
    expect(spec.map((step) => step.name)).toEqual([
      'anthropic',
      'openai',
      'rule-based',
    ])
    expect(spec[0].retries).toBe(3)
    expect(spec[1].retries).toBe(2)
    expect(spec[2].fallback).toBe(true)
  })

  it('uses only rule-based when no LLM providers are configured', () => {
    const spec = providerChainFromEnv({})
    expect(spec.map((step) => step.name)).toEqual(['rule-based'])
  })

  it('honours retry overrides and fallback disable', () => {
    const spec = providerChainFromEnv({
      LLM_PRIMARY: 'anthropic',
      LLM_SECONDARY: 'openai',
      LLM_PRIMARY_RETRIES: '5',
      LLM_SECONDARY_RETRIES: '0',
      LLM_RULE_BASED: 'false',
    })
    expect(spec.map((step) => step.name)).toEqual(['anthropic', 'openai'])
    expect(spec[0].retries).toBe(5)
    expect(spec[1].retries).toBe(2)
  })
})

describe('RuleBasedProvider', () => {
  it('flags known anti-patterns in added lines with file and line', async () => {
    const provider = new RuleBasedProvider()
    const diff = [
      'diff --git a/foo.ts b/foo.ts',
      '--- a/foo.ts',
      '+++ b/foo.ts',
      '@@ -1,3 +1,4 @@',
      ' const kept = true',
      '+console.log("debug")',
      '+const bar: any = null',
    ].join('\n')
    const result = await provider.review({ diff })
    expect(result.comments).toHaveLength(2)
    expect(result.comments[0]).toMatchObject({
      path: 'foo.ts',
      line: 2,
      body: expect.stringContaining('console'),
    })
    expect(result.comments[1]).toMatchObject({
      path: 'foo.ts',
      line: 3,
      body: expect.stringContaining('any'),
    })
  })

  it('returns an empty comment list for a clean diff', async () => {
    const provider = new RuleBasedProvider()
    const diff = [
      'diff --git a/foo.ts b/foo.ts',
      '--- a/foo.ts',
      '+++ b/foo.ts',
      '@@ -1,1 +1,1 @@',
      '- old',
      '+ new',
    ].join('\n')
    const result = await provider.review({ diff })
    expect(result.comments).toHaveLength(0)
    expect(result.summary).toContain('No rule-based issues')
  })
})
