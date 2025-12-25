export interface MarketData {
  id: string
  industry: string
  marketSize: number
  growthRate: number
  competitionLevel: number
  entryBarriers: number
  customerAcquisitionCost: number
  lifetimeValue: number
  segments: MarketSegment[]
  timestamp: Date
}

export interface MarketSegment {
  name: string
  size: number
  growthRate: number
  penetration: number
  keyDrivers: string[]
  barriers: string[]
}

export interface CompetitorAnalysis {
  competitors: number
  marketLeader: string
  avgPricing: number
  marketShareDistribution: Record<string, number>
  featureFrequency: Record<string, number>
  competitiveGaps: string[]
  lastUpdated: Date
}

export interface Competitor {
  name: string
  marketShare: number
  pricing: {
    basic: number
    premium: number
    enterprise: number
  }
  features: string[]
  strengths: string[]
  weaknesses: string[]
}

export interface BusinessInsight {
  type: 'opportunity' | 'competitive' | 'financial' | 'risk'
  title: string
  description: string
  action: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  confidence: number // 0-1
  metrics?: Record<string, number>
}

export interface MarketOpportunity {
  segment: string
  score: number // 0-100
  marketSize: number
  competition: number
  barriers: number
  estimatedRoi: number
  timeToMarket: number // months
}

export interface PricingAnalysis {
  recommendedPrice: number
  priceRange: { min: number; max: number }
  marketPosition: 'premium' | 'competitive' | 'budget'
  justification: string[]
  elasticity: number // -1 to 0
}

export interface FeatureGap {
  feature: string
  impact: number // 0-10
  effort: number // 1-5 (development effort)
  priority: number // impact/effort
  competitorsOffering: string[]
  estimatedRevenueImpact: number
}

export interface MarketPenetration {
  segment: string
  penetration: number // 0-100%
  opportunity: number
  totalAddressableMarket: number
  serviceableAddressableMarket: number
  serviceableObtainableMarket: number
}

export interface BusinessMetrics {
  revenue: number
  growthRate: number
  customerAcquisitionCost: number
  customerLifetimeValue: number
  churnRate: number
  netPromoterScore: number
  marketShare: number
}

export interface KPIDashboard {
  id: string
  name: string
  metrics: BusinessMetrics
  widgets: DashboardWidget[]
  lastUpdated: Date
  isShared: boolean
}

export interface DashboardWidget {
  id: string
  type: 'metric' | 'chart' | 'table' | 'alert'
  title: string
  dataSource: string
  visualization: 'line' | 'bar' | 'pie' | 'gauge' | 'heatmap'
  filters: Record<string, any>
  refreshInterval: number // seconds
}

export interface BusinessAlert {
  id: string
  type: 'opportunity' | 'threat' | 'performance' | 'trend'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  conditions: AlertCondition[]
  recipients: string[]
  isActive: boolean
  createdAt: Date
}

export interface AlertCondition {
  metric: string
  operator: '>' | '<' | '=' | '>=' | '<='
  value: number
  timeWindow: number // minutes
}

export interface CRMIntegration {
  platform: 'salesforce' | 'hubspot' | 'pipedrive'
  apiKey: string
  webhookUrl: string
  syncFields: string[]
  lastSync: Date
  isActive: boolean
}

export interface DocumentIntelligence {
  documentId: string
  summary: string
  keyInsights: string[]
  sentiment: number // -1 to 1
  topics: string[]
  relatedDocuments: string[]
  recommendations: string[]
  confidence: number // 0-1
}

export interface PredictiveModel {
  id: string
  name: string
  type: 'sales' | 'churn' | 'expansion' | 'risk'
  accuracy: number
  features: string[]
  lastTrained: Date
  predictions: Prediction[]
}

export interface Prediction {
  id: string
  modelId: string
  target: string
  probability: number
  confidence: number
  factors: Record<string, number>
  createdAt: Date
  expiresAt: Date
}
