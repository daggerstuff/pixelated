/**
 * Outcome evaluation layer for the reflection loop.
 *
 * Takes a `ReflectionContext` (from `@pixelated/memory-schema`) and an optional
 * ground-truth signal and classifies the action outcome into one of four
 * states: `success`, `failure`, `partial`, or `unclear`.
 *
 * PIX-3898 — Sprint 4: Reflection & Learning
 */

import type {
  ReflectionContext,
  ReflectionOutcome,
} from '@pixelated/memory-schema'

// Re-export the canonical outcome type so consumers don't need a direct
// dependency on the schema package for this one type.
export type { ReflectionOutcome } from '@pixelated/memory-schema'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Result of evaluating a single reflection context. */
export interface EvaluationResult {
  /** Classified outcome. */
  outcome: ReflectionOutcome
  /** Human-readable rationale for the classification. */
  rationale: string
  /** Confidence in the classification [0, 1]. */
  confidence: number
}

/** Optional ground-truth signal that overrides / adjusts the evaluation. */
export interface GroundTruthSignal {
  /** Whether the downstream action is known to have succeeded. */
  success?: boolean
  /** Direct user correction of the outcome (overrides all other signals). */
  userOverride?: ReflectionOutcome
}

/**
 * Signature for pluggable evaluation strategies — consumers can swap the
 * rule-based evaluator for an LLM-backed one without changing call sites.
 */
export type OutcomeEvaluator = (
  context: ReflectionContext,
  groundTruth?: GroundTruthSignal,
) => EvaluationResult

// ---------------------------------------------------------------------------
// Default (rule-based) evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate a reflection context and return a classified outcome with rationale.
 *
 * The default strategy is rule-based:
 *  1. If `groundTruth.userOverride` is set, use it immediately.
 *  2. If `groundTruth.success` is explicitly `true`, map to `success`;
 *     if explicitly `false`, map to `failure`.
 *  3. Otherwise, classify from the context's own outcome, user feedback
 *     sentiment, and cognitive pattern signals.
 *
 * Consumers may pass a custom `OutcomeEvaluator` fn to replace the logic
 * (e.g. an LLM-based classifier).
 */
export function evaluateReflectionOutcome(
  context: ReflectionContext,
  groundTruth?: GroundTruthSignal,
): EvaluationResult {
  // --- Override path (highest priority) ---
  if (groundTruth?.userOverride) {
    return {
      outcome: groundTruth.userOverride,
      rationale: `Outcome overridden by user to '${groundTruth.userOverride}'.`,
      confidence: 1.0,
    }
  }

  if (groundTruth?.success === true) {
    return {
      outcome: 'success',
      rationale:
        'Ground-truth signal indicates the downstream action succeeded.',
      confidence: 0.95,
    }
  }

  if (groundTruth?.success === false) {
    return {
      outcome: 'failure',
      rationale: 'Ground-truth signal indicates the downstream action failed.',
      confidence: 0.95,
    }
  }

  // --- Rule-based classification ---
  return classifyFromContext(context)
}

/**
 * Create a reusable rule-based evaluator with the same logic as
 * `evaluateReflectionOutcome` but without needing to re-import.
 */
export function createRuleBasedEvaluator(): OutcomeEvaluator {
  return (context: ReflectionContext, groundTruth?: GroundTruthSignal) =>
    evaluateReflectionOutcome(context, groundTruth)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const NEGATIVE_KEYWORDS = [
  'error',
  'fail',
  'incorrect',
  'wrong',
  'bad',
  'unable',
  'could not',
  "didn't work",
  'not working',
  'timeout',
  'exception',
]

const POSITIVE_KEYWORDS = [
  'success',
  'completed',
  'ok',
  'done',
  'correct',
  'good',
  'passed',
  'verified',
]

function classifyFromContext(context: ReflectionContext): EvaluationResult {
  const { outcome, userFeedback, cognitivePatterns } = context

  // --- If the context already has a definitive non-neutral outcome, trust it
  //     (but still provide a rationale). ---
  if (outcome === 'success') {
    return {
      outcome: 'success',
      rationale:
        userFeedback ||
        'Action outcome recorded as success in the reflection context.',
      confidence: 0.8,
    }
  }

  if (outcome === 'failure') {
    return {
      outcome: 'failure',
      rationale:
        userFeedback ||
        'Action outcome recorded as failure in the reflection context.',
      confidence: 0.8,
    }
  }

  if (outcome === 'partial') {
    return {
      outcome: 'partial',
      rationale:
        userFeedback ||
        'Action outcome recorded as partial in the reflection context.',
      confidence: 0.7,
    }
  }

  // --- Neutral / ambiguous context — probe user feedback text ---
  const feedback = userFeedback.toLowerCase()

  // Check for strong negative signals
  const hasNegativeKeyword = NEGATIVE_KEYWORDS.some((kw) =>
    feedback.includes(kw),
  )
  if (hasNegativeKeyword) {
    return {
      outcome: 'failure',
      rationale: `User feedback contains negative signal: "${userFeedback}".`,
      confidence: 0.65,
    }
  }

  // Check for strong positive signals
  const hasPositiveKeyword = POSITIVE_KEYWORDS.some((kw) =>
    feedback.includes(kw),
  )
  if (hasPositiveKeyword) {
    return {
      outcome: 'success',
      rationale: `User feedback contains positive signal: "${userFeedback}".`,
      confidence: 0.65,
    }
  }

  // --- Check cognitive patterns for risk signals ---
  const hasRiskPattern = cognitivePatterns.some(
    (p) =>
      p.toLowerCase().includes('error') ||
      p.toLowerCase().includes('regression') ||
      p.toLowerCase().includes('failure'),
  )
  if (hasRiskPattern) {
    return {
      outcome: 'partial',
      rationale: `Cognitive patterns indicate risk: ${cognitivePatterns.filter((p) => p.toLowerCase().includes('error') || p.toLowerCase().includes('regression') || p.toLowerCase().includes('failure')).join(', ')}.`,
      confidence: 0.6,
    }
  }

  // --- Insufficient signal ---
  return {
    outcome: 'neutral',
    rationale: userFeedback
      ? `No clear success or failure signal in feedback: "${userFeedback}".`
      : 'No user feedback available and outcome is neutral. Cannot determine success or failure.',
    confidence: 0.4,
  }
}

export const DEFAULT_EVALUATOR: OutcomeEvaluator = evaluateReflectionOutcome
