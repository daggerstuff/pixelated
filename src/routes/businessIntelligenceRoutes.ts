import { Router } from 'express'
import { Pool } from 'pg'

import {
  BusinessIntelligenceService,
  type BusinessAlert,
  type BusinessMetrics,
} from '../services/BusinessIntelligenceService.js'

const router = Router()

export function createBusinessIntelligenceRoutes(db: Pool) {
  const biService = new BusinessIntelligenceService(db)
  type AddBusinessMetricInput = Omit<BusinessMetrics, 'quarter' | 'year'> & {
    userId: string
  }
  type CreateBusinessAlertInput = Omit<BusinessAlert, 'id' | 'timestamp'>

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

  const parseString = (value: unknown): string | undefined =>
    typeof value === 'string' && value !== '' ? value : undefined

  const parseNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined
    }

    if (typeof value === 'string' && value !== '') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : undefined
    }

    return undefined
  }

  const parseBoolean = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') {
      return value
    }

    return undefined
  }

  const parseAlert = (value: unknown): CreateBusinessAlertInput | undefined => {
    if (!isRecord(value)) {
      return undefined
    }

    return {
      type: parseString(value.type) as CreateBusinessAlertInput['type'],
      title: parseString(value.title) ?? '',
      description: parseString(value.description) ?? '',
      severity: parseString(
        value.severity,
      ) as CreateBusinessAlertInput['severity'],
      source: parseString(value.source) ?? '',
      isRead: parseBoolean(value.isRead) ?? false,
      actionUrl: parseString(value.actionUrl),
    }
  }

  const parseMetric = (value: unknown): AddBusinessMetricInput | undefined => {
    if (!isRecord(value)) {
      return undefined
    }

    const userId = parseString(value.userId)
    if (!userId) {
      return undefined
    }

    return {
      userId,
      revenue: parseNumber(value.revenue) ?? 0,
      growthRate: parseNumber(value.growthRate) ?? 0,
      customerAcquisitionCost: parseNumber(value.customerAcquisitionCost) ?? 0,
      customerLifetimeValue: parseNumber(value.customerLifetimeValue) ?? 0,
      churnRate: parseNumber(value.churnRate) ?? 0,
      netPromoterScore: parseNumber(value.netPromoterScore) ?? 0,
      marketShare: parseNumber(value.marketShare) ?? 0,
      employeeCount: parseNumber(value.employeeCount) ?? 0,
    }
  }

  const parseQueryNumber = (value: unknown, fallback: number): number => {
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10)
      return Number.isNaN(parsed) ? fallback : parsed
    }
    return fallback
  }

  const parseQueryNumberOrUndefined = (value: unknown): number | undefined => {
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10)
      return Number.isNaN(parsed) ? undefined : parsed
    }
    return undefined
  }

  // Get market data for a specific symbol
  router.get('/market-data/:symbol', async (req, res) => {
    try {
      const symbol = req.params['symbol']
      if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' })
      }

      const marketData = await biService.getMarketData(symbol.toUpperCase())
      return res.json(marketData)
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Failed to fetch market data' })
    }
  })

  // Get market trends for an industry
  router.get('/market-trends/:industry', async (req, res) => {
    try {
      const { industry } = req.params
      const trends = await biService.getMarketTrends(industry)
      return res.json(trends)
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Failed to fetch market trends' })
    }
  })

  // Get competitor analysis
  router.get('/competitors/:industry', async (req, res) => {
    try {
      const { industry } = req.params
      const analysis = await biService.getCompetitorAnalysis(industry)
      return res.json(analysis)
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ error: 'Failed to fetch competitor analysis' })
    }
  })

  // Get market opportunities
  router.get('/opportunities/:industry', async (req, res) => {
    try {
      const { industry } = req.params
      const opportunities = await biService.getMarketOpportunities(industry)
      return res.json(opportunities)
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ error: 'Failed to fetch market opportunities' })
    }
  })

  // Get business metrics for a user
  router.get('/metrics/:userId', async (req, res) => {
    try {
      const userId = req.params['userId']
      const quarter = req.query['quarter']
      const year = req.query['year']
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' })
      }

      const metrics = await biService.getBusinessMetrics(
        userId,
        typeof quarter === 'string' ? quarter : undefined,
        parseQueryNumberOrUndefined(year),
      )
      return res.json(metrics)
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Failed to fetch business metrics' })
    }
  })

  // Add business metric
  router.post('/metrics', async (req, res) => {
    try {
      const metric = parseMetric(req.body)
      if (!metric) {
        return res
          .status(400)
          .json({ error: 'Invalid business metric payload' })
      }
      await biService.addBusinessMetric(metric)
      return res.json({ success: true })
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Failed to add business metric' })
    }
  })

  // Get business alerts
  router.get('/alerts/:userId', async (req, res) => {
    try {
      const userId = req.params['userId']
      const limit = parseQueryNumber(req.query['limit'], 50)
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' })
      }

      const alerts = await biService.getBusinessAlerts(
        userId,
        Number.isNaN(limit) ? 50 : limit,
      )
      return res.json(alerts)
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Failed to fetch business alerts' })
    }
  })

  // Create business alert
  router.post('/alerts', async (req, res) => {
    try {
      const alert = parseAlert(req.body)
      if (!alert) {
        return res.status(400).json({ error: 'Invalid business alert payload' })
      }
      await biService.createBusinessAlert(alert)
      return res.json({ success: true })
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Failed to create business alert' })
    }
  })

  // Get market forecast
  router.get('/forecast/:symbol', async (req, res) => {
    try {
      const symbol = req.params['symbol']
      const days = parseQueryNumber(req.query['days'], 30)
      if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' })
      }

      const forecast = await biService.getMarketForecast(
        symbol.toUpperCase(),
        Number.isNaN(days) ? 30 : days,
      )
      return res.json(forecast)
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ error: 'Failed to generate market forecast' })
    }
  })

  // Get industry analysis
  router.get('/industry/:industry', async (req, res) => {
    try {
      const { industry } = req.params
      const analysis = await biService.getIndustryAnalysis(industry)
      return res.json(analysis)
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ error: 'Failed to generate industry analysis' })
    }
  })

  // Get dashboard data
  router.get('/dashboard/:userId', async (req, res) => {
    try {
      const { userId } = req.params

      const [metrics, alerts, recentAnalysis] = await Promise.all([
        biService.getBusinessMetrics(userId),
        biService.getBusinessAlerts(userId, 10),
        biService.getIndustryAnalysis('technology'), // Default industry
      ])

      return res.json({
        metrics: metrics.slice(0, 4),
        alerts,
        recentAnalysis,
        timestamp: new Date(),
      })
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Failed to fetch dashboard data' })
    }
  })

  // Get market insights summary
  router.get('/insights/summary', async (req, res) => {
    try {
      const { industry = 'technology' } = req.query

      const [opportunities, competitors, trends] = await Promise.all([
        biService.getMarketOpportunities(industry as string),
        biService.getCompetitorAnalysis(industry as string),
        biService.getMarketTrends(industry as string),
      ])

      return res.json({
        opportunities: opportunities.slice(0, 5),
        competitors: competitors.slice(0, 5),
        trends: trends.slice(0, 10),
        industry,
        timestamp: new Date(),
      })
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Failed to fetch market insights' })
    }
  })

  return router
}
