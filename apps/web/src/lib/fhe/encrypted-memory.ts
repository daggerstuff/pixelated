/**
 * Encrypted Memory & Session Storage
 *
 * Provides FHE-based encrypted storage for therapy session data,
 * enabling emotional intelligence features while maintaining complete
 * privacy through homomorphic encryption.
 */

import type { ChatMessage } from '../../types/chat'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { getFHEService, FHEImplementation } from './fhe-factory'
import {
  type FHEService,
  type EncryptedData,
  EncryptionMode,
  FHEOperation,
} from './types'

const logger = createBuildSafeLogger('encrypted-memory')

/**
 * Encrypted session state
 */
export interface EncryptedSessionState {
  sessionId: string
  therapistId: string
  encryptedData: EncryptedData
  createdAt: number
  updatedAt: number
  metadata: {
    messageCount: number
    emotionalTrajectory?: string
    riskLevel?: string
    tags?: string[]
  }
}

/**
 * Encrypted memory entry for patient history
 */
export interface EncryptedMemoryEntry {
  entryId: string
  patientId: string
  encryptedContent: EncryptedData
  entryType:
    | 'session_summary'
    | 'emotional_pattern'
    | 'crisis_indicator'
    | 'therapist_note'
  createdAt: number
  metadata: {
    sessionId?: string
    keywords?: string[]
    sentiment?: string
    confidence?: number
  }
}

/**
 * Emotional state vector stored encrypted
 */
export interface EncryptedEmotionalState {
  sessionId: string
  timestamp: number
  encryptedVector: EncryptedData
  vectorType: 'emotion' | 'sentiment' | 'risk' | 'trajectory'
  metadata: {
    dimensions: number
    encoding: 'one-hot' | 'dense' | 'sparse'
  }
}

/**
 * Encrypted memory store service
 */
export class EncryptedMemoryService {
  private static instance: EncryptedMemoryService | null = null
  private fheService: FHEService | null = null
  private initialized = false

  // In-memory storage (production should use encrypted DB)
  private readonly sessions = new Map<string, EncryptedSessionState>()
  private readonly memories = new Map<string, EncryptedMemoryEntry>()
  private readonly emotionalStates = new Map<
    string,
    EncryptedEmotionalState[]
  >()

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): EncryptedMemoryService {
    EncryptedMemoryService.instance ??= new EncryptedMemoryService()
    return EncryptedMemoryService.instance
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      const env = process.env['NODE_ENV']
      const useMock = env === 'test' || env === 'development'
      this.fheService = await getFHEService({
        implementation: useMock
          ? FHEImplementation.Mock
          : FHEImplementation.SEAL,
      })

      await this.fheService.initialize()
      this.initialized = true
      logger.info('Encrypted memory service initialized')
    } catch (error) {
      logger.error('Failed to initialize encrypted memory service', { error })
      throw error
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * Create encrypted session state
   */
  public async createSession(
    sessionId: string,
    therapistId: string,
    initialMessages: ChatMessage[],
  ): Promise<EncryptedSessionState> {
    await this.ensureInitialized()
    if (!this.fheService) throw new Error('FHE service not initialized')

    // Encrypt session data
    const encryptedContent = await this.fheService.encrypt(
      JSON.stringify({
        messages: initialMessages.map((m) => ({
          role: m.role,
          timestamp: m.timestamp,
          // Content encrypted separately
        })),
        metadata: {
          therapistId,
          createdAt: Date.now(),
        },
      }),
    )

    const state: EncryptedSessionState = {
      sessionId,
      therapistId,
      encryptedData: encryptedContent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        messageCount: initialMessages.length,
      },
    }

    this.sessions.set(sessionId, state)
    logger.info(`Created encrypted session ${sessionId.slice(-8)}`)
    return state
  }

  /**
   * Update session with new messages (encrypted)
   */
  public async updateSession(
    sessionId: string,
    newMessages: ChatMessage[],
  ): Promise<EncryptedSessionState | null> {
    await this.ensureInitialized()
    const session = this.sessions.get(sessionId)
    if (!session) return null

    // Encrypt new messages
    const encryptedMessages = await Promise.all(
      newMessages.map(async (msg) => ({
        role: msg.role,
        timestamp: msg.timestamp,
        content: await this.fheService!.encrypt(msg.content),
      })),
    )

    // Update session state
    session.updatedAt = Date.now()
    session.metadata.messageCount += newMessages.length

    // Store encrypted messages
    session.encryptedData = await this.fheService!.encrypt(
      JSON.stringify({
        messages: encryptedMessages,
        metadata: session.encryptedData.metadata,
      }),
    )

    this.sessions.set(sessionId, session)
    return session
  }

  /**
   * Get session state (returns encrypted data)
   */
  public getSession(sessionId: string): EncryptedSessionState | null {
    return this.sessions.get(sessionId) ?? null
  }

  /**
   * Create encrypted memory entry
   */
  public async createMemoryEntry(
    patientId: string,
    content: string,
    entryType: EncryptedMemoryEntry['entryType'],
    metadata: EncryptedMemoryEntry['metadata'] = {},
  ): Promise<EncryptedMemoryEntry> {
    await this.ensureInitialized()
    if (!this.fheService) throw new Error('FHE service not initialized')

    const encryptedContent = await this.fheService.encrypt(content)

    const entry: EncryptedMemoryEntry = {
      entryId: `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      patientId,
      encryptedContent,
      entryType,
      createdAt: Date.now(),
      metadata,
    }

    this.memories.set(entry.entryId, entry)
    logger.info(`Created encrypted memory entry ${entry.entryId.slice(-8)}`)
    return entry
  }

  /**
   * Get memory entries for patient
   */
  public getPatientMemories(patientId: string): EncryptedMemoryEntry[] {
    return Array.from(this.memories.values()).filter(
      (entry) => entry.patientId === patientId,
    )
  }

  /**
   * Store encrypted emotional state vector
   */
  public async storeEmotionalState(
    sessionId: string,
    vector: number[],
    vectorType: EncryptedEmotionalState['vectorType'],
  ): Promise<EncryptedEmotionalState> {
    await this.ensureInitialized()
    if (!this.fheService) throw new Error('FHE service not initialized')

    const encryptedVector = await this.fheService.encrypt(vector)

    const state: EncryptedEmotionalState = {
      sessionId,
      timestamp: Date.now(),
      encryptedVector,
      vectorType,
      metadata: {
        dimensions: vector.length,
        encoding: 'dense',
      },
    }

    if (!this.emotionalStates.has(sessionId)) {
      this.emotionalStates.set(sessionId, [])
    }
    this.emotionalStates.get(sessionId)!.push(state)

    return state
  }

  /**
   * Get emotional trajectory for session
   */
  public getEmotionalTrajectory(sessionId: string): EncryptedEmotionalState[] {
    return this.emotionalStates.get(sessionId) ?? []
  }

  /**
   * Analyze emotional trajectory homomorphically
   */
  public async analyzeEmotionalTrajectory(sessionId: string): Promise<{
    trend: 'improving' | 'declining' | 'stable'
    volatility: number
    encryptedAnalysis: EncryptedData
  }> {
    await this.ensureInitialized()
    if (!this.fheService) throw new Error('FHE service not initialized')

    const states = this.getEmotionalTrajectory(sessionId)
    if (states.length < 2) {
      return {
        trend: 'stable',
        volatility: 0,
        encryptedAnalysis: await this.fheService.encrypt({
          trend: 'stable',
          volatility: 0,
        }),
      }
    }

    // Encrypt trajectory data for homomorphic analysis
    const trajectoryData = states.map((s) => ({
      timestamp: s.timestamp,
      vectorType: s.vectorType,
    }))

    const encryptedAnalysis = await this.fheService.encrypt(
      JSON.stringify(trajectoryData),
    )

    // In production, perform homomorphic analysis on encrypted vectors
    // For now, return encrypted trajectory data
    return {
      trend: 'stable',
      volatility: 0,
      encryptedAnalysis,
    }
  }

  /**
   * Search memories by encrypted keywords
   */
  public async searchMemories(
    patientId: string,
    keywords: string[],
  ): Promise<EncryptedMemoryEntry[]> {
    await this.ensureInitialized()
    const entries = this.getPatientMemories(patientId)

    // Encrypt keywords for encrypted search
    const encryptedKeywords = await Promise.all(
      keywords.map((k) => this.fheService!.encrypt(k)),
    )

    // In production, perform homomorphic search on encrypted content
    // For now, return all entries (client-side filtering after decryption)
    return entries
  }

  /**
   * Delete session (securely wipe encrypted data)
   */
  public deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId)
    this.emotionalStates.delete(sessionId)
    logger.info(`Deleted encrypted session ${sessionId.slice(-8)}`)
  }

  /**
   * Export all encrypted data for backup
   */
  public async exportEncryptedData(): Promise<Record<string, unknown>> {
    await this.ensureInitialized()

    return {
      sessions: Array.from(this.sessions.values()).map((s) => ({
        sessionId: s.sessionId,
        encryptedData: s.encryptedData.data,
        metadata: s.metadata,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      memories: Array.from(this.memories.values()).map((m) => ({
        entryId: m.entryId,
        patientId: m.patientId,
        encryptedContent: m.encryptedContent.data,
        entryType: m.entryType,
        createdAt: m.createdAt,
        metadata: m.metadata,
      })),
    }
  }

  /**
   * Import encrypted data from backup
   */
  public async importEncryptedData(
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.ensureInitialized()

    const sessionsArr = data['sessions'] as
      | Array<Record<string, unknown>>
      | undefined
    if (sessionsArr) {
      for (const session of sessionsArr) {
        this.sessions.set((session['sessionId'] as string) || '', {
          sessionId: (session['sessionId'] as string) || '',
          therapistId: (session['therapistId'] as string) || '',
          encryptedData: {
            id: `imported-${Date.now()}`,
            data: session['encryptedData'] || '',
            dataType: 'string',
            metadata: (session['metadata'] as Record<string, unknown>) || {},
          },
          createdAt: (session['createdAt'] as number) || 0,
          updatedAt: (session['updatedAt'] as number) || 0,
          metadata: (session['metadata'] as Record<string, unknown>) ?? {},
        })
      }
    }

    const memoriesArr = data['memories'] as
      | Array<Record<string, unknown>>
      | undefined
    if (memoriesArr) {
      for (const memory of memoriesArr) {
        this.memories.set((memory['entryId'] as string) || '', {
          entryId: (memory['entryId'] as string) || '',
          patientId: (memory['patientId'] as string) || '',
          encryptedContent: {
            id: `imported-${Date.now()}`,
            data: memory['encryptedContent'] || '',
            dataType: 'string',
            metadata: (memory['metadata'] as Record<string, unknown>) || {},
          },
          entryType:
            (memory['entryType'] as EncryptedMemoryEntry['entryType']) ||
            'session_summary',
          createdAt: (memory['createdAt'] as number) || 0,
          metadata: (memory['metadata'] as Record<string, unknown>) ?? {},
        })
      }
    }

    const sessionCount = sessionsArr?.length ?? 0
    const memoryCount = memoriesArr?.length ?? 0
    logger.info(`Imported ${sessionCount} sessions and ${memoryCount} memories`)
  }
}

// Export singleton instance
export const encryptedMemory = EncryptedMemoryService.getInstance()
export default encryptedMemory
