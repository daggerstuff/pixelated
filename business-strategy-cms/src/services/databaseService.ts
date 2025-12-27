import {
  BusinessMetrics,
  MarketData,
  CompetitorAnalysis,
  KPIDashboard,
  BusinessAlert,
} from '../types/business-intelligence'
import { postgresPool } from '@/config/database'

export class DatabaseService {
  /**
   * Store market data in PostgreSQL
   */
  async storeMarketData(marketData: MarketData): Promise<void> {
    const sql = `
      INSERT INTO market_data (
        id, industry, market_size, growth_rate, competition_level,
        entry_barriers, customer_acquisition_cost, lifetime_value,
        segments, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        industry = EXCLUDED.industry,
        market_size = EXCLUDED.market_size,
        growth_rate = EXCLUDED.growth_rate,
        competition_level = EXCLUDED.competition_level,
        entry_barriers = EXCLUDED.entry_barriers,
        customer_acquisition_cost = EXCLUDED.customer_acquisition_cost,
        lifetime_value = EXCLUDED.lifetime_value,
        segments = EXCLUDED.segments,
        timestamp = EXCLUDED.timestamp
    `

    await postgresPool.query(sql, [
      marketData.id,
      marketData.industry,
      marketData.marketSize,
      marketData.growthRate,
      marketData.competitionLevel,
      marketData.entryBarriers,
      marketData.customerAcquisitionCost,
      marketData.lifetimeValue,
      JSON.stringify(marketData.segments),
      marketData.timestamp,
    ])
  }

  /**
   * Store competitor analysis in PostgreSQL
   */
  async storeCompetitorAnalysis(analysis: CompetitorAnalysis): Promise<void> {
    const sql = `
      INSERT INTO competitor_analysis (
        competitors, market_leader, avg_pricing, market_share_distribution,
        feature_frequency, competitive_gaps, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        competitors = EXCLUDED.competitors,
        market_leader = EXCLUDED.market_leader,
        avg_pricing = EXCLUDED.avg_pricing,
        market_share_distribution = EXCLUDED.market_share_distribution,
        feature_frequency = EXCLUDED.feature_frequency,
        competitive_gaps = EXCLUDED.competitive_gaps,
        last_updated = EXCLUDED.last_updated
    `

    await postgresPool.query(sql, [
      analysis.competitors,
      analysis.marketLeader,
      analysis.avgPricing,
      JSON.stringify(analysis.marketShareDistribution),
      JSON.stringify(analysis.featureFrequency),
      JSON.stringify(analysis.competitiveGaps),
      analysis.lastUpdated,
    ])
  }

  /**
   * Get market data by industry
   */
  async getMarketData(industry: string): Promise<MarketData[]> {
    const sql = `
      SELECT * FROM market_data 
      WHERE industry = $1 
      ORDER BY timestamp DESC 
      LIMIT 100
    `
    const result = await postgresPool.query(sql, [industry])

    return result.rows.map((row) => ({
      id: row.id,
      industry: row.industry,
      marketSize: row.market_size,
      growthRate: row.growth_rate,
      competitionLevel: row.competition_level,
      entryBarriers: row.entry_barriers,
      customerAcquisitionCost: row.customer_acquisition_cost,
      lifetimeValue: row.lifetime_value,
      segments: JSON.parse(row.segments || '[]'),
      timestamp: row.timestamp,
    }))
  }

  /**
   * Store business metrics in PostgreSQL
   */
  async storeBusinessMetrics(metrics: BusinessMetrics): Promise<void> {
    const sql = `
      INSERT INTO business_metrics (
        revenue, growth_rate, customer_acquisition_cost, customer_lifetime_value,
        churn_rate, net_promoter_score, market_share
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `

    await postgresPool.query(sql, [
      metrics.revenue,
      metrics.growthRate,
      metrics.customerAcquisitionCost,
      metrics.customerLifetimeValue,
      metrics.churnRate,
      metrics.netPromoterScore,
      metrics.marketShare,
    ])
  }

  /**
   * Get latest business metrics
   */
  async getLatestBusinessMetrics(): Promise<BusinessMetrics> {
    const sql = `
      SELECT * FROM business_metrics 
      ORDER BY created_at DESC 
      LIMIT 1
    `
    const result = await postgresPool.query(sql)

    if (result.rows.length === 0) {
      return {
        revenue: 0,
        growthRate: 0,
        customerAcquisitionCost: 0,
        customerLifetimeValue: 0,
        churnRate: 0,
        netPromoterScore: 0,
        marketShare: 0,
      }
    }

    const row = result.rows[0]
    return {
      revenue: row.revenue,
      growthRate: row.growth_rate,
      customerAcquisitionCost: row.customer_acquisition_cost,
      customerLifetimeValue: row.customer_lifetime_value,
      churnRate: row.churn_rate,
      netPromoterScore: row.net_promoter_score,
      marketShare: row.market_share,
    }
  }

  /**
   * Store KPI dashboard in PostgreSQL
   */
  async storeKPIDashboard(dashboard: KPIDashboard): Promise<void> {
    const sql = `
      INSERT INTO kpi_dashboards (
        id, name, metrics, widgets, last_updated, is_shared
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        metrics = EXCLUDED.metrics,
        widgets = EXCLUDED.widgets,
        last_updated = EXCLUDED.last_updated,
        is_shared = EXCLUDED.is_shared
    `

    await postgresPool.query(sql, [
      dashboard.id,
      dashboard.name,
      JSON.stringify(dashboard.metrics),
      JSON.stringify(dashboard.widgets),
      dashboard.lastUpdated,
      dashboard.isShared,
    ])
  }

  /**
   * Get KPI dashboard
   */
  async getKPIDashboard(id: string): Promise<KPIDashboard | null> {
    const sql = `SELECT * FROM kpi_dashboards WHERE id = $1`
    const result = await postgresPool.query(sql, [id])

    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      id: row.id,
      name: row.name,
      metrics: JSON.parse(row.metrics || '{}'),
      widgets: JSON.parse(row.widgets || '[]'),
      lastUpdated: row.last_updated,
      isShared: row.is_shared,
    }
  }

  /**
   * Store business alert in PostgreSQL
   */
  async storeBusinessAlert(alert: BusinessAlert): Promise<void> {
    const sql = `
      INSERT INTO business_alerts (
        id, type, title, description, severity, conditions, recipients,
        is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        severity = EXCLUDED.severity,
        conditions = EXCLUDED.conditions,
        recipients = EXCLUDED.recipients,
        is_active = EXCLUDED.is_active
    `

    await postgresPool.query(sql, [
      alert.id,
      alert.type,
      alert.title,
      alert.description,
      alert.severity,
      JSON.stringify(alert.conditions),
      JSON.stringify(alert.recipients),
      alert.isActive,
      alert.createdAt,
    ])
  }

  /**
   * Get active business alerts
   */
  async getActiveBusinessAlerts(): Promise<BusinessAlert[]> {
    const sql = `SELECT * FROM business_alerts WHERE is_active = true ORDER BY created_at DESC`
    const result = await postgresPool.query(sql)

    return result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      severity: row.severity,
      conditions: JSON.parse(row.conditions || '[]'),
      recipients: JSON.parse(row.recipients || '[]'),
      isActive: row.is_active,
      createdAt: row.created_at,
    }))
  }

  /**
   * Get historical market data
   */
  async getHistoricalMarketData(
    industry: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MarketData[]> {
    const sql = `
      SELECT * FROM market_data 
      WHERE industry = $1 AND timestamp BETWEEN $2 AND $3
      ORDER BY timestamp DESC
    `

    const result = await postgresPool.query(sql, [industry, startDate, endDate])

    return result.rows.map((row) => ({
      id: row.id,
      industry: row.industry,
      marketSize: row.market_size,
      growthRate: row.growth_rate,
      competitionLevel: row.competition_level,
      entryBarriers: row.entry_barriers,
      customerAcquisitionCost: row.customer_acquisition_cost,
      lifetimeValue: row.lifetime_value,
      segments: JSON.parse(row.segments || '[]'),
      timestamp: row.timestamp,
    }))
  }

  /**
   * Get trend analysis
   */
  async getTrendAnalysis(
    metric: string,
    period: 'week' | 'month' | 'quarter' | 'year',
  ): Promise<any[]> {
    const periodMap = {
      week: 7,
      month: 30,
      quarter: 90,
      year: 365,
    }

    const days = periodMap[period]
    const sql = `
      SELECT 
        DATE(created_at) as date,
        AVG(${metric}) as value
      FROM business_metrics 
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `

    const result = await postgresPool.query(sql)
    return result.rows
  }

  /**
   * Get dashboard metrics summary
   */
  async getDashboardMetrics(): Promise<{
    totalRevenue: number
    totalCustomers: number
    avgCustomerLifetimeValue: number
    monthlyGrowthRate: number
  }> {
    const sql = `
      SELECT 
        COALESCE(SUM(revenue), 0) as total_revenue,
        COALESCE(COUNT(DISTINCT id), 0) as total_customers,
        COALESCE(AVG(customer_lifetime_value), 0) as avg_clv,
        COALESCE(AVG(growth_rate), 0) as monthly_growth_rate
      FROM business_metrics
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `

    const result = await postgresPool.query(sql)
    const row = result.rows[0]

    return {
      totalRevenue: row.total_revenue,
      totalCustomers: row.total_customers,
      avgCustomerLifetimeValue: row.avg_clv,
      monthlyGrowthRate: row.monthly_growth_rate,
    }
  }

  /**
   * Get all KPI dashboards
   */
  async getAllKPIDashboards(): Promise<KPIDashboard[]> {
    const sql = `SELECT * FROM kpi_dashboards ORDER BY last_updated DESC`
    const result = await postgresPool.query(sql)

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      metrics: JSON.parse(row.metrics || '{}'),
      widgets: JSON.parse(row.widgets || '[]'),
      lastUpdated: row.last_updated,
      isShared: row.is_shared,
    }))
  }

  /**
   * Delete business alert
   */
  async deleteBusinessAlert(id: string): Promise<void> {
    const sql = `DELETE FROM business_alerts WHERE id = $1`
    await postgresPool.query(sql, [id])
  }

  /**
   * Update business alert status
   */
  async updateBusinessAlertStatus(
    id: string,
    isActive: boolean,
  ): Promise<void> {
    const sql = `UPDATE business_alerts SET is_active = $1 WHERE id = $2`
    await postgresPool.query(sql, [isActive, id])
  }

  /**
   * Get market data statistics
   */
  async getMarketDataStats(): Promise<{
    totalIndustries: number
    avgMarketSize: number
    avgGrowthRate: number
  }> {
    const sql = `
      SELECT 
        COUNT(DISTINCT industry) as total_industries,
        COALESCE(AVG(market_size), 0) as avg_market_size,
        COALESCE(AVG(growth_rate), 0) as avg_growth_rate
      FROM market_data
    `

    const result = await postgresPool.query(sql)
    const row = result.rows[0]

    return {
      totalIndustries: row.total_industries,
      avgMarketSize: row.avg_market_size,
      avgGrowthRate: row.avg_growth_rate,
    }
  }
}
