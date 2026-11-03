import { MEMORY_SCOPE_VALUES, RETENTION_POLICY_VALUES } from './enums'
import type {
  UnifiedMemory,
  MemoryScope,
  RetentionPolicy,
  StanceShift,
  StrengthTrend,
  GateDecision,
  SynthesisResult,
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

export function isMemoryScope(value: unknown): value is MemoryScope {
  return typeof value === 'string' && MEMORY_SCOPES.has(value as MemoryScope)
}

export function isRetentionPolicy(value: unknown): value is RetentionPolicy {
  return (
    typeof value === 'string' &&
    RETENTION_POLICIES.has(value as RetentionPolicy)
  )
}

export function isStrengthTrend(value: unknown): value is StrengthTrend {
  return (
    typeof value === 'string' && STRENGTH_TRENDS.has(value as StrengthTrend)
  )
}

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

export function isSessionMemory(memory: UnifiedMemory): boolean {
  return memory.scope === 'session'
}

export function isArcMemory(memory: UnifiedMemory): boolean {
  return memory.scope === 'arc'
}

export function isTraitMemory(memory: UnifiedMemory): boolean {
  return memory.scope === 'trait'
}

export function isFactMemory(memory: UnifiedMemory): boolean {
  return memory.scope === 'fact'
}

// ---------------------------------------------------------------------------
// Retention predicates
// ---------------------------------------------------------------------------

export function isEphemeral(memory: UnifiedMemory): boolean {
  return memory.retention === 'ephemeral'
}

export function isPermanent(memory: UnifiedMemory): boolean {
  return memory.retention === 'permanent'
}

// ---------------------------------------------------------------------------
// Ghost / synthesis predicates
// ---------------------------------------------------------------------------

export function isGhostMemory(memory: UnifiedMemory): boolean {
  return memory.isGhost
}

export function isSynthesized(memory: UnifiedMemory): boolean {
  return memory.synthesizedFrom.length > 0
}

// ---------------------------------------------------------------------------
// Strength / decay predicates
// ---------------------------------------------------------------------------

export function isStale(memory: UnifiedMemory): boolean {
  return memory.strengthTrend === 'stale'
}

export function isStrengthening(memory: UnifiedMemory): boolean {
  return memory.strengthTrend === 'strengthening'
}

// ---------------------------------------------------------------------------
// Emotional / clinical predicates
// ---------------------------------------------------------------------------

export function hasEmotionalContext(memory: UnifiedMemory): boolean {
  return memory.emotionalContext !== null
}

export function hasEmpathyMetrics(memory: UnifiedMemory): boolean {
  return memory.empathyMetrics !== null
}

export function isEmbedded(memory: UnifiedMemory): boolean {
  return memory.vectorId !== null
}

// ---------------------------------------------------------------------------
// Synthesis output type guards
// ---------------------------------------------------------------------------

/**
 * Narrows an unknown value to `StanceShift`. Shallow structural check —
 * validates required string/number fields and that `evidenceIds` is an
 * array. Does not recursively validate that each evidence id resolves.
 */
export function isStanceShift(value: unknown): value is StanceShift {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    typeof s['attribute'] === 'string' &&
    typeof s['oldValue'] === 'number' &&
    typeof s['newValue'] === 'number' &&
    typeof s['delta'] === 'number' &&
    Array.isArray(s['evidenceIds']) &&
    s['evidenceIds'].every((id) => typeof id === 'string') &&
    typeof s['confidence'] === 'number'
  )
}

/**
 * Narrows an unknown value to `SynthesisResult`. Shallow structural check —
 * delegates to `isStanceShift` for each entry in `stanceShifts`.
 */
export function isSynthesisResult(value: unknown): value is SynthesisResult {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return (
    Array.isArray(r['mergedIds']) &&
    r['mergedIds'].every((id) => typeof id === 'string') &&
    typeof r['newMemoryId'] === 'string' &&
    Array.isArray(r['stanceShifts']) &&
    r['stanceShifts'].every((s) => isStanceShift(s)) &&
    typeof r['compressionRatio'] === 'number'
  )
}
