import type { CognitiveModel } from '../types/CognitiveModel'

export interface ConversationMessage {
  role: string
  content: string
  timestamp: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

export interface PatientProfile {
  id: string
  cognitiveModel: CognitiveModel
  conversationHistory: ConversationMessage[]
  lastUpdatedAt: string
}
