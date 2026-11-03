/**
 * Crisis prediction types (formerly exported from PredictiveCrisisModelingService).
 * Used by dashboard UI; live crisis detection uses `@/lib/ai/services/crisis-detection`.
 */

export interface CrisisRiskFactors {
  emotional: {
    intensityTrend: number[]
    volatilityScore: number
    negativeEmotionDuration: number
    emotionalRegulationCapacity: number
  }
  behavioral: {
    sessionEngagement: number
    communicationPatterns: string[]
    isolationIndicators: number
    activityChanges: number
  }
  historical: {
    previousCrises: number
    timesSinceLastCrisis: number
    treatmentCompliance: number
    supportSystemStrength: number
  }
  temporal: {
    daysSinceLastSession: number
    timeOfDay: number
    seasonalFactors: number
    anniversaryDates: string[]
  }
}

export interface CrisisPrediction {
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'imminent'
  timeframe: 'within_hour' | 'within_day' | 'within_week' | 'within_month'
  confidence: number
  primaryRiskFactors: string[]
  protectiveFactors: string[]
  interventionWindow: {
    optimal: string
    critical: string
  }
  escalationTriggers: string[]
}

export interface TemporalRiskModel {
  shortTerm: {
    nextHour: number
    next6Hours: number
    next24Hours: number
  }
  mediumTerm: {
    next3Days: number
    nextWeek: number
    next2Weeks: number
  }
  longTerm: {
    nextMonth: number
    next3Months: number
    next6Months: number
  }
}
