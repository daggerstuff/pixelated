/**
 * MongoDB session store for WebSocket training session persistence.
 *
 * PIX-3935 — Persists active training sessions so server restart
 * allows reconnection without data loss. Supports lastEventId-based
 * replay for reconnecting clients.
 */

import { type Db, type Collection } from 'mongodb'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('training-session-store')

export const SESSIONS_COLLECTION = 'training_sessions'

/** A persisted training session document. */
export interface TrainingSessionDocument {
  /** Unique session identifier. */
  sessionId: string
  /** List of attendee user IDs. */
  attendees: string[]
  /** Last event sequence id — monotonically increasing. */
  lastEventId: number
  /** Schema version for forward-compat. */
  version: number
  /** ISO timestamp of creation. */
  createdAt: string
  /** ISO timestamp of last update. */
  updatedAt: string
  /** Optional dialogue context for the session. */
  dialogue?: Array<{ speaker: string; text: string }>
}

export class SessionStore {
  private readonly collection: Collection<TrainingSessionDocument>

  constructor(db: Db) {
    this.collection =
      db.collection<TrainingSessionDocument>(SESSIONS_COLLECTION)

    // Ensure indexes for common queries
    void this.collection.createIndexes([
      { key: { sessionId: 1 }, unique: true },
      { key: { attendees: 1 } },
      { key: { updatedAt: 1 } },
    ])
  }

  /**
   * Save or create a session snapshot.
   */
  async save(session: TrainingSessionDocument): Promise<void> {
    const doc = {
      ...session,
      updatedAt: new Date().toISOString(),
    }
    await this.collection.updateOne(
      { sessionId: session.sessionId },
      { $set: doc },
      { upsert: true },
    )
    logger.debug('Session saved', {
      sessionId: session.sessionId,
      lastEventId: session.lastEventId,
    })
  }

  /**
   * Load a session by ID.
   */
  async load(sessionId: string): Promise<TrainingSessionDocument | null> {
    return this.collection.findOne({ sessionId })
  }

  /**
   * Remove a completed/expired session.
   */
  async delete(sessionId: string): Promise<void> {
    await this.collection.deleteOne({ sessionId })
    logger.debug('Session deleted', { sessionId })
  }

  /**
   * Increment the event counter and return the new value.
   * Used to allocate monotonic event IDs within a session.
   */
  async nextEventId(sessionId: string): Promise<number> {
    const result = await this.collection.findOneAndUpdate(
      { sessionId },
      {
        $inc: { lastEventId: 1 },
        $set: { updatedAt: new Date().toISOString() },
      },
      { returnDocument: 'after', upsert: true },
    )
    return result?.lastEventId ?? 0
  }

  /**
   * Reconnect: load session and return the next expected event ID.
   * If no session exists, create a fresh stub.
   */
  async reconnect(
    sessionId: string,
    userId: string,
  ): Promise<{ session: TrainingSessionDocument; resumeFrom: number }> {
    let session = await this.load(sessionId)
    if (!session) {
      const now = new Date().toISOString()
      session = {
        sessionId,
        attendees: [userId],
        lastEventId: 0,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }
      await this.collection.insertOne(session)
      logger.info('Session created', { sessionId })
    } else {
      // Append user if not already in attendees
      if (!session.attendees.includes(userId)) {
        await this.collection.updateOne(
          { sessionId },
          { $addToSet: { attendees: userId } },
        )
        session.attendees.push(userId)
      }
    }

    return { session, resumeFrom: session.lastEventId + 1 }
  }
}
