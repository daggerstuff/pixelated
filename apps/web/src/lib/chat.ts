/**
 * MentalHealthChat implementation for Pixelated Empathy
 * Production-grade mental health analysis and therapeutic chat system
 */

import { createMentalLLaMAFromEnvSafe } from './ai/mental-llama/client-adapter'
import type {
  MentalHealthAnalysisResult,
  RoutingContext,
} from './ai/mental-llama/types/mentalLLaMATypes'
import { RecommendationService } from './ai/services/RecommendationService'
import { createBuildSafeLogger } from './logging/build-safe-logger'
import { MentalHealthService } from './mental-health/service'
import type { MentalHealthAnalysis as MHAnalysis } from './mental-health/types'

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

/**
 * Internal analysis conversion function
 */
function convertAnalysisToLegacyFormat(
  analysis: MHAnalysis | MentalHealthAnalysisResult,
): MentalHealthAnalysis {
  const now = Date.now()

  const isLlmAnalysis = (
    candidate: MHAnalysis | MentalHealthAnalysisResult,
  ): candidate is MentalHealthAnalysisResult =>
    'mentalHealthCategory' in candidate

  const getNumberValue = (
    values: Record<string, number>,
    key: string,
  ): number => values[key] ?? 0
  const getStringValues = (
    values: Record<string, string[]>,
    key: string,
  ): string[] => values[key] ?? []

  // Handle different analysis result types
  if (!isLlmAnalysis(analysis)) {
    // Handle our mental-health service analysis
    const mhAnalysis = analysis
    const scores: Record<string, number> = {}
    const evidence: Record<string, string[]> = {}

    // Convert indicators to scores and evidence
    ;(mhAnalysis.indicators ?? []).forEach((indicator) => {
      scores[indicator.type] = indicator.severity
      evidence[indicator.type] = indicator.evidence
    })

    return {
      id: mhAnalysis.id ?? `analysis-${mhAnalysis.timestamp}`,
      timestamp: mhAnalysis.timestamp,
      category: mhAnalysis.categories?.[0]?.name ?? 'general',
      explanation: (mhAnalysis.indicators ?? [])
        .map((indicator) => indicator.description)
        .join('; '),
      expertGuided: false,
      scores: {
        depression: getNumberValue(scores, 'depression'),
        anxiety: getNumberValue(scores, 'anxiety'),
        stress: getNumberValue(scores, 'stress'),
        anger: getNumberValue(scores, 'anger'),
        socialIsolation: getNumberValue(scores, 'isolation'),
      },
      evidence: {
        depression: getStringValues(evidence, 'depression'),
        anxiety: getStringValues(evidence, 'anxiety'),
        stress: getStringValues(evidence, 'stress'),
        anger: getStringValues(evidence, 'anger'),
        socialIsolation: getStringValues(evidence, 'isolation'),
        ...evidence,
      },
      summary:
        mhAnalysis.summary ??
        mhAnalysis.recommendations?.join('. ') ??
        'Analysis completed',
      riskLevel:
        mhAnalysis.riskLevel === 'critical'
          ? 'high'
          : mhAnalysis.riskLevel === 'medium'
            ? 'moderate'
            : 'low',
    }
  }

  // Handle MentalLLaMA analysis result
  const llmAnalysis = analysis
  const isExpertGuided = 'expertGuidance' in llmAnalysis
  const category = llmAnalysis.mentalHealthCategory
  const evidence = llmAnalysis.supportingEvidence ?? []

  return {
    id: `analysis-${now}`,
    timestamp: now,
    category,
    explanation: llmAnalysis.explanation,
    expertGuided: isExpertGuided,
    scores: {
      depression: category === 'depression' ? llmAnalysis.confidence : 0,
      anxiety: category === 'anxiety' ? llmAnalysis.confidence : 0,
      stress: category === 'stress' ? llmAnalysis.confidence : 0,
      anger: category === 'anger' ? llmAnalysis.confidence : 0,
      socialIsolation:
        category === 'social_isolation' ? llmAnalysis.confidence : 0,
    },
    evidence: {
      depression: category === 'depression' ? evidence : [],
      anxiety: category === 'anxiety' ? evidence : [],
      stress: category === 'stress' ? evidence : [],
      anger: category === 'anger' ? evidence : [],
      socialIsolation: category === 'social_isolation' ? evidence : [],
    },
    summary: llmAnalysis.explanation,
    riskLevel: llmAnalysis.isCrisis
      ? 'high'
      : llmAnalysis.confidence > 0.7
        ? 'moderate'
        : 'low',
  }
}

function toRecommendationAnalysis(
  analysis: MHAnalysis | MentalHealthAnalysisResult,
): MentalHealthAnalysisResult {
  if ('mentalHealthCategory' in analysis) {
    return {
      hasMentalHealthIssue: analysis.hasMentalHealthIssue,
      mentalHealthCategory: analysis.mentalHealthCategory,
      confidence: analysis.confidence,
      explanation: analysis.explanation,
      supportingEvidence: analysis.supportingEvidence ?? [],
      isCrisis: analysis.isCrisis,
      timestamp: analysis.timestamp,
      stressLevel: analysis.stressLevel ?? 0,
    }
  }

  return {
    hasMentalHealthIssue: analysis.hasMentalHealthIssue,
    mentalHealthCategory: analysis.category,
    confidence: analysis.confidence,
    explanation: analysis.explanation,
    supportingEvidence: analysis.supportingEvidence,
    isCrisis:
      analysis.riskLevel === 'high' || analysis.riskLevel === 'critical',
    timestamp: new Date(analysis.timestamp).toISOString(),
    stressLevel: analysis.riskLevel === 'high' ? 0.8 : 0.4,
  }
}

/**
 * Creates a new MentalHealthChat instance
 * Production-grade implementation with real AI analysis
 */
export function createMentalHealthChat(
  _fheService: any = null,
  options: MentalHealthChatOptions = {},
) {
  // Initialize services
  let mentalHealthService: MentalHealthService | null = null
  type MentalLLaMAFactoryAdapter = Awaited<
    ReturnType<typeof createMentalLLaMAFromEnvSafe>
  >['adapter']
  let mentalLLaMAAdapter: MentalLLaMAFactoryAdapter | null = null
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
      const analysisConfig = {
        enableAnalysis: config.enableAnalysis,
        confidenceThreshold: config.confidenceThreshold,
        interventionThreshold: config.triggerInterventionThreshold,
        analysisMinLength: config.analysisMinimumLength,
        enableCrisisDetection: config.enableCrisisDetection,
      }

      mentalHealthService = new MentalHealthService(analysisConfig)

      // Initialize MentalLLaMA for advanced analysis (if available)
      try {
        const mentalLLaMAFactory = await createMentalLLaMAFromEnvSafe()
        if (
          'analyzeMentalHealthWithExpertGuidance' in mentalLLaMAFactory.adapter
        ) {
          mentalLLaMAAdapter = mentalLLaMAFactory.adapter
        }
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
        if (
          mentalLLaMAAdapter &&
          config.useExpertGuidance &&
          'analyzeMentalHealthWithExpertGuidance' in mentalLLaMAAdapter
        ) {
          const routingContext: RoutingContext = {
            userId: config.userId,
            sessionId: config.sessionId,
            sessionType: 'therapeutic_chat',
          }

          // Type-safe call to MentalLLaMA adapter
          const llmResult =
            await mentalLLaMAAdapter.analyzeMentalHealthWithExpertGuidance(
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
          interventions[Math.floor(Math.random() * interventions.length)] ??
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

        const recommendationAnalysis = toRecommendationAnalysis(latestAnalysis)

        return await recommendationService.getRecommendationsFromAnalysis(
          config.userId,
          recommendationAnalysis,
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
