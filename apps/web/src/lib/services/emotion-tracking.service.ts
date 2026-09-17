import { v4 as uuidv4 } from 'uuid'

import type { Collection } from 'mongodb'

import { createAuditLog, AuditEventType } from '../audit'
import { aiRepository } from '../db/ai'
import mongoClient from '../db/mongoClient'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('emotion-tracking-service')

/** Runtime document persisted in the emotion_records collection */
interface EmotionRecordDocument {
  id: string
  sessionId: string
  userId: string
  timestamp: Date
  valence: number
  arousal: number
  dominance: number
  label?: string
  notes?: string
  source: 'user_reported' | 'ai_detected'
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

/** Result of recording an emotion data point */
export interface RecordEmotionResult {
  success: boolean
  message: string
  dataPointId: string
}

function getEmotionCollection(): Collection<EmotionRecordDocument> {
  return mongoClient.db.collection<EmotionRecordDocument>('emotion_records')
}

function mapRecordToPoint(
  record: EmotionRecordDocument,
): EmotionDataPoint {
  return {
    timestamp: record.timestamp.toISOString(),
    valence: record.valence,
    arousal: record.arousal,
    dominance: record.dominance,
    label: record.label,
    notes: record.notes,
  }
}

/**
 * Map an AI-detected emotion analysis (Plutchik vector, 0..1 scales) to a
 * user-reported data point (VAD dimensions, 0..10 scales) so both sources
 * appear in one timeline.
 */
function mapAnalysisToPoint(
  analysis: {
    timestamp: string
    dimensions: { valence: number; arousal: number; dominance: number }
  },
  detectedLabel?: string,
): EmotionDataPoint {
  // valence/dominance arrive in [-1, 1], arousal in [0, 1]
  const toVadScale = (v: number, bipolar: boolean): number =>
    Math.round(((bipolar ? (v + 1) / 2 : v) * 10) * 100) / 100
  return {
    timestamp: new Date(analysis.timestamp).toISOString(),
    valence: toVadScale(analysis.dimensions.valence, true),
    arousal: toVadScale(analysis.dimensions.arousal, false),
    dominance: toVadScale(analysis.dimensions.dominance, true),
    label: detectedLabel,
  }
}

/** Record emotion data point with persistence */
export async function recordEmotion(
  dataPoint: EmotionDataPoint,
  userId: string,
  sessionId?: string,
): Promise<RecordEmotionResult> {
  try {
    const dataPointId = uuidv4()
    const record: EmotionRecordDocument = {
      id: dataPointId,
      sessionId: sessionId ?? 'unassigned',
      userId,
      timestamp: new Date(dataPoint.timestamp),
      valence: dataPoint.valence,
      arousal: dataPoint.arousal,
      dominance: dataPoint.dominance,
      label: dataPoint.label,
      notes: dataPoint.notes,
      source: 'user_reported',
    }

    const collection = getEmotionCollection()
    await collection.insertOne(record)

    // Create audit log entry (HIPAA: emotion data is PHI)
    await createAuditLog(
      AuditEventType.CREATE,
      'emotion_recorded',
      userId,
      'emotion_record',
      {
        dataPointId,
        sessionId: record.sessionId,
        label: dataPoint.label,
      },
    )

    logger.info('Emotion data recorded successfully', {
      dataPointId,
      userId,
      sessionId: record.sessionId,
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

/** Fetch emotion data for session: persisted records + AI-detected analyses */
export async function fetchSessionEmotionData(
  sessionId: string,
  options?: FetchOptions,
): Promise<EmotionDataPoint[]> {
  try {
    const collection = getEmotionCollection()
    const query: Record<string, unknown> = { sessionId }
    if (options?.timeRange) {
      query['timestamp'] = {
        $gte: options.timeRange[0],
        $lte: options.timeRange[1],
      }
    }

    let cursor = collection
      .find(query)
      .sort({ timestamp: 1 })

    if (options?.limit) {
      cursor = cursor.limit(options.limit)
    }

    const records = await cursor.toArray()
    const points = records.map(mapRecordToPoint)

    // Merge AI-detected analyses for this session (emotion_data collection,
    // written by analysis pipelines) as detected source points
    try {
      const analyses = await aiRepository.getEmotionsForSession(sessionId)
      const detected = analyses.map((analysis) =>
        mapAnalysisToPoint(analysis, undefined),
      )
      points.push(...detected)
      points.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    } catch (err) {
      logger.warn('Could not merge AI-detected emotion analyses', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    const limitedData =
      options?.limit && points.length > options.limit
        ? points.slice(0, options.limit)
        : points

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
