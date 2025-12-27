import axios, { AxiosInstance } from 'axios'
import { Logger } from '../utils/logger'

export interface AlphaVantageQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: Date
}

export interface CompanyFundamentals {
  symbol: string
  companyName: string
  sector: string
  industry: string
  marketCap: number
  peRatio: number
  pegRatio: number
  bookValue: number
  dividendPerShare: number
  dividendYield: number
  eps: number
  revenuePerShare: number
  profitMargin: number
  operatingMargin: number
  returnOnAssets: number
  returnOnEquity: number
  revenue: number
  grossProfit: number
  netIncome: number
  totalAssets: number
  totalLiabilities: number
  totalShareholderEquity: number
  cashAndCashEquivalents: number
  quarterly: boolean
  fiscalDateEnding: string
  beta: number
}

export interface TechnicalIndicator {
  symbol: string
  date: string
  value: number
}

export interface EconomicIndicator {
  name: string
  value: string
  date: string
}

export interface NewsSentiment {
  title: string
  url: string
  summary: string
  sentiment: 'positive' | 'negative' | 'neutral'
  relevance: number
  timePublished: string
}

export class AlphaVantageService {
  private logger: Logger
  private client: AxiosInstance
  private readonly API_KEY: string
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 15 * 60 * 1000 // 15 minutes

  constructor() {
    this.logger = new Logger('AlphaVantageService')
    this.API_KEY = process.env['ALPHA_VANTAGE_API_KEY'] || ''

    if (!this.API_KEY) {
      this.logger.error('Alpha Vantage API key not configured')
    }

    this.client = axios.create({
      baseURL:
        process.env['ALPHA_VANTAGE_API_URL'] ||
        'https://www.alphavantage.co/query',
      timeout: 30000, // Alpha Vantage can be slow
      params: {
        apikey: this.API_KEY,
      },
    })
  }

  /**
   * Get real-time stock quote
   */
  async getQuote(symbol: string): Promise<AlphaVantageQuote | null> {
    try {
      const cacheKey = `alpha_quote_${symbol}`
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached

      const response = await this.client.get('', {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: symbol.toUpperCase(),
        },
      })

      const quote = response.data['Global Quote']
      if (!quote || !quote['01. symbol']) {
        this.logger.warn('No quote data found', { symbol })
        return null
      }

      const result: AlphaVantageQuote = {
        symbol: quote['01. symbol'],
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
        volume: parseInt(quote['06. volume']),
        timestamp: new Date(),
      }

      this.setCache(cacheKey, result)
      return result
    } catch (error) {
      this.logger.error('Failed to fetch Alpha Vantage quote', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Get comprehensive company fundamentals
   */
  async getFundamentals(symbol: string): Promise<CompanyFundamentals | null> {
    try {
      const cacheKey = `alpha_fundamentals_${symbol}`
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached

      // Get company overview
      const response = await this.client.get('', {
        params: {
          function: 'OVERVIEW',
          symbol: symbol.toUpperCase(),
        },
      })

      const data = response.data
      if (!data || data['Symbol'] !== symbol.toUpperCase()) {
        this.logger.warn('No fundamentals data found', { symbol })
        return null
      }

      const fundamentals: CompanyFundamentals = {
        symbol: data.Symbol,
        companyName: data.Name,
        sector: data.Sector,
        industry: data.Industry,
        marketCap: parseInt(data.MarketCapitalization) || 0,
        peRatio: parseFloat(data.PERatio) || 0,
        pegRatio: parseFloat(data.PEGRatio) || 0,
        bookValue: parseFloat(data.BookValue) || 0,
        dividendPerShare: parseFloat(data.DividendPerShare) || 0,
        dividendYield: parseFloat(data.DividendYield) || 0,
        eps: parseFloat(data.EPS) || 0,
        revenuePerShare: parseFloat(data.RevenuePerShareTTM) || 0,
        profitMargin: parseFloat(data.ProfitMargin) || 0,
        operatingMargin: parseFloat(data.OperatingMarginTTM) || 0,
        returnOnAssets: parseFloat(data.ReturnOnAssetsTTM) || 0,
        returnOnEquity: parseFloat(data.ReturnOnEquityTTM) || 0,
        revenue: parseInt(data.RevenueTTM) || 0,
        grossProfit: parseInt(data.GrossProfitTTM) || 0,
        netIncome: parseInt(data.NetIncomeTTM) || 0,
        totalAssets: parseInt(data.TotalAssets) || 0,
        totalLiabilities: parseInt(data.TotalLiabilities) || 0,
        totalShareholderEquity: parseInt(data.TotalShareholderEquity) || 0,
        cashAndCashEquivalents:
          parseInt(data.CashAndCashEquivalentsAtCarryingValue) || 0,
        quarterly: false,
        fiscalDateEnding: data.LatestQuarter,
        beta: parseFloat(data.Beta) || 0,
      }

      this.setCache(cacheKey, fundamentals)
      return fundamentals
    } catch (error) {
      this.logger.error('Failed to fetch Alpha Vantage fundamentals', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Get technical indicators (RSI, MACD, etc.)
   */
  async getTechnicalIndicator(
    symbol: string,
    indicator: 'RSI' | 'MACD' | 'SMA' | 'EMA',
    interval = 'daily',
    timePeriod = 14,
  ): Promise<TechnicalIndicator[]> {
    try {
      const cacheKey = `alpha_${indicator}_${symbol}_${interval}_${timePeriod}`
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached

      let functionType = ''
      switch (indicator) {
        case 'RSI':
          functionType = 'RSI'
          break
        case 'MACD':
          functionType = 'MACD'
          break
        case 'SMA':
          functionType = 'SMA'
          break
        case 'EMA':
          functionType = 'EMA'
          break
      }

      const response = await this.client.get('', {
        params: {
          function: functionType,
          symbol: symbol.toUpperCase(),
          interval,
          time_period: timePeriod,
          series_type: 'close',
        },
      })

      const dataKey = `Technical Analysis: ${indicator}`
      const data = response.data[dataKey]
      if (!data) {
        this.logger.warn('No technical indicator data found', {
          symbol,
          indicator,
        })
        return []
      }

      const indicators: TechnicalIndicator[] = Object.entries(data).map(
        ([date, values]: [string, any]) => ({
          symbol: symbol.toUpperCase(),
          date,
          value:
            indicator === 'MACD'
              ? parseFloat(
                  values.MACD || values.SMA || values.EMA || values.RSI,
                )
              : parseFloat(
                  values[indicator] || values.SMA || values.EMA || values.RSI,
                ),
        }),
      )

      this.setCache(cacheKey, indicators)
      return indicators.slice(0, 50) // Return last 50 data points
    } catch (error) {
      this.logger.error('Failed to fetch technical indicators', {
        symbol,
        indicator,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Get economic indicators (GDP, inflation, etc.)
   */
  async getEconomicIndicator(
    indicator: 'GDP' | 'INFLATION' | 'UNEMPLOYMENT',
  ): Promise<EconomicIndicator[]> {
    try {
      const cacheKey = `alpha_economic_${indicator}`
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached

      let functionType = ''
      switch (indicator) {
        case 'GDP':
          functionType = 'REAL_GDP'
          break
        case 'INFLATION':
          functionType = 'INFLATION'
          break
        case 'UNEMPLOYMENT':
          functionType = 'UNEMPLOYMENT'
          break
      }

      const response = await this.client.get('', {
        params: {
          function: functionType,
        },
      })

      const data = response.data.data || []
      const indicators: EconomicIndicator[] = data
        .slice(0, 12)
        .map((item: any) => ({
          name: indicator,
          value: item.value || item.value.toString(),
          date: item.date,
        }))

      this.setCache(cacheKey, indicators)
      return indicators
    } catch (error) {
      this.logger.error('Failed to fetch economic indicators', {
        indicator,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Get news sentiment analysis
   */
  async getNewsSentiment(symbol: string): Promise<NewsSentiment[]> {
    try {
      const cacheKey = `alpha_news_${symbol}`
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached

      const response = await this.client.get('', {
        params: {
          function: 'NEWS_SENTIMENT',
          tickers: symbol.toUpperCase(),
          limit: 20,
        },
      })

      const data = response.data.feed || []
      const sentiments: NewsSentiment[] = data.map((item: any) => ({
        title: item.title,
        url: item.url,
        summary: item.summary,
        sentiment: item.overall_sentiment_label as
          | 'positive'
          | 'negative'
          | 'neutral',
        relevance: parseFloat(item.relevance_score) || 0,
        timePublished: item.time_published,
      }))

      this.setCache(cacheKey, sentiments)
      return sentiments
    } catch (error) {
      this.logger.error('Failed to fetch news sentiment', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Get quarterly earnings data
   */
  async getQuarterlyEarnings(symbol: string): Promise<any[]> {
    try {
      const cacheKey = `alpha_earnings_${symbol}`
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached

      const response = await this.client.get('', {
        params: {
          function: 'EARNINGS',
          symbol: symbol.toUpperCase(),
        },
      })

      const data = response.data.quarterlyEarnings || []
      const earnings = data.map((item: any) => ({
        fiscalDateEnding: item.fiscalDateEnding,
        reportedEPS: parseFloat(item.reportedEPS) || 0,
        estimatedEPS: parseFloat(item.estimatedEPS) || 0,
        surprise: parseFloat(item.surprise) || 0,
        surprisePercentage: parseFloat(item.surprisePercentage) || 0,
      }))

      this.setCache(cacheKey, earnings)
      return earnings
    } catch (error) {
      this.logger.error('Failed to fetch quarterly earnings', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Get comprehensive market analysis
   */
  async getMarketAnalysis(symbols: string[]): Promise<{
    quotes: AlphaVantageQuote[]
    fundamentals: CompanyFundamentals[]
    technical: Record<string, TechnicalIndicator[]>
    news: Record<string, NewsSentiment[]>
  }> {
    try {
      const quotes = await Promise.all(symbols.map((s) => this.getQuote(s)))
      const fundamentals = await Promise.all(
        symbols.map((s) => this.getFundamentals(s)),
      )

      const technical: Record<string, TechnicalIndicator[]> = {}
      const news: Record<string, NewsSentiment[]> = {}

      for (const symbol of symbols) {
        const [rsi, macd, sentiment] = await Promise.all([
          this.getTechnicalIndicator(symbol, 'RSI'),
          this.getTechnicalIndicator(symbol, 'MACD'),
          this.getNewsSentiment(symbol),
        ])

        technical[symbol] = [...rsi, ...macd]
        news[symbol] = sentiment
      }

      return {
        quotes: quotes.filter((q): q is AlphaVantageQuote => q !== null),
        fundamentals: fundamentals.filter(
          (f): f is CompanyFundamentals => f !== null,
        ),
        technical,
        news,
      }
    } catch (error) {
      this.logger.error('Failed to get comprehensive market analysis', {
        symbols,
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        quotes: [],
        fundamentals: [],
        technical: {},
        news: {},
      }
    }
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }
    return null
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  /**
   * Clear cache for fresh data
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get API usage stats
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}
