import { YahooFinanceService } from './yahooFinanceService'
import { AlphaVantageService } from './alphaVantageService'
import { Logger } from '../utils/logger'

export interface MarketData {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: number
  peRatio: number
  eps: number
  revenue: number
  grossProfit: number
  netIncome: number
  dividendYield: number
  beta: number
  sector: string
  industry: string
  timestamp: Date
}

export interface TechnicalAnalysis {
  symbol: string
  rsi: number
  macd: number
  macdSignal: number
  sma20: number
  sma50: number
  support: number
  resistance: number
  timestamp: Date
}

export interface MarketSector {
  sector: string
  performance: number
  companies: number
  marketCap: number
  avgPERatio: number
  avgDividendYield: number
}

export interface EconomicIndicator {
  name: string
  value: string
  date: string
  impact: 'high' | 'medium' | 'low'
}

export class MarketDataService {
  private logger: Logger
  private yahooService: YahooFinanceService
  private alphaService: AlphaVantageService

  constructor() {
    this.logger = new Logger('MarketDataService')
    this.yahooService = new YahooFinanceService()
    this.alphaService = new AlphaVantageService()
  }

  /**
   * Get comprehensive market data by combining both APIs
   */
  async getComprehensiveMarketData(symbol: string): Promise<MarketData | null> {
    try {
      const [yahooData, alphaFundamentals] = await Promise.all([
        this.yahooService.getQuote(symbol),
        this.alphaService.getFundamentals(symbol),
      ])

      if (!yahooData && !alphaFundamentals) {
        this.logger.warn('No data found for symbol', { symbol })
        return null
      }

      const marketData: MarketData = {
        symbol: symbol.toUpperCase(),
        price: yahooData?.price || 0,
        change: yahooData?.change || 0,
        changePercent: yahooData?.changePercent || 0,
        volume: yahooData?.volume || 0,
        marketCap: yahooData?.marketCap || alphaFundamentals?.marketCap || 0,
        peRatio: alphaFundamentals?.peRatio || 0,
        eps: alphaFundamentals?.eps || 0,
        revenue: alphaFundamentals?.revenue || 0,
        grossProfit: alphaFundamentals?.grossProfit || 0,
        netIncome: alphaFundamentals?.netIncome || 0,
        dividendYield: alphaFundamentals?.dividendYield || 0,
        beta: alphaFundamentals?.beta || 0,
        sector: alphaFundamentals?.sector || 'Unknown',
        industry: alphaFundamentals?.industry || 'Unknown',
        timestamp: new Date(),
      }

      return marketData
    } catch (error) {
      this.logger.error('Failed to get comprehensive market data', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Get bulk market data for multiple symbols
   */
  async getBulkMarketData(symbols: string[]): Promise<MarketData[]> {
    try {
      const promises = symbols.map((symbol) =>
        this.getComprehensiveMarketData(symbol),
      )
      const results = await Promise.allSettled(promises)

      return results
        .filter(
          (result): result is PromiseFulfilledResult<MarketData> =>
            result.status === 'fulfilled' && result.value !== null,
        )
        .map((result) => result.value)
    } catch (error) {
      this.logger.error('Failed to get bulk market data', {
        symbols,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Get technical analysis combining multiple indicators
   */
  async getTechnicalAnalysis(
    symbol: string,
  ): Promise<TechnicalAnalysis | null> {
    try {
      const [rsiData, macdData, sma20Data, sma50Data] = await Promise.all([
        this.alphaService.getTechnicalIndicator(symbol, 'RSI'),
        this.alphaService.getTechnicalIndicator(symbol, 'MACD'),
        this.alphaService.getTechnicalIndicator(symbol, 'SMA', 'daily', 20),
        this.alphaService.getTechnicalIndicator(symbol, 'SMA', 'daily', 50),
      ])

      if (!rsiData.length || !macdData.length) {
        return null
      }

      // Get the latest values
      const latestRSI = rsiData[rsiData.length - 1]?.value || 0
      const latestMACD = macdData[macdData.length - 1]?.value || 0
      const latestMACDSignal = macdData[macdData.length - 1]?.value || 0
      const latestSMA20 = sma20Data[sma20Data.length - 1]?.value || 0
      const latestSMA50 = sma50Data[sma50Data.length - 1]?.value || 0

      // Calculate support/resistance levels (simplified)
      const support = Math.min(latestSMA20, latestSMA50) * 0.95
      const resistance = Math.max(latestSMA20, latestSMA50) * 1.05

      const analysis: TechnicalAnalysis = {
        symbol: symbol.toUpperCase(),
        rsi: latestRSI,
        macd: latestMACD,
        macdSignal: latestMACDSignal,
        sma20: latestSMA20,
        sma50: latestSMA50,
        support,
        resistance,
        timestamp: new Date(),
      }

      return analysis
    } catch (error) {
      this.logger.error('Failed to get technical analysis', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Get sector performance analysis
   */
  async getSectorPerformance(): Promise<MarketSector[]> {
    try {
      const sectors = [
        {
          name: 'Technology',
          symbols: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META'],
        },
        { name: 'Healthcare', symbols: ['JNJ', 'PFE', 'UNH', 'ABBV', 'MRK'] },
        { name: 'Financial', symbols: ['JPM', 'BAC', 'WFC', 'GS', 'MS'] },
        { name: 'Energy', symbols: ['XOM', 'CVX', 'COP', 'EOG', 'SLB'] },
        { name: 'Consumer', symbols: ['PG', 'KO', 'PEP', 'WMT', 'HD'] },
      ]

      const sectorData: MarketSector[] = []

      for (const sector of sectors) {
        const companies = await this.getBulkMarketData(sector.symbols)

        if (companies.length > 0) {
          const totalMarketCap = companies.reduce(
            (sum, company) => sum + company.marketCap,
            0,
          )
          const avgPERatio =
            companies.reduce((sum, company) => sum + company.peRatio, 0) /
            companies.length
          const avgDividendYield =
            companies.reduce((sum, company) => sum + company.dividendYield, 0) /
            companies.length
          const avgPerformance =
            companies.reduce((sum, company) => sum + company.changePercent, 0) /
            companies.length

          sectorData.push({
            sector: sector.name,
            performance: avgPerformance,
            companies: companies.length,
            marketCap: totalMarketCap,
            avgPERatio,
            avgDividendYield,
          })
        }
      }

      return sectorData
    } catch (error) {
      this.logger.error('Failed to get sector performance', {
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Get economic indicators
   */
  async getEconomicIndicators(): Promise<EconomicIndicator[]> {
    try {
      const indicators = [
        { name: 'GDP', impact: 'high' as const },
        { name: 'INFLATION', impact: 'high' as const },
        { name: 'UNEMPLOYMENT', impact: 'medium' as const },
      ]

      const economicData: EconomicIndicator[] = []

      for (const indicator of indicators) {
        const data = await this.alphaService.getEconomicIndicator(
          indicator.name as 'GDP' | 'INFLATION' | 'UNEMPLOYMENT',
        )
        data.forEach((item) => {
          economicData.push({
            name: item.name,
            value: item.value,
            date: item.date,
            impact: indicator.impact,
          })
        })
      }

      return economicData
    } catch (error) {
      this.logger.error('Failed to get economic indicators', {
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Get market sentiment analysis
   */
  async getMarketSentiment(symbol: string): Promise<{
    symbol: string
    overallSentiment: 'bullish' | 'bearish' | 'neutral'
    newsSentiment: number
    technicalScore: number
    fundamentalScore: number
  }> {
    try {
      const [newsSentimentData, technicalData, fundamentals] =
        await Promise.all([
          this.alphaService.getNewsSentiment(symbol),
          this.getTechnicalAnalysis(symbol),
          this.alphaService.getFundamentals(symbol),
        ])

      // News sentiment score (-1 to 1)
      const newsScore =
        newsSentimentData.length > 0
          ? newsSentimentData.reduce((sum, item) => {
              const sentimentValue =
                item.sentiment === 'positive'
                  ? 1
                  : item.sentiment === 'negative'
                    ? -1
                    : 0
              return sum + sentimentValue * item.relevance
            }, 0) / newsSentimentData.length
          : 0

      // Technical score based on RSI and MACD
      let technicalScore = 0
      if (technicalData) {
        if (technicalData.rsi < 30)
          technicalScore += 0.3 // Oversold
        else if (technicalData.rsi > 70) technicalScore -= 0.3 // Overbought

        if (technicalData.macd > 0)
          technicalScore += 0.2 // Positive momentum
        else technicalScore -= 0.2
      }

      // Fundamental score based on P/E and growth
      let fundamentalScore = 0
      if (fundamentals) {
        if (fundamentals.peRatio > 0 && fundamentals.peRatio < 20)
          fundamentalScore += 0.2
        if (fundamentals.profitMargin > 0.1) fundamentalScore += 0.2
        if (fundamentals.returnOnEquity > 0.15) fundamentalScore += 0.2
      }

      const overallScore = newsScore + technicalScore + fundamentalScore
      let overallSentiment: 'bullish' | 'bearish' | 'neutral'

      if (overallScore > 0.3) overallSentiment = 'bullish'
      else if (overallScore < -0.3) overallSentiment = 'bearish'
      else overallSentiment = 'neutral'

      return {
        symbol: symbol.toUpperCase(),
        overallSentiment,
        newsSentiment: newsScore,
        technicalScore,
        fundamentalScore,
      }
    } catch (error) {
      this.logger.error('Failed to get market sentiment', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        symbol: symbol.toUpperCase(),
        overallSentiment: 'neutral',
        newsSentiment: 0,
        technicalScore: 0,
        fundamentalScore: 0,
      }
    }
  }
}
