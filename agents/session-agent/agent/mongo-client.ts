import { Collection, Db, MongoClient } from 'mongodb'

import { registerProcessShutdown } from './lib/process-shutdown.js'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017'
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME ?? 'pixelated_empathy'

const SESSIONS_COLLECTION = 'rehearsal_sessions'

export interface TranscriptTurn {
  role: 'trainee' | 'participant' | 'supervisor'
  text: string
  timestamp: string
}

export interface EmotionRollup {
  primary_emotion: string
  intensity: number
  valence: number
  risk_flags: string[]
  timestamp: string
}

interface SessionDoc {
  session_id: string
  trainee_id: string
  scenario_id: string
  state: string
  started_at: string
  updated_at: string
  transcripts: TranscriptTurn[]
  emotion_rollups: EmotionRollup[]
  summary?: string
  exit_reason?: string
  closed_at?: string
}

let client: MongoClient | null = null
let db: Db | null = null

async function connect(): Promise<Db> {
  if (db) return db
  client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    retryWrites: true,
  })
  await client.connect()
  db = client.db(MONGODB_DB_NAME)
  return db
}

function collection(): Collection<SessionDoc> {
  if (!db) throw new Error('MongoDB not connected. Call connect() first.')
  return db.collection<SessionDoc>(SESSIONS_COLLECTION)
}

export async function saveSessionHeader(
  sessionId: string,
  traineeId: string,
  scenarioId: string,
  state: string,
): Promise<string | null> {
  try {
    const d = await connect()
    const now = new Date().toISOString()
    const result = await d
      .collection<SessionDoc>(SESSIONS_COLLECTION)
      .updateOne(
        { session_id: sessionId },
        {
          $set: {
            session_id: sessionId,
            trainee_id: traineeId,
            scenario_id: scenarioId,
            state,
            updated_at: now,
          },
          $setOnInsert: {
            started_at: now,
            transcripts: [],
            emotion_rollups: [],
          },
        },
        { upsert: true },
      )
    return result.upsertedId?.toString() ?? sessionId
  } catch (err) {
    return null
  }
}

export interface SaveSessionResult {
  session_id: string
  transcript_count: number
  emotion_rollup_count: number
}

export async function saveSessionTranscript(
  sessionId: string,
  transcripts: TranscriptTurn[],
  emotionRollups: EmotionRollup[],
  summary?: string,
): Promise<SaveSessionResult> {
  try {
    await connect()
    const now = new Date().toISOString()
    await collection().updateOne(
      { session_id: sessionId },
      {
        $set: {
          state: 'ACTIVE',
          updated_at: now,
          ...(summary ? { summary } : {}),
        },
        $push: {
          transcripts: { $each: transcripts },
          emotion_rollups: { $each: emotionRollups },
        },
      },
      { upsert: true },
    )
    return {
      session_id: sessionId,
      transcript_count: transcripts.length,
      emotion_rollup_count: emotionRollups.length,
    }
  } catch (err) {
    return {
      session_id: sessionId,
      transcript_count: 0,
      emotion_rollup_count: 0,
    }
  }
}

export interface HydratedSession {
  session_id: string
  state: string
  started_at: string | null
  updated_at: string | null
  transcripts: TranscriptTurn[]
  emotion_rollups: EmotionRollup[]
  summary: string | null
  closed_at: string | null
  exit_reason: string | null
}

export async function hydrateSession(
  sessionId: string,
  maxTurns = 50,
): Promise<HydratedSession | null> {
  try {
    await connect()
    const doc = await collection().findOne(
      { session_id: sessionId },
      {
        projection: {
          session_id: 1,
          state: 1,
          started_at: 1,
          updated_at: 1,
          transcripts: { $slice: -maxTurns },
          emotion_rollups: 1,
          summary: 1,
          closed_at: 1,
          exit_reason: 1,
        },
      },
    )
    if (!doc) return null
    return {
      session_id: doc.session_id,
      state: doc.state ?? 'NEW',
      started_at: doc.started_at ?? null,
      updated_at: doc.updated_at ?? null,
      transcripts: doc.transcripts ?? [],
      emotion_rollups: doc.emotion_rollups ?? [],
      summary: doc.summary ?? null,
      closed_at: doc.closed_at ?? null,
      exit_reason: doc.exit_reason ?? null,
    }
  } catch (err) {
    return null
  }
}

export async function updateSessionState(
  sessionId: string,
  state: string,
  exitReason?: string,
  summary?: string,
): Promise<boolean> {
  try {
    await connect()
    const now = new Date().toISOString()
    await collection().updateOne(
      { session_id: sessionId },
      {
        $set: {
          state,
          updated_at: now,
          ...(exitReason ? { exit_reason: exitReason } : {}),
          ...(summary ? { summary } : {}),
          ...(state === 'CLOSED' ? { closed_at: now } : {}),
        },
      },
    )
    return true
  } catch (err) {
    return false
  }
}

async function close(): Promise<void> {
  if (client) {
    await client.close()
    client = null
    db = null
  }
}

registerProcessShutdown(close)
