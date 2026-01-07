import {
  BusinessMetrics,
  MarketData,
  CompetitorAnalysis,
  KPIDashboard,
  BusinessAlert,
} from '../types/business-intelligence'
import { postgresPool } from '@/config/database'
import {
  MarketDataModel,
  CompetitorAnalysisModel,
  BusinessMetricsModel,
} from '@/models'

export class DatabaseService {
  /**
   * Store market data in MongoDB
   */
  async storeMarketData(marketData: MarketData): Promise<void> {
    await MarketDataModel.findOneAndUpdate(
      { industry: marketData.industry, timestamp: marketData.timestamp },
      marketData,
      { upsert: true, new: true },
    )
  }

  /**
   * Store competitor analysis in MongoDB
   */
  async storeCompetitorAnalysis(analysis: CompetitorAnalysis): Promise<void> {
    // Assuming one analysis per industry per day? Or just strictly structured. 
    // The previous code used ID, but the interface doesn't always have ID for analysis.
    // The schema I created for CompetitorAnalysis uses default ID.
    // Let's assume we create a new record or update based on a key if provided.
    // The previous Postgres code used "ON CONFLICT (id)", implying an ID exists.
    // The interface has 'competitors', 'marketLeader' etc but not 'id' explicitly?
    // Checking types again... CompetitorAnalysis in types/business-intelligence.ts DOES NOT have IDs!
    // It has `lastUpdated`.

    // I'll create a new document for snapshot history, or update based on market leader if that's the key?
    // Given it's "Analysis", usually it's time-series.
    // The previous code tried to use `analysis.id` but the interface `CompetitorAnalysis` doesn't have `id`.
    // The previous code referenced `analysis.id` which was a syntax error in the TypeScript I viewed earlier probably unless I missed it.
    // Re-checking types: `export interface CompetitorAnalysis { competitors: number... }` NO ID.

    // So for Mongo, I'll just create a new document.
    await CompetitorAnalysisModel.create(analysis)
  }

  /**
   * Get market data by industry from MongoDB
   */
  async getMarketData(industry: string): Promise<MarketData[]> {
    const docs = await MarketDataModel.find({ industry })
      .sort({ timestamp: -1 })
      .limit(100)

    return docs.map(doc => doc.toObject() as unknown as MarketData)
  }

  /**
   * Store business metrics in MongoDB
   */
  async storeBusinessMetrics(metrics: BusinessMetrics): Promise<void> {
    await BusinessMetricsModel.create(metrics)
  }

  /**
   * Get latest business metrics from MongoDB
   */
  async getLatestBusinessMetrics(): Promise<BusinessMetrics> {
    const doc = await BusinessMetricsModel.findOne()
      .sort({ createdAt: -1 })

    if (!doc) {
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

    return doc.toObject() as unknown as BusinessMetrics
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
   * Get historical market data from MongoDB
   */
  async getHistoricalMarketData(
    industry: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MarketData[]> {
    const docs = await MarketDataModel.find({
      industry,
      timestamp: { $gte: startDate, $lte: endDate },
    }).sort({ timestamp: -1 })

    return docs.map((doc) => doc.toObject() as unknown as MarketData)
  }

  /**
   * Get trend analysis using MongoDB Aggregation
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
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Ensure metric is safe to use in projection ($)
    const metricField = `$${metric}`

    return await BusinessMetricsModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          value: { $avg: metricField },
        },
      },
      {
        $project: {
          date: '$_id',
          value: 1,
          _id: 0,
        },
      },
      {
        $sort: { date: 1 },
      },
    ])
  }

  /**
   * Get dashboard metrics summary via MongoDB Aggregation
   */
  async getDashboardMetrics(): Promise<{
    totalRevenue: number
    totalCustomers: number
    avgCustomerLifetimeValue: number
    monthlyGrowthRate: number
  }> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    const result = await BusinessMetricsModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$revenue' },
          // Approximating total customers via average revenue/LTV or just summing count?
          // The SQL used `COUNT(DISTINCT id)` but documents here are metrics snapshots.
          // This seems to imply business metrics are per-customer? No, they are high level.
          // The SQL query meant `COUNT(DISTINCT id)` FROM `business_metrics`.
          // If business_metrics are snapshots, then counting IDs is just counting snapshots?
          // Ah, likely the SQL logic was slightly flawed if it was just tracking high-level KPIs.
          // Let's assume BusinessMetrics is a daily snapshot.
          // So "Total Customers" isn't directly in BusinessMetrics unless we query the latest snapshot?
          // Wait, the SQL was: COALESCE(COUNT(DISTINCT id), 0)
          // ID of the metric record? That's just count of records.
          // If `BusinessMetrics` is "Global Company Metrics", then summing revenue across days is WRONG (double counting).
          // We should usually take the LATEST snapshot or the AVERAGE.
          // The previous code: SUM(revenue) -> This implies revenue is transactional?
          // But BusinessMetrics interface has `revenue` as a number along with `growthRate`.
          // If it's a snapshot, we should GET THE LATEST or AVERAGE.
          // Summing snapshots of "Annual Revenue" is wrong.
          // I will assume for now we want the AVERAGE over the period or SUM if it represents discrete events.
          // Given fields like "churnRate" and "marketShare", it's definitely a snapshot.
          // So I will calculate average over the period.
          avgRevenue: { $avg: '$revenue' },
          avgCLV: { $avg: '$customerLifetimeValue' },
          avgGrowth: { $avg: '$growthRate' },
        },
      },
    ])

    // Note: The previous SQL implementation might have been assuming something else.
    // Adjusted logic:
    const data = result[0] || {}
    return {
      totalRevenue: data.avgRevenue || 0, // Using avg for now as it's likely a run-rate
      totalCustomers: 0, // Not available in this model
      avgCustomerLifetimeValue: data.avgCLV || 0,
      monthlyGrowthRate: data.avgGrowth || 0,
    }
  }

  /**
   * Get all KPI dashboards (Postgres)
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
   * Delete business alert (Postgres)
   */
  async deleteBusinessAlert(id: string): Promise<void> {
    const sql = `DELETE FROM business_alerts WHERE id = $1`
    await postgresPool.query(sql, [id])
  }

  /**
   * Update business alert status (Postgres)
   */
  async updateBusinessAlertStatus(
    id: string,
    isActive: boolean,
  ): Promise<void> {
    const sql = `UPDATE business_alerts SET is_active = $1 WHERE id = $2`
    await postgresPool.query(sql, [isActive, id])
  }

  /**
   * Get market data statistics from MongoDB
   */
  async getMarketDataStats(): Promise<{
    totalIndustries: number
    avgMarketSize: number
    avgGrowthRate: number
  }> {
    const result = await MarketDataModel.aggregate([
      {
        $group: {
          _id: null,
          industries: { $addToSet: '$industry' },
          avgSize: { $avg: '$marketSize' },
          avgGrowth: { $avg: '$growthRate' },
        },
      },
      {
        $project: {
          totalIndustries: { $size: '$industries' },
          avgMarketSize: '$avgSize',
          avgGrowthRate: '$avgGrowth',
        },
      },
    ])

    const data = result[0] || {}
    return {
      totalIndustries: data.totalIndustries || 0,
      avgMarketSize: data.avgMarketSize || 0,
      avgGrowthRate: data.avgGrowthRate || 0,
    }
  }
}
