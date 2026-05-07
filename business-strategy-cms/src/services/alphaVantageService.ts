import axios, { AxiosInstance } from 'axios'

import { Logger } from '../utils/logger'

type AlphaVantagePayload = Record<string, unknown>

interface AlphaVantageGlobalQuoteResponse extends AlphaVantagePayload {
  'Global Quote'?: AlphaVantagePayload
}

interface AlphaVantageOverviewResponse extends AlphaVantagePayload {
  Symbol?: string
  Name?: string
  Sector?: string
  Industry?: string
  MarketCapitalization?: string
  PERatio?: string
  PEGatio?: string
  BookValue?: string
  DividendPerShare?: string
  DividendYield?: string
  EPS?: string
  RevenuePerShareTTM?: string
  ProfitMargin?: string
  OperatingMarginTTM?: string
  ReturnOnAssetsTTM?: string
  ReturnOnEquityTTM?: string
  RevenueTTM?: string
  GrossProfitTTM?: string
  NetIncomeTTM?: string
  TotalAssets?: string
  TotalLiabilities?: string
  TotalShareholderEquity?: string
  CashAndCashEquivalentsAtCarryingValue?: string
  LatestQuarter?: string
  Beta?: string
}

interface AlphaVantageTechnicalResponse extends AlphaVantagePayload {
  [key: string]: unknown
}

interface AlphaVantageEconomicResponse extends AlphaVantagePayload {
  data?: unknown
}

interface AlphaVantageNewsResponse extends AlphaVantagePayload {
  feed?: unknown
}

interface AlphaVantageEarningsResponse extends AlphaVantagePayload {
  quarterlyEarnings?: unknown
}

const isRecord = (value: unknown): value is AlphaVantagePayload =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const parseSentiment = (
  value: unknown,
): 'positive' | 'negative' | 'neutral' => {
  if (value === 'positive' || value === 'negative' || value === 'neutral') {
    return value
  }
  return 'neutral'
}

const toDisplayString = (value: unknown): string => {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value)
  }
  return ''
}

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

interface QuarterlyEarnings {
  fiscalDateEnding: string
  reportedEPS: number
  estimatedEPS: number
  surprise: number
  surprisePercentage: number
}

export class AlphaVantageService {
  private logger: Logger
  private client: AxiosInstance
  private readonly API_KEY: string
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 15 * 60 * 1000 // 15 minutes

  constructor() {
    this.logger = new Logger('AlphaVantageService')
    this.API_KEY = process.env['ALPHA_VANTAGE_API_KEY'] ?? ''

    if (!this.API_KEY) {
      this.logger.error('Alpha Vantage API key not configured')
    }

    this.client = axios.create({
      baseURL:
        process.env['ALPHA_VANTAGE_API_URL'] ??
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
      const cached = this.getFromCache<AlphaVantageQuote>(cacheKey)
      if (cached) return cached

      const response = await this.client.get<AlphaVantageGlobalQuoteResponse>(
        '',
        {
          params: {
            function: 'GLOBAL_QUOTE',
            symbol: symbol.toUpperCase(),
          },
        },
      )

      const quote = response.data['Global Quote']
      const resolvedSymbol = toDisplayString(quote?.['01. symbol'])
      if (!resolvedSymbol) {
        this.logger.warn('No quote data found', { symbol })
        return null
      }

      if (!isRecord(quote)) {
        this.logger.warn('Unexpected quote payload shape', { symbol, quote })
        return null
      }

      const changePercent = quote['10. change percent']
      const changePercentNumber =
        typeof changePercent === 'string'
          ? parseNumber(changePercent.replace('%', ''))
          : parseNumber(changePercent)

      const result: AlphaVantageQuote = {
        symbol: resolvedSymbol,
        price: parseNumber(quote['05. price']),
        change: parseNumber(quote['09. change']),
        changePercent: changePercentNumber,
        volume: parseNumber(quote['06. volume']),
        timestamp: new Date(),
      }

      this.setCache(cacheKey, result)
      return result
    } catch (error: unknown) {
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
      const cached = this.getFromCache<CompanyFundamentals>(cacheKey)
      if (cached) return cached

      // Get company overview
      const response = await this.client.get<AlphaVantageOverviewResponse>('', {
        params: {
          function: 'OVERVIEW',
          symbol: symbol.toUpperCase(),
        },
      })

      const data = response.data
      if (!isRecord(data) || data['Symbol'] !== symbol.toUpperCase()) {
        this.logger.warn('No fundamentals data found', { symbol })
        return null
      }

      const fundamentals: CompanyFundamentals = {
        symbol: data.Symbol,
        companyName: data.Name ?? '',
        sector: data.Sector ?? '',
        industry: data.Industry ?? '',
        marketCap: parseNumber(data.MarketCapitalization),
        peRatio: parseNumber(data.PERatio),
        pegRatio: parseNumber(data.PEGatio),
        bookValue: parseNumber(data.BookValue),
        dividendPerShare: parseNumber(data.DividendPerShare),
        dividendYield: parseNumber(data.DividendYield),
        eps: parseNumber(data.EPS),
        revenuePerShare: parseNumber(data.RevenuePerShareTTM),
        profitMargin: parseNumber(data.ProfitMargin),
        operatingMargin: parseNumber(data.OperatingMarginTTM),
        returnOnAssets: parseNumber(data.ReturnOnAssetsTTM),
        returnOnEquity: parseNumber(data.ReturnOnEquityTTM),
        revenue: parseNumber(data.RevenueTTM),
        grossProfit: parseNumber(data.GrossProfitTTM),
        netIncome: parseNumber(data.NetIncomeTTM),
        totalAssets: parseNumber(data.TotalAssets),
        totalLiabilities: parseNumber(data.TotalLiabilities),
        totalShareholderEquity: parseNumber(data.TotalShareholderEquity),
        cashAndCashEquivalents: parseNumber(
          data.CashAndCashEquivalentsAtCarryingValue,
        ),
        quarterly: false,
        fiscalDateEnding: data.LatestQuarter ?? '',
        beta: parseNumber(data.Beta),
      }

      this.setCache(cacheKey, fundamentals)
      return fundamentals
    } catch (error: unknown) {
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
      const cached = this.getFromCache<TechnicalIndicator[]>(cacheKey)
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

      const response = await this.client.get<AlphaVantageTechnicalResponse>(
        '',
        {
          params: {
            function: functionType,
            symbol: symbol.toUpperCase(),
            interval,
            time_period: timePeriod,
            series_type: 'close',
          },
        },
      )

      const dataKey = `Technical Analysis: ${indicator}`
      const data = response.data[dataKey]
      if (!data) {
        this.logger.warn('No technical indicator data found', {
          symbol,
          indicator,
        })
        return []
      }

      const indicators: TechnicalIndicator[] = Object.entries(data)
        .map(([date, values]) => {
          if (!isRecord(values)) return null

          const valueKey = isRecord(values)
            ? indicator === 'MACD'
              ? 'MACD'
              : indicator
            : indicator
          const fallbackValue = isRecord(values)
            ? (values['SMA'] ?? values['EMA'] ?? values['RSI'])
            : undefined
          const value = parseNumber(
            isRecord(values) ? (values[valueKey] ?? fallbackValue) : undefined,
          )

          return {
            symbol: symbol.toUpperCase(),
            date,
            value,
          }
        })
        .filter((item): item is TechnicalIndicator => item !== null)

      this.setCache(cacheKey, indicators)
      return indicators.slice(0, 50) // Return last 50 data points
    } catch (error: unknown) {
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
      const cached = this.getFromCache<EconomicIndicator[]>(cacheKey)
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

      const response = await this.client.get<AlphaVantageEconomicResponse>('', {
        params: {
          function: functionType,
        },
      })

      const rawData = response.data.data
      const data = Array.isArray(rawData) ? rawData : []
      const indicators = data
        .filter(isRecord)
        .slice(0, 12)
        .map(
          (item): EconomicIndicator => ({
            name: indicator,
            value: toDisplayString(item['value']) || 'N/A',
            date: toDisplayString(item['date']) || 'N/A',
          }),
        )

      this.setCache(cacheKey, indicators)
      return indicators
    } catch (error: unknown) {
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
      const cached = this.getFromCache<NewsSentiment[]>(cacheKey)
      if (cached) return cached

      const response = await this.client.get<AlphaVantageNewsResponse>('', {
        params: {
          function: 'NEWS_SENTIMENT',
          tickers: symbol.toUpperCase(),
          limit: 20,
        },
      })

      const rawData = response.data.feed
      const data = Array.isArray(rawData) ? rawData : []
      const sentiments = data.filter(isRecord).map(
        (item): NewsSentiment => ({
          title: toDisplayString(item['title']),
          url: toDisplayString(item['url']),
          summary: toDisplayString(item['summary']),
          sentiment: parseSentiment(item['overall_sentiment_label']),
          relevance: parseNumber(item['relevance_score']),
          timePublished: toDisplayString(item['time_published']),
        }),
      )

      this.setCache(cacheKey, sentiments)
      return sentiments
    } catch (error: unknown) {
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
  async getQuarterlyEarnings(symbol: string): Promise<QuarterlyEarnings[]> {
    try {
      const cacheKey = `alpha_earnings_${symbol}`
      const cached = this.getFromCache<QuarterlyEarnings[]>(cacheKey)
      if (cached) return cached

      const response = await this.client.get<AlphaVantageEarningsResponse>('', {
        params: {
          function: 'EARNINGS',
          symbol: symbol.toUpperCase(),
        },
      })

      const rawData = response.data.quarterlyEarnings
      const data = Array.isArray(rawData) ? rawData : []
      const earnings = data.filter(isRecord).map(
        (item): QuarterlyEarnings => ({
          fiscalDateEnding: String(item['fiscalDateEnding'] ?? ''),
          reportedEPS: parseNumber(item['reportedEPS']),
          estimatedEPS: parseNumber(item['estimatedEPS']),
          surprise: parseNumber(item['surprise']),
          surprisePercentage: parseNumber(item['surprisePercentage']),
        }),
      )

      this.setCache(cacheKey, earnings)
      return earnings
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T
    }
    return null
  }

  private setCache<T>(key: string, data: T): void {
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
