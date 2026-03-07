export interface TherapySession {
  sessionId: string
  clientId: string
  therapistId: string
  startTime: Date
  endTime?: Date
  status: 'active' | 'completed' | 'cancelled'
  securityLevel: 'standard' | 'hipaa' | 'maximum'
  emotionAnalysisEnabled: boolean
  notes?: string
  metadata?: Record<string, unknown>
}

export interface TherapyClient {
  id: string
  name: string
  age?: number
  demographics?: {
    gender?: string
    ethnicity?: string
    primaryLanguage?: string
  }
  preferences?: Record<string, unknown>
}

export interface TherapyAnalysis {
  sessionId: string
  timestamp: Date
  emotionalState: {
    valence: number
    arousal: number
    dominance: number
  }
  insights: string[]
  recommendations: string[]
}

export interface Emotion {
  type: string
  confidence: number
  intensity?: number
}

export interface RiskFactor {
  type: string
  severity: number
}

export interface EmotionAnalysis {
  emotions: Emotion[]
  riskFactors: RiskFactor[]
}
