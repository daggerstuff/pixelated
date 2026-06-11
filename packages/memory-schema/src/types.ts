/**
 * @pixelated/memory-schema — Unified Memory Schema
 *
 * Canonical type definitions for the Pixelated Empathy memory system.
 * All services (Astro frontend, Foresight MCP, AI services) use these types
 * at their API boundaries to ensure consistent memory representation.
 *
 * Sprint 1 — ADHD-318: Design Unified Memory Schema
 * Epic: ADHD-3 Foresight Memory Architecture
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Memory scope defines the logical lifecycle boundary of a memory.
 *
 * - `session`  : Relevant only to the current conversation/session
 * - `arc`      : Spans a therapeutic arc (multiple sessions, one theme)
 * - `trait`    : Persistent user/persona trait (semi-permanent)
 * - `fact`     : Ground-truth factual knowledge (permanent until explicitly retracted)
 */
export type MemoryScope = 'session' | 'arc' | 'trait' | 'fact'

export const MemoryScopeSchema = z.enum(['session', 'arc', 'trait', 'fact'])

/**
 * Retention policy controls how long a memory stays in active vector space
 * before being archived or evicted by the decay scheduler.
 */
export type RetentionPolicy =
  | 'ephemeral' // < 1 hour — scratch space
  | 'short_term' // 1 day – 1 week
  | 'long_term' // 1 week – 6 months
  | 'permanent' // Never evicted (only explicit delete)

export const RetentionPolicySchema = z.enum([
  'ephemeral',
  'short_term',
  'long_term',
  'permanent',
])

/**
 * Strength trend — set by the temporal decay scheduler after each retrieval cycle.
 */
export type StrengthTrend = 'stable' | 'strengthening' | 'weakening' | 'stale'

export const StrengthTrendSchema = z.enum([
  'stable',
  'strengthening',
  'weakening',
  'stale',
])

/**
 * Gate decision — output of Socratic Gate evaluation before memory ingestion.
 */
export type GateDecision = 'auto' | 'passive' | 'active' | 'block'

/**
 * Which service originally wrote this memory row.
 * Used for audit trails, debugging, and selective sync.
 */
export type SourceService =
  | 'foresight'
  | 'ai-services'
  | 'astro-frontend'
  | 'unknown'

export const SourceServiceSchema = z.enum([
  'foresight',
  'ai-services',
  'astro-frontend',
  'unknown',
])

// ---------------------------------------------------------------------------
// Sub-objects
// ---------------------------------------------------------------------------

/**
 * Emotional metadata anchored to Plutchik's Wheel of Emotions.
 * All values are normalized floats.
 */
export interface EmotionalContext {
  /** Valence: -1.0 (strongly negative) → 1.0 (strongly positive) */
  valence: number
  /** Arousal: 0.0 (calm/flat) → 1.0 (highly activated) */
  arousal: number
  /** Dominance: 0.0 (submissive) → 1.0 (dominant) */
  dominance: number
  /** The primary detected emotion (e.g. 'grief', 'rage', 'anticipation') */
  primaryEmotion: string
  /** Intensity: 0.0 (trace) → 1.0 (maximum) */
  intensity: number
}

export const EmotionalContextSchema = z.object({
  valence: z.number().min(-1).max(1),
  arousal: z.number().min(0).max(1),
  dominance: z.number().min(0).max(1),
  primaryEmotion: z.string(),
  intensity: z.number().min(0).max(1),
})

/**
 * Empathy quality metrics derived from a therapeutic interaction.
 * Scored post-hoc by the evaluation pipeline.
 */
export interface EmpathyMetrics {
  /** How well the participant matched the AI's empathy level */
  reciprocity: number
  /** Accuracy of the participant's emotional validation */
  validationAccuracy: number
  /** Resistance to persona/perspective shift (0 = none, 1 = maximum) */
  resistanceLevel: number
}

export const EmpathyMetricsSchema = z.object({
  reciprocity: z.number().min(0).max(1),
  validationAccuracy: z.number().min(0).max(1),
  resistanceLevel: z.number().min(0).max(1),
})

/**
 * Result of Socratic Gate evaluation (run before memory ingestion).
 */
export interface GateResult {
  decision: GateDecision
  reason: string
  suggestedTags: string[]
  anomalyDetected: boolean
}

// ---------------------------------------------------------------------------
// Canonical Memory Object
// ---------------------------------------------------------------------------

/**
 * UnifiedMemory — the canonical memory object shared by all Pixelated services.
 *
 * Mapping to storage backends:
 *   - SQLite (Foresight):  snake_case columns, JSON-serialized sub-objects
 *   - MongoDB (ai-services): `_id` = id, `data` field wrapped by encryption
 *   - TypeScript in-memory: this interface directly
 */
export interface UnifiedMemory {
  // ── Identity ──────────────────────────────────────────────────────────────
  /** UUID v4 — globally unique across all storage backends */
  id: string

  /** Tenant identifier for multi-tenant hard isolation */
  tenantId: string

  /** User identifier (maps to Pixelated user profile) */
  userId: string

  /** Memory bank — logical grouping (e.g. 'default', 'training', 'session:<id>') */
  bankId: string

  // ── Content ───────────────────────────────────────────────────────────────
  /** The primary memory content — the "what happened" */
  content: string

  /** Semantic scope of this memory */
  scope: MemoryScope

  /** Retention / eviction policy */
  retention: RetentionPolicy

  /** Category label for filtering (e.g. 'fact', 'crisis', 'conversation', 'preference') */
  category: string

  /** Free-form tags for ad-hoc filtering and label propagation */
  tags: string[]

  // ── Versioning ────────────────────────────────────────────────────────────
  /** Monotonically increasing version counter, incremented on every update */
  version: number

  /** Version of this unified schema definition that wrote this row (semver string) */
  schemaVersion: string

  /** Which service originally created this memory */
  sourceService: SourceService

  // ── Decay & Importance ────────────────────────────────────────────────────
  /** Current importance score (0.0 → 1.0), updated by decay scheduler */
  importance: number

  /** Per-memory decay rate (fraction of importance lost per hour) */
  decayRate: number

  /** Current strength trend — updated by temporal decay scheduler */
  strengthTrend: StrengthTrend

  /** Total number of times this memory was activated (retrieved + reinforced) */
  activationCount: number

  /** Total number of times this memory appeared in a retrieval result set */
  retrievalCount: number

  // ── Ghost / Synthesis ─────────────────────────────────────────────────────
  /** True if this is a Ghost Node — a compressed summary of evicted memories */
  isGhost: boolean

  /** 10-word gist summary (set for Ghost Nodes and synthesized memories) */
  gist: string | null

  /** IDs of source memories this memory was synthesized from */
  synthesizedFrom: string[]

  // ── Embeddings ────────────────────────────────────────────────────────────
  /** Reference ID in the vector store (pgvector / Qdrant) */
  vectorId: string | null

  // ── Emotional / Clinical ──────────────────────────────────────────────────
  /** Emotional context at time of creation */
  emotionalContext: EmotionalContext | null

  /** Empathy quality metrics (null for non-interaction memories) */
  empathyMetrics: EmpathyMetrics | null

  // ── Timestamps ────────────────────────────────────────────────────────────
  /** ISO 8601 — when this memory was first created */
  createdAt: string

  /** ISO 8601 — when this memory was last mutated */
  updatedAt: string | null

  /** ISO 8601 — when this memory was last accessed (read) */
  accessedAt: string | null

  /** ISO 8601 — when this memory was last retrieved in a search result */
  lastRetrievedAt: string | null
}

export const UnifiedMemorySchema = z.object({
  // ── Identity ──────────────────────────────────────────────────────────────
  id: z.string().uuid(),
  tenantId: z.string(),
  userId: z.string(),
  bankId: z.string(),

  // ── Content ───────────────────────────────────────────────────────────────
  content: z.string().min(1).max(100000),
  scope: MemoryScopeSchema,
  retention: RetentionPolicySchema,
  category: z.string(),
  tags: z.array(z.string()),

  // ── Versioning ────────────────────────────────────────────────────────────
  version: z.number().int().min(1),
  schemaVersion: z.string(),
  sourceService: SourceServiceSchema,

  // ── Decay & Importance ────────────────────────────────────────────────────
  importance: z.number().min(0).max(1),
  decayRate: z.number().min(0),
  strengthTrend: StrengthTrendSchema,
  activationCount: z.number().int().min(0),
  retrievalCount: z.number().int().min(0),

  // ── Ghost / Synthesis ─────────────────────────────────────────────────────
  isGhost: z.boolean(),
  gist: z.string().max(200).nullable(),
  synthesizedFrom: z.array(z.string()),

  // ── Embeddings ────────────────────────────────────────────────────────────
  vectorId: z.string().nullable(),

  // ── Emotional / Clinical ──────────────────────────────────────────────────
  emotionalContext: EmotionalContextSchema.nullable(),
  empathyMetrics: EmpathyMetricsSchema.nullable(),

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  accessedAt: z.string().nullable(),
  lastRetrievedAt: z.string().nullable(),
})

// ---------------------------------------------------------------------------
// Partial / Input Types
// ---------------------------------------------------------------------------

/**
 * Input shape for creating a new memory.
 * Required fields only — defaults are applied by the receiving service.
 */
export interface CreateMemoryInput {
  content: string
  userId: string
  tenantId?: string
  bankId?: string
  scope?: MemoryScope
  retention?: RetentionPolicy
  category?: string
  tags?: string[]
  importance?: number
  emotionalContext?: EmotionalContext
  empathyMetrics?: EmpathyMetrics
}

export const CreateMemoryInputSchema = z.object({
  content: z.string().min(1).max(100000),
  userId: z.string(),
  tenantId: z.string().optional(),
  bankId: z.string().optional(),
  scope: MemoryScopeSchema.optional(),
  retention: RetentionPolicySchema.optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().min(0).max(1).optional(),
  emotionalContext: EmotionalContextSchema.optional(),
  empathyMetrics: EmpathyMetricsSchema.optional(),
})

/**
 * Input shape for updating an existing memory.
 * All fields optional — only provided fields are mutated.
 */
export interface UpdateMemoryInput {
  content?: string
  scope?: MemoryScope
  retention?: RetentionPolicy
  category?: string
  tags?: string[]
  importance?: number
  emotionalContext?: EmotionalContext | null
  empathyMetrics?: EmpathyMetrics | null
}

export const UpdateMemoryInputSchema = z
  .object({
    content: z.string().min(1).max(100000).optional(),
    scope: MemoryScopeSchema.optional(),
    retention: RetentionPolicySchema.optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    importance: z.number().min(0).max(1).optional(),
    emotionalContext: EmotionalContextSchema.optional().nullable(),
    empathyMetrics: EmpathyMetricsSchema.optional().nullable(),
  })
  .partial()

/**
 * Query options for listing / searching memories.
 */
export interface MemoryQueryOptions {
  userId: string
  tenantId?: string
  bankId?: string
  scope?: MemoryScope
  retention?: RetentionPolicy
  category?: string
  tags?: string[]
  strengthTrend?: StrengthTrend
  minImportance?: number
  search?: string
  limit?: number
  offset?: number
  sortBy?: keyof Pick<
    UnifiedMemory,
    'createdAt' | 'updatedAt' | 'importance' | 'accessedAt'
  >
  sortOrder?: 'asc' | 'desc'
}

export const MemoryQueryOptionsSchema = z.object({
  userId: z.string(),
  tenantId: z.string().optional(),
  bankId: z.string().optional(),
  scope: MemoryScopeSchema.optional(),
  retention: RetentionPolicySchema.optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  strengthTrend: StrengthTrendSchema.optional(),
  minImportance: z.number().min(0).max(1).optional(),
  search: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'importance', 'accessedAt'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

// ---------------------------------------------------------------------------
// Schema version constant
// ---------------------------------------------------------------------------

/** Current schema version — bump when adding fields to UnifiedMemory */
export const MEMORY_SCHEMA_VERSION = '1.0.0' as const
