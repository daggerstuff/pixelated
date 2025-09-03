// Shared API types
export interface DetectCrisisResult {
  assessment: {
    overallRisk: 'none' | 'low' | 'moderate' | 'high' | 'imminent'
    suicidalIdeation: { present: boolean; severity?: 'with_intent' | 'with_plan' | 'active' | 'passive' | string }
    selfHarm: { present: boolean; risk?: 'low' | 'moderate' | 'high'; frequency?: 'rare' | 'occasional' | 'frequent' | 'daily' }
    agitation: { present: boolean; controllable?: boolean; severity?: 'mild' | 'moderate' | 'severe' | string }
    substanceUse: { present: boolean; acute?: boolean; impairment?: 'none' | 'mild' | 'moderate' | 'severe' | string }
  }
  riskFactors: Array<{ factor: string }>
  protectiveFactors: Array<{ factor: string }>
  recommendations: { immediate: Array<{ action: string }>; followUp?: Array<{ action: string }> }
  resources: { crisis: Array<{ name: string; contact: string; specialization: string[]; availability: string }> }
  metadata: { confidenceScore: number }
}

export default DetectCrisisResult
