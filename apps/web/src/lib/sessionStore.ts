/**
 * MongoDB-backed chat session store.
 *
 * Replaces the previous in-memory store so chat sessions survive
 * server restarts. Follows the same pattern as the training
 * SessionStore (PIX-3935).
 */

import type { Collection, Db, Filter, UpdateFilter } from 'mongodb'

import { mongodb } from '@/config/mongodb.config'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('chat-session-store')

export const CHAT_SESSIONS_COLLECTION = 'chat_sessions'

/** MongoDB document for a persisted chat session. */
export interface ChatSessionDocument {
  /** Unique session identifier (same as the in-memory `id` was). */
  sessionId: string
  /** Arbitrary session payload (therapist info, state, threads, etc.). */
  data: Record<string, unknown>
  /** Schema version for forward-compat. */
  version: number
  /** ISO timestamp of creation. */
  createdAt: string
  /** ISO timestamp of last update. */
  updatedAt: string
}

let collection: Collection<ChatSessionDocument> | null = null

async function getCollection(): Promise<Collection<ChatSessionDocument>> {
  if (collection) return collection

  const db: Db = await mongodb.connect()
  const col = db.collection<ChatSessionDocument>(CHAT_SESSIONS_COLLECTION)

  await col.createIndexes([
    { key: { sessionId: 1 }, unique: true },
    { key: { updatedAt: 1 } },
  ])

  collection = col
  return col
}

/**
 * Retrieve a chat session by ID.
 * Returns the stored `data` payload or null if not found.
 */
export async function getSession(
  sessionId: string,
): Promise<Record<string, unknown> | null> {
  const col = await getCollection()
  const doc = await col.findOne({ sessionId })

  if (!doc) {
    logger.debug('Session not found', { sessionId })
    return null
  }

  return { ...doc.data, id: doc.sessionId }
}

/**
 * Persist a chat session. Requires the payload to contain a string `id`.
 * Uses upsert so create + update are a single code path.
 */
export async function saveSession(
  sessionData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!('id' in sessionData) || typeof sessionData['id'] !== 'string') {
    throw new Error('Session data must have a string id')
  }

  const sessionId = sessionData['id']
  const now = new Date().toISOString()

  const col = await getCollection()
  const filter: Filter<ChatSessionDocument> = { sessionId }
  const update: UpdateFilter<ChatSessionDocument> = {
    $set: {
      sessionId,
      data: { ...sessionData },
      version: 1,
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  }

  await col.updateOne(filter, update, { upsert: true })
  logger.debug('Session saved', { sessionId })

  return { ...sessionData, saved: true }
}

/**
 * Delete a chat session by ID.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const col = await getCollection()
  await col.deleteOne({ sessionId })
  logger.debug('Session deleted', { sessionId })
}
