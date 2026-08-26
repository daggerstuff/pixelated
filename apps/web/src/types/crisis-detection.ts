export interface CrisisDetectionResponse {
  assessment: {
    overallRisk: 'none' | 'low' | 'moderate' | 'high' | 'imminent'
    suicidalIdeation: {
      present: boolean
      severity: 'passive' | 'active' | 'with_plan' | 'with_intent'
    }
    selfHarm: {
      present: boolean
      risk: 'low' | 'moderate' | 'high'
      frequency: 'rare' | 'occasional' | 'frequent' | 'daily'
    }
    agitation: {
      present: boolean
      controllable: boolean
      severity: 'mild' | 'moderate' | 'severe'
    }
    substanceUse: {
      present: boolean
      acute: boolean
      impairment: 'none' | 'mild' | 'moderate' | 'severe'
    }
  }
  riskFactors: {
    factor: string
    confidence: number
  }[]
  protectiveFactors: {
    factor: string
    confidence: number
  }[]
  recommendations: {
    immediate: {
      action: string
      priority: 'high' | 'medium' | 'low'
    }[]
  }
  resources: {
    crisis: {
      name: string
      contact: string
      specialization: string[]
      availability: string
    }[]
  }
  metadata: {
    confidenceScore: number
  }
}

export interface CrisisDetectionRequest {
  content: string
  contentType: 'chat_message' | 'transcript' | 'clinical_note'
  context?: {
    previousAssessments?: unknown[]
    sessionMetadata?: unknown
  }
  options?: {
    sensitivityLevel?: 'low' | 'medium' | 'high'
    includeTreatmentSuggestions?: boolean
    includeResourceRecommendations?: boolean
    enableImmediateNotifications?: boolean
  }
}
