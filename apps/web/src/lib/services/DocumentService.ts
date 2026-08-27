import Redis from 'ioredis'
import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'

export interface Document {
  id: string
  title: string
  content: string
  ownerId: string
  collaborators: string[]
  createdAt: Date
  updatedAt: Date
  version: number
  isPublic: boolean
}

export interface DocumentChange {
  id: string
  documentId: string
  userId: string
  change: unknown
  timestamp: Date
  version: number
}

interface DocumentRow {
  id: string
  title: string
  content: string
  owner_id: string
  collaborators: string[] | null
  created_at: string | Date
  updated_at: string | Date
  version: number
  is_public: boolean
}

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const docLogger = createBuildSafeLogger('document-service')

interface DocumentChangeRow {
  id: string
  document_id: string
  user_id: string
  change: unknown
  timestamp: string | Date
  version: number
}

interface RawCollaborationSession {
  id: string
  documentId: string
  userId: string
  socketId: string
  cursor?: { line: number; column: number }
  lastActivity: string | Date
}

export interface CollaborationSession {
  id: string
  documentId: string
  userId: string
  socketId: string
  cursor?: { line: number; column: number }
  lastActivity: Date
}

export class DocumentService {
  private readonly db: Pool
  private readonly redis: Redis

  constructor(db: Pool, redis: Redis) {
    this.db = db
    this.db = db
    this.redis = redis
  }

  private get redisClient() {
    return this.redis as unknown as {
      get(key: string): Promise<string | null>
      mget(...keys: string[]): Promise<(string | null)[]>
      setex(key: string, seconds: number, value: string): Promise<string>
      sadd(key: string, ...members: string[]): Promise<number>
      srem(key: string, ...members: string[]): Promise<number>
      smembers(key: string): Promise<string[]>
      del(key: string): Promise<number>
    }
  }

  async createDocument(data: {
    title: string
    content: string
    ownerId: string
    isPublic?: boolean
  }): Promise<Document> {
    const id = uuidv4()
    const now = new Date()

    const query = `
      INSERT INTO documents (id, title, content, owner_id, collaborators, created_at, updated_at, version, is_public)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `

    const result = await this.db.query<DocumentRow>(query, [
      id,
      data.title,
      data.content,
      data.ownerId,
      JSON.stringify([]),
      now,
      now,
      1,
      data.isPublic ?? false,
    ])

    return this.mapDocumentRow(result.rows[0])
  }

  async getDocument(id: string, userId: string): Promise<Document | null> {
    const query = `
      SELECT * FROM documents 
      WHERE id = $1 AND (
        owner_id = $2 OR 
        $2 = ANY(collaborators) OR 
        is_public = true
      )
    `

    const result = await this.db.query<DocumentRow>(query, [id, userId])
    return result.rows.length > 0 ? this.mapDocumentRow(result.rows[0]) : null
  }

  async updateDocument(
    id: string,
    userId: string,
    updates: Partial<{ title: string; content: string }>,
  ): Promise<Document | null> {
    const document = await this.getDocument(id, userId)
    if (!document) return null

    const query = `
      UPDATE documents 
      SET title = COALESCE($1, title),
          content = COALESCE($2, content),
          updated_at = NOW(),
          version = version + 1
      WHERE id = $3
      RETURNING *
    `

    const result = await this.db.query<DocumentRow>(query, [
      updates.title,
      updates.content,
      id,
    ])

    return this.mapDocumentRow(result.rows[0])
  }

  async addCollaborator(
    documentId: string,
    ownerId: string,
    collaboratorEmail: string,
  ): Promise<boolean> {
    const query = `
      UPDATE documents 
      SET collaborators = collaborators || $1::text[]
      WHERE id = $2 AND owner_id = $3
    `

    const result = await this.db.query(query, [
      [collaboratorEmail],
      documentId,
      ownerId,
    ])
    return (result.rowCount ?? 0) > 0
  }

  async recordChange(
    documentId: string,
    userId: string,
    change: unknown,
  ): Promise<void> {
    const id = uuidv4()
    const query = `
      INSERT INTO document_changes (id, document_id, user_id, change, timestamp, version)
      VALUES ($1, $2, $3, $4, NOW(), (
        SELECT version FROM documents WHERE id = $2
      ))
    `

    await this.db.query(query, [id, documentId, userId, JSON.stringify(change)])
  }

  async getDocumentHistory(
    documentId: string,
    userId: string,
  ): Promise<DocumentChange[]> {
    const document = await this.getDocument(documentId, userId)
    if (!document) return []

    const query = `
      SELECT * FROM document_changes 
      WHERE document_id = $1 
      ORDER BY timestamp ASC
    `

    const result = await this.db.query<DocumentChangeRow>(query, [documentId])
    return result.rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      userId: row.user_id,
      change: row.change,
      timestamp:
        row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp),
      version: row.version,
    }))
  }

  async createCollaborationSession(data: {
    documentId: string
    userId: string
    socketId: string
  }): Promise<CollaborationSession> {
    const session: CollaborationSession = {
      id: uuidv4(),
      documentId: data.documentId,
      userId: data.userId,
      socketId: data.socketId,
      lastActivity: new Date(),
    }

    await this.redisClient.setex(
      `session:${session.id}`,
      3600,
      JSON.stringify(session),
    )

    await this.redisClient.sadd(`doc:${data.documentId}:sessions`, session.id)

    return session
  }

  async updateCursor(
    sessionId: string,
    cursor: { line: number; column: number },
  ): Promise<void> {
    const sessionData = await this.redisClient.get(`session:${sessionId}`)
    if (!sessionData) return

    const session = parseSession(sessionData)
    if (!session) return
    session.cursor = cursor
    session.lastActivity = new Date()

    await this.redisClient.setex(
      `session:${sessionId}`,
      3600,
      JSON.stringify(session),
    )
  }

  async getActiveCollaborators(
    documentId: string,
  ): Promise<CollaborationSession[]> {
    const sessionIds = await this.redisClient.smembers(
      `doc:${documentId}:sessions`,
    )
    const sessions: CollaborationSession[] = []

    if (sessionIds.length > 0) {
      const sessionKeys = sessionIds.map((id) => `session:${id}`)
      const sessionDataArray = await this.redisClient.mget(...sessionKeys)

      for (let i = 0; i < sessionIds.length; i++) {
        const sessionId = sessionIds[i]
        const sessionData = sessionDataArray[i]

        if (sessionData) {
          const session = parseSession(sessionData)
          if (session) {
            sessions.push(session)
          } else {
            await this.redis.srem(`doc:${documentId}:sessions`, sessionId)
          }
        } else {
          await this.redisClient.srem(`doc:${documentId}:sessions`, sessionId)
        }
      }
    }

    return sessions
  }

  async removeCollaborationSession(sessionId: string): Promise<void> {
    const sessionData = await this.redisClient.get(`session:${sessionId}`)
    if (!sessionData) return

    const session = parseSession(sessionData)
    if (!session) return
    await this.redis.srem(`doc:${session.documentId}:sessions`, sessionId)
    await this.redis.del(`session:${sessionId}`)
  }

  private mapDocumentRow(row: DocumentRow): Document {
    const collaborators = Array.isArray(row.collaborators)
      ? row.collaborators
      : []

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      ownerId: row.owner_id,
      collaborators,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at
          : new Date(row.created_at),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at
          : new Date(row.updated_at),
      version: row.version,
      isPublic: row.is_public,
    }
  }
}

function isRawCollaborationSession(
  value: unknown,
): value is RawCollaborationSession {
  if (!isRecord(value)) return false

  return (
    typeof value['id'] === 'string' &&
    typeof value['documentId'] === 'string' &&
    typeof value['userId'] === 'string' &&
    typeof value['socketId'] === 'string' &&
    (typeof value['lastActivity'] === 'string' ||
      value['lastActivity'] instanceof Date)
  )
}

function parseSession(sessionData: string): CollaborationSession | null {
  try {
    const value = JSON.parse(sessionData) as unknown
    if (!isRawCollaborationSession(value)) return null

    return {
      ...value,
      lastActivity:
        value.lastActivity instanceof Date
          ? value.lastActivity
          : new Date(value.lastActivity),
    }
  } catch (error: unknown) {
    docLogger.error('Failed to parse collaboration session', error)
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
