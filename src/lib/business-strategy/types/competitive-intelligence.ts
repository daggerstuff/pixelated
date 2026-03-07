/**
 * Competitive Intelligence Types
 */

import type { BaseEntity, Priority, } from './common'

export interface CompetitiveStrength {
    id: string
    category: 'product' | 'marketing' | 'operations' | 'financial' | 'strategic'
    name: string
    description: string
    impact: number // 0-100
    evidence: string[]
    lastVerified: Date
}

export interface CompetitiveWeakness {
    id: string
    category: 'product' | 'marketing' | 'operations' | 'financial' | 'strategic'
    name: string
    description: string
    severity: number // 0-100
    exploitability: number // 0-100
    evidence: string[]
    lastVerified: Date
}

export interface Feature {
    featureId: string
    name: string
    description: string
    category: string
    hasFeature: boolean
    quality?: number // 0-100
    uniqueness?: number // 0-100
    customerSatisfaction?: number // 0-100
    implementationDate?: Date
    notes?: string
}

export interface PricingTier {
    id: string
    name: string
    price: number
    currency: string
    billingPeriod: 'monthly' | 'quarterly' | 'annually' | 'one-time'
    features: string[]
    limitations?: string[]
    targetSegment?: string
    popularity?: number // 0-100
}

export interface PricingModel {
    model: 'subscription' | 'one-time' | 'usage-based' | 'freemium' | 'enterprise'
    tiers: PricingTier[]
    freeTrialDays?: number
    hasFreeTier: boolean
    customPricingAvailable: boolean
    discountsAvailable: string[]
    lastUpdated: Date
}

export interface CustomerSegment {
    id: string
    name: string
    description: string
    size: number
    growthRate?: number
    profitability?: number // 0-100
    acquisitionCost?: number
    lifetimeValue?: number
    churnRate?: number
    satisfactionScore?: number // 0-100
}

export interface FeatureGap {
    gapId: string
    featureName: string
    description: string
    category: 'critical' | 'important' | 'nice-to-have'
    competitorHas: boolean
    weHave: boolean
    customerDemand: number // 0-100
    implementationEffort: number // 1-10
    estimatedCost: number
    expectedImpact: number // 1-10
    recommendation: 'adopt-and-improve' | 'ignore' | 'differentiate-differently'
    reasoning: string
    timeline?: string
    dependencies?: string[]
}

export interface CompetitorAnalysis extends BaseEntity {
    competitorId: string
    name: string
    website?: string
    marketPosition: 'leader' | 'challenger' | 'follower' | 'niche'
    marketShare?: number
    revenue?: number
    employees?: number
    valuation?: number
    fundingRounds?: {
        round: string
        amount: number
        date: Date
        investors: string[]
    }[]
    strengths: CompetitiveStrength[]
    weaknesses: CompetitiveWeakness[]
    features: Feature[]
    pricing: PricingModel
    customerSegments: CustomerSegment[]
    gapsVsUs: FeatureGap[]
    marketingStrategy?: {
        channels: string[]
        messaging: string[]
        positioning: string
        budget?: number
    }
    partnerships?: string[]
    recentNews?: {
        title: string
        summary: string
        date: Date
        source: string
        impact: 'positive' | 'negative' | 'neutral'
    }[]
    swotAnalysis?: {
        strengths: string[]
        weaknesses: string[]
        opportunities: string[]
        threats: string[]
    }
    lastUpdated: Date
    nextReviewDate: Date
    dataQuality: number // 0-100
    sources: string[]
}

export interface CompetitiveScenario {
    id: string
    name: string
    description: string
    type: 'price-war' | 'feature-launch' | 'market-entry' | 'acquisition' | 'partnership'
    probability: number // 0-100
    impact: number // 0-100
    timeframe: 'immediate' | 'short-term' | 'medium-term' | 'long-term'
    triggers: string[]
    indicators: string[]
}

export interface ResponseStrategy {
    id: string
    scenarioId: string
    name: string
    description: string
    type: 'defensive' | 'offensive' | 'neutral' | 'collaborative'
    actions: {
        action: string
        timeline: string
        owner: string
        resources: string[]
        expectedOutcome: string
    }[]
    riskLevel: Priority
    successProbability: number // 0-100
    estimatedCost: number
    expectedROI?: number
    approvalRequired: boolean
    lastUpdated: Date
}

export interface CompetitorUpdate {
    id: string
    competitorId: string
    updateType: 'product' | 'pricing' | 'marketing' | 'funding' | 'personnel' | 'strategy'
    title: string
    description: string
    impact: 'high' | 'medium' | 'low'
    actionRequired: boolean
    recommendedResponse?: string
    source: string
    confidence: number // 0-100
    detectedAt: Date
    verifiedAt?: Date
}