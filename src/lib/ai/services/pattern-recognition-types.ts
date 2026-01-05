import { z } from 'zod'
import type { TherapySession } from '../models/ai-types'
import type { EmotionAnalysis } from '../emotions/types'

// Base schemas for statistical metrics
export const StatisticalMetricsSchema = z.object({
  meanConfidence: z.number().min(0).max(1),
  standardDeviation: z.number().min(0),
  outlierCount: z.number().int().min(0),
  correlationStrength: z.number().min(-1).max(1),
})

export const TimelineAnalysisSchema = z.object({
  firstOccurrence: z.date(),
  lastOccurrence: z.date(),
  frequency: z.number().min(0),
  trend: z.enum(['increasing', 'decreasing', 'stable']),
  trendStrength: z.number().min(0).max(1),
  seasonality: z
    .object({
      period: z.number().min(0),
      amplitude: z.number().min(0),
      confidence: z.number().min(0).max(1),
    })
    .optional(),
})

export const ClinicalRelevanceSchema = z.object({
  significance: z.enum(['low', 'medium', 'high']),
  recommendation: z.string(),
  interventionSuggested: z.boolean(),
  urgency: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  evidenceScore: z.number().min(0).max(1),
})

// Pattern Recognition Result Schema
export const PatternRecognitionResultSchema = z.object({
  patternId: z.string(),
  type: z.enum(['behavioral', 'emotional', 'cognitive', 'communication']),
  description: z.string(),
  frequency: z.number().min(0),
  confidence: z.number().min(0).max(1),
  sessionIds: z.array(z.string()),
  timelineAnalysis: TimelineAnalysisSchema,
  clinicalRelevance: ClinicalRelevanceSchema,
  statisticalMetrics: StatisticalMetricsSchema,
})

// Risk Correlation Schema
export const RiskCorrelationSchema = z.object({
  primaryFactor: z.string(),
  correlatedFactors: z.array(
    z.object({
      factor: z.string(),
      correlation: z.number().min(-1).max(1),
      confidence: z.number().min(0).max(1),
      pValue: z.number().min(0).max(1),
      effectSize: z.enum(['small', 'medium', 'large']),
    }),
  ),
  timeFrame: z.object({
    start: z.date(),
    end: z.date(),
    duration: z.number().min(0),
  }),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  actionRequired: z.boolean(),
  recommendations: z.array(z.string()),
  statisticalMetrics: z.object({
    sampleSize: z.number().int().min(0),
    pearsonCorrelation: z.number().min(-1).max(1),
    spearmanCorrelation: z.number().min(-1).max(1),
    kendallTau: z.number().min(-1).max(1),
    confidence95Interval: z.tuple([z.number(), z.number()]),
  }),
  fheAnalysis: z
    .object({
      encryptedCorrelationMatrix: z.string(),
      homomorphicConfidence: z.number().min(0).max(1),
      privacyPreserved: z.boolean(),
    })
    .optional(),
})

// Trend Pattern Schema
export const TrendPatternSchema = z.object({
  id: z.string(),
  type: z.string(),
  confidence: z.number().min(0).max(1),
  startDate: z.date(),
  endDate: z.date(),
  indicators: z.array(z.string()),
  description: z.string(),
  algorithmicAnalysis: z.object({
    trendDirection: z.enum([
      'increasing',
      'decreasing',
      'stable',
      'oscillating',
    ]),
    trendStrength: z.number().min(0).max(1),
    linearRegression: z.object({
      slope: z.number(),
      intercept: z.number(),
      rSquared: z.number().min(0).max(1),
      pValue: z.number().min(0).max(1),
    }),
    seasonalDecomposition: z
      .object({
        trendComponent: z.array(z.number()),
        seasonalComponent: z.array(z.number()),
        residualComponent: z.array(z.number()),
        seasonalityStrength: z.number().min(0).max(1),
      })
      .optional(),
    changePoints: z.array(
      z.object({
        timestamp: z.date(),
        confidenceLevel: z.number().min(0).max(1),
        changeType: z.enum(['increase', 'decrease', 'plateau']),
      }),
    ),
  }),
  clinicalImplications: z.object({
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    interventionWindow: z.number().min(0),
    followUpRecommended: z.boolean(),
    escalationRequired: z.boolean(),
  }),
})

// Cross Session Pattern Schema
export const CrossSessionPatternSchema = z.object({
  id: z.string(),
  type: z.string(),
  sessions: z.array(z.string()),
  pattern: z.string(),
  frequency: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  impact: z.string(),
  recommendations: z.array(z.string()),
  advancedMetrics: z.object({
    cohesionCoefficient: z.number().min(0).max(1),
    persistenceScore: z.number().min(0).max(1),
    evolutionRate: z.number().min(0).max(1),
    clinicalMagnitude: z.number().min(0).max(1),
    networkAnalysis: z.object({
      centralitySessions: z.array(z.string()),
      connectionStrength: z.number().min(0).max(1),
      communityDetection: z.boolean(),
    }),
  }),
  temporalCharacteristics: z.object({
    cyclicNature: z.boolean(),
    periodLength: z.number().min(0).optional(),
    phaseShift: z.number(),
    amplitudeVariation: z.number().min(0),
  }),
})

// Type definitions
export type PatternRecognitionResult = z.infer<
  typeof PatternRecognitionResultSchema
>
export type RiskCorrelation = z.infer<typeof RiskCorrelationSchema>
export type TrendPattern = z.infer<typeof TrendPatternSchema>
export type CrossSessionPattern = z.infer<typeof CrossSessionPatternSchema>

// Type guards
export function isPatternRecognitionResult(
  value: unknown,
): value is PatternRecognitionResult {
  try {
    PatternRecognitionResultSchema.parse(value)
    return true
  } catch {
    return false
  }
}

export function isRiskCorrelation(value: unknown): value is RiskCorrelation {
  try {
    RiskCorrelationSchema.parse(value)
    return true
  } catch {
    return false
  }
}

export function isTrendPattern(value: unknown): value is TrendPattern {
  try {
    TrendPatternSchema.parse(value)
    return true
  } catch {
    return false
  }
}

export function isCrossSessionPattern(
  value: unknown,
): value is CrossSessionPattern {
  try {
    CrossSessionPatternSchema.parse(value)
    return true
  } catch {
    return false
  }
}

// Service interface
export interface PatternRecognitionService {
  detectCrossSessionPatterns(
    clientId: string,
    sessions: TherapySession[],
  ): Promise<PatternRecognitionResult[]>

  analyzeSessionPatterns(
    session: TherapySession,
  ): Promise<PatternRecognitionResult[]>

  comparePatterns(
    patterns1: PatternRecognitionResult[],
    patterns2: PatternRecognitionResult[],
  ): Promise<{
    common: PatternRecognitionResult[]
    unique1: PatternRecognitionResult[]
    unique2: PatternRecognitionResult[]
  }>

  analyzeRiskFactorCorrelations(
    clientId: string,
    analyses: EmotionAnalysis[],
  ): Promise<RiskCorrelation[]>

  analyzeLongTermTrends(
    clientId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TrendPattern[]>

  detectCrossSessionPatternsAdvanced(
    clientId: string,
    sessions: TherapySession[],
  ): Promise<CrossSessionPattern[]>
}

// Error types
export class PatternRecognitionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'PatternRecognitionError'
  }
}

export class ValidationError extends PatternRecognitionError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class ProcessingError extends PatternRecognitionError {
  constructor(message: string, details?: unknown) {
    super(message, 'PROCESSING_ERROR', details)
    this.name = 'ProcessingError'
  }
}
