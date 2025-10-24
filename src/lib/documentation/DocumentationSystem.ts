import type { AIRepository } from '../db/ai/repository'
import type { TherapySession } from '../ai/models/ai-types'
import type { EmotionAnalysis } from '../ai/emotions/types'

// Import shared types to avoid circular dependencies
import type { SessionDocumentation } from './types'

interface TherapyAIResponse {
  content: string
  confidence: number
  techniques: string[]
  sessionId?: string
  timestamp: Date
}

interface TherapyAIOptions {
  temperature?: number
  maxTokens?: number
  model?: string
  includeEmotions?: boolean
  includeInterventions?: boolean
}
import type { AIService } from '../ai/AIService'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { EventEmitter } from 'node:events'
import { RedisService } from '../services/redis'
import {
  EHRIntegration,
  type EHRExportOptions,
  type EHRExportResult,
} from './ehrIntegration'
import type { FHIRClient } from '../ehr/types'

const logger = createBuildSafeLogger('documentation-system')

/**
 * Documentation system for therapy sessions
 * Connects to session repository and provides real-time updates and NLP-based summary generation
 */
export class DocumentationSystem extends EventEmitter {
  private repository: AIRepository
  private redisService = new RedisService()
  private ehrIntegration: EHRIntegration | null = null
  private activeSessions = new Map<
    string,
    {
      sessionId: string
      lastUpdate: Date
      documentationData?: SessionDocumentation
    }
  >()

  /**
   * Create a new DocumentationSystem
   * @param repository The repository to use for session data
   * @param aiService The AI service to use for NLP-based summary generation
   */
  constructor(repository: AIRepository, _aiService: AIService) {
    super()
    this.repository = repository
    this.initializeRealTimeUpdates()
  }

  /**
   * Connect to the session repository and initialize real-time updates
   */
  private async initializeRealTimeUpdates(): Promise<void> {
    try {
      // Subscribe to session update events through Redis pub/sub
      await this.redisService.subscribe('session:update', (message: string) => {
        try {
          const sessionData = JSON.parse(message) as unknown
          if (sessionData && sessionData.sessionId) {
            this.handleSessionUpdate(sessionData.sessionId)
          }
        } catch (error: unknown) {
          logger.error('Error processing session update', { error })
        }
      })

      // Subscribe to session creation events
      await this.redisService.subscribe('session:create', (message: string) => {
        try {
          const sessionData = JSON.parse(message) as unknown
          if (sessionData && sessionData.sessionId) {
            this.trackActiveSession(sessionData.sessionId)
          }
        } catch (error: unknown) {
          logger.error('Error processing session creation', { error })
        }
      })

      // Subscribe to session completion events
      await this.redisService.subscribe(
        'session:complete',
        (message: string) => {
          try {
            const sessionData = JSON.parse(message) as unknown
            if (sessionData && sessionData.sessionId) {
              this.handleSessionCompletion(sessionData.sessionId)
            }
          } catch (error: unknown) {
            logger.error('Error processing session completion', { error })
          }
        },
      )

      logger.info('Real-time session updates initialized')
    } catch (error: unknown) {
      logger.error('Failed to initialize real-time updates', { error })
    }
  }

  /**
   * Track a new active session
   * @param sessionId The ID of the session to track
   */
  private async trackActiveSession(sessionId: string): Promise<void> {
    try {
      this.activeSessions.set(sessionId, {
        sessionId,
        lastUpdate: new Date(),
      })

      logger.info('Tracking new active session', { sessionId })
      this.emit('session:tracking', { sessionId })
    } catch (error: unknown) {
      logger.error('Error tracking active session', { sessionId, error })
    }
  }

  /**
   * Handle a session update event
   * @param sessionId The ID of the updated session
   */
  private async handleSessionUpdate(sessionId: string): Promise<void> {
    try {
      const activeSession = this.activeSessions.get(sessionId)

      if (!activeSession) {
        // If we're not tracking this session yet, start tracking it
        return this.trackActiveSession(sessionId)
      }

      // Update the last update timestamp
      this.activeSessions.set(sessionId, {
        ...activeSession,
        lastUpdate: new Date(),
      })

      // Emit an update event
      this.emit('session:updated', { sessionId })
      logger.debug('Session update processed', { sessionId })
    } catch (error: unknown) {
      logger.error('Error handling session update', { sessionId, error })
    }
  }

  /**
   * Handle a session completion event
   * @param sessionId The ID of the completed session
   */
  private async handleSessionCompletion(sessionId: string): Promise<void> {
    try {
      const activeSession = this.activeSessions.get(sessionId)

      if (!activeSession) {
        logger.warn('Received completion event for untracked session', {
          sessionId,
        })
        return
      }

      // Generate final documentation if not already done
      if (!activeSession.documentationData) {
        await this.generateDocumentation(sessionId)
      }

      // Remove session from active sessions
      this.activeSessions.delete(sessionId)

      // Emit completion event
      this.emit('session:completed', { sessionId })
      logger.info('Session completed', { sessionId })
    } catch (error: unknown) {
      logger.error('Error handling session completion', { sessionId, error })
    }
  }

  /**
   * Get a session from the repository
   * @param sessionId The ID of the session to retrieve
   * @returns The session or null if not found
   */
  public async getSession(sessionId: string): Promise<TherapySession | null> {
    try {
      const sessions = await this.repository.getSessionsByIds([sessionId])

      if (sessions && sessions.length > 0) {
        return sessions[0] ?? null
      }

      return null
    } catch (error: unknown) {
      logger.error('Error getting session', { sessionId, error })
      return null
    }
  }

  /**
   * Get emotion analyses for a session
   * @param sessionId The ID of the session to retrieve emotions for
   * @returns Array of emotion analyses for the session or empty array if none found
   */
  public async getSessionEmotions(
    sessionId: string,
  ): Promise<EmotionAnalysis[]> {
    try {
      return await this.repository.getEmotionsForSession(sessionId)
    } catch (error: unknown) {
      logger.error('Error getting session emotions', { sessionId, error })
      return []
    }
  }

  /**
   * Get therapy interventions for a session
   * @param sessionId The ID of the session to get interventions for
   * @returns Array of therapy interventions for the session
   */
  public async getInterventionsForSession(
    sessionId: string,
  ): Promise<TherapyAIResponse[]> {
    try {
      // In a real implementation, this would call the repository method
      // return await this.repository.getInterventionsForSession(sessionId)

      // For now, use mock data that matches the TherapyAIResponse interface
      const mockResponse: TherapyAIResponse = {
        content: "Let's practice deep breathing techniques to manage anxiety.",
        confidence: 0.85,
        techniques: ['breathing', 'mindfulness'],
        timestamp: new Date(),
      }

      return [mockResponse]
    } catch (error: unknown) {
      logger.error('Error getting interventions for session', {
        sessionId,
        error,
      })
      return []
    }
  }

  /**
   * Generate or retrieve documentation for a session
   * @param sessionId The ID of the session to generate documentation for
   * @param options Options for documentation generation
   * @returns The generated documentation
   */
  public async generateDocumentation(
    sessionId: string,
    _options?: TherapyAIOptions,
  ): Promise<SessionDocumentation | null> {
    try {
      logger.info('Generating documentation for session', { sessionId })

      // Get session data
      const session = await this.getSession(sessionId)
      if (!session) {
        logger.error('Session not found', { sessionId })
        return null
      }

      // Get interventions
      const interventions = await this.getInterventionsForSession(sessionId)

      // Generate documentation using AI service
      // TODO: Implement generateSessionDocumentation method in AIService
      const documentation: SessionDocumentation = {
        sessionId: session.sessionId || sessionId,
        clientId: session.clientId || 'unknown',
        therapistId: session.therapistId || 'unknown',
        startTime: session.startTime || new Date(),
        endTime: session.endTime,
        notes: 'Auto-generated documentation',
        interventions: interventions.map((i) => i.content) as readonly string[],
        outcomes: [],
        nextSteps: [],
        riskAssessment: {
          level: 'low',
          factors: [],
          recommendations: [],
          requiresImmediateAttention: false,
        },
        metadata: {
          version: '1.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: session.therapistId || 'system',
          sessionType: 'individual',
          duration: 60,
          modality: 'in-person',
        },
      }

      // Update cache for active session if it exists
      const activeSession = this.activeSessions.get(sessionId)
      if (activeSession) {
        this.activeSessions.set(sessionId, {
          ...activeSession,
          documentationData: documentation,
        })
      }

      // Emit documentation event
      this.emit('documentation:generated', { sessionId, documentation })

      return documentation
    } catch (error: unknown) {
      logger.error('Error generating documentation', { sessionId, error })
      return null
    }
  }

  /**
   * Get documentation for a session (cached or generate new)
   * @param sessionId The ID of the session
   * @param forceRefresh Whether to force a refresh of the documentation
   * @returns The session documentation
   */
  public async getDocumentation(
    sessionId: string,
    forceRefresh = false,
  ): Promise<SessionDocumentation | null> {
    try {
      // Check if we have cached documentation for an active session
      const activeSession = this.activeSessions.get(sessionId)
      if (activeSession && activeSession.documentationData && !forceRefresh) {
        return activeSession.documentationData
      }

      // Otherwise generate new documentation
      return await this.generateDocumentation(sessionId)
    } catch (error: unknown) {
      logger.error('Error getting documentation', { sessionId, error })
      return null
    }
  }

  /**
   * Save documentation for a session (for manual edits)
   * @param sessionId The ID of the session
   * @param documentation The documentation to save
   */
  public async saveDocumentation(
    sessionId: string,
    documentation: SessionDocumentation,
  ): Promise<boolean> {
    try {
      // In a real implementation, this would save to a repository
      // await this.repository.saveSessionDocumentation(sessionId, documentation)

      // For now, just update our active sessions cache
      const activeSession = this.activeSessions.get(sessionId)
      if (activeSession) {
        this.activeSessions.set(sessionId, {
          ...activeSession,
          documentationData: documentation,
        })
      }

      // Emit save event
      this.emit('documentation:saved', { sessionId, documentation })

      return true
    } catch (error: unknown) {
      logger.error('Error saving documentation', { sessionId, error })
      return false
    }
  }

  /**
   * Listen for real-time documentation updates
   * @param sessionId The ID of the session to listen for
   * @param callback The callback to call when documentation is updated
   * @returns A function to remove the listener
   */
  public onDocumentationUpdate(
    sessionId: string,
    callback: (documentation: SessionDocumentation) => void,
  ): () => void {
    const handleUpdate = (data: {
      sessionId: string
      documentation: SessionDocumentation
    }) => {
      if (data.sessionId === sessionId) {
        callback(data.documentation)
      }
    }

    this.on('documentation:generated', handleUpdate)
    this.on('documentation:saved', handleUpdate)

    // Return function to remove listeners
    return () => {
      this.off('documentation:generated', handleUpdate)
      this.off('documentation:saved', handleUpdate)
    }
  }

  /**
   * Check if a session is active (has been updated recently)
   * @param sessionId The ID of the session to check
   * @returns True if the session is active, false otherwise
   */
  public isSessionActive(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId)

    if (!session) {
      return false
    }

    // Check if the session was updated in the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
    return session.lastUpdate > fifteenMinutesAgo
  }

  /**
   * Publish an update for a session
   * @param sessionId The ID of the session to update
   * @param data The data to publish
   */
  public async publishSessionUpdate(
    sessionId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.redisService.publish(
        'session:update',
        JSON.stringify({
          sessionId,
          timestamp: new Date().toISOString(),
          ...data,
        }),
      )

      logger.debug('Published session update', { sessionId })
    } catch (error: unknown) {
      logger.error('Error publishing session update', { sessionId, error })
    }
  }

  /**
   * Set up EHR integration
   * @param fhirClient The FHIR client to use for EHR integration
   * @param options Additional options for the integration
   */
  public setupEHRIntegration(
    fhirClient: FHIRClient,
    options?: { auditLog?: boolean },
  ): void {
    this.ehrIntegration = new EHRIntegration(fhirClient, options)
    logger.info('EHR integration set up successfully')
  }

  /**
   * Export documentation to an EHR system
   * @param sessionId The ID of the session to export
   * @param options Export options
   * @returns The result of the export operation
   */
  public async exportToEHR(
    sessionId: string,
    options: EHRExportOptions,
  ): Promise<EHRExportResult> {
    try {
      if (!this.ehrIntegration) {
        throw new Error('EHR integration not set up')
      }

      logger.info('Exporting documentation to EHR', { sessionId })

      // Get the documentation (generate if needed)
      const documentation = await this.getDocumentation(sessionId, false)

      if (!documentation) {
        throw new Error('Failed to retrieve or generate documentation')
      }

      // Export using the EHR integration
      const result = await this.ehrIntegration.exportToEHR(
        documentation,
        options,
      )

      // Emit export event
      this.emit('documentation:exported', {
        sessionId,
        ehrSystem: options.format,
        success: result.success,
        documentId:
          result.data && typeof result.data === 'object' && 'id' in result.data
            ? (result.data as { id?: string }).id
            : undefined,
      })

      return result
    } catch (error: unknown) {
      logger.error('Error exporting documentation to EHR', { sessionId, error })

      return {
        success: false,
        errors: [error instanceof Error ? String(error) : String(error)],
        format: options.format,
        metadata: {
          exportedAt: new Date(),
          exportedBy: options.providerId,
          patientId: options.patientId,
          providerId: options.providerId,
        },
      }
    }
  }
}

// Export a factory function to create the documentation system
export function createDocumentationSystem(
  repository: AIRepository,
  aiService: AIService,
): DocumentationSystem {
  return new DocumentationSystem(repository, aiService)
}
