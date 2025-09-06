// TypeScript types for bias detection demo data structures

export interface Demographics {
  age: string
  gender: string
  ethnicity: string
  primaryLanguage: string
}

export interface SessionData {
  sessionId: string
  scenario: string
  demographics: Demographics
  content: string
  timestamp: Date
}

export interface BiasFactors {
  overall: number
  linguistic: number
  gender: number
  racial: number
  age: number
  cultural: number
  model: number
  interactive: number
  evaluation: number
}

export interface LinguisticBias {
  genderBiasScore: number
  racialBiasScore: number
  ageBiasScore: number
  culturalBiasScore: number
}

export interface RepresentationAnalysis {
  diversityIndex: number
  underrepresentedGroups: string[]
}

export interface FairnessMetrics {
  demographicParity: number
  equalizedOdds: number
  calibration: number
}

export interface CounterfactualAnalysis {
  scenariosAnalyzed: number
  biasDetected: boolean
  consistencyScore: number
}

export interface HuggingFaceMetrics {
  bias: number
  stereotype: number
  regard: {
    positive: number
    negative: number
  }
}

export interface LayerResults {
  preprocessing: {
    biasScore: number
    linguisticBias: LinguisticBias
    representationAnalysis: RepresentationAnalysis
  }
  modelLevel: {
    biasScore: number
    fairnessMetrics: FairnessMetrics
  }
  interactive: {
    biasScore: number
    counterfactualAnalysis: CounterfactualAnalysis
  }
  evaluation: {
    biasScore: number
    huggingFaceMetrics: HuggingFaceMetrics
  }
}

export interface BiasAnalysisResults {
  sessionId: string
  timestamp: Date
  overallBiasScore: number
  alertLevel: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  layerResults: LayerResults
  recommendations: string[]
  demographics: Demographics
}

export interface PresetScenario {
  [x: string]: unknown
  id: string
  name: string
  description: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  category: 'cultural' | 'gender' | 'age' | 'linguistic' | 'intersectional'
  scenario: string
  demographics: Demographics
  content: string
  expectedBiasScore: number
  learningObjectives: string[]
}

export interface CounterfactualScenario {
  id: string
  change: string
  impact: string
  likelihood: 'low' | 'medium' | 'high'
  biasScoreChange: number
  confidence: number
}

export interface HistoricalComparison {
  thirtyDayAverage: number
  sevenDayTrend: 'improving' | 'stable' | 'worsening'
  percentileRank: number
  comparisonToAverage: number
  trendDirection: string
}

export interface ExportData {
  timestamp: string
  sessionId: string
  analysis: BiasAnalysisResults
  counterfactualScenarios: CounterfactualScenario[]
  historicalComparison: HistoricalComparison
  metadata: {
    exportedBy: string
    version: string
    demoType: string
  }
}

export interface DashboardMetrics {
  totalAnalyses: number
  avgBiasScore: number
  activeAlerts: number
  systemHealth: number
}

export interface AlertConfiguration {
  lowThreshold: number
  mediumThreshold: number
  highThreshold: number
  criticalThreshold: number
}
