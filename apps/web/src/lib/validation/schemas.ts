import z from 'zod'

import { DEFAULT_LLM_MODEL } from '../ai/constants'

/**
 * Chat message schema with security validations
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  // Security: Content is sanitized at the rendering layer using DOMPurify and
  // at the data layer using parameterized queries. Regex blocklists here would
  // create false confidence and block legitimate clinical text.
  name: z.string().optional(),
})

/**
 * AI completion request schema
 */
export const CompletionRequestSchema = z.object({
  model: z.string().min(1).default(DEFAULT_LLM_MODEL),
  messages: z.array(ChatMessageSchema).min(1).max(100),
  temperature: z.number().min(0).max(2).default(0.7),
  max_tokens: z.number().min(1).max(4096).default(1024),
  stream: z.boolean().default(false),
  presence_penalty: z.number().min(-2).max(2).default(0).optional(),
  frequency_penalty: z.number().min(-2).max(2).default(0).optional(),
  top_p: z.number().min(0).max(1).default(1).optional(),
  reveriePrompt: z.string().min(1).max(8192).optional(),
})

/**
 * Usage statistics request schema
 */
export const UsageStatsRequestSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  allUsers: z.boolean().default(false),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

/**
 * Sentiment analysis request schema
 */
export const SentimentRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  model: z.string().default(DEFAULT_LLM_MODEL).optional(),
  includeReasoning: z.boolean().default(false).optional(),
})

/**
 * Crisis detection request schema
 */
export const CrisisDetectionRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  userId: z.string().optional(),
  threshold: z.number().min(0).max(1).default(0.7).optional(),
  categories: z.array(z.string()).optional(),
})

/**
 * Response generation request schema
 */
export const ResponseGenerationRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(100),
  userId: z.string().optional(),
  model: z.string().default(DEFAULT_LLM_MODEL).optional(),
  includeAnalysis: z.boolean().default(false).optional(),
  safety: z
    .object({
      enabled: z.boolean().default(true),
      threshold: z.number().min(0).max(1).default(0.7),
    })
    .optional(),
})

/**
 * Intervention analysis request schema
 */
export const InterventionAnalysisRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(2).max(100),
  userId: z.string().optional(),
  interventionTypes: z.array(z.string()).optional(),
  includeTextAnalysis: z.boolean().default(false).optional(),
})
