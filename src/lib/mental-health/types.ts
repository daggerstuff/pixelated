export interface MentalHealthAnalysis {
  id: string
  timestamp: number
  confidence: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  categories: MentalHealthCategory[]
  sentiment: SentimentScore
  indicators: HealthIndicator[]
  recommendations: string[]
  requiresIntervention: boolean
}

export interface MentalHealthCategory {
  name: string
  score: number
  confidence: number
  keywords: string[]
}

export interface SentimentScore {
  overall: number
  positive: number
  negative: number
  neutral: number
}

export interface HealthIndicator {
  type: 'depression' | 'anxiety' | 'stress' | 'anger' | 'isolation' | 'crisis'
  severity: number
  evidence: string[]
  description: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  analysis?: MentalHealthAnalysis
}

export interface TherapeuticResponse {
  content: string
  approach: 'supportive' | 'cognitive' | 'behavioral' | 'crisis'
  techniques: string[]
  followUp: string[]
}

export interface AnalysisConfig {
  enableAnalysis: boolean
  confidenceThreshold: number
  interventionThreshold: number
  analysisMinLength: number
  enableCrisisDetection: boolean
}
