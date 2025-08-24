import { Pool } from 'pg'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

// Define a specific interface for the crisis event data
export interface CrisisEventData {
  caseId: string
  patientId: string
  sessionId: string
  alertLevel: string
  detectionScore: number
  detectedRisks: string[]
  textSample: string
  timestamp: string
}

// Initialize logger
const logger = createBuildSafeLogger('crisis-event-db')

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL is not defined in the environment variables.')
}

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined,
})

export async function recordCrisisEventToDb(
  eventData: CrisisEventData,
): Promise<void> {
  const {
    caseId,
    patientId,
    sessionId,
    alertLevel,
    detectionScore,
    detectedRisks,
    textSample,
    timestamp,
  } = eventData

  try {
    await pool.query(
      `INSERT INTO crisis_events
        (case_id, patient_id, session_id, alert_level, detection_score, detected_risks, text_sample, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        caseId,
        patientId,
        sessionId,
        alertLevel,
        detectionScore,
        detectedRisks,
        textSample,
        timestamp,
      ],
    )
    logger.info('Crisis event recorded successfully', { caseId })
  } catch (error: unknown) {
    logger.error('Failed to record crisis event to database', {
      error: error instanceof Error ? String(error) : String(error),
      stack: error instanceof Error ? (error as Error)?.stack : undefined,
      caseId,
    })
    // Rethrow to allow calling code to handle the error if needed
    throw new Error(
      `Failed to record crisis event: ${error instanceof Error ? String(error) : String(error)}`,
    )
  }
}
