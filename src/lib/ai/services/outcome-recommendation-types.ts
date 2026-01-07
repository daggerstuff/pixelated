import { z } from 'zod'

// Base schemas
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.date(),
})

export const TherapySessionSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  therapistId: z.string(),
  status: z.enum(['active', 'completed', 'scheduled', 'cancelled']),
  securityLevel: z.enum(['standard', 'enhanced', 'maximum']),
  emotionAnalysisEnabled: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
})

export const ChatSessionSchema = z.object({
  messages: z.array(MessageSchema),
  metadata: z.record(z.unknown()).optional(),
})

export const EmotionStateSchema = z.object({
  currentEmotion: z.string(),
  intensity: z.number().min(0).max(1),
  timestamp: z.date(),
  confidence: z.number().min(0).max(1),
  relatedFactors: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const MentalHealthAnalysisSchema = z.object({
  primaryConcerns: z.array(z.string()),
  riskLevel: z.enum(['low', 'moderate', 'high']),
  recommendedApproaches: z.array(z.string()).optional(),
  notes: z.string().optional(),
  lastUpdated: z.date().optional(),
  confidence: z.number().min(0).max(1).optional(),
})

// Context and Request schemas
export const RecommendationContextSchema = z.object({
  session: TherapySessionSchema,
  chatSession: ChatSessionSchema,
  recentEmotionState: EmotionStateSchema,
  recentInterventions: z.array(z.string()),
  userPreferences: z.record(z.unknown()).optional(),
  mentalHealthAnalysis: MentalHealthAnalysisSchema.optional(),
})

export const RecommendationRequestSchema = z.object({
  context: RecommendationContextSchema,
  desiredOutcomes: z.array(z.string()).min(1),
  maxResults: z.number().int().positive(),
  minConfidence: z.number().min(0).max(1).optional(),
  includeExperimental: z.boolean().optional(),
})

// Outcome schemas
export const TreatmentForecastSchema = z.object({
  outcomeId: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  timeEstimate: z.string(),
  interventions: z.array(z.string()),
  risk: z.enum(['low', 'moderate', 'high']),
  details: z
    .object({
      expectedDuration: z.number().int().positive(),
      successRate: z.number().min(0).max(100),
      contraindications: z.array(z.string()),
      sideEffects: z.array(z.string()),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
})

// Type definitions
export type Message = z.infer<typeof MessageSchema>
export type TherapySession = z.infer<typeof TherapySessionSchema>
export type ChatSession = z.infer<typeof ChatSessionSchema>
export type EmotionState = z.infer<typeof EmotionStateSchema>
export type MentalHealthAnalysis = z.infer<typeof MentalHealthAnalysisSchema>
export type RecommendationContext = z.infer<typeof RecommendationContextSchema>
export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>
export type TreatmentForecast = z.infer<typeof TreatmentForecastSchema>

// Type guards
export function isTherapySession(value: unknown): value is TherapySession {
  try {
    TherapySessionSchema.parse(value)
    return true
  } catch {
    return false
  }
}

export function isChatSession(value: unknown): value is ChatSession {
  try {
    ChatSessionSchema.parse(value)
    return true
  } catch {
    return false
  }
}

export function isEmotionState(value: unknown): value is EmotionState {
  try {
    EmotionStateSchema.parse(value)
    return true
  } catch {
    return false
  }
}

export function isMentalHealthAnalysis(
  value: unknown,
): value is MentalHealthAnalysis {
  try {
    MentalHealthAnalysisSchema.parse(value)
    return true
  } catch {
    return false
  }
}

export function isRecommendationContext(
  value: unknown,
): value is RecommendationContext {
  try {
    RecommendationContextSchema.parse(value)
    return true
  } catch {
    return false
  }
}

export function isRecommendationRequest(
  value: unknown,
): value is RecommendationRequest {
  try {
    RecommendationRequestSchema.parse(value)
    return true
  } catch {
    return false
  }
}

export function isTreatmentForecast(
  value: unknown,
): value is TreatmentForecast {
  try {
    TreatmentForecastSchema.parse(value)
    return true
  } catch {
    return false
  }
}

// Error types
export class RecommendationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'RecommendationError'
  }
}

export class ValidationError extends RecommendationError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class ProcessingError extends RecommendationError {
  constructor(message: string, details?: unknown) {
    super(message, 'PROCESSING_ERROR', details)
    this.name = 'ProcessingError'
  }
}
