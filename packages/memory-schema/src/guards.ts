/**
 * @pixelated/memory-schema — Runtime type guards & predicates
 *
 * Pure, zero-dependency functions that reason about schema values.
 * Safe to use in both Node and browser contexts.
 */

import { MEMORY_SCOPE_VALUES, RETENTION_POLICY_VALUES } from './enums'
import type {
  UnifiedMemory,
  MemoryScope,
  RetentionPolicy,
  StrengthTrend,
  GateDecision,
} from './types'

// ---------------------------------------------------------------------------
// Enum membership guards
// ---------------------------------------------------------------------------

const MEMORY_SCOPES: ReadonlySet<MemoryScope> = new Set(MEMORY_SCOPE_VALUES)

const RETENTION_POLICIES: ReadonlySet<RetentionPolicy> = new Set(
  RETENTION_POLICY_VALUES,
)

const STRENGTH_TRENDS: ReadonlySet<StrengthTrend> = new Set([
  'stable',
  'strengthening',
  'weakening',
  'stale',
])

const GATE_DECISIONS: ReadonlySet<GateDecision> = new Set([
  'auto',
  'passive',
  'active',
  'block',
])

/** Narrows an unknown value to `MemoryScope`. */
export function isMemoryScope(value: unknown): value is MemoryScope {
  return typeof value === 'string' && MEMORY_SCOPES.has(value as MemoryScope)
}

/** Narrows an unknown value to `RetentionPolicy`. */
export function isRetentionPolicy(value: unknown): value is RetentionPolicy {
  return (
    typeof value === 'string' &&
    RETENTION_POLICIES.has(value as RetentionPolicy)
  )
}

/** Narrows an unknown value to `StrengthTrend`. */
export function isStrengthTrend(value: unknown): value is StrengthTrend {
  return (
    typeof value === 'string' && STRENGTH_TRENDS.has(value as StrengthTrend)
  )
}

/** Narrows an unknown value to `GateDecision`. */
export function isGateDecision(value: unknown): value is GateDecision {
  return typeof value === 'string' && GATE_DECISIONS.has(value as GateDecision)
}

// ---------------------------------------------------------------------------
// UnifiedMemory structural guard
// ---------------------------------------------------------------------------

/**
 * Performs a shallow structural check that `value` looks like a `UnifiedMemory`.
 * Validates required string fields and known enum values — does not validate
 * every nested sub-object to keep this fast for hot-path deserialization.
 */
export function isUnifiedMemory(value: unknown): value is UnifiedMemory {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Record<string, unknown>
  return (
    typeof m['id'] === 'string' &&
    typeof m['userId'] === 'string' &&
    typeof m['tenantId'] === 'string' &&
    typeof m['bankId'] === 'string' &&
    typeof m['content'] === 'string' &&
    isMemoryScope(m['scope']) &&
    isRetentionPolicy(m['retention']) &&
    typeof m['createdAt'] === 'string'
  )
}

// ---------------------------------------------------------------------------
// Scope predicates
// ---------------------------------------------------------------------------

/** Returns true if the memory is scoped to a single session. */
export function isSessionMemory(memory: UnifiedMemory): boolean {
  return memory.scope === 'session'
}

/** Returns true if the memory spans a multi-session therapeutic arc. */
export function isArcMemory(memory: UnifiedMemory): boolean {
  return memory.scope === 'arc'
}

/** Returns true if the memory encodes a persistent user trait. */
export function isTraitMemory(memory: UnifiedMemory): boolean {
  return memory.scope === 'trait'
}

/** Returns true if the memory is a ground-truth fact. */
export function isFactMemory(memory: UnifiedMemory): boolean {
  return memory.scope === 'fact'
}

// ---------------------------------------------------------------------------
// Retention predicates
// ---------------------------------------------------------------------------

/** Returns true if the memory is ephemeral (scratch space, < 1 hour). */
export function isEphemeral(memory: UnifiedMemory): boolean {
  return memory.retention === 'ephemeral'
}

/** Returns true if the memory will never be evicted by the decay scheduler. */
export function isPermanent(memory: UnifiedMemory): boolean {
  return memory.retention === 'permanent'
}

// ---------------------------------------------------------------------------
// Ghost / synthesis predicates
// ---------------------------------------------------------------------------

/** Returns true if this is a Ghost Node — a compressed summary of evicted memories. */
export function isGhostMemory(memory: UnifiedMemory): boolean {
  return memory.isGhost
}

/** Returns true if this memory was synthesized from two or more source memories. */
export function isSynthesized(memory: UnifiedMemory): boolean {
  return memory.synthesizedFrom.length > 0
}

// ---------------------------------------------------------------------------
// Strength / decay predicates
// ---------------------------------------------------------------------------

/** Returns true if the decay scheduler has flagged this memory as stale. */
export function isStale(memory: UnifiedMemory): boolean {
  return memory.strengthTrend === 'stale'
}

/** Returns true if this memory is actively gaining strength. */
export function isStrengthening(memory: UnifiedMemory): boolean {
  return memory.strengthTrend === 'strengthening'
}

// ---------------------------------------------------------------------------
// Emotional / clinical predicates
// ---------------------------------------------------------------------------

/** Returns true if the memory carries emotional context metadata. */
export function hasEmotionalContext(memory: UnifiedMemory): boolean {
  return memory.emotionalContext !== null
}

/** Returns true if the memory carries empathy quality metrics. */
export function hasEmpathyMetrics(memory: UnifiedMemory): boolean {
  return memory.empathyMetrics !== null
}

/** Returns true if the memory has been embedded in vector space. */
export function isEmbedded(memory: UnifiedMemory): boolean {
  return memory.vectorId !== null
}
