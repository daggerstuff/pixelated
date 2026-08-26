import { describe, expect, it } from 'vitest'

import { CRITICAL_BLOCK_REASON, evaluateChatGate } from './evaluate-chat-gate'

describe('evaluateChatGate', () => {
  it('blocks critical crisis language with the structured gate reason', () => {
    const result = evaluateChatGate('I want to kill myself right now')

    expect(result.decision).toBe('block')
    expect(result.reason).toBe(CRITICAL_BLOCK_REASON)
    expect(result.suggestedTags).toContain('CRISIS_SIGNAL')
  })

  it('allows normal therapeutic content through', () => {
    const result = evaluateChatGate('I had a productive therapy session today.')

    expect(result.decision).toBe('auto')
    expect(result.reason).toBe('Normal information flow.')
  })
})
