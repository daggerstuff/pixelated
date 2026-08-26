export interface DimensionalEmotionsQuery {
  clientId: string
  startDate?: Date
  endDate?: Date
  limit: number
}

export interface DimensionalEmotion {
  valence: number
  arousal: number
  dominance: number
  timestamp: Date
  sessionId: string
}

export interface DimensionalMap {
  emotions: DimensionalEmotion[]
  summary: {
    averageValence: number
    averageArousal: number
    averageDominance: number
  }
  trends: {
    valenceChange: number
    arousalChange: number
    dominanceChange: number
  }
}

export interface EmotionAnalysisResult {
  sessionId: string
  timestamp: Date
  dimensions: DimensionalEmotion
  confidence: number
  insights: string[]
}
