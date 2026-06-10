/**
 * @pixelated/memory-schema — Factory defaults & construction helpers
 *
 * Canonical default values for memory creation so every service starts
 * from the same baseline. Centralising these here prevents drift where
 * different services hard-code their own fallbacks.
 */

import type {
  CreateMemoryInput,
  UnifiedMemory,
  EmotionalContext,
} from './types'
import { MEMORY_SCHEMA_VERSION } from './types'

// ---------------------------------------------------------------------------
// CreateMemoryInput defaults
// ---------------------------------------------------------------------------

/**
 * Returns a `CreateMemoryInput` with all optional fields set to their
 * canonical defaults.  Provided fields are merged in and override defaults.
 *
 * @example
 * ```ts
 * const input = memoryInputDefaults({ content: 'User felt anxious today', userId: 'u_123' })
 * // → { content, userId, scope: 'session', retention: 'short_term', … }
 * ```
 */
export function memoryInputDefaults(
  overrides: CreateMemoryInput,
): Required<CreateMemoryInput> {
  return {
    tenantId: 'default',
    bankId: 'default',
    scope: 'session',
    retention: 'short_term',
    category: 'conversation',
    tags: [],
    importance: 0.5,
    emotionalContext: undefined as unknown as EmotionalContext,
    empathyMetrics: undefined as unknown as never,
    ...overrides,
  } as Required<CreateMemoryInput>
}

// ---------------------------------------------------------------------------
// Neutral EmotionalContext
// ---------------------------------------------------------------------------

/**
 * Baseline neutral `EmotionalContext` — all dimensions at their midpoints.
 * Use as a starting point before running emotion detection.
 */
export const NEUTRAL_EMOTIONAL_CONTEXT: Readonly<EmotionalContext> =
  Object.freeze({
    valence: 0,
    arousal: 0,
    dominance: 0.5,
    primaryEmotion: 'neutral',
    intensity: 0,
  })

// ---------------------------------------------------------------------------
// UnifiedMemory skeleton factory
// ---------------------------------------------------------------------------

/**
 * Constructs a minimal valid `UnifiedMemory` from a `CreateMemoryInput`.
 *
 * **Important**: this is a *local* construction helper — it does NOT
 * persist anything to any storage backend.  Use it in tests, stubs, and
 * in-memory implementations that need a valid `UnifiedMemory` without
 * going through the Foresight server.
 *
 * All storage-assigned fields (`id`, `createdAt`, `schemaVersion`, etc.)
 * are filled with sensible defaults.
 */
export function buildMemorySkeleton(
  input: CreateMemoryInput,
  overrides: Partial<UnifiedMemory> = {},
): UnifiedMemory {
  const now = new Date().toISOString()
  const defaults = memoryInputDefaults(input)
  return {
    id: crypto.randomUUID(),
    tenantId: defaults.tenantId,
    userId: defaults.userId,
    bankId: defaults.bankId,
    content: defaults.content,
    scope: defaults.scope,
    retention: defaults.retention,
    category: defaults.category,
    tags: [...defaults.tags],
    version: 1,
    schemaVersion: MEMORY_SCHEMA_VERSION,
    sourceService: 'unknown',
    importance: defaults.importance,
    decayRate: 0.01,
    strengthTrend: 'stable',
    activationCount: 0,
    retrievalCount: 0,
    isGhost: false,
    gist: null,
    synthesizedFrom: [],
    vectorId: null,
    emotionalContext: defaults.emotionalContext ?? null,
    empathyMetrics: defaults.empathyMetrics ?? null,
    createdAt: now,
    updatedAt: null,
    accessedAt: null,
    lastRetrievedAt: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Importance helpers
// ---------------------------------------------------------------------------

/**
 * Clamps an importance score to the valid [0, 1] range.
 * Useful when the decay scheduler produces out-of-range values.
 */
export function clampImportance(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * Applies one tick of exponential decay to an importance score.
 *
 * `nextImportance = importance * (1 - decayRate)^hours`
 *
 * @param importance - Current importance score (0–1)
 * @param decayRate  - Fraction of importance lost per hour
 * @param hours      - Elapsed hours since last decay tick
 */
export function applyImportanceDecay(
  importance: number,
  decayRate: number,
  hours: number,
): number {
  return clampImportance(importance * Math.pow(1 - decayRate, hours))
}
