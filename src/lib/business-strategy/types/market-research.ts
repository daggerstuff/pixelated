/**
 * Market Research Types
 */

import type { BaseEntity, Priority, BusinessStrategyId } from './common'

export interface MarketSize {
    totalAddressableMarket: number
    serviceableAddressableMarket: number
    serviceableObtainableMarket: number
    currency: string
    confidence: number // 0-100
}

export interface AccessibilityFactor {
    id: string
    name: string
    description: string
    impact: number // 0-100
    difficulty: number // 0-100
}

export interface AccessibilityScore {
    score: number // 0-100
    factors: AccessibilityFactor[]
    reasoning: string
}

export interface BarrierToEntry {
    id: string
    type: 'regulatory' | 'financial' | 'technical' | 'competitive' | 'cultural'
    name: string
    description: string
    severity: Priority
    mitigationStrategy?: string
    estimatedCost?: number
    timeToOvercome?: number // months
}

export interface CompetitiveAdvantage {
    id: string
    type: 'technology' | 'brand' | 'cost' | 'network' | 'data' | 'regulatory'
    name: string
    description: string
    strength: number // 0-100
    sustainability: number // 0-100
    uniqueness: number // 0-100
}

export interface MarketOpportunity {
    id: string
    name: string
    description: string
    marketSegment: string
    estimatedValue: number
    probability: number // 0-100
    timeframe: 'immediate' | 'short-term' | 'medium-term' | 'long-term'
    requiredInvestment: number
    expectedROI: number
}

export interface MarketThreat {
    id: string
    name: string
    description: string
    type: 'competitive' | 'regulatory' | 'technological' | 'economic' | 'social'
    probability: number // 0-100
    impact: number // 0-100
    mitigationStrategy?: string
}

export interface StrategyRecommendation {
    id: string
    strategy: 'enter' | 'avoid' | 'monitor' | 'partner'
    reasoning: string
    confidence: number // 0-100
    timeline: string
    requiredResources: string[]
    expectedOutcome: string
    riskFactors: string[]
    successMetrics: string[]
}

export interface NicheMarket extends BaseEntity {
    name: string
    description: string
    marketSize: MarketSize
    accessibility: AccessibilityScore
    competitiveLandscape: {
        directCompetitors: string[]
        indirectCompetitors: string[]
        competitiveIntensity: number // 0-100
    }
    barriers: BarrierToEntry[]
    advantages: CompetitiveAdvantage[]
    opportunities: MarketOpportunity[]
    threats: MarketThreat[]
    recommendation: StrategyRecommendation
    analysisDate: Date
    nextReviewDate: Date
}

export interface MarketAnalysis extends BaseEntity {
    marketId: BusinessStrategyId
    marketName: string
    analysisType: 'initial' | 'quarterly' | 'annual' | 'ad-hoc'
    marketSize: MarketSize
    accessibility: AccessibilityScore
    competitiveLandscape: {
        directCompetitors: CompetitorProfile[]
        indirectCompetitors: CompetitorProfile[]
        competitiveIntensity: number
    }
    barriers: BarrierToEntry[]
    opportunities: MarketOpportunity[]
    threats: MarketThreat[]
    recommendation: StrategyRecommendation
    confidence: number // 0-100
    dataQuality: number // 0-100
    sources: string[]
}

export interface CompetitorProfile {
    id: string
    name: string
    website?: string
    marketPosition: 'leader' | 'challenger' | 'follower' | 'niche'
    marketShare?: number
    revenue?: number
    employees?: number
    foundedYear?: number
    headquarters?: string
    strengths: string[]
    weaknesses: string[]
    keyProducts: string[]
    pricingModel?: string
    targetMarkets: string[]
    recentNews?: string[]
    lastUpdated: Date
}