import { v4 as uuidv4 } from 'uuid'

import { createAuditLog, AuditEventType } from '../audit'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('emotion-tracking-service')

/** Record emotion data point */
export async function recordEmotion(
  dataPoint: EmotionDataPoint,
  userId: string,
): Promise<{ success: boolean; message: string; dataPointId: string }> {
  try {
    // In production, would verify user has permission to record emotion
    const dataPointId = uuidv4()

    // Create audit log entry
    await createAuditLog(
      AuditEventType.SECURITY,
      'emotion_recorded',
      userId,
      dataPointId,
      {
        valence: dataPoint.valence,
        arousal: dataPoint.arousal,
        dominance: dataPoint.dominance,
        label: dataPoint.label,
      },
    )

    logger.info('Emotion data recorded successfully', {
      dataPointId,
      userId,
    })

    return {
      success: true,
      message: 'Emotion data recorded successfully',
      dataPointId,
    }
  } catch (error: unknown) {
    logger.error('Error recording emotion data', {
      error: error instanceof Error ? String(error) : String(error),
      dataPoint,
    })
    return {
      success: false,
      message: 'Failed to record emotion data',
      dataPointId: '',
    }
  }
}

/** Fetch emotion data for session */
export async function fetchSessionEmotionData(
  sessionId: string,
  options?: FetchOptions,
): Promise<EmotionDataPoint[]> {
  try {
    // In production, would query database with proper authorization
    // For now, return empty data structure
    const allData: EmotionDataPoint[] = []

    // If time range specified, filter data
    let filteredData = allData
    const timeRange = options?.timeRange
    if (timeRange) {
      filteredData = allData.filter(
        (point) =>
          new Date(point.timestamp) >= timeRange[0] &&
          new Date(point.timestamp) <= timeRange[1],
      )
    }

    // Apply limit if specified
    const limitedData =
      options?.limit && filteredData.length > options.limit
        ? filteredData.slice(0, options.limit)
        : filteredData

    logger.info('Emotion data fetched', {
      sessionId,
      recordCount: limitedData.length,
    })

    return limitedData
  } catch (error: unknown) {
    logger.error('Error fetching emotion data', {
      error: error instanceof Error ? String(error) : String(error),
      sessionId,
    })
    return []
  }
}

/** Calculate emotion summary */
export function calculateEmotionSummary(
  data: EmotionDataPoint[],
): EmotionSummary {
  if (data.length === 0) {
    return {
      averageValence: 0,
      averageArousal: 0,
      averageDominance: 0,
      varianceValence: 0,
      varianceArousal: 0,
      varianceDominance: 0,
      peaks: [],
    }
  }

  // Calculate averages
  const sum = data.reduce(
    (acc, point) => ({
      valence: acc.valence + point.valence,
      arousal: acc.arousal + point.arousal,
      dominance: acc.dominance + point.dominance,
    }),
    { valence: 0, arousal: 0, dominance: 0 },
  )

  const averageValence = sum.valence / data.length
  const averageArousal = sum.arousal / data.length
  const averageDominance = sum.dominance / data.length

  // Calculate variances
  const squaredDiffs = data.reduce(
    (acc, point) => ({
      valence: acc.valence + Math.pow(point.valence - averageValence, 2),
      arousal: acc.arousal + Math.pow(point.arousal - averageArousal, 2),
      dominance:
        acc.dominance + Math.pow(point.dominance - averageDominance, 2),
    }),
    { valence: 0, arousal: 0, dominance: 0 },
  )

  const varianceValence = squaredDiffs.valence / data.length
  const varianceArousal = squaredDiffs.arousal / data.length
  const varianceDominance = squaredDiffs.dominance / data.length

  // Find peaks (points that are at least 1.5 standard deviations above the mean)
  const peaks: EmotionPeak[] = []

  const stdValence = Math.sqrt(varianceValence)
  const stdArousal = Math.sqrt(varianceArousal)
  const stdDominance = Math.sqrt(varianceDominance)

  data.forEach((point) => {
    if (point.valence > averageValence + 1.5 * stdValence) {
      peaks.push({
        dimension: 'valence',
        value: point.valence,
        timestamp: point.timestamp,
      })
    }
    if (point.arousal > averageArousal + 1.5 * stdArousal) {
      peaks.push({
        dimension: 'arousal',
        value: point.arousal,
        timestamp: point.timestamp,
      })
    }
    if (point.dominance > averageDominance + 1.5 * stdDominance) {
      peaks.push({
        dimension: 'dominance',
        value: point.dominance,
        timestamp: point.timestamp,
      })
    }
  })

  return {
    averageValence,
    averageArousal,
    averageDominance,
    varianceValence,
    varianceArousal,
    varianceDominance,
    peaks,
  }
}

/** Emotion data point */
export interface EmotionDataPoint {
  /** ISO timestamp */
  timestamp: string
  /** Positive/negative dimension (0-10) */
  valence: number
  /** Energy/activation level (0-10) */
  arousal: number
  /** Feeling of control (0-10) */
  dominance: number
  /** Optional label */
  label?: string
  /** Optional notes */
  notes?: string
}

/** Emotion dimensions summary */
export interface EmotionSummary {
  /** valence value */
  averageValence: number
  /** arousal value */
  averageArousal: number
  /** dominance value */
  averageDominance: number
  /** Variance in valence */
  varianceValence: number
  /** Variance in arousal */
  varianceArousal: number
  /** Variance in dominance */
  varianceDominance: number
  /** Array emotion peaks */
  peaks: EmotionPeak[]
}

/** Emotion peak definition */
export interface EmotionPeak {
  /** dimension peaked */
  dimension: 'valence' | 'arousal' | 'dominance'
  /** peak value */
  value: number
  /** When peak occurred */
  timestamp: string
}

/** Fetch options for emotion data */
export interface FetchOptions {
  /** Optional time range fetching data */
  timeRange?: [Date, Date]
  /** Optional limit on number data points */
  limit?: number
}
