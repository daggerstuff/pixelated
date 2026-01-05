import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('default')
import type { RecommendationContext } from './OutcomeRecommendationEngine'

interface TherapySession {
  sessionId: string
  clientId: string
  therapistId: string
  status: 'active' | 'completed' | 'scheduled' | 'cancelled'
  securityLevel: 'standard' | 'enhanced' | 'maximum'
  emotionAnalysisEnabled: boolean
}

interface ChatSession {
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }>
  metadata?: Record<string, unknown>
}

interface EmotionState {
  currentEmotion: string
  intensity: number
  timestamp: Date
  confidence: number
  relatedFactors?: string[]
}

interface MentalHealthAnalysis {
  primaryConcerns: string[]
  riskLevel: 'low' | 'moderate' | 'high'
  recommendedApproaches?: string[]
  notes?: string
}

export interface ContextCollectionInput {
  session: TherapySession
  chatSession: ChatSession
  recentEmotionState: EmotionState
  recentInterventions: string[]
  userPreferences?: Record<string, unknown>
  mentalHealthAnalysis?: MentalHealthAnalysis
}

export function collectContext(
  input: ContextCollectionInput,
): RecommendationContext {
  logger.info('Collecting contextual data for recommendations')

  // Process and structure the context data
  const context: RecommendationContext = {
    session: {
      id: input.session.sessionId,
      clientId: input.session.clientId,
      therapistId: input.session.therapistId,
      status: input.session.status,
      securityLevel: input.session.securityLevel,
      emotionAnalysisEnabled: input.session.emotionAnalysisEnabled,
    },
    chatSession: input.chatSession,
    recentEmotionState: input.recentEmotionState,
    recentInterventions: input.recentInterventions,
    userPreferences: input.userPreferences || {},
    mentalHealthAnalysis: input.mentalHealthAnalysis || {},
  }

  return context
}
