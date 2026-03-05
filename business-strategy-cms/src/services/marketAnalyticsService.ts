import { Logger } from '../utils/logger'
import {
  MarketPenetration,
  MarketOpportunity,
} from '../types/business-intelligence'
// import { DatabaseService } from './databaseService'

export class MarketAnalyticsService {
  private logger: Logger
  constructor() {
    this.logger = new Logger('MarketAnalyticsService')
  }

  /**
   * Analyze market penetration across segments
   */
  async analyzeMarketPenetration(
    targetSegments: string[],
  ): Promise<MarketPenetration[]> {
    try {
      const segmentData = await this.fetchSegmentData(targetSegments)
      const penetrationAnalysis: MarketPenetration[] = []

      for (const segment of targetSegments) {
        const data = segmentData[segment]
        const penetration = (data.current / data.total) * 100
        const opportunity = data.total - data.current

        const sam = data.total * 0.8 // Serviceable Addressable Market (80%)
        const som = sam * 0.15 // Serviceable Obtainable Market (15% market share goal)

        penetrationAnalysis.push({
          segment,
          penetration: Math.min(100, penetration),
          opportunity,
          totalAddressableMarket: data.total,
          serviceableAddressableMarket: sam,
          serviceableObtainableMarket: som,
        })
      }

      return penetrationAnalysis.sort((a, b) => b.opportunity - a.opportunity)
    } catch (error) {
      this.logger.error('Failed to analyze market penetration', {
        error,
        targetSegments,
      })
      throw new Error(`Market penetration analysis failed: ${String(error)}`)
    }
  }

  /**
   * Score market opportunities using weighted criteria
   */
  async scoreMarketOpportunities(
    opportunities: MarketOpportunity[],
  ): Promise<MarketOpportunity[]> {
    const scoredOpportunities = opportunities.map((opp) => {
      // Normalize all factors to 0-100 scale
      const marketSizeScore = Math.min(100, (opp.marketSize / 1000000) * 10)
      const competitionScore = Math.max(0, 100 - opp.competition * 20)
      const barrierScore = Math.max(0, 100 - opp.barriers * 15)
      const roiScore = Math.min(100, opp.estimatedRoi * 10)
      const timeScore = Math.max(0, 100 - opp.timeToMarket * 5)

      // Weighted scoring
      const weights = {
        marketSize: 0.25,
        competition: 0.2,
        barriers: 0.15,
        roi: 0.25,
        time: 0.15,
      }

      const score =
        marketSizeScore * weights.marketSize +
        competitionScore * weights.competition +
        barrierScore * weights.barriers +
        roiScore * weights.roi +
        timeScore * weights.time

      return { ...opp, score: Math.round(score) }
    })

    return scoredOpportunities.sort((a, b) => b.score - a.score)
  }

  /**
   * Generate market expansion roadmap
   */
  async generateExpansionRoadmap(
    currentMarket: string,
    targetMarkets: string[],
  ): Promise<{
    phases: ExpansionPhase[]
    timeline: number
    resourceRequirements: ResourceRequirements
    riskAssessment: RiskAssessment
  }> {
    await this.analyzeTargetMarkets(
      currentMarket,
      targetMarkets,
    )

    const phases: ExpansionPhase[] = []
    let totalTimeline = 0
    let totalCost = 0
    const risks: string[] = []

    // Phase 1: Market Research & Validation (Months 1-2)
    phases.push({
      phase: 1,
      name: 'Market Research & Validation',
      duration: 2,
      activities: [
        'Conduct detailed market research',
        'Validate customer segments',
        'Analyze competitive landscape',
        'Assess regulatory requirements',
      ],
      estimatedCost: 50000,
      successCriteria: [
        'Market size > $10M',
        'Competition level < 7/10',
        'Customer validation > 80%',
      ],
    })

    // Phase 2: Product-Market Fit (Months 3-4)
    phases.push({
      phase: 2,
      name: 'Product-Market Fit',
      duration: 2,
      activities: [
        'Localize product offering',
        'Adapt marketing messaging',
        'Establish local partnerships',
        'Pilot program launch',
      ],
      estimatedCost: 75000,
      successCriteria: [
        'Pilot customer satisfaction > 85%',
        'Retention rate > 70%',
        'Referral rate > 30%',
      ],
    })

    // Phase 3: Market Entry (Months 5-8)
    phases.push({
      phase: 3,
      name: 'Market Entry',
      duration: 4,
      activities: [
        'Launch marketing campaigns',
        'Establish sales channels',
        'Build local team',
        'Scale customer acquisition',
      ],
      estimatedCost: 150000,
      successCriteria: [
        'Monthly recurring revenue > $25K',
        'Customer acquisition cost < $500',
        'Market share > 2%',
      ],
    })

    // Phase 4: Scale & Optimize (Months 9-12)
    phases.push({
      phase: 4,
      name: 'Scale & Optimize',
      duration: 4,
      activities: [
        'Optimize operations',
        'Expand sales team',
        'Develop strategic partnerships',
        'Enhance product features',
      ],
      estimatedCost: 200000,
      successCriteria: [
        'Monthly recurring revenue > $100K',
        'Market share > 5%',
        'Positive unit economics',
      ],
    })

    // Calculate totals
    totalTimeline = phases.reduce((sum, phase) => sum + phase.duration, 0)
    totalCost = phases.reduce((sum, phase) => sum + phase.estimatedCost, 0)

    // Risk assessment
    risks.push(
      'Regulatory compliance requirements',
      'Cultural adaptation challenges',
      'Local competition response',
      'Currency and economic risks',
      'Team scaling challenges',
    )

    return {
      phases,
      timeline: totalTimeline,
      resourceRequirements: {
        totalBudget: totalCost,
        teamSize: 8,
        timeline: totalTimeline,
      },
      riskAssessment: {
        overallRisk: 'medium',
        probabilityOfSuccess: 0.75,
        riskFactors: risks,
        mitigationStrategies: [
          'Partner with local experts',
          'Start with pilot markets',
          'Maintain financial reserves',
          'Build flexible team structure',
        ],
      },
    }
  }

  /**
   * Analyze customer segmentation
   */
  async analyzeCustomerSegmentation(
    customerData: any[],
  ): Promise<CustomerSegment[]> {
    const segments = await this.performClusteringAnalysis(customerData)

    return segments.map((segment) => ({
      name: segment.name,
      size: segment.customers.length,
      percentage: (segment.customers.length / customerData.length) * 100,
      characteristics: segment.characteristics,
      lifetimeValue: segment.avgLifetimeValue,
      acquisitionCost: segment.avgAcquisitionCost,
      churnRate: segment.churnRate,
      expansionPotential: segment.expansionPotential,
      recommendedStrategy: segment.strategy,
    }))
  }

  /**
   * Calculate market saturation
   */
  async calculateMarketSaturation(market: string): Promise<{
    saturationLevel: number // 0-100
    growthPotential: number // 0-100
    expansionOpportunities: string[]
  }> {
    const marketData = await this.fetchMarketSaturationData(market)

    // Saturation based on penetration rate and growth
    const penetrationRate =
      marketData.currentCustomers / marketData.totalPotential
    const growthRate = marketData.yoyGrowth

    let saturationLevel = penetrationRate * 100

    // Adjust for growth rate
    if (growthRate > 15) saturationLevel *= 0.7 // High growth reduces effective saturation
    if (growthRate < 5) saturationLevel *= 1.3 // Low growth increases effective saturation

    const growthPotential = Math.max(0, 100 - saturationLevel)

    const expansionOpportunities = []
    if (saturationLevel < 30) {
      expansionOpportunities.push('Aggressive market expansion')
      expansionOpportunities.push('Geographic expansion')
    } else if (saturationLevel < 60) {
      expansionOpportunities.push('Product line extension')
      expansionOpportunities.push('Customer segment expansion')
    } else {
      expansionOpportunities.push('Market consolidation')
      expansionOpportunities.push('Adjacent market expansion')
    }

    return {
      saturationLevel: Math.min(100, Math.round(saturationLevel)),
      growthPotential: Math.round(growthPotential),
      expansionOpportunities,
    }
  }

  /**
   * Generate market forecast
   */
  async generateMarketForecast(
    market: string,
    forecastPeriod: 12 | 24 | 36,
  ): Promise<MarketForecast> {
    const historicalData = await this.fetchHistoricalData(market, 24)
    const trends = this.calculateTrends(historicalData)

    const forecast = []
    let currentMarketSize =
      historicalData[historicalData.length - 1]?.marketSize || 1000000

    for (let month = 1; month <= forecastPeriod; month++) {
      const growthMultiplier = 1 + trends.growthRate / 100 / 12
      const seasonalAdjustment = this.calculateSeasonalAdjustment(month)

      currentMarketSize *= growthMultiplier * seasonalAdjustment

      forecast.push({
        month,
        marketSize: Math.round(currentMarketSize),
        confidence: Math.max(0.7, 1 - (month / forecastPeriod) * 0.3),
      })
    }

    return {
      market,
      forecast,
      confidence: 0.85,
      assumptions: [
        'Stable economic conditions',
        'No major competitive disruptions',
        'Consistent customer acquisition rates',
      ],
    }
  }

  /**
   * Private helper methods
   */
  private async fetchSegmentData(
    segments: string[],
  ): Promise<Record<string, { current: number; total: number }>> {
    // Mock implementation - replace with actual market research APIs
    const mockData: Record<string, { current: number; total: number }> = {
      'healthcare-institutions': { current: 150, total: 2000 },
      'universities': { current: 75, total: 500 },
      'private-practices': { current: 300, total: 8000 },
      'corporate-wellness': { current: 50, total: 1000 },
      'government-agencies': { current: 25, total: 200 },
      'non-profits': { current: 100, total: 1500 },
    }

    return Object.fromEntries(
      segments.map((segment) => [
        segment,
        mockData[segment] || { current: 0, total: 1000 },
      ]),
    )
  }

  private async analyzeTargetMarkets(
    current: string,
    targets: string[],
  ): Promise<any> {
    // Mock analysis - replace with actual market research
    return {
      current,
      targets,
      analysis: 'Ready for multi-market expansion',
    }
  }

  private async performClusteringAnalysis(data: any[]): Promise<any[]> {
    // Mock clustering - replace with actual ML clustering
    return [
      {
        name: 'Enterprise Healthcare',
        customers: data.filter((d) => d.companySize > 1000),
        characteristics: ['Large budget', 'Complex needs', 'Long sales cycle'],
        avgLifetimeValue: 15000,
        avgAcquisitionCost: 2000,
        churnRate: 0.05,
        expansionPotential: 'high',
        strategy: 'Direct sales with custom solutions',
      },
      {
        name: 'Mid-Market Universities',
        customers: data.filter((d) => d.type === 'university' && d.size > 100),
        characteristics: [
          'Budget conscious',
          'Standardized needs',
          'Quick decisions',
        ],
        avgLifetimeValue: 8000,
        avgAcquisitionCost: 800,
        churnRate: 0.08,
        expansionPotential: 'medium',
        strategy: 'Inside sales with modular pricing',
      },
    ]
  }

  private async fetchMarketSaturationData(_market: string): Promise<any> {
    // Mock data - replace with actual market data
    return {
      currentCustomers: 450,
      totalPotential: 2000,
      yoyGrowth: 12.5,
    }
  }

  private async fetchHistoricalData(
    _market: string,
    months: number,
  ): Promise<any[]> {
    // Mock historical data - replace with actual data
    const data = []
    let baseSize = 800000

    for (let i = 0; i < months; i++) {
      baseSize *= 1.01 // 1% monthly growth
      data.push({
        date: new Date(Date.now() - (months - i) * 30 * 24 * 60 * 60 * 1000),
        marketSize: baseSize,
      })
    }

    return data
  }

  private calculateTrends(data: any[]): { growthRate: number } {
    if (data.length < 2) return { growthRate: 5 }

    const first = data[0].marketSize
    const last = data[data.length - 1].marketSize
    const periods = data.length

    const growthRate = ((last / first) ** (12 / periods) - 1) * 100
    return { growthRate: Math.max(-5, Math.min(25, growthRate)) }
  }

  private calculateSeasonalAdjustment(month: number): number {
    // Simple seasonal adjustment
    const seasonalFactors = [
      1.0, 0.95, 1.05, 1.1, 1.05, 1.0, 0.9, 0.85, 0.9, 1.0, 1.1, 1.15,
    ]
    return seasonalFactors[(month - 1) % 12]
  }
}

interface ExpansionPhase {
  phase: number
  name: string
  duration: number
  activities: string[]
  estimatedCost: number
  successCriteria: string[]
}

interface ResourceRequirements {
  totalBudget: number
  teamSize: number
  timeline: number
}

interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high'
  probabilityOfSuccess: number
  riskFactors: string[]
  mitigationStrategies: string[]
}

interface CustomerSegment {
  name: string
  size: number
  percentage: number
  characteristics: string[]
  lifetimeValue: number
  acquisitionCost: number
  churnRate: number
  expansionPotential: string
  recommendedStrategy: string
}

interface MarketForecast {
  market: string
  forecast: Array<{
    month: number
    marketSize: number
    confidence: number
  }>
  confidence: number
  assumptions: string[]
}
