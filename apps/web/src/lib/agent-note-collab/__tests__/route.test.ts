import { describe, expect, it } from 'vitest'

import { routeTurn, HandoffPolicy } from '../route'
import type { NoteTurn } from '../turn-log'

describe('routeTurn', () => {
  const baseTurn: NoteTurn = {
    turnId: 'test-turn',
    artifactId: 'test-artifact',
    phase: 'Propose',
    role: 'scribe',
    agentId: 'agent-1',
    confidence: 0.9,
    assumptions: [],
    openQuestions: [],
    decision: 'Proceed with implementation',
    evidence: ['Existing data'],
    requestedAction: 'defer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const policy: HandoffPolicy = {
    minimumConfidenceForHandoff: 0.8,
    escalateOnOpenQuestions: 2,
    escalateOnMissingEvidence: true,
    maxRetriesBeforeEscalation: 3,
  }

  it('should accept valid turns', () => {
    const result = routeTurn(baseTurn, 0, policy)
    expect(result.action).toBe('accept')
    expect(result.nextPhase).toBe('Counter')
  })

  it('should retry if confidence is too low', () => {
    const lowConfidenceTurn = { ...baseTurn, confidence: 0.7 }
    const result = routeTurn(lowConfidenceTurn, 0, policy)
    expect(result.action).toBe('retry')
    if (result.action === 'retry') {
      expect(result.reason).toContain('Confidence below minimum')
    }
  })

  it('should escalate if too many open questions', () => {
    const manyQuestionsTurn = { ...baseTurn, openQuestions: ['Q1', 'Q2'] }
    const result = routeTurn(manyQuestionsTurn, 0, policy)
    expect(result.action).toBe('escalate')
    if (result.action === 'escalate') {
      expect(result.reason).toContain('unresolved ambiguity')
    }
  })

  it('should escalate if evidence is missing and required', () => {
    const noEvidenceTurn = { ...baseTurn, evidence: [] }
    const result = routeTurn(noEvidenceTurn, 0, policy)
    expect(result.action).toBe('escalate')
    if (result.action === 'escalate') {
      expect(result.reason).toContain('Evidence required')
    }
  })

  it('should escalate if retry count exceeds limit', () => {
    const result = routeTurn(baseTurn, 4, policy)
    expect(result.action).toBe('escalate')
    if (result.action === 'escalate') {
      expect(result.reason).toContain('threshold')
    }
  })

  it('should always accept Observe phase turns', () => {
    const observeTurn = {
      ...baseTurn,
      phase: 'Observe' as const,
      confidence: 0.1,
      evidence: [],
    }
    const result = routeTurn(observeTurn, 0, policy)
    expect(result.action).toBe('accept')
    expect(result.nextPhase).toBe('Propose')
  })
})
