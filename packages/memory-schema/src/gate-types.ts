/**
 * Socratic Gate contract — canonical Zod schemas and TypeScript types.
 *
 * The Socratic Gate is the pre-ingestion middleman for memory writes. TypeScript
 * consumers use camelCase field names; Foresight MCP (`foresight_mcp.memory_types`)
 * serialises the same shape in snake_case on the wire.
 *
 * Python drift (documented, not auto-generated):
 *   - `suggested_tags` ↔ `suggestedTags`
 *   - `anomaly_detected` ↔ `anomalyDetected`
 *   - `src/lib/ai/memory/types.ts` still exposes `crisis_detected` (legacy); prefer
 *     `anomalyDetected` / `anomaly_detected` for new consumers.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Core gate enums & result
// ---------------------------------------------------------------------------

/** Gate decision — output of Socratic Gate evaluation before memory ingestion. */
export const GateDecisionSchema = z.enum(['auto', 'passive', 'active', 'block'])
export type GateDecision = z.infer<typeof GateDecisionSchema>

/** Optional extended gating metadata from the Astro Socratic Gate pipeline. */
export const GatingMetadataSchema = z.object({
  piiRedacted: z.boolean(),
  piiTypes: z.array(z.string()),
  crisisTier: z.string(),
  crisisFlag: z.boolean(),
  traumaIndicators: z.array(z.string()),
  traumaSeverity: z.string(),
  consentTier: z.string(),
  consentAllowed: z.boolean(),
  scrubbedContent: z.string(),
})
export type GatingMetadata = z.infer<typeof GatingMetadataSchema>

/** Result of Socratic Gate evaluation (run before memory ingestion). */
export const GateResultSchema = z.object({
  decision: GateDecisionSchema,
  reason: z.string(),
  suggestedTags: z.array(z.string()),
  anomalyDetected: z.boolean(),
  gating: GatingMetadataSchema.optional(),
})
export type GateResult = z.infer<typeof GateResultSchema>

// ---------------------------------------------------------------------------
// Wire format (snake_case) — matches foresight_mcp.memory_types.GateResult
// ---------------------------------------------------------------------------

export const GateResultWireSchema = z.object({
  decision: GateDecisionSchema,
  reason: z.string(),
  suggested_tags: z.array(z.string()),
  anomaly_detected: z.boolean().default(false),
})
export type GateResultWire = z.infer<typeof GateResultWireSchema>

// ---------------------------------------------------------------------------
// Evaluate input / output envelopes
// ---------------------------------------------------------------------------

const GateMemoryScopeSchema = z.enum(['session', 'arc', 'trait', 'fact'])

/**
 * Minimal memory payload required by `SocraticGate.evaluate`.
 * Matches the fields read by both TS and Python gate implementations.
 */
export const GateMemoryInputSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
  scope: GateMemoryScopeSchema,
})
export type GateMemoryInput = z.infer<typeof GateMemoryInputSchema>

/** Input envelope for a Socratic Gate evaluation request. */
export const GateEvaluateInputSchema = z.object({
  memory: GateMemoryInputSchema,
  userId: z.string().min(1),
})
export type GateEvaluateInput = z.infer<typeof GateEvaluateInputSchema>

/** Wire-format input envelope (snake_case user_id). */
export const GateEvaluateInputWireSchema = z.object({
  memory: GateMemoryInputSchema,
  user_id: z.string().min(1),
})
export type GateEvaluateInputWire = z.infer<typeof GateEvaluateInputWireSchema>

/** Output envelope for a Socratic Gate evaluation response. */
export const GateEvaluateOutputSchema = z.object({
  result: GateResultSchema,
})
export type GateEvaluateOutput = z.infer<typeof GateEvaluateOutputSchema>

/** Wire-format output envelope (snake_case result fields). */
export const GateEvaluateOutputWireSchema = z.object({
  result: GateResultWireSchema,
})
export type GateEvaluateOutputWire = z.infer<typeof GateEvaluateOutputWireSchema>
