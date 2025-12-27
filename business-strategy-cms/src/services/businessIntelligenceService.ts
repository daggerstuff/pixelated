import { Logger } from '../utils/logger'
import {
  MarketData,
  CompetitorAnalysis,
  BusinessInsight,
} from '../types/business-intelligence'
import { DatabaseService } from './databaseService'

export class BusinessIntelligenceService {
  private logger: Logger
  private db: DatabaseService
  private marketDataCache: Map<string, MarketData> = new Map()
  private competitorCache: Map<string, CompetitorAnalysis> = new Map()

  constructor() {
    this.logger = new Logger('BusinessIntelligenceService')
    this.db = new DatabaseService()
  }

  /**
   * Real-time competitive intelligence monitoring
   */
  async analyzeCompetitiveLandscape(
    industry: string,
  ): Promise<CompetitorAnalysis> {
    try {
      const competitors = await this.fetchCompetitorData(industry)
      const analysis = await this.performCompetitiveAnalysis(competitors)

      this.competitorCache.set(industry, analysis)
      await this.db.storeCompetitorAnalysis(analysis)

      return analysis
    } catch (error) {
      this.logger.error('Failed to analyze competitive landscape', {
        error,
        industry,
      })
      throw new Error(`Competitive analysis failed: ${error}`)
    }
  }

  /**
   * Market opportunity scoring
   */
  async scoreMarketOpportunity(params: {
    marketSize: number
    growthRate: number
    competitionLevel: number
    entryBarriers: number
    customerAcquisitionCost: number
    lifetimeValue: number
  }): Promise<number> {
    const {
      marketSize,
      growthRate,
      competitionLevel,
      entryBarriers,
      customerAcquisitionCost,
      lifetimeValue,
    } = params

    // Market attractiveness scoring (0-100)
    const marketScore = Math.min(100, (marketSize / 1000000) * 20) // Scale to millions
    const growthScore = Math.min(30, growthRate * 3) // 0-30 points
    const competitionScore = Math.max(0, 25 - competitionLevel * 5) // Lower competition = higher score
    const barrierScore = Math.max(0, 15 - entryBarriers * 3) // Lower barriers = higher score

    // Economic viability scoring (0-30)
    const ltvCacRatio = lifetimeValue / customerAcquisitionCost
    const economicScore = Math.min(30, ltvCacRatio * 6) // 0-30 points

    return Math.min(
      100,
      marketScore +
        growthScore +
        competitionScore +
        barrierScore +
        economicScore,
    )
  }

  /**
   * Pricing intelligence analysis
   */
  async analyzePricingStrategy(competitorData: any[]): Promise<{
    recommendedPrice: number
    priceRange: { min: number; max: number }
    marketPosition: 'premium' | 'competitive' | 'budget'
    justification: string[]
  }> {
    const prices = competitorData.map((c) => c.price).filter((p) => p > 0)
    const avgPrice =
      prices.reduce((sum, price) => sum + price, 0) / prices.length
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    // Determine market position
    let marketPosition: 'premium' | 'competitive' | 'budget'
    let recommendedPrice: number
    const justification: string[] = []

    if (avgPrice * 1.2 <= maxPrice) {
      marketPosition = 'premium'
      recommendedPrice = avgPrice * 1.15
      justification.push('Premium positioning justified by superior features')
      justification.push('20% price premium within acceptable market range')
    } else if (avgPrice * 0.8 >= minPrice) {
      marketPosition = 'budget'
      recommendedPrice = avgPrice * 0.85
      justification.push('Competitive pricing to gain market share')
      justification.push('Cost advantage allows for lower pricing')
    } else {
      marketPosition = 'competitive'
      recommendedPrice = avgPrice
      justification.push('Pricing aligned with market expectations')
      justification.push('Competitive positioning without price war')
    }

    return {
      recommendedPrice,
      priceRange: { min: minPrice, max: maxPrice },
      marketPosition,
      justification,
    }
  }

  /**
   * Feature gap analysis
   */
  async analyzeFeatureGaps(
    ourFeatures: string[],
    competitorFeatures: string[][],
  ): Promise<{
    missingFeatures: string[]
    competitiveAdvantages: string[]
    priorityGaps: { feature: string; impact: number; effort: number }[]
  }> {
    const allCompetitorFeatures = [...new Set(competitorFeatures.flat())]
    const ourFeatureSet = new Set(ourFeatures.map((f) => f.toLowerCase()))

    const missingFeatures = allCompetitorFeatures.filter(
      (feature) => !ourFeatureSet.has(feature.toLowerCase()),
    )

    const competitiveAdvantages = ourFeatures.filter(
      (feature) =>
        !allCompetitorFeatures.some((cf) =>
          cf.toLowerCase().includes(feature.toLowerCase()),
        ),
    )

    // Priority scoring for missing features
    const priorityGaps = missingFeatures
      .map((feature) => ({
        feature,
        impact: this.estimateFeatureImpact(feature, competitorFeatures),
        effort: this.estimateDevelopmentEffort(feature),
      }))
      .sort((a, b) => b.impact / b.effort - a.impact / a.effort)

    return {
      missingFeatures,
      competitiveAdvantages,
      priorityGaps: priorityGaps.slice(0, 10), // Top 10 priorities
    }
  }

  /**
   * Market penetration analysis
   */
  async analyzeMarketPenetration(targetSegments: string[]): Promise<{
    segmentPenetration: {
      segment: string
      penetration: number
      opportunity: number
    }
    totalAddressableMarket: number
    serviceableAddressableMarket: number
    serviceableObtainableMarket: number
  }> {
    const marketData = await this.fetchMarketSegmentData(targetSegments)

    const segmentPenetration = targetSegments.map((segment) => {
      const segmentData = marketData[segment] || { current: 0, total: 1000 }
      const penetration = (segmentData.current / segmentData.total) * 100
      const opportunity = segmentData.total - segmentData.current

      return {
        segment,
        penetration: Math.min(100, penetration),
        opportunity,
      }
    })

    const totalAddressableMarket = segmentPenetration.reduce(
      (sum, s) => sum + s.penetration,
      0,
    )
    const serviceableAddressableMarket = totalAddressableMarket * 0.8 // 80% realistic reach
    const serviceableObtainableMarket = serviceableAddressableMarket * 0.15 // 15% market share goal

    return {
      segmentPenetration,
      totalAddressableMarket,
      serviceableAddressableMarket,
      serviceableObtainableMarket,
    }
  }

  /**
   * Generate business insights
   */
  async generateBusinessInsights(
    marketData: MarketData,
  ): Promise<BusinessInsight[]> {
    const insights: BusinessInsight[] = []

    // Market opportunity insights
    if (marketData.growthRate > 20) {
      insights.push({
        type: 'opportunity',
        title: 'High Growth Market',
        description: `Market growing at ${marketData.growthRate}% annually presents significant expansion opportunity`,
        action: 'Accelerate market entry strategy',
        urgency: 'high',
        confidence: 0.85,
      })
    }

    // Competitive insights
    if (marketData.competitionLevel < 3) {
      insights.push({
        type: 'competitive',
        title: 'Low Competition Segment',
        description: 'Market segment shows low competitive intensity',
        action: 'Focus resources on this segment for market share gains',
        urgency: 'medium',
        confidence: 0.75,
      })
    }

    // Financial insights
    const ltvCacRatio =
      marketData.lifetimeValue / marketData.customerAcquisitionCost
    if (ltvCacRatio > 3) {
      insights.push({
        type: 'financial',
        title: 'Strong Unit Economics',
        description: `LTV:CAC ratio of ${ltvCacRatio.toFixed(1)} indicates profitable unit economics`,
        action: 'Scale customer acquisition efforts',
        urgency: 'high',
        confidence: 0.9,
      })
    }

    // Risk insights
    if (marketData.entryBarriers > 7) {
      insights.push({
        type: 'risk',
        title: 'High Entry Barriers',
        description:
          'Significant barriers to entry may limit new competitor emergence',
        action: 'Develop partnership strategy to overcome barriers',
        urgency: 'medium',
        confidence: 0.7,
      })
    }

    return insights.sort((a, b) => b.urgency.localeCompare(a.urgency))
  }

  /**
   * Fetch competitor data from APIs
   */
  private async fetchCompetitorData(industry: string): Promise<any[]> {
    // Mock implementation - replace with actual API calls
    const mockCompetitors = [
      {
        name: 'BetterHelp',
        marketShare: 35,
        pricing: {
          basic: 80,
          premium: 120,
          enterprise: 200,
        },
        features: ['video therapy', 'text messaging', 'progress tracking'],
        strengths: ['brand recognition', 'large network'],
        weaknesses: ['limited AI', 'high cost'],
      },
      {
        name: 'Talkspace',
        marketShare: 25,
        pricing: {
          basic: 69,
          premium: 99,
          enterprise: 179,
        },
        features: ['text therapy', 'video sessions', 'psychiatry'],
        strengths: ['text-based focus', 'insurance coverage'],
        weaknesses: ['limited AI', 'quality concerns'],
      },
    ]

    return mockCompetitors.filter((c) =>
      c.features.some((f) => f.toLowerCase().includes(industry.toLowerCase())),
    )
  }

  /**
   * Perform competitive analysis
   */
  private async performCompetitiveAnalysis(
    competitors: any[],
  ): Promise<CompetitorAnalysis> {
    const avgPricing =
      competitors.reduce(
        (sum, c) =>
          sum +
          (c.pricing.basic + c.pricing.premium + c.pricing.enterprise) / 3,
        0,
      ) / competitors.length

    const marketShareDistribution = competitors.reduce(
      (acc, c) => {
        acc[c.name] = c.marketShare
        return acc
      },
      {} as Record<string, number>,
    )

    const featureFrequency = this.analyzeFeatureFrequency(competitors)
    const competitiveGaps = this.identifyCompetitiveGaps(competitors)

    return {
      competitors: competitors.length,
      marketLeader: competitors.reduce((leader, c) =>
        c.marketShare > (leader?.marketShare || 0) ? c : leader,
      ).name,
      avgPricing,
      marketShareDistribution,
      featureFrequency,
      competitiveGaps,
      lastUpdated: new Date(),
    }
  }

  /**
   * Analyze feature frequency across competitors
   */
  private analyzeFeatureFrequency(competitors: any[]): Record<string, number> {
    const featureCounts: Record<string, number> = {}

    competitors.forEach((competitor) => {
      competitor.features.forEach((feature: string) => {
        const normalized = feature.toLowerCase().replace(/\s+/g, '_')
        featureCounts[normalized] = (featureCounts[normalized] || 0) + 1
      })
    })

    return featureCounts
  }

  /**
   * Identify competitive gaps
   */
  private identifyCompetitiveGaps(competitors: any[]): string[] {
    const allFeatures = competitors.flatMap((c) => c.features)
    const uniqueFeatures = [...new Set(allFeatures)]

    const gaps = uniqueFeatures.filter((feature) => {
      const count = allFeatures.filter((f) => f === feature).length
      return count < competitors.length / 2 // Features offered by <50% of competitors
    })

    return gaps
  }

  /**
   * Estimate feature impact based on competitor adoption
   */
  private estimateFeatureImpact(
    feature: string,
    competitorFeatures: string[][],
  ): number {
    const adoptionRate =
      competitorFeatures.filter((cf) =>
        cf.some((f) => f.toLowerCase().includes(feature.toLowerCase())),
      ).length / competitorFeatures.length

    return Math.min(10, adoptionRate * 10) // Scale to 0-10
  }

  /**
   * Estimate development effort for missing features
   */
  private estimateDevelopmentEffort(feature: string): number {
    const complexityMap: Record<string, number> = {
      basic: 1,
      video: 3,
      ai: 5,
      integration: 4,
      mobile: 2,
      analytics: 3,
      security: 4,
    }

    const lowerFeature = feature.toLowerCase()
    for (const [keyword, effort] of Object.entries(complexityMap)) {
      if (lowerFeature.includes(keyword)) {
        return effort
      }
    }

    return 2 // Default medium effort
  }

  /**
   * Fetch market segment data
   */
  private async fetchMarketSegmentData(
    segments: string[],
  ): Promise<Record<string, { current: number; total: number }>> {
    // Mock implementation - replace with actual market research APIs
    const mockData: Record<string, { current: number; total: number }> = {
      'healthcare-institutions': { current: 150, total: 2000 },
      'universities': { current: 75, total: 500 },
      'private-practices': { current: 300, total: 8000 },
      'corporate-wellness': { current: 50, total: 1000 },
    }

    return Object.fromEntries(
      segments.map((segment) => [
        segment,
        mockData[segment] || { current: 0, total: 1000 },
      ]),
    )
  }

  /**
   * Store market data in database
   */
  async storeMarketData(marketData: MarketData): Promise<void> {
    await this.db.storeMarketData(marketData)
    this.marketDataCache.set(marketData.id, marketData)
  }

  /**
   * Get cached market data
   */
  getCachedMarketData(id: string): MarketData | undefined {
    return this.marketDataCache.get(id)
  }

  /**
   * Clear cache for fresh data
   */
  clearCache(): void {
    this.marketDataCache.clear()
    this.competitorCache.clear()
  }
}
