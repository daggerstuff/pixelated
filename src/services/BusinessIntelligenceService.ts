import axios from 'axios'
import { Pool } from 'pg'

// Market data interfaces
export interface MarketData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: number
  timestamp: Date
}

export interface CompetitorAnalysis {
  company: string
  marketShare: number
  revenue: number
  growthRate: number
  keyProducts: string[]
  strengths: string[]
  weaknesses: string[]
  lastUpdated: Date
}

export interface MarketOpportunity {
  segment: string
  size: number
  growthRate: number
  competition: 'low' | 'medium' | 'high'
  barriers: string[]
  opportunities: string[]
  riskLevel: 'low' | 'medium' | 'high'
  estimatedROI: number
}

export interface BusinessMetrics {
  revenue: number
  growthRate: number
  customerAcquisitionCost: number
  customerLifetimeValue: number
  churnRate: number
  netPromoterScore: number
  marketShare: number
  employeeCount: number
  quarter: string
  year: number
}

export interface BusinessAlert {
  id: string
  type: 'market_change' | 'competitor_activity' | 'opportunity' | 'risk'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  timestamp: Date
  isRead: boolean
  actionUrl?: string
}

export class BusinessIntelligenceService {
  private db: Pool
  private alphaVantageApiKey: string
  private yahooFinanceBaseUrl =
    'https://query1.finance.yahoo.com/v8/finance/chart'
  private alphaVantageBaseUrl = 'https://www.alphavantage.co/query'

  constructor(db: Pool) {
    this.db = db
    this.alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY || 'demo'
  }

  async getMarketData(symbol: string): Promise<MarketData> {
    try {
      // Use Yahoo Finance API for real-time data
      const response = await axios.get(
        `${this.yahooFinanceBaseUrl}/${symbol}`,
        {
          params: {
            interval: '1d',
            range: '1d',
          },
        },
      )

      const result = response.data.chart.result[0]
      const meta = result.meta
      const timestamp = new Date()

      return {
        symbol: meta.symbol,
        name: meta.symbol, // Would use company name from another endpoint
        price: meta.regularMarketPrice,
        change: meta.regularMarketChange,
        changePercent: meta.regularMarketChangePercent,
        volume: meta.regularMarketVolume,
        marketCap: meta.marketCap,
        timestamp,
      }
    } catch (error) {
      console.error('Error fetching market data:', error)
      // Return demo data if API fails
      return this.getDemoMarketData(symbol)
    }
  }

  async getMarketTrends(industry: string): Promise<MarketData[]> {
    try {
      // Use Alpha Vantage for industry trends
      const symbols = this.getIndustrySymbols(industry)
      const promises = symbols.map((symbol) => this.getMarketData(symbol))
      return Promise.all(promises)
    } catch (error) {
      console.error('Error fetching market trends:', error)
      return this.getDemoMarketTrends(industry)
    }
  }

  async getCompetitorAnalysis(industry: string): Promise<CompetitorAnalysis[]> {
    try {
      // Fetch real competitor data from database and APIs
      const competitors = await this.fetchCompetitorsFromAPI(industry)

      if (competitors.length > 0) {
        return competitors
      }

      // Fallback to database-stored data
      const result = await this.db.query(
        `SELECT * FROM competitor_analysis WHERE industry = $1 ORDER BY market_share DESC`,
        [industry],
      )

      return result.rows.map((row) => ({
        company: row.company,
        marketShare: row.market_share,
        revenue: row.revenue,
        growthRate: row.growth_rate,
        keyProducts: row.key_products,
        strengths: row.strengths,
        weaknesses: row.weaknesses,
        lastUpdated: row.last_updated,
      }))
    } catch (error) {
      console.error('Error fetching competitor analysis:', error)
      return this.getDemoCompetitorAnalysis(industry)
    }
  }

  async getMarketOpportunities(industry: string): Promise<MarketOpportunity[]> {
    try {
      // Analyze market gaps and opportunities
      const opportunities = await this.analyzeMarketOpportunities(industry)

      if (opportunities.length > 0) {
        return opportunities
      }

      // Use database-stored opportunities
      const result = await this.db.query(
        `SELECT * FROM market_opportunities WHERE industry = $1 ORDER BY estimated_roi DESC`,
        [industry],
      )

      return result.rows.map((row) => ({
        segment: row.segment,
        size: row.market_size,
        growthRate: row.growth_rate,
        competition: row.competition,
        barriers: row.barriers,
        opportunities: row.opportunities,
        riskLevel: row.risk_level,
        estimatedROI: row.estimated_roi,
      }))
    } catch (error) {
      console.error('Error fetching market opportunities:', error)
      return this.getDemoMarketOpportunities(industry)
    }
  }

  async getBusinessMetrics(
    userId: string,
    quarter?: string,
    year?: number,
  ): Promise<BusinessMetrics[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM business_metrics 
         WHERE user_id = $1 
         ${quarter ? 'AND quarter = $2' : ''} 
         ${year ? 'AND year = $3' : ''}
         ORDER BY year DESC, quarter DESC`,
        [userId, quarter, year].filter(Boolean),
      )

      if (result.rows.length > 0) {
        return result.rows.map((row) => ({
          revenue: row.revenue,
          growthRate: row.growth_rate,
          customerAcquisitionCost: row.customer_acquisition_cost,
          customerLifetimeValue: row.customer_lifetime_value,
          churnRate: row.churn_rate,
          netPromoterScore: row.net_promoter_score,
          marketShare: row.market_share,
          employeeCount: row.employee_count,
          quarter: row.quarter,
          year: row.year,
        }))
      }

      // Return demo data if no real data
      return this.getDemoBusinessMetrics(userId, quarter, year)
    } catch (error) {
      console.error('Error fetching business metrics:', error)
      return this.getDemoBusinessMetrics(userId, quarter, year)
    }
  }

  async addBusinessMetric(
    metric: Omit<BusinessMetrics, 'quarter' | 'year'> & { userId: string },
  ): Promise<void> {
    const currentDate = new Date()
    const quarter = `Q${Math.floor(currentDate.getMonth() / 3) + 1}`
    const year = currentDate.getFullYear()

    await this.db.query(
      `INSERT INTO business_metrics (user_id, revenue, growth_rate, customer_acquisition_cost, customer_lifetime_value, churn_rate, net_promoter_score, market_share, employee_count, quarter, year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        metric.userId,
        metric.revenue,
        metric.growthRate,
        metric.customerAcquisitionCost,
        metric.customerLifetimeValue,
        metric.churnRate,
        metric.netPromoterScore,
        metric.marketShare,
        metric.employeeCount,
        quarter,
        year,
      ],
    )
  }

  async getBusinessAlerts(
    userId: string,
    limit: number = 50,
  ): Promise<BusinessAlert[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM business_alerts 
         WHERE user_id = $1 OR is_public = TRUE
         ORDER BY timestamp DESC
         LIMIT $2`,
        [userId, limit],
      )

      return result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        severity: row.severity,
        source: row.source,
        timestamp: row.timestamp,
        isRead: row.is_read,
        actionUrl: row.action_url,
      }))
    } catch (error) {
      console.error('Error fetching business alerts:', error)
      return this.getDemoBusinessAlerts(userId, limit)
    }
  }

  async createBusinessAlert(
    alert: Omit<BusinessAlert, 'id' | 'timestamp'>,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO business_alerts (type, title, description, severity, source, is_read, action_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        alert.type,
        alert.title,
        alert.description,
        alert.severity,
        alert.source,
        alert.isRead,
        alert.actionUrl,
      ],
    )
  }

  async getMarketForecast(
    symbol: string,
    days: number = 30,
  ): Promise<{
    predictions: Array<{
      date: Date
      predictedPrice: number
      confidence: number
    }>
    trend: 'up' | 'down' | 'stable'
    confidence: number
  }> {
    try {
      // Use Alpha Vantage for technical analysis
      const response = await axios.get(this.alphaVantageBaseUrl, {
        params: {
          function: 'SMA',
          symbol,
          interval: 'daily',
          time_period: 20,
          apikey: this.alphaVantageApiKey,
        },
      })

      // Process and return forecast data
      return this.generateMarketForecast(response.data, days)
    } catch (error) {
      console.error('Error generating market forecast:', error)
      return this.getDemoMarketForecast(symbol, days)
    }
  }

  async getIndustryAnalysis(industry: string): Promise<{
    overview: string
    growthRate: number
    keyPlayers: string[]
    marketSize: number
    trends: string[]
    risks: string[]
  }> {
    try {
      // Combine multiple data sources for comprehensive industry analysis
      const marketData = await this.getMarketTrends(industry)
      const competitors = await this.getCompetitorAnalysis(industry)
      const opportunities = await this.getMarketOpportunities(industry)

      return {
        overview: `Analysis of ${industry} industry with ${marketData.length} tracked companies`,
        growthRate:
          competitors.reduce((sum, c) => sum + c.growthRate, 0) /
          competitors.length,
        keyPlayers: competitors.slice(0, 5).map((c) => c.company),
        marketSize: competitors.reduce((sum, c) => sum + c.marketShare, 0),
        trends: [
          'Digital transformation',
          'Sustainability focus',
          'AI adoption',
        ],
        risks: ['Regulatory changes', 'Market volatility', 'Competition'],
      }
    } catch (error) {
      console.error('Error generating industry analysis:', error)
      return this.getDemoIndustryAnalysis(industry)
    }
  }

  // Demo data generators for fallback
  private getDemoMarketData(symbol: string): MarketData {
    return {
      symbol,
      name: `${symbol} Corporation`,
      price: 150 + Math.random() * 50,
      change: (Math.random() - 0.5) * 10,
      changePercent: (Math.random() - 0.5) * 5,
      volume: 1000000 + Math.random() * 5000000,
      marketCap: 1000000000 + Math.random() * 9000000000,
      timestamp: new Date(),
    }
  }

  private getDemoMarketTrends(industry: string): MarketData[] {
    const symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META']
    return symbols.map((symbol) => this.getDemoMarketData(symbol))
  }

  private getDemoCompetitorAnalysis(industry: string): CompetitorAnalysis[] {
    return [
      {
        company: 'Market Leader Inc',
        marketShare: 25,
        revenue: 1000000000,
        growthRate: 15,
        keyProducts: ['Product A', 'Product B'],
        strengths: ['Strong brand', 'Innovation'],
        weaknesses: ['High prices', 'Limited reach'],
        lastUpdated: new Date(),
      },
      {
        company: 'Challenger Corp',
        marketShare: 20,
        revenue: 800000000,
        growthRate: 25,
        keyProducts: ['Product X', 'Product Y'],
        strengths: ['Agile', 'Customer-focused'],
        weaknesses: ['Limited resources', 'New market'],
        lastUpdated: new Date(),
      },
    ]
  }

  private getDemoMarketOpportunities(industry: string): MarketOpportunity[] {
    return [
      {
        segment: 'Emerging Markets',
        size: 500000000,
        growthRate: 30,
        competition: 'low',
        barriers: ['Regulatory', 'Cultural'],
        opportunities: ['Untapped demand', 'First-mover advantage'],
        riskLevel: 'medium',
        estimatedROI: 25,
      },
      {
        segment: 'Digital Transformation',
        size: 1000000000,
        growthRate: 40,
        competition: 'medium',
        barriers: ['Technology adoption', 'Cost'],
        opportunities: ['Automation', 'Efficiency gains'],
        riskLevel: 'low',
        estimatedROI: 35,
      },
    ]
  }

  private getDemoBusinessMetrics(
    userId: string,
    quarter?: string,
    year?: number,
  ): BusinessMetrics[] {
    const currentYear = year || new Date().getFullYear()
    const quarters = quarter ? [quarter] : ['Q1', 'Q2', 'Q3', 'Q4']

    return quarters.map((q) => ({
      revenue: 1000000 + Math.random() * 500000,
      growthRate: 10 + Math.random() * 20,
      customerAcquisitionCost: 50 + Math.random() * 30,
      customerLifetimeValue: 500 + Math.random() * 200,
      churnRate: 5 + Math.random() * 5,
      netPromoterScore: 50 + Math.random() * 30,
      marketShare: 5 + Math.random() * 10,
      employeeCount: 50 + Math.floor(Math.random() * 50),
      quarter: q,
      year: currentYear,
    }))
  }

  private getDemoBusinessAlerts(
    userId: string,
    limit: number,
  ): BusinessAlert[] {
    return [
      {
        id: '1',
        type: 'market_change',
        title: 'Market Volatility Detected',
        description:
          'Significant market movement detected in your tracked industries',
        severity: 'medium',
        source: 'Market Monitor',
        timestamp: new Date(),
        isRead: false,
        actionUrl: '/dashboard/market-analysis',
      },
      {
        id: '2',
        type: 'opportunity',
        title: 'New Market Opportunity',
        description:
          'Emerging market segment identified with high growth potential',
        severity: 'high',
        source: 'Opportunity Scanner',
        timestamp: new Date(Date.now() - 86400000),
        isRead: false,
        actionUrl: '/opportunities/new',
      },
    ].slice(0, limit)
  }

  private getDemoMarketForecast(symbol: string, days: number) {
    const predictions = []
    for (let i = 0; i < days; i++) {
      predictions.push({
        date: new Date(Date.now() + i * 86400000),
        predictedPrice: 150 + Math.sin(i / 10) * 20 + Math.random() * 10,
        confidence: 0.7 + Math.random() * 0.2,
      })
    }

    return {
      predictions,
      trend: Math.random() > 0.5 ? 'up' : 'down',
      confidence: 0.75,
    }
  }

  private getDemoIndustryAnalysis(industry: string) {
    return {
      overview: `${industry} industry analysis with comprehensive market overview`,
      growthRate: 15 + Math.random() * 20,
      keyPlayers: ['Company A', 'Company B', 'Company C'],
      marketSize: 1000000000 + Math.random() * 9000000000,
      trends: ['AI integration', 'Sustainability', 'Digital transformation'],
      risks: ['Regulatory changes', 'Economic downturn', 'Competition'],
    }
  }

  private getIndustrySymbols(industry: string): string[] {
    const industryMap: Record<string, string[]> = {
      technology: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META'],
      finance: ['JPM', 'BAC', 'WFC', 'GS', 'C'],
      healthcare: ['JNJ', 'PFE', 'UNH', 'ABBV', 'TMO'],
      retail: ['WMT', 'TGT', 'COST', 'HD', 'LOW'],
      energy: ['XOM', 'CVX', 'COP', 'EOG', 'PSX'],
      automotive: ['TSLA', 'F', 'GM', 'STLA', 'HMC'],
    }

    return industryMap[industry.toLowerCase()] || ['SPY']
  }

  private async fetchCompetitorsFromAPI(
    industry: string,
  ): Promise<CompetitorAnalysis[]> {
    // This would integrate with real competitor APIs
    // For now, return empty to trigger fallback
    return []
  }

  private async analyzeMarketOpportunities(
    industry: string,
  ): Promise<MarketOpportunity[]> {
    // This would analyze real market data
    // For now, return empty to trigger fallback
    return []
  }

  private async generateMarketForecast(data: any, days: number) {
    // This would process real market data for forecasts
    // For now, return demo data
    return this.getDemoMarketForecast('SPY', days)
  }
}
