/**
 * Reflection loop contracts — input context and output insights.
 *
 * Canonicalizes shapes that previously drifted across:
 * - src/lib/memory/reflection/reflexion.ts
 * - ai/memory/reflection_subagent.py
 * - src/lib/memory/reprioritization_engine.ts
 *
 * PIX-3897 / PIX-1914 (Sprint 4: Reflection & Learning)
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Outcome of a reflected action (mirrors FeedbackType in reflexion.ts). */
export const ReflectionOutcomeSchema = z.enum([
  'success',
  'failure',
  'partial',
  'neutral',
])

export type ReflectionOutcome = z.infer<typeof ReflectionOutcomeSchema>

// ---------------------------------------------------------------------------
// Output — single insight unit
// ---------------------------------------------------------------------------

export const ReflectionInsightSchema = z.object({
  /** Human-readable insight summary. */
  summary: z.string(),
  /**
   * Insight category — aligns with foresight reflection_engine insight types
   * and reflexion verbal sections (improvement, warning, etc.).
   */
  insightType: z.string(),
  /** Model confidence in [0, 1]. */
  confidence: z.number().min(0).max(1),
  /** Optional follow-up action (maps to reflexion `whatToChange` entries). */
  recommendedAction: z.string().optional(),
  /** Memory or evidence row IDs supporting this insight. */
  evidenceIds: z.array(z.string()),
  /** Service-specific metadata (never store PHI here). */
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type ReflectionInsight = z.infer<typeof ReflectionInsightSchema>

// ---------------------------------------------------------------------------
// Input — per-action reflection context
// ---------------------------------------------------------------------------

export const ReflectionContextSchema = z.object({
  /** Stable identifier for the action instance (pair id, tool call id, etc.). */
  actionId: z.string(),
  /** Action category or tool name. */
  actionType: z.string(),
  /** Observed outcome of the action. */
  outcome: ReflectionOutcomeSchema,
  /** End-user or evaluator feedback text. */
  userFeedback: z.string(),
  /** Detected cognitive or behavioral patterns relevant to the action. */
  cognitivePatterns: z.array(z.string()),
  /** Prior or derived insights attached to this context. */
  insights: z.array(ReflectionInsightSchema),
})

export type ReflectionContext = z.infer<typeof ReflectionContextSchema>

// ---------------------------------------------------------------------------
// Reflexion engine result (structural mirror of reflexion.ts)
// ---------------------------------------------------------------------------

export const ActionFeedbackPairSchema = z.object({
  action: z.string(),
  feedback: z.string(),
  feedbackType: ReflectionOutcomeSchema,
  timestampMs: z.number(),
  sessionId: z.string(),
})

export type ActionFeedbackPair = z.infer<typeof ActionFeedbackPairSchema>

export const VerbalReflectionSchema = z.object({
  reflectionId: z.string(),
  whatWentWell: z.array(z.string()),
  whatWentWrong: z.array(z.string()),
  whatToChange: z.array(z.string()),
  sourcePairs: z.array(ActionFeedbackPairSchema),
  confidence: z.number(),
})

export type VerbalReflection = z.infer<typeof VerbalReflectionSchema>

/**
 * Zod mirror of `ReflexionResult` in src/lib/memory/reflection/reflexion.ts.
 * Use this schema to validate reflexion engine output at API boundaries.
 */
export const ReflexionResultSchema = z.object({
  reflections: z.array(VerbalReflectionSchema),
  contextUpdates: z.array(z.string()),
  memoriesToUpdate: z.array(z.string()),
  elapsedMs: z.number(),
})

export type ReflexionResult = z.infer<typeof ReflexionResultSchema>

// ---------------------------------------------------------------------------
// Bridges between context pairs and reflexion result
// ---------------------------------------------------------------------------

/** Map a reflexion action/feedback pair into the canonical reflection context. */
export function actionFeedbackPairToReflectionContext(
  pair: ActionFeedbackPair,
  options?: {
    actionId?: string
    cognitivePatterns?: string[]
    insights?: ReflectionInsight[]
  },
): ReflectionContext {
  return {
    actionId: options?.actionId ?? `${pair.sessionId}:${pair.timestampMs}`,
    actionType: pair.action,
    outcome: pair.feedbackType,
    userFeedback: pair.feedback,
    cognitivePatterns: options?.cognitivePatterns ?? [],
    insights: options?.insights ?? [],
  }
}

/** Map a verbal reflection section into a canonical insight. */
export function verbalReflectionToInsights(
  reflection: VerbalReflection,
): ReflectionInsight[] {
  const insights: ReflectionInsight[] = []

  for (const summary of reflection.whatWentWell) {
    insights.push({
      summary,
      insightType: 'success',
      confidence: reflection.confidence,
      evidenceIds: reflection.sourcePairs.map(
        (pair) => `${pair.sessionId}:${pair.timestampMs}`,
      ),
    })
  }

  for (const summary of reflection.whatWentWrong) {
    insights.push({
      summary,
      insightType: 'failure',
      confidence: reflection.confidence,
      evidenceIds: reflection.sourcePairs.map(
        (pair) => `${pair.sessionId}:${pair.timestampMs}`,
      ),
    })
  }

  for (const recommendedAction of reflection.whatToChange) {
    insights.push({
      summary: recommendedAction,
      insightType: 'improvement',
      confidence: reflection.confidence,
      recommendedAction,
      evidenceIds: reflection.sourcePairs.map(
        (pair) => `${pair.sessionId}:${pair.timestampMs}`,
      ),
    })
  }

  return insights
}
