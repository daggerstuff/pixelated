/**
 * @pixelated/memory-schema
 *
 * Canonical memory types, runtime guards, and factory helpers for the
 * Pixelated Empathy platform.  All services (Astro frontend, Foresight MCP,
 * AI services) should import exclusively from this package — never from the
 * internal `./types` or `./guards` modules directly.
 *
 * @module @pixelated/memory-schema
 */

// ---------------------------------------------------------------------------
// Schema version — single source of truth
// ---------------------------------------------------------------------------

export { MEMORY_SCHEMA_VERSION } from './types'

// ---------------------------------------------------------------------------
// Canonical enum value sets (for Zod, guards, OpenAPI)
// ---------------------------------------------------------------------------

export { MEMORY_SCOPE_VALUES, RETENTION_POLICY_VALUES } from './enums'

// ---------------------------------------------------------------------------
// Primitive enum types
// ---------------------------------------------------------------------------

export type {
  /** Logical lifecycle boundary of a memory (session → arc → trait → fact). */
  MemoryScope,
  /** How long a memory stays active before the decay scheduler evicts it. */
  RetentionPolicy,
  /** Strength trend set by the temporal decay scheduler. */
  StrengthTrend,
  /** Gate decision output from the Socratic Gate pre-ingestion evaluation. */
  GateDecision,
  /** Which service originally wrote this memory row. */
  SourceService,
} from './types'

// ---------------------------------------------------------------------------
// Sub-object types
// ---------------------------------------------------------------------------

export type {
  /** Emotional metadata anchored to Plutchik's Wheel of Emotions. */
  EmotionalContext,
  /** Empathy quality metrics derived from a therapeutic interaction. */
  EmpathyMetrics,
  /** Result of Socratic Gate evaluation run before memory ingestion. */
  GateResult,
  /** Detailed metadata produced by the safety-gating pipeline (PII, crisis, trauma, consent). */
  GatingMetadata,
} from './types'

// ---------------------------------------------------------------------------
// Canonical memory object
// ---------------------------------------------------------------------------

export type {
  /**
   * The single canonical memory record shared by all Pixelated services.
   * Mapping notes:
   *  - SQLite (Foresight):    snake_case columns, JSON-serialised sub-objects
   *  - MongoDB (ai-services): `_id` = id, `data` field wrapped by encryption
   *  - TypeScript in-memory:  this interface directly
   */
  UnifiedMemory,
} from './types'

// ---------------------------------------------------------------------------
// Synthesis output types
// ---------------------------------------------------------------------------

export type {
  /** Detected change in user/persona behavior across memories. */
  StanceShift,
  /** Output of a memory reconciliation pass. */
  SynthesisResult,
} from './types'

// ---------------------------------------------------------------------------
// Input / query shapes
// ---------------------------------------------------------------------------

export type {
  /** Shape for creating a new memory — required fields only, defaults applied by the receiving service. */
  CreateMemoryInput,
  /** Shape for updating an existing memory — all fields optional, only provided fields are mutated. */
  UpdateMemoryInput,
  /** Query options for listing / searching memories. */
  MemoryQueryOptions,
} from './types'

// ---------------------------------------------------------------------------
// Zod runtime validation schemas  (schemas.ts)
// ---------------------------------------------------------------------------

export {
  MemoryScopeSchema,
  RetentionPolicySchema,
  StrengthTrendSchema,
  GateDecisionSchema,
  SourceServiceSchema,
  EmotionalContextSchema,
  EmpathyMetricsSchema,
  GateResultSchema,
  UnifiedMemorySchema,
  CreateMemoryInputSchema,
  UpdateMemoryInputSchema,
  MemoryQueryOptionsSchema,
  StanceShiftSchema,
  SynthesisResultSchema,
} from './schemas'

// ---------------------------------------------------------------------------
// Runtime type guards & predicates  (guards.ts)
// ---------------------------------------------------------------------------

export {
  // Enum membership guards
  isMemoryScope,
  isRetentionPolicy,
  isStrengthTrend,
  isGateDecision,

  // Structural guard
  isUnifiedMemory,

  // Scope predicates
  isSessionMemory,
  isArcMemory,
  isTraitMemory,
  isFactMemory,

  // Retention predicates
  isEphemeral,
  isPermanent,

  // Ghost / synthesis predicates
  isGhostMemory,
  isSynthesized,

  // Strength / decay predicates
  isStale,
  isStrengthening,

  // Emotional / clinical predicates
  hasEmotionalContext,
  hasEmpathyMetrics,
  isEmbedded,

  // Synthesis output guards
  isStanceShift,
  isSynthesisResult,
} from './guards'

// ---------------------------------------------------------------------------
// Reflection loop contracts  (reflection.ts)
// ---------------------------------------------------------------------------

export {
  ReflectionOutcomeSchema,
  ReflectionInsightSchema,
  ReflectionContextSchema,
  ActionFeedbackPairSchema,
  VerbalReflectionSchema,
  ReflexionResultSchema,
  actionFeedbackPairToReflectionContext,
  verbalReflectionToInsights,
} from './reflection'

export type {
  ReflectionOutcome,
  ReflectionInsight,
  ReflectionContext,
  ActionFeedbackPair,
  VerbalReflection,
  ReflexionResult,
} from './reflection'

// ---------------------------------------------------------------------------
// Factory defaults & construction helpers  (defaults.ts)
// ---------------------------------------------------------------------------

export {
  /**
   * Returns a `CreateMemoryInput` with all optional fields set to their
   * canonical defaults. Provided fields override defaults.
   */
  memoryInputDefaults,

  /**
   * Baseline neutral EmotionalContext — all dimensions at their midpoints.
   * Use as a starting point before running emotion detection.
   */
  NEUTRAL_EMOTIONAL_CONTEXT,

  /**
   * Constructs a minimal valid UnifiedMemory from a CreateMemoryInput.
   * Does NOT persist — intended for tests, stubs, and in-memory implementations.
   */
  buildMemorySkeleton,

  /**
   * Clamps an importance score to the valid [0, 1] range.
   */
  clampImportance,

  /**
   * Applies one tick of exponential decay to an importance score.
   * `nextImportance = importance * (1 − decayRate)^hours`
   */
  applyImportanceDecay,
} from './defaults'
