import axios, { AxiosInstance } from 'axios'
import { Logger } from '../utils/logger'

export interface YahooFinanceQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: number
  dayHigh: number
  dayLow: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  timestamp: Date
}

export interface YahooFinanceHistoricalData {
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
  adjustedClose: number
}

export interface CompanyProfile {
  symbol: string
  companyName: string
  industry: string
  sector: string
  marketCap: number
  employees: number
  revenue: number
  profitMargin: number
  beta: number
  peRatio: number
  dividendYield: number
}

export interface MarketSector {
  sector: string
  performance: number
  companies: number
  marketCap: number
}

export class YahooFinanceService {
  private logger: Logger
  private client: AxiosInstance
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private readonly CACHE_TTL =
    parseInt(process.env['CACHE_TTL_SECONDS'] || '300', 10) * 1000

  constructor() {
    this.logger = new Logger('YahooFinanceService')
    this.client = axios.create({
      baseURL:
        process.env['YAHOO_FINANCE_API_URL'] ||
        'https://query1.finance.yahoo.com/v8/finance',
      timeout: 10000,
      headers: {
        'User-Agent': 'BusinessStrategyCMS/1.0',
      },
    })
  }

  /**
   * Get real-time stock quote
   */
  async getQuote(symbol: string): Promise<YahooFinanceQuote | null> {
    try {
      const cacheKey = `quote_${symbol}`
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached

      const response = await this.client.get(`/quote/${symbol}`)
      const result = response.data.quoteResponse?.result?.[0]

      if (!result) {
        this.logger.warn('No quote data found', { symbol })
        return null
      }

      const quote: YahooFinanceQuote = {
        symbol: result.symbol,
        price: result.regularMarketPrice,
        change: result.regularMarketChange,
        changePercent: result.regularMarketChangePercent,
        volume: result.regularMarketVolume,
        marketCap: result.marketCap,
        dayHigh: result.regularMarketDayHigh,
        dayLow: result.regularMarketDayLow,
        fiftyTwoWeekHigh: result.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: result.fiftyTwoWeekLow,
        timestamp: new Date(),
      }

      this.setCache(cacheKey, quote)
      return quote
    } catch (error) {
      this.logger.error('Failed to fetch quote', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Get historical stock data
   */
  async getHistoricalData(
    symbol: string,
    period:
      | '1d'
      | '5d'
      | '1mo'
      | '3mo'
      | '6mo'
      | '1y'
      | '2y'
      | '5y'
      | '10y'
      | 'ytd'
      | 'max' = '1y',
  ): Promise<YahooFinanceHistoricalData[]> {
    try {
      const cacheKey = `historical_${symbol}_${period}`
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached

      const interval = period === '1d' ? '1m' : '1d'
      const range = period

      const response = await this.client.get(`/chart/${symbol}`, {
        params: {
          interval,
          range,
          includeAdjustedClose: true,
        },
      })

      const result = response.data.chart?.result?.[0]
      if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
        this.logger.warn('No historical data found', { symbol, period })
        return []
      }

      const { timestamp, indicators } = result
      const quote = indicators.quote[0]

      const data: YahooFinanceHistoricalData[] = timestamp.map(
        (time: number, index: number) => ({
          date: new Date(time * 1000),
          open: quote.open?.[index] || 0,
          high: quote.high?.[index] || 0,
          low: quote.low?.[index] || 0,
          close: quote.close?.[index] || 0,
          volume: quote.volume?.[index] || 0,
          adjustedClose:
            indicators.adjclose?.[0]?.adjclose?.[index] ||
            quote.close?.[index] ||
            0,
        }),
      )

      this.setCache(cacheKey, data)
      return data
    } catch (error) {
      this.logger.error('Failed to fetch historical data', {
        symbol,
        period,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Get company profile and fundamentals
   */
  async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
    try {
      const cacheKey = `profile_${symbol}`
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached

      const response = await this.client.get(`/quote/${symbol}`)
      const result = response.data.quoteResponse?.result?.[0]

      if (!result) {
        this.logger.warn('No company data found', { symbol })
        return null
      }

      const profile: CompanyProfile = {
        symbol: result.symbol,
        companyName: result.longName || result.shortName || result.symbol,
        industry: result.industry || 'Unknown',
        sector: result.sector || 'Unknown',
        marketCap: result.marketCap || 0,
        employees: result.fullTimeEmployees || 0,
        revenue: result.revenue || 0,
        profitMargin: result.profitMargins || 0,
        beta: result.beta || 0,
        peRatio: result.trailingPE || 0,
        dividendYield: result.trailingAnnualDividendYield || 0,
      }

      this.setCache(cacheKey, profile)
      return profile
    } catch (error) {
      this.logger.error('Failed to fetch company profile', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Get market indices
   */
  async getMarketIndices(): Promise<YahooFinanceQuote[]> {
    const indices = ['^GSPC', '^DJI', '^IXIC', '^RUT', '^VIX']
    const results = await Promise.all(
      indices.map((symbol) => this.getQuote(symbol)),
    )
    return results.filter(
      (result): result is YahooFinanceQuote => result !== null,
    )
  }

  /**
   * Get financial metrics for business analysis
   */
  async getFinancialMetrics(symbols: string[]): Promise<
    {
      symbol: string
      marketCap: number
      revenue: number
      profitMargin: number
      peRatio: number
      dividendYield: number
      beta: number
    }[]
  > {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const profile = await this.getCompanyProfile(symbol)
        if (!profile) return null

        return {
          symbol: profile.symbol,
          marketCap: profile.marketCap,
          revenue: profile.revenue,
          profitMargin: profile.profitMargin,
          peRatio: profile.peRatio,
          dividendYield: profile.dividendYield,
          beta: profile.beta,
        }
      }),
    )
    return results.filter((result): result is any => result !== null)
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
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}
