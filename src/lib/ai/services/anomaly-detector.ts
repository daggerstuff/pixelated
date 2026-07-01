export interface AnomalyResult {
  isAnomaly: boolean
  confidence: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  urgency: 'low' | 'medium' | 'high' | 'immediate'
  category: string
  content: string
  detectedTerms: string[]
  suggestedActions: string[]
  timestamp: string
}

export abstract class AnomalyDetector {
  abstract detect(content: string, options?: any): Promise<AnomalyResult>
}
