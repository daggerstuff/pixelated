/**
 * @pixelated/memory-schema — Zod runtime validation schemas
 *
 * Mirrors the canonical TypeScript types in `./types.ts` so consumers can
 * validate untrusted input against a single source of truth instead of
 * maintaining drift-prone local schemas.
 */

import { z } from 'zod'

import { GatingMetadataSchema } from './gate-types'

import type {
  CreateMemoryInput,
  EmotionalContext,
  EmpathyMetrics,
  GateResult,
  MemoryQueryOptions,
  MemoryScope,
  RetentionPolicy,
  SourceService,
  StrengthTrend,
  GateDecision,
  UnifiedMemory,
  UpdateMemoryInput,
} from './types'

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const MemoryScopeSchema = z.enum([
  'session',
  'arc',
  'trait',
  'fact',
])

export const RetentionPolicySchema = z.enum([
  'ephemeral',
  'short_term',
  'long_term',
  'permanent',
])

export const StrengthTrendSchema = z.enum([
  'stable',
  'strengthening',
  'weakening',
  'stale',
])

export const GateDecisionSchema = z.enum(['auto', 'passive', 'active', 'block'])

export const SourceServiceSchema = z.enum([
  'foresight',
  'ai-services',
  'astro-frontend',
  'unknown',
])

// ---------------------------------------------------------------------------
// Sub-objects
// ---------------------------------------------------------------------------

export const EmotionalContextSchema = z.object({
  valence: z.number(),
  arousal: z.number(),
  dominance: z.number(),
  primaryEmotion: z.string(),
  intensity: z.number(),
})

export const EmpathyMetricsSchema = z.object({
  reciprocity: z.number(),
  validationAccuracy: z.number(),
  resistanceLevel: z.number(),
})

export const GateResultSchema = z.object({
  decision: GateDecisionSchema,
  reason: z.string(),
  suggestedTags: z.array(z.string()),
  anomalyDetected: z.boolean(),
  gating: GatingMetadataSchema.optional(),
})

// ---------------------------------------------------------------------------
// Canonical memory object
// ---------------------------------------------------------------------------

export const UnifiedMemorySchema = z.object({
  id: z.uuid(),
  tenantId: z.string(),
  userId: z.string(),
  bankId: z.string(),
  content: z.string(),
  scope: MemoryScopeSchema,
  retention: RetentionPolicySchema,
  category: z.string(),
  tags: z.array(z.string()),
  version: z.number().int().nonnegative(),
  schemaVersion: z.string(),
  sourceService: SourceServiceSchema,
  importance: z.number(),
  decayRate: z.number(),
  strengthTrend: StrengthTrendSchema,
  activationCount: z.number().int().nonnegative(),
  retrievalCount: z.number().int().nonnegative(),
  isGhost: z.boolean(),
  gist: z.string().nullable(),
  synthesizedFrom: z.array(z.string()),
  vectorId: z.string().nullable(),
  emotionalContext: EmotionalContextSchema.nullable(),
  empathyMetrics: EmpathyMetricsSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
  accessedAt: z.iso.datetime().nullable(),
  lastRetrievedAt: z.iso.datetime().nullable(),
})

// ---------------------------------------------------------------------------
// Input / query shapes
// ---------------------------------------------------------------------------

export const CreateMemoryInputSchema = z.object({
  content: z.string(),
  userId: z.string(),
  tenantId: z.string().optional(),
  bankId: z.string().optional(),
  scope: MemoryScopeSchema.optional(),
  retention: RetentionPolicySchema.optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().optional(),
  emotionalContext: EmotionalContextSchema.optional(),
  empathyMetrics: EmpathyMetricsSchema.optional(),
})

export const UpdateMemoryInputSchema = z.object({
  content: z.string().optional(),
  scope: MemoryScopeSchema.optional(),
  retention: RetentionPolicySchema.optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().optional(),
  emotionalContext: EmotionalContextSchema.nullable().optional(),
  empathyMetrics: EmpathyMetricsSchema.nullable().optional(),
})

export const MemoryQueryOptionsSchema = z.object({
  userId: z.string(),
  tenantId: z.string().optional(),
  bankId: z.string().optional(),
  scope: MemoryScopeSchema.optional(),
  retention: RetentionPolicySchema.optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  strengthTrend: StrengthTrendSchema.optional(),
  minImportance: z.number().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'importance', 'accessedAt'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

// ---------------------------------------------------------------------------
// Compile-time compatibility checks (z.infer ↔ canonical TS types)
// ---------------------------------------------------------------------------

type AssertCompatible<Inferred, Canonical> =
  Inferred extends Canonical
    ? Canonical extends Inferred
      ? true
      : never
    : never

type _CheckMemoryScope = AssertCompatible<
  z.infer<typeof MemoryScopeSchema>,
  MemoryScope
>
type _CheckRetentionPolicy = AssertCompatible<
  z.infer<typeof RetentionPolicySchema>,
  RetentionPolicy
>
type _CheckStrengthTrend = AssertCompatible<
  z.infer<typeof StrengthTrendSchema>,
  StrengthTrend
>
type _CheckGateDecision = AssertCompatible<
  z.infer<typeof GateDecisionSchema>,
  GateDecision
>
type _CheckSourceService = AssertCompatible<
  z.infer<typeof SourceServiceSchema>,
  SourceService
>
type _CheckEmotionalContext = AssertCompatible<
  z.infer<typeof EmotionalContextSchema>,
  EmotionalContext
>
type _CheckEmpathyMetrics = AssertCompatible<
  z.infer<typeof EmpathyMetricsSchema>,
  EmpathyMetrics
>
type _CheckGateResult = AssertCompatible<
  z.infer<typeof GateResultSchema>,
  GateResult
>
type _CheckUnifiedMemory = AssertCompatible<
  z.infer<typeof UnifiedMemorySchema>,
  UnifiedMemory
>
type _CheckCreateMemoryInput = AssertCompatible<
  z.infer<typeof CreateMemoryInputSchema>,
  CreateMemoryInput
>
type _CheckUpdateMemoryInput = AssertCompatible<
  z.infer<typeof UpdateMemoryInputSchema>,
  UpdateMemoryInput
>
type _CheckMemoryQueryOptions = AssertCompatible<
  z.infer<typeof MemoryQueryOptionsSchema>,
  MemoryQueryOptions
>

// Silence unused-type warnings while keeping compile-time assertions.
const _schemaCompatibilityChecks: [
  _CheckMemoryScope,
  _CheckRetentionPolicy,
  _CheckStrengthTrend,
  _CheckGateDecision,
  _CheckSourceService,
  _CheckEmotionalContext,
  _CheckEmpathyMetrics,
  _CheckGateResult,
  _CheckUnifiedMemory,
  _CheckCreateMemoryInput,
  _CheckUpdateMemoryInput,
  _CheckMemoryQueryOptions,
] = [
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
]

void _schemaCompatibilityChecks
