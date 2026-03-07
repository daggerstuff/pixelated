/**
 * MentalHealthChat implementation for Pixelated Empathy
 * Production-grade mental health analysis and therapeutic chat system
 */

import { MentalHealthService } from './mental-health/service'
import { createMentalLLaMAFromEnvSafe } from './ai/mental-llama/client-adapter'
import { RecommendationService } from './ai/services/RecommendationService'
import { createBuildSafeLogger } from './logging/build-safe-logger'
import type { MentalHealthAnalysis as MHAnalysis } from './mental-health/types'
import type {
  MentalHealthAnalysisResult,
  ExpertGuidedAnalysisResult,
  RoutingContext,
} from './ai/mental-llama/types/mentalLLaMATypes'

const logger = createBuildSafeLogger('MentalHealthChat')

// Re-export for backward compatibility
export interface MentalHealthAnalysis {
  category: string
  explanation: string
  expertGuided: boolean | null
  id: string
  timestamp: number
  scores: {
    depression: number
    anxiety: number
    stress: number
    anger: number
    socialIsolation: number
    bipolarDisorder?: number
    ocd?: number
    eatingDisorder?: number
    socialAnxiety?: number
    panicDisorder?: number
  } & Record<string, number | undefined>
  evidence: {
    depression: string[]
    anxiety: string[]
    stress: string[]
    anger: string[]
    socialIsolation: string[]
    bipolarDisorder?: string[]
    ocd?: string[]
    eatingDisorder?: string[]
    socialAnxiety?: string[]
    panicDisorder?: string[]
  } & Record<string, string[] | undefined>
  summary: string
  expertExplanation?: string
  riskLevel: 'low' | 'moderate' | 'high'
}

interface Message {
  id: string
  senderId: string
  content: string
  timestamp: number
}

interface MentalHealthChatOptions {
  enableAnalysis?: boolean
  useExpertGuidance?: boolean
  triggerInterventionThreshold?: number
  analysisMinimumLength?: number
  userId?: string
  sessionId?: string
  enableCrisisDetection?: boolean
  confidenceThreshold?: number
}

interface FHEService {
  encrypt?: (data: string) => Promise<string>
  decrypt?: (data: string) => Promise<string>
}

/**
 * Internal analysis conversion function
 */
function convertAnalysisToLegacyFormat(
  analysis: MHAnalysis | MentalHealthAnalysisResult,
): MentalHealthAnalysis {
  const now = Date.now()

  // Handle different analysis result types
  if ('indicators' in analysis) {
    // Handle our mental-health service analysis
    const mhAnalysis = analysis as MHAnalysis
    const scores: Record<string, number> = {}
    const evidence: Record<string, string[]> = {}

    // Convert indicators to scores and evidence
    mhAnalysis.indicators.forEach((indicator) => {
      scores[indicator.type] = indicator.severity
      evidence[indicator.type] = indicator.evidence
    })

    return {
      id: mhAnalysis.id,
      timestamp: mhAnalysis.timestamp,
      category: mhAnalysis.categories[0]?.name || 'general',
      explanation: mhAnalysis.indicators.map((i) => i.description).join('; '),
      expertGuided: false,
      scores: {
        depression: scores['depression'] || 0,
        anxiety: scores['anxiety'] || 0,
        stress: scores['stress'] || 0,
        anger: scores['anger'] || 0,
        socialIsolation: scores['isolation'] || 0,
        ...scores,
      },
      evidence: {
        depression: evidence['depression'] || [],
        anxiety: evidence['anxiety'] || [],
        stress: evidence['stress'] || [],
        anger: evidence['anger'] || [],
        socialIsolation: evidence['isolation'] || [],
        ...evidence,
      },
      summary: mhAnalysis.recommendations.join('. '),
      riskLevel:
        mhAnalysis.riskLevel === 'critical'
          ? 'high'
          : mhAnalysis.riskLevel === 'medium'
            ? 'moderate'
            : 'low',
    }
  } else {
    // Handle MentalLLaMA analysis result
    const llmAnalysis = analysis as MentalHealthAnalysisResult
    const isExpertGuided = 'expertGuidance' in llmAnalysis

    return {
      id: `analysis-${now}`,
      timestamp: now,
      category: llmAnalysis.mentalHealthCategory || 'general',
      explanation: llmAnalysis.explanation || 'Analysis completed',
      expertGuided: isExpertGuided,
      scores: {
        depression:
          llmAnalysis.mentalHealthCategory === 'depression'
            ? llmAnalysis.confidence
            : 0,
        anxiety:
          llmAnalysis.mentalHealthCategory === 'anxiety'
            ? llmAnalysis.confidence
            : 0,
        stress:
          llmAnalysis.mentalHealthCategory === 'stress'
            ? llmAnalysis.confidence
            : 0,
        anger:
          llmAnalysis.mentalHealthCategory === 'anger'
            ? llmAnalysis.confidence
            : 0,
        socialIsolation:
          llmAnalysis.mentalHealthCategory === 'social_isolation'
            ? llmAnalysis.confidence
            : 0,
      },
      evidence: {
        depression:
          llmAnalysis.mentalHealthCategory === 'depression'
            ? llmAnalysis.supportingEvidence || []
            : [],
        anxiety:
          llmAnalysis.mentalHealthCategory === 'anxiety'
            ? llmAnalysis.supportingEvidence || []
            : [],
        stress:
          llmAnalysis.mentalHealthCategory === 'stress'
            ? llmAnalysis.supportingEvidence || []
            : [],
        anger:
          llmAnalysis.mentalHealthCategory === 'anger'
            ? llmAnalysis.supportingEvidence || []
            : [],
        socialIsolation:
          llmAnalysis.mentalHealthCategory === 'social_isolation'
            ? llmAnalysis.supportingEvidence || []
            : [],
      },
      summary: llmAnalysis.explanation || 'Mental health analysis completed',
      riskLevel: llmAnalysis.isCrisis
        ? 'high'
        : llmAnalysis.confidence > 0.7
          ? 'moderate'
          : 'low',
    }
  }
}

/**
 * Creates a new MentalHealthChat instance
 * Production-grade implementation with real AI analysis
 */
export function createMentalHealthChat(
  _fheService: FHEService | null = null,
  options: MentalHealthChatOptions = {},
) {
  // Initialize services
  let mentalHealthService: MentalHealthService | null = null
  let mentalLLaMAAdapter: unknown = null
  let recommendationService: RecommendationService | null = null
  let isInitialized = false

  // Configuration with defaults
  const config = {
    enableAnalysis: options.enableAnalysis ?? true,
    useExpertGuidance: options.useExpertGuidance ?? true,
    triggerInterventionThreshold: options.triggerInterventionThreshold ?? 0.7,
    analysisMinimumLength: options.analysisMinimumLength ?? 20,
    userId: options.userId ?? 'anonymous',
    sessionId: options.sessionId ?? `session-${Date.now()}`,
    enableCrisisDetection: options.enableCrisisDetection ?? true,
    confidenceThreshold: options.confidenceThreshold ?? 0.6,
  }

  // Lazy initialization function
  const ensureInitialized = async () => {
    if (isInitialized) {
      return
    }

    try {
      logger.info('Initializing MentalHealthChat services...')

      // Initialize MentalHealthService for basic analysis
      mentalHealthService = new MentalHealthService({
        enableAnalysis: config.enableAnalysis,
        confidenceThreshold: config.confidenceThreshold,
        interventionThreshold: config.triggerInterventionThreshold,
        analysisMinLength: config.analysisMinimumLength,
        enableCrisisDetection: config.enableCrisisDetection,
      })

      // Initialize MentalLLaMA for advanced analysis (if available)
      try {
        const mentalLLaMAFactory = await createMentalLLaMAFromEnvSafe()
        mentalLLaMAAdapter = mentalLLaMAFactory.adapter
        logger.info('MentalLLaMA adapter initialized successfully')
      } catch (error: unknown) {
        logger.warn(
          'MentalLLaMA not available, falling back to basic analysis',
          { error },
        )
      }

      // Initialize RecommendationService
      try {
        recommendationService = new RecommendationService()
        logger.info('RecommendationService initialized successfully')
      } catch (error: unknown) {
        logger.warn('RecommendationService not available', { error })
      }

      isInitialized = true
      logger.info('MentalHealthChat initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize MentalHealthChat', { error })
      throw new Error('MentalHealthChat initialization failed', {
        cause: error,
      })
    }
  }

  return {
    /**
     * Process a message and return analysis results
     */
    processMessage: async (message: Omit<Message, 'conversationId'>) => {
      await ensureInitialized()

      if (
        !config.enableAnalysis ||
        message.content.length < config.analysisMinimumLength
      ) {
        return {
          ...message,
          mentalHealthAnalysis: null,
        }
      }

      try {
        let analysis: MentalHealthAnalysis | null = null

        // Use MentalLLaMA if available and expert guidance is enabled
        if (mentalLLaMAAdapter && config.useExpertGuidance) {
          const routingContext: RoutingContext = {
            userId: config.userId,
            sessionId: config.sessionId,
            sessionType: 'therapeutic_chat',
          }

          // Type-safe call to MentalLLaMA adapter
          const adapter = mentalLLaMAAdapter as {
            analyzeMentalHealthWithExpertGuidance: (
              text: string,
              guidance: boolean,
              context: RoutingContext,
            ) => Promise<ExpertGuidedAnalysisResult>
          }

          const llmResult = await adapter.analyzeMentalHealthWithExpertGuidance(
            message.content,
            true,
            routingContext,
          )

          analysis = convertAnalysisToLegacyFormat(llmResult)
        }
        // Fallback to basic mental health service
        else if (mentalHealthService) {
          const processedMessage = await mentalHealthService.processMessage(
            config.sessionId,
            {
              id: message.id,
              role: 'user',
              content: message.content,
              timestamp: message.timestamp,
            },
          )

          if (processedMessage.analysis) {
            analysis = convertAnalysisToLegacyFormat(processedMessage.analysis)
          }
        }

        return {
          ...message,
          mentalHealthAnalysis: analysis,
        }
      } catch (error: unknown) {
        logger.error('Error processing message', { error })
        return {
          ...message,
          mentalHealthAnalysis: null,
        }
      }
    },

    /**
     * Check if intervention is needed based on recent analyses
     */
    needsIntervention: async (): Promise<boolean> => {
      await ensureInitialized()

      if (!mentalHealthService) {
        return false
      }

      try {
        return mentalHealthService.needsIntervention(config.sessionId)
      } catch (error: unknown) {
        logger.error('Error checking intervention need', { error })
        return false
      }
    },

    /**
     * Generate therapeutic intervention message
     */
    generateIntervention: async (): Promise<string> => {
      await ensureInitialized()

      try {
        if (mentalHealthService) {
          const response =
            await mentalHealthService.generateTherapeuticResponse(
              config.sessionId,
            )
          return response.content
        }

        // Fallback intervention messages
        const interventions = [
          "I notice you might be going through a difficult time. Would you like to talk about what's on your mind?",
          "It sounds like you're experiencing some challenges. Remember that it's okay to seek support when you need it.",
          "I'm here to listen. Sometimes sharing what we're feeling can help us process difficult emotions.",
          'Would you like to explore some coping strategies that might help you feel better?',
        ]

        return (
          interventions[Math.floor(Math.random() * interventions.length)] ||
          "I'm here to support you."
        )
      } catch (error: unknown) {
        logger.error('Error generating intervention', { error })
        return "I'm here to support you. How are you feeling right now?"
      }
    },

    /**
     * Configure chat options dynamically
     */
    configure: (newOptions: Partial<MentalHealthChatOptions>) => {
      Object.assign(config, newOptions)
      logger.info('Chat configuration updated', { newOptions })
    },

    /**
     * Get conversation history and analysis trends
     */
    getAnalysisHistory: async () => {
      await ensureInitialized()

      if (!mentalHealthService) {
        return []
      }

      try {
        return mentalHealthService.getAnalysisHistory(config.sessionId)
      } catch (error: unknown) {
        logger.error('Error retrieving analysis history', { error })
        return []
      }
    },

    /**
     * Get personalized recommendations based on analysis
     */
    getRecommendations: async () => {
      await ensureInitialized()

      if (!recommendationService || !mentalHealthService) {
        return []
      }

      try {
        const latestAnalysis = mentalHealthService.getLatestAnalysis(
          config.sessionId,
        )
        if (!latestAnalysis) {
          return []
        }

        // Type guard to ensure latestAnalysis is in the expected format
        if ('indicators' in latestAnalysis) {
          logger.warn('Cannot get recommendations from legacy analysis format.')
          return []
        }

        return await recommendationService.getRecommendationsFromAnalysis(
          config.userId,
          latestAnalysis as MentalHealthAnalysisResult,
        )
      } catch (error: unknown) {
        logger.error('Error generating recommendations', { error })
        return []
      }
    },

    /**
     * Check system status and capabilities
     */
    getStatus: () => ({
      isInitialized,
      hasAdvancedAnalysis: !!mentalLLaMAAdapter,
      hasRecommendations: !!recommendationService,
      hasBasicAnalysis: !!mentalHealthService,
      configuration: config,
    }),
  }
}
