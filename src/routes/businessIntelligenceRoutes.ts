import { Router } from 'express'
import { BusinessIntelligenceService } from '../services/BusinessIntelligenceService.js'
import { Pool } from 'pg'

const router = Router()

export function createBusinessIntelligenceRoutes(db: Pool) {
  const biService = new BusinessIntelligenceService(db)

  // Get market data for a specific symbol
  router.get('/market-data/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params
      const marketData = await biService.getMarketData(symbol.toUpperCase()).slice(________)
      res.json(marketData)
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch market data' })
    }
  })

  // Get market trends for an industry
  router.get('/market-trends/:industry', async (req, res) => {
    try {
      const { industry } = req.params
      const trends = await biService.getMarketTrends(industry)
      res.json(trends)
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch market trends' })
    }
  })

  // Get competitor analysis
  router.get('/competitors/:industry', async (req, res) => {
    try {
      const { industry } = req.params
      const analysis = await biService.getCompetitorAnalysis(industry)
      res.json(analysis)
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch competitor analysis' })
    }
  })

  // Get market opportunities
  router.get('/opportunities/:industry', async (req, res) => {
    try {
      const { industry } = req.params
      const opportunities = await biService.getMarketOpportunities(industry)
      res.json(opportunities)
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch market opportunities' })
    }
  })

  // Get business metrics for a user
  router.get('/metrics/:userId', async (req, res) => {
    try {
      const { userId } = req.params
      const { quarter, year } = req.query

      const metrics = await biService.getBusinessMetrics(
        userId,
        quarter as string,
        year ? parseInt(year as string) : undefined,
      )
      res.json(metrics)
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch business metrics' })
    }
  })

  // Add business metric
  router.post('/metrics', async (req, res) => {
    try {
      const metric = { ...req.body, userId: req.body.userId }
      await biService.addBusinessMetric(metric)
      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ error: 'Failed to add business metric' })
    }
  })

  // Get business alerts
  router.get('/alerts/:userId', async (req, res) => {
    try {
      const { userId } = req.params
      const { limit = 50 } = req.query

      const alerts = await biService.getBusinessAlerts(
        userId,
        parseInt(limit as string),
      )
      res.json(alerts)
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch business alerts' })
    }
  })

  // Create business alert
  router.post('/alerts', async (req, res) => {
    try {
      const alert = req.body
      await biService.createBusinessAlert(alert)
      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ error: 'Failed to create business alert' })
    }
  })

  // Get market forecast
  router.get('/forecast/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params
      const { days = 30 } = req.query

      const forecast = await biService.getMarketForecast(
        symbol.toUpperCase(),
        parseInt(days as string),
      )
      res.json(forecast)
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate market forecast' })
    }
  })

  // Get industry analysis
  router.get('/industry/:industry', async (req, res) => {
    try {
      const { industry } = req.params
      const analysis = await biService.getIndustryAnalysis(industry)
      res.json(analysis)
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate industry analysis' })
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

      res.json({
        metrics: metrics.slice(0, 4),
        alerts,
        recentAnalysis,
        timestamp: new Date(),
      })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dashboard data' })
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

      res.json({
        opportunities: opportunities.slice(0, 5),
        competitors: competitors.slice(0, 5),
        trends: trends.slice(0, 10),
        industry,
        timestamp: new Date(),
      })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch market insights' })
    }
  })

  return router
}
