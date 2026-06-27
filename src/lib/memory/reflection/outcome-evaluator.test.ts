import type { ReflectionContext } from '@pixelated/memory-schema'
import { describe, test, expect } from 'vitest'

import {
  evaluateReflectionOutcome,
  createRuleBasedEvaluator,
  DEFAULT_EVALUATOR,
} from './outcome-evaluator'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(
  overrides: Partial<ReflectionContext> = {},
): ReflectionContext {
  return {
    actionId:
      overrides.actionId ?? `act_${Math.random().toString(36).slice(2, 10)}`,
    actionType: overrides.actionType ?? 'test_action',
    outcome: overrides.outcome ?? 'neutral',
    userFeedback: overrides.userFeedback ?? '',
    cognitivePatterns: overrides.cognitivePatterns ?? [],
    insights: overrides.insights ?? [],
  }
}

// ---------------------------------------------------------------------------
// evaluateReflectionOutcome
// ---------------------------------------------------------------------------

describe('evaluateReflectionOutcome', () => {
  describe('context-based classification', () => {
    test('returns success when context outcome is success', () => {
      const ctx = makeContext({
        outcome: 'success',
        userFeedback: 'The model responded empathetically.',
      })
      const result = evaluateReflectionOutcome(ctx)
      expect(result.outcome).toBe('success')
      expect(result.rationale).toBeTruthy()
      expect(result.confidence).toBeGreaterThanOrEqual(0.7)
    })

    test('returns failure when context outcome is failure', () => {
      const ctx = makeContext({
        outcome: 'failure',
        userFeedback: 'The model gave irrelevant advice.',
      })
      const result = evaluateReflectionOutcome(ctx)
      expect(result.outcome).toBe('failure')
      expect(result.rationale).toBeTruthy()
      expect(result.confidence).toBeGreaterThanOrEqual(0.7)
    })

    test('returns partial when context outcome is partial', () => {
      const ctx = makeContext({
        outcome: 'partial',
        userFeedback: 'Model identified the issue but solution was incomplete.',
      })
      const result = evaluateReflectionOutcome(ctx)
      expect(result.outcome).toBe('partial')
      expect(result.rationale).toBeTruthy()
      expect(result.confidence).toBeGreaterThanOrEqual(0.6)
    })

    test('classifies neutral outcome with negative feedback as failure', () => {
      const ctx = makeContext({
        outcome: 'neutral',
        userFeedback: 'Got an error when calling the API.',
      })
      const result = evaluateReflectionOutcome(ctx)
      expect(result.outcome).toBe('failure')
      expect(result.rationale).toContain('negative signal')
    })

    test('classifies neutral outcome with positive feedback as success', () => {
      const ctx = makeContext({
        outcome: 'neutral',
        userFeedback: 'Successfully completed the task.',
      })
      const result = evaluateReflectionOutcome(ctx)
      expect(result.outcome).toBe('success')
      expect(result.rationale).toContain('positive signal')
    })

    test('returns neutral when no signal is present', () => {
      const ctx = makeContext({
        outcome: 'neutral',
        userFeedback: 'Hmm, not sure about this one.',
      })
      const result = evaluateReflectionOutcome(ctx)
      expect(result.outcome).toBe('neutral')
      expect(result.confidence).toBeLessThan(0.5)
    })

    test('returns neutral when feedback is empty and outcome is neutral', () => {
      const ctx = makeContext({
        outcome: 'neutral',
        userFeedback: '',
      })
      const result = evaluateReflectionOutcome(ctx)
      expect(result.outcome).toBe('neutral')
      expect(result.confidence).toBeLessThan(0.5)
    })
  })

  describe('cognitive pattern signals', () => {
    test('detects risk patterns and returns partial', () => {
      const ctx = makeContext({
        outcome: 'neutral',
        userFeedback: 'It worked but I saw something concerning.',
        cognitivePatterns: ['error_rate_increased', 'latency_regression'],
      })
      const result = evaluateReflectionOutcome(ctx)
      expect(result.outcome).toBe('partial')
      expect(result.rationale).toContain('risk')
    })

    test('failure keyword in cognitive patterns triggers partial', () => {
      const ctx = makeContext({
        outcome: 'neutral',
        userFeedback: 'Mostly fine.',
        cognitivePatterns: ['pattern_failure_detected'],
      })
      const result = evaluateReflectionOutcome(ctx)
      expect(result.outcome).toBe('partial')
    })
  })

  describe('ground-truth overrides', () => {
    test('groundTruth.success=true overrides to success', () => {
      const ctx = makeContext({
        outcome: 'failure',
        userFeedback: 'Seemed bad.',
      })
      const result = evaluateReflectionOutcome(ctx, { success: true })
      expect(result.outcome).toBe('success')
      expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    })

    test('groundTruth.success=false overrides to failure', () => {
      const ctx = makeContext({
        outcome: 'success',
        userFeedback: 'Seemed good.',
      })
      const result = evaluateReflectionOutcome(ctx, { success: false })
      expect(result.outcome).toBe('failure')
      expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    })

    test('groundTruth.userOverride takes highest priority', () => {
      const ctx = makeContext({
        outcome: 'failure',
        userFeedback: 'Clearly failed.',
      })
      const result = evaluateReflectionOutcome(ctx, {
        userOverride: 'success',
      })
      expect(result.outcome).toBe('success')
      expect(result.confidence).toBe(1.0)
      expect(result.rationale).toContain('overridden')
    })
  })

  describe('createRuleBasedEvaluator', () => {
    test('returns a callable evaluator with same behavior', () => {
      const evaluator = createRuleBasedEvaluator()
      const ctx = makeContext({
        outcome: 'success',
        userFeedback: 'All good.',
      })
      const result = evaluator(ctx)
      expect(result.outcome).toBe('success')
      expect(result.rationale).toBeTruthy()
    })
  })

  describe('DEFAULT_EVALUATOR', () => {
    test('is the same function as evaluateReflectionOutcome', () => {
      expect(DEFAULT_EVALUATOR).toBe(evaluateReflectionOutcome)
    })
  })
})
