import { z } from 'zod';

/**
 * Memory Scope: Defines the logical boundary of the memory.
 * - session: Relevant only to the current conversation.
 * - arc: Spans multiple sessions in a single training arc.
 * - trait: Permanent modification to the persona's traits.
 * - fact: Objective fact discovered about the user/trainee.
 */
export const MemoryScopeSchema = z.enum(['session', 'arc', 'trait', 'fact']);
export type MemoryScope = z.infer<typeof MemoryScopeSchema>;

/**
 * Retention Policy: Defines how long the memory is kept in active vector space.
 * - ephemeral: Deleted after the session.
 * - short_term: Kept for the duration of the arc.
 * - long_term: Candidate for Ghost Node archival.
 * - permanent: Never archived.
 */
export const RetentionPolicySchema = z.enum([
  'ephemeral',
  'short_term',
  'long_term',
  'permanent',
]);
export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;

/**
 * Emotional Metadata: Plutchik's Wheel + big Five normalized scores.
 */
export const EmotionalMetadataSchema = z.object({
  valence: z.number().min(-1).max(1), // -1 (negative) to 1 (positive)
  arousal: z.number().min(0).max(1), // 0 (calm) to 1 (intense)
  dominance: z.number().min(0).max(1), // 0 (submissive) to 1 (dominant)
  primary_emotion: z.string(),
  intensity: z.number().min(0).max(1),
});

/**
 * Empathy Metrics: Derived from the interaction.
 */
export const EmpathyMetricsSchema = z.object({
  reciprocity: z.number().min(0).max(1), // How well the user matched empathy
  validation_accuracy: z.number().min(0).max(1), // How accurately the user validated
  resistance_level: z.number().min(0).max(1), // User's resistance to persona shift
});

/**
 * Memory Object: The atomic unit of our memory system.
 */
export const MemoryObjectSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  scope: MemoryScopeSchema,
  retention: RetentionPolicySchema,
  content: z.string().min(1),
  emotional_context: EmotionalMetadataSchema.optional(),
  metrics: EmpathyMetricsSchema.optional(),
  tags: z.array(z.string()).default([]),
  synthesized_from: z.array(z.string()).default([]), // IDs of source memories
  is_ghost: z.boolean().default(false),
  vector_id: z.string().optional(), // ID in the vector database
  gist: z.string().max(100).optional(), // 10-word summary for Ghost Nodes
});

/**
 * Stance Shift: Represents a detected change in user/persona behavior.
 */
export const StanceShiftSchema = z.object({
  attribute: z.string(), // e.g., 'openness', 'defensiveness'
  old_value: z.number(),
  new_value: z.number(),
  delta: z.number(),
  evidence_ids: z.array(z.string()), // IDs of memories showing the shift
  confidence: z.number(),
});

/**
 * Synthesis Result: The output of a reconciliation pass.
 */
export const SynthesisResultSchema = z.object({
  merged_ids: z.array(z.string()),
  new_memory_id: z.string(),
  stance_shifts: z.array(StanceShiftSchema),
  compression_ratio: z.number(),
});

export type MemoryObject = z.infer<typeof MemoryObjectSchema>;
export type EmotionalMetadata = z.infer<typeof EmotionalMetadataSchema>;
export type EmpathyMetrics = z.infer<typeof EmpathyMetricsSchema>;
export type StanceShift = z.infer<typeof StanceShiftSchema>;
export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

/**
 * Socratic Gate Decision Levels
 */
export const GateDecisionSchema = z.enum(['auto', 'passive', 'active', 'block']);
export type GateDecision = z.infer<typeof GateDecisionSchema>;

export interface GateResult {
  decision: GateDecision;
  reason: string;
  suggested_tags: string[];
  crisis_detected: boolean;
}
