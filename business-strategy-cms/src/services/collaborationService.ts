import { DocumentModel } from '@/models/Document'

export interface CollaborationSession {
  documentId: string
  userId: string
  userName: string
  color: string
  cursorPosition: number
  selection?: {
    start: number
    end: number
  }
  lastActivity: Date
}

export interface DocumentChange {
  type: 'insert' | 'delete' | 'format'
  position: number
  content?: string
  length?: number
  format?: string
  value?: any
  userId: string
  timestamp: Date
}

export class CollaborationService {
  private static sessions: Map<string, CollaborationSession[]> = new Map()
  private static changes: Map<string, DocumentChange[]> = new Map()

  static joinSession(
    documentId: string,
    userId: string,
    userName: string,
  ): CollaborationSession {
    const color = this.generateUserColor(userId)
    const session: CollaborationSession = {
      documentId,
      userId,
      userName,
      color,
      cursorPosition: 0,
      lastActivity: new Date(),
    }

    if (!this.sessions.has(documentId)) {
      this.sessions.set(documentId, [])
    }

    const existingSessions = this.sessions.get(documentId) || []
    const existingIndex = existingSessions.findIndex((s) => s.userId === userId)

    if (existingIndex >= 0) {
      existingSessions[existingIndex] = session
    } else {
      existingSessions.push(session)
    }

    this.sessions.set(documentId, existingSessions)
    return session
  }

  static leaveSession(documentId: string, userId: string): void {
    const sessions = this.sessions.get(documentId) || []
    const filteredSessions = sessions.filter((s) => s.userId !== userId)
    this.sessions.set(documentId, filteredSessions)
  }

  static getActiveUsers(documentId: string): CollaborationSession[] {
    return this.sessions.get(documentId) || []
  }

  static updateCursor(
    documentId: string,
    userId: string,
    position: number,
    selection?: { start: number; end: number },
  ): void {
    const sessions = this.sessions.get(documentId) || []
    const session = sessions.find((s) => s.userId === userId)

    if (session) {
      session.cursorPosition = position
      session.selection = selection
      session.lastActivity = new Date()
    }
  }

  static recordChange(documentId: string, change: DocumentChange): void {
    if (!this.changes.has(documentId)) {
      this.changes.set(documentId, [])
    }

    const changes = this.changes.get(documentId) || []
    changes.push(change)

    // Keep only last 100 changes
    if (changes.length > 100) {
      changes.shift()
    }

    this.changes.set(documentId, changes)
  }

  static getChanges(documentId: string, since?: Date): DocumentChange[] {
    const changes = this.changes.get(documentId) || []

    if (since) {
      return changes.filter((c) => c.timestamp > since)
    }

    return changes
  }

  static async autoSave(
    documentId: string,
    content: string,
    userId: string,
  ): Promise<void> {
    // Record the change
    this.recordChange(documentId, {
      type: 'insert',
      position: 0,
      content,
      userId,
      timestamp: new Date(),
    })

    // Update document with auto-save flag
    const document = await DocumentModel.findById(documentId)
    if (document) {
      await DocumentModel.update(documentId, {
        content,
        metadata: {
          ...document.metadata,
          lastEditedBy: userId,
        },
      })
    }
  }

  static generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FECA57',
      '#FF9FF3',
      '#54A0FF',
      '#5F27CD',
      '#00D2D3',
      '#FF9F43',
      '#10AC84',
      '#EE5A24',
      '#0652DD',
      '#9980FA',
      '#D63031',
    ]

    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }

    return colors[Math.abs(hash) % colors.length]
  }

  static cleanupInactiveSessions(): void {
    const now = new Date()
    const timeout = 5 * 60 * 1000 // 5 minutes

    for (const [documentId, sessions] of this.sessions.entries()) {
      const activeSessions = sessions.filter(
        (s) => now.getTime() - s.lastActivity.getTime() < timeout,
      )
      this.sessions.set(documentId, activeSessions)
    }
  }
}
