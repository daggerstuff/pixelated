import { z } from 'zod'

/**
 * Emotion dimension value schema
 */
export const EmotionValueSchema = z.number().min(0).max(10)

/**
 * Emotion dimensions schema
 */
export const EmotionDimensionsSchema = z.object({
  /** Positive/negative dimension (0-10) */
  valence: EmotionValueSchema,
  /** Energy/activation level (0-10) */
  arousal: EmotionValueSchema,
  /** Feeling of control (0-10) */
  dominance: EmotionValueSchema,
})

/**
 * Emotion data point schema
 */
export const EmotionDataPointSchema = EmotionDimensionsSchema.extend({
  /** ISO timestamp of the emotion recording */
  timestamp: z.string().datetime(),
  /** Optional emotion label */
  label: z.string().optional(),
  /** Optional notes about the emotion */
  notes: z.string().optional(),
})

/**
 * Emotion peak schema
 */
export const EmotionPeakSchema = z.object({
  /** The dimension that peaked */
  dimension: z.enum(['valence', 'arousal', 'dominance']),
  /** The peak value */
  value: EmotionValueSchema,
  /** When the peak occurred */
  timestamp: z.string().datetime(),
})

/**
 * Emotion summary schema
 */
export const EmotionSummarySchema = z.object({
  /** Average valence value */
  averageValence: z.number(),
  /** Average arousal value */
  averageArousal: z.number(),
  /** Average dominance value */
  averageDominance: z.number(),
  /** Variance in valence */
  varianceValence: z.number(),
  /** Variance in arousal */
  varianceArousal: z.number(),
  /** Variance in dominance */
  varianceDominance: z.number(),
  /** Array of emotion peaks */
  peaks: z.array(EmotionPeakSchema),
})

/**
 * Fetch options schema
 */
export const FetchOptionsSchema = z.object({
  /** Optional time range for fetching data */
  timeRange: z.tuple([z.date(), z.date()]).optional(),
  /** Optional limit on number of data points */
  limit: z.number().positive().optional(),
})

// Type definitions
export type EmotionDimension = keyof z.infer<typeof EmotionDimensionsSchema>
export type EmotionDimensions = z.infer<typeof EmotionDimensionsSchema>
export type EmotionDataPoint = z.infer<typeof EmotionDataPointSchema>
export type EmotionPeak = z.infer<typeof EmotionPeakSchema>
export type EmotionSummary = z.infer<typeof EmotionSummarySchema>
export type FetchOptions = z.infer<typeof FetchOptionsSchema>

/**
 * Hook return type
 */
export interface UseSessionEmotionsResult {
  /** Emotion data points */
  data: EmotionDataPoint[]
  /** Whether data is currently loading */
  isLoading: boolean
  /** Summary statistics of emotion data */
  summary: EmotionSummary
  /** Any error that occurred */
  error?: Error
}

/**
 * Error types
 */
export class EmotionTrackingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'EmotionTrackingError'
  }
}

export class ValidationError extends EmotionTrackingError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class FetchError extends EmotionTrackingError {
  constructor(message: string, details?: unknown) {
    super(message, 'FETCH_ERROR', details)
    this.name = 'FetchError'
  }
}

/**
 * Type guards
 */
export function isEmotionDimensions(
  value: unknown,
): value is EmotionDimensions {
  try {
    EmotionDimensionsSchema.parse(value)
    return true
  } catch {
    return false
  }
}

export function isEmotionDataPoint(value: unknown): value is EmotionDataPoint {
  try {
    EmotionDataPointSchema.parse(value)
    return true
  } catch {
    return false
  }
}

export function isEmotionSummary(value: unknown): value is EmotionSummary {
  try {
    EmotionSummarySchema.parse(value)
    return true
  } catch {
    return false
  }
}

/**
 * Helper functions
 */
export function validateEmotionValue(value: number): boolean {
  return value >= 0 && value <= 10
}

export function validateEmotionDimensions(
  dimensions: EmotionDimensions,
): boolean {
  return (
    validateEmotionValue(dimensions.valence) &&
    validateEmotionValue(dimensions.arousal) &&
    validateEmotionValue(dimensions.dominance)
  )
}

export function createEmotionDataPoint(
  dimensions: EmotionDimensions,
  timestamp: Date,
  label?: string,
  notes?: string,
): EmotionDataPoint {
  return {
    ...dimensions,
    timestamp: timestamp.toISOString(),
    label,
    notes,
  }
}

export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const mean = values.reduce((a, b) => a + b) / values.length
  const variance =
    values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}
