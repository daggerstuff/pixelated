export interface PatientPsiProfile {
  id: string
  name: string
  age: number
  gender: string
  communicationStyle: CommunicationStyle
  therapeuticGoals: string[]
  culturalFactors: CulturalContext
  presentingIssues: string[]
  history: string[]
  preferences: PatientPreferences
  riskFactors: RiskFactors
}

export interface CommunicationStyle {
  primary:
    | 'anxious'
    | 'avoidant'
    | 'aggressive'
    | 'passive'
    | 'assertive'
    | 'manipulative'
  secondary?: string[]
  patterns: string[]
  triggers: string[]
  preferredApproach: string[]
}

export interface PatientPreferences {
  sessionLength: number
  communicationMethod: 'text' | 'voice' | 'video'
  interventionStyle: 'direct' | 'gentle' | 'collaborative'
  feedbackFrequency: 'realtime' | 'summary' | 'none'
  culturalConsiderations: string[]
}

export interface RiskFactors {
  suicideRisk: number // 0-1 scale
  selfHarm: number // 0-1 scale
  substanceUse: number // 0-1 scale
  violence: number // 0-1 scale
  psychosis: number // 0-1 scale
  traumaHistory: string[]
  protectiveFactors: string[]
}

export interface CulturalContext {
  primaryFactors: string[]
  communicationPreferences: string[]
  therapeuticApproaches: string[]
  familyDynamics: string[]
  religiousSpiritual: string[]
  languagePreferences: string[]
  culturalAdaptations: string[]
}
