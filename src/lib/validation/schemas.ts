import z from 'zod'

/**
 * Chat message schema with security validations
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z
    .string()
    .min(1)
    .max(32768)
    .refine(
      (value) => {
        // Block common XSS patterns
        const xssPatterns = [
          /<script\b[^<]*(?:<[^<]*)*<\/script>/i, // Script tags
          /javascript:/i, // JavaScript protocol
          /data:[^,]*base64/i, // Data URIs with base64
          /on\w+=/i, // Event handlers
          /eval\(/i, // Eval calls
        ]
        return !xssPatterns.some((pattern) => pattern.test(value))
      },
      {
        message: 'Potential security issue detected in content',
      },
    )
    .refine(
      (value) => {
        // Block SQL injection patterns
        const sqlPatterns = [
          /\b(select|insert|update|delete|drop|alter|create|truncate)\b.*\b(from|into|table|database|values)\b/i,
          /\bunion\b.*\bselect\b/i,
          /--.*$/m,
          /;$/,
          /\/\*.*\*\//,
        ]
        return !sqlPatterns.some((pattern) => pattern.test(value))
      },
      {
        message: 'Potential injection attack detected in content',
      },
    ),
  name: z.string().optional(),
})

/**
 * AI completion request schema
 */
export const CompletionRequestSchema = z.object({
  model: z.string().min(1).default('togethercomputer/llama-3-8b-instruct'),
  messages: z.array(ChatMessageSchema).min(1).max(100),
  temperature: z.number().min(0).max(2).default(0.7),
  max_tokens: z.number().min(1).max(4096).default(1024),
  stream: z.boolean().default(false),
  presence_penalty: z.number().min(-2).max(2).default(0).optional(),
  frequency_penalty: z.number().min(-2).max(2).default(0).optional(),
  top_p: z.number().min(0).max(1).default(1).optional(),
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
  model: z.string().default('togethercomputer/llama-3-8b-instruct').optional(),
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
  model: z.string().default('togethercomputer/llama-3-8b-instruct').optional(),
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
