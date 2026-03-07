/**
 * @module schemas
 * @description This module defines the standard input and output format schemas using Zod.
 * These schemas are used for validation and to ensure consistency across the MetaAligner pipeline.
 */

import { z } from 'zod'

/**
 * Zod schema for the {@link LLMOutput} interface.
 */
export const LLMOutputSchema = z.object({
  content: z.union([z.string(), z.record(z.unknown())]),
  metadata: z.record(z.unknown()).optional(),
  version: z.string().optional(),
})

/**
 * Zod schema for the {@link UnifiedContext} interface.
 */
export const UnifiedContextSchema = z.object({
  userQuery: z.string(),
  conversationHistory: z.array(z.string()).optional(),
  version: z.string().optional(),
})

/**
 * Zod schema for the {@link UnifiedProcessingRequest} interface.
 */
export const UnifiedProcessingRequestSchema = z.object({
  llmOutput: LLMOutputSchema,
  context: UnifiedContextSchema,
  version: z.string().optional(),
})

/**
 * Zod schema for the {@link UnifiedProcessingResponse} interface.
 */
export const UnifiedProcessingResponseSchema = z.object({
  enhancedResponse: z.string(),
  originalResponse: z.string(),
  alignment: z.object({
    evaluation: z.record(z.unknown()), // This could be more specific if AlignmentEvaluationResult has a Zod schema
    metrics: z.record(z.unknown()), // This could be more specific if AlignmentMetrics has a Zod schema
    enhanced: z.boolean(),
    enhancementAttempts: z.number(),
  }),
  errors: z
    .array(z.object({ message: z.string(), stage: z.string() }))
    .optional(),
  version: z.string().optional(),
})
