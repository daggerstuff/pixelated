import { Router } from 'express'
import { authenticateToken } from '@/middleware/auth'
import { MarketDataService } from '@/services/marketDataService'
import { logger } from '@/utils/logger'
import type { AuthenticatedRequest } from '@/middleware/auth'

const router = Router()

// All market data endpoints require authentication
router.use(authenticateToken)

// Initialize market data service
const marketDataService = new MarketDataService()

/**
 * GET /api/market/quote/:symbol
 * Get comprehensive market data for a symbol
 */
router.get('/quote/:symbol', async (req: AuthenticatedRequest, res) => {
  try {
    const { symbol } = req.params

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: { message: 'Symbol is required' },
      })
    }

    const data = await marketDataService.getComprehensiveMarketData(symbol)

    if (!data) {
      return res.status(404).json({
        success: false,
        error: { message: 'Symbol not found' },
      })
    }

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    logger.error('Quote error:', error)
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get quote' },
    })
  }
})

/**
 * POST /api/market/bulk
 * Get comprehensive market data for multiple symbols
 */
router.post('/bulk', async (req: AuthenticatedRequest, res) => {
  try {
    const { symbols } = req.body

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Symbols array is required' },
      })
    }

    const data = await marketDataService.getBulkMarketData(symbols)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    logger.error('Bulk data error:', error)
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get bulk market data' },
    })
  }
})

/**
 * GET /api/market/technical/:symbol
 * Get technical analysis for a symbol
 */
router.get('/technical/:symbol', async (req: AuthenticatedRequest, res) => {
  try {
    const { symbol } = req.params

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: { message: 'Symbol is required' },
      })
    }

    const data = await marketDataService.getTechnicalAnalysis(symbol)

    if (!data) {
      return res.status(404).json({
        success: false,
        error: { message: 'Technical analysis not available' },
      })
    }

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    logger.error('Technical analysis error:', error)
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get technical analysis' },
    })
  }
})

/**
 * GET /api/market/sectors
 * Get sector performance analysis
 */
router.get('/sectors', async (_req: AuthenticatedRequest, res) => {
  try {
    const data = await marketDataService.getSectorPerformance()

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    logger.error('Sectors error:', error)
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get sector data' },
    })
  }
})

/**
 * GET /api/market/economic
 * Get economic indicators
 */
router.get('/economic', async (_req: AuthenticatedRequest, res) => {
  try {
    const data = await marketDataService.getEconomicIndicators()

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    logger.error('Economic indicators error:', error)
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get economic indicators' },
    })
  }
})

/**
 * GET /api/market/sentiment/:symbol
 * Get market sentiment analysis
 */
router.get('/sentiment/:symbol', async (req: AuthenticatedRequest, res) => {
  try {
    const { symbol } = req.params

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: { message: 'Symbol is required' },
      })
    }

    const data = await marketDataService.getMarketSentiment(symbol)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    logger.error('Sentiment error:', error)
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get market sentiment' },
    })
  }
})

export { router as marketRouter }
