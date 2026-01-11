import { EventEmitter } from 'events'
import { Redis } from 'ioredis'
import axios, { AxiosInstance } from 'axios'
import { MongoClient, type Db } from 'mongodb'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type { ThreatResponse } from '../response-orchestration'

const logger = createBuildSafeLogger('external-threat-intelligence')

export interface ThreatIntelligenceConfig {
  enabled: boolean
  feeds: ThreatIntelligenceFeed[]
  updateInterval: number // milliseconds
  cacheTimeout: number // milliseconds
  apiKeys: Record<string, string>
  mongoUrl?: string
  redisUrl?: string
  proxyConfig?: {
    host: string
    port: number
    auth?: {
      username: string
      password: string
    }
  }
}

export interface ThreatIntelligenceFeed {
  name: string
  type: 'commercial' | 'open_source' | 'community'
  url: string
  apiKey?: string
  authType: 'none' | 'api_key' | 'bearer' | 'basic'
  rateLimit: {
    requestsPerMinute: number
    burstLimit: number
  }
  supportedIOCTypes: string[]
  updateFrequency: number // milliseconds
  enabled: boolean
  priority: number
}

export interface ThreatIntelligence {
  intelligenceId: string
  feedName: string
  iocType: string
  iocValue: string
  threatType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  firstSeen: Date
  lastSeen: Date
  expirationDate?: Date
  source: string
  tags: string[]
  metadata: Record<string, unknown>
  relatedIOCs?: string[]
  attribution?: {
    actor: string
    campaign: string
    family: string
  }
}

export interface ThreatIntelligenceQuery {
  iocType?: string
  iocValue?: string
  threatType?: string
  severity?: string
  tags?: string[]
  source?: string
  timeRange?: {
    start: Date
    end: Date
  }
}

export interface ThreatIntelligenceResult {
  intelligence: ThreatIntelligence[]
  totalCount: number
  sources: string[]
  queryTime: Date
  cacheHit: boolean
}

export class ExternalThreatIntelligenceService extends EventEmitter {
  private mongoClient!: MongoClient
  private redis!: Redis
  private config: ThreatIntelligenceConfig
  private httpClients: Map<string, AxiosInstance> = new Map()
  private updateIntervals: NodeJS.Timeout[] = []
  private isRunning: boolean = false

  constructor(config: ThreatIntelligenceConfig) {
    super()
    this.config = config
  }

  public async initialize(): Promise<void> {
    await this.initializeServices()
  }

  private async initializeServices(): Promise<void> {
    try {
      this.mongoClient = new MongoClient(
        this.config.mongoUrl ||
        process.env.MONGODB_URI ||
        'mongodb://localhost:27017/threat_detection',
      )
      await this.mongoClient.connect()

      this.redis = new Redis(
        this.config.redisUrl ||
        process.env.REDIS_URL ||
        'redis://localhost:6379',
      )

      // Initialize HTTP clients for each feed
      this.initializeHttpClients()

      logger.info('External threat intelligence service initialized')
      this.emit('intelligence_initialized')
    } catch (error) {
      logger.error('Failed to initialize threat intelligence service:', {
        error,
      })
      throw error
    }
  }

  /**
   * Initialize HTTP clients for threat intelligence feeds
   */
  private initializeHttpClients(): void {
    for (const feed of this.config.feeds) {
      if (!feed.enabled) {
        continue
      }

      const client = axios.create({
        baseURL: feed.url,
        timeout: 30000,
        headers: {
          'User-Agent': 'Pixelated-Threat-Intelligence/1.0',
          'Content-Type': 'application/json',
        },
      })

      // Add authentication
      if (feed.authType === 'api_key' && feed.apiKey) {
        client.defaults.headers.common['X-API-Key'] = feed.apiKey
      } else if (feed.authType === 'bearer' && feed.apiKey) {
        client.defaults.headers.common['Authorization'] =
          `Bearer ${feed.apiKey}`
      }

      // Add proxy configuration if provided
      if (this.config.proxyConfig) {
        client.defaults.proxy = {
          host: this.config.proxyConfig.host,
          port: this.config.proxyConfig.port,
          auth: this.config.proxyConfig.auth,
        }
      }

      // Add rate limiting interceptor
      this.addRateLimitingInterceptor(client, feed)

      this.httpClients.set(feed.name, client)
    }
  }

  /**
   * Add rate limiting interceptor to HTTP client
   */
  private addRateLimitingInterceptor(
    client: AxiosInstance,
    feed: ThreatIntelligenceFeed,
  ): void {
    let requestQueue: (() => Promise<void>)[] = []
    let processing = false

    const processQueue = async () => {
      if (processing || requestQueue.length === 0) {
        return
      }

      processing = true
      const request = requestQueue.shift()

      if (request) {
        try {
          await request()
        } catch (error) {
          logger.error('Rate limited request failed:', {
            error,
            feed: feed.name,
          })
        }
      }

      processing = false

      // Schedule next request
      const delay = 60000 / feed.rateLimit.requestsPerMinute // milliseconds between requests
      setTimeout(processQueue, delay)
    }

    client.interceptors.request.use(async (config) => {
      return new Promise((resolve) => {
        requestQueue.push(async () => {
          resolve(config)
        })

        processQueue()
      })
    })
  }

  /**
   * Start threat intelligence updates
   */
  async startUpdates(): Promise<void> {
    if (!this.config.enabled) {
      logger.warn('External threat intelligence is disabled')
      return
    }

    if (this.isRunning) {
      logger.warn('Threat intelligence updates are already running')
      return
    }

    try {
      this.isRunning = true

      // Perform initial update
      await this.updateAllFeeds()

      // Schedule regular updates
      for (const feed of this.config.feeds) {
        if (!feed.enabled) {
          continue
        }

        const interval = setInterval(async () => {
          try {
            await this.updateFeed(feed)
          } catch (error) {
            logger.error(`Failed to update feed ${feed.name}:`, { error })
          }
        }, feed.updateFrequency)

        this.updateIntervals.push(interval)
      }

      logger.info('External threat intelligence updates started')
      this.emit('intelligence_updates_started')
    } catch (error) {
      logger.error('Failed to start threat intelligence updates:', { error })
      throw error
    }
  }

  /**
   * Stop threat intelligence updates
   */
  async stopUpdates(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    // Clear all update intervals
    this.updateIntervals.forEach((interval) => clearInterval(interval))
    this.updateIntervals = []

    logger.info('External threat intelligence updates stopped')
    this.emit('intelligence_updates_stopped')
  }

  /**
   * Update all threat intelligence feeds
   */
  private async updateAllFeeds(): Promise<void> {
    const enabledFeeds = this.config.feeds.filter((feed) => feed.enabled)

    for (const feed of enabledFeeds) {
      try {
        await this.updateFeed(feed)
      } catch (error) {
        logger.error(`Failed to update feed ${feed.name}:`, { error })
      }
    }
  }

  /**
   * Update a specific threat intelligence feed
   */
  private async updateFeed(feed: ThreatIntelligenceFeed): Promise<void> {
    try {
      logger.info(`Updating threat intelligence feed: ${feed.name}`)

      const client = this.httpClients.get(feed.name)
      if (!client) {
        throw new Error(`HTTP client not found for feed: ${feed.name}`)
      }

      // Fetch threat intelligence data
      const intelligenceData = await this.fetchThreatIntelligence(feed, client)

      // Process and store the data
      await this.processAndStoreIntelligence(feed, intelligenceData)

      logger.info(`Threat intelligence feed updated: ${feed.name}`, {
        intelligenceCount: intelligenceData.length,
      })
    } catch (error) {
      logger.error(`Failed to update feed ${feed.name}:`, { error })
      throw error
    }
  }

  /**
   * Fetch threat intelligence data from feed
   */
  private async fetchThreatIntelligence(
    feed: ThreatIntelligenceFeed,
    client: AxiosInstance,
  ): Promise<ThreatIntelligence[]> {
    try {
      let endpoint = '/threats'
      let params: Record<string, unknown> = {
        limit: 1000,
        include_expired: false,
      }

      // Customize endpoint and parameters based on feed type
      switch (feed.type) {
        case 'commercial':
          endpoint = '/api/v2/intel'
          params = {
            ...params,
            format: 'json',
            confidence_min: 70,
          }
          break

        case 'open_source':
          endpoint = '/feeds/all'
          params = {
            ...params,
            format: 'stix2',
          }
          break

        case 'community':
          endpoint = '/community/threats'
          params = {
            ...params,
            community: true,
            verified: true,
          }
          break
      }

      const response = await client.get(endpoint, { params })

      // Transform response data based on feed format
      return this.transformIntelligenceData(feed, response.data)
    } catch (error) {
      logger.error(`Failed to fetch threat intelligence from ${feed.name}:`, {
        error,
      })
      return []
    }
  }

  /**
   * Transform threat intelligence data based on feed format
   */
  private transformIntelligenceData(
    feed: ThreatIntelligenceFeed,
    data: unknown,
  ): ThreatIntelligence[] {
    try {
      const intelligence: ThreatIntelligence[] = []

      if (Array.isArray(data)) {
        // Direct array of intelligence items
        for (const item of data) {
          const transformed = this.transformIntelligenceItem(feed, item)
          if (transformed) {
            intelligence.push(transformed)
          }
        }
      } else if (typeof data === 'object' && data !== null) {
        // Handle different response formats
        const obj = data as Record<string, unknown>

        if (obj.threats && Array.isArray(obj.threats)) {
          // Format: { threats: [...] }
          for (const item of obj.threats) {
            const transformed = this.transformIntelligenceItem(feed, item)
            if (transformed) {
              intelligence.push(transformed)
            }
          }
        } else if (obj.data && Array.isArray(obj.data)) {
          // Format: { data: [...] }
          for (const item of obj.data) {
            const transformed = this.transformIntelligenceItem(feed, item)
            if (transformed) {
              intelligence.push(transformed)
            }
          }
        } else if (obj.objects && Array.isArray(obj.objects)) {
          // STIX2 format
          for (const item of obj.objects) {
            const transformed = this.transformSTIX2Item(feed, item)
            if (transformed) {
              intelligence.push(transformed)
            }
          }
        }
      }

      return intelligence
    } catch (error) {
      logger.error(`Failed to transform intelligence data from ${feed.name}:`, {
        error,
      })
      return []
    }
  }

  /**
   * Transform a single intelligence item
   */
  private transformIntelligenceItem(
    feed: ThreatIntelligenceFeed,
    item: unknown,
  ): ThreatIntelligence | null {
    try {
      if (typeof item !== 'object' || item === null) {
        return null
      }

      const data = item as Record<string, unknown>

      // Extract basic fields
      const iocValue = String(data.value || data.ioc || data.indicator || '')
      const iocType = String(data.type || data.ioc_type || 'unknown')
      const threatType = String(data.threat_type || data.malware_family || 'unknown')
      const severity = this.mapSeverity(
        String(data.severity || data.confidence || 'medium'),
      )
      const confidence = this.extractConfidence(
        (data.confidence ?? data.score ?? 50) as unknown,
      )

      if (!iocValue) {
        return null
      }

      return {
        intelligenceId: `intel_${feed.name}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        feedName: feed.name,
        iocType: iocType as string,
        iocValue: iocValue as string,
        threatType: threatType as string,
        severity,
        confidence,
        firstSeen: new Date((data.first_seen || data.created || Date.now()) as any),
        lastSeen: new Date((data.last_seen || data.updated || Date.now()) as any),
        expirationDate: data.expiration_date
          ? new Date(data.expiration_date as string)
          : undefined,
        source: String(data.source || feed.name),
        tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
        metadata: {
          originalData: data,
          feedType: String(feed.type),
          transformationDate: new Date(),
        },
        relatedIOCs: Array.isArray(data.related_iocs)
          ? (data.related_iocs as string[])
          : undefined,
        attribution: data.attribution
          ? {
            actor:
              ((data.attribution as Record<string, unknown>)
                .actor as string) || 'unknown',
            campaign:
              ((data.attribution as Record<string, unknown>)
                .campaign as string) || 'unknown',
            family:
              String(((data.attribution as Record<string, unknown>)
                .family as string) || 'unknown'),
          }
          : undefined,
      }
    } catch (error) {
      logger.error('Failed to transform intelligence item:', { error })
      return null
    }
  }

  /**
   * Transform STIX2 formatted intelligence item
   */
  private transformSTIX2Item(
    feed: ThreatIntelligenceFeed,
    item: unknown,
  ): ThreatIntelligence | null {
    try {
      if (typeof item !== 'object' || item === null) {
        return null
      }

      const data = item as Record<string, unknown>

      // Only process indicator and malware objects
      if (data.type !== 'indicator' && data.type !== 'malware') {
        return null
      }

      let iocValue = ''
      let iocType = 'unknown'
      let threatType = 'unknown'

      if (data.type === 'indicator') {
        // Extract IOC from pattern
        const pattern = (data.pattern as string) || ''
        const patternMatch = pattern.match(/([a-zA-Z]+)\s*=\s*['"]([^'"]+)['"]/)

        if (patternMatch) {
          iocType = patternMatch[1].toLowerCase()
          iocValue = patternMatch[2]
        }
      } else if (data.type === 'malware') {
        iocType = 'malware'
        iocValue = (data.name as string) || 'unknown'
        threatType = data.labels
          ? (data.labels as string[]).join(', ')
          : 'malware'
      }

      if (!iocValue) {
        return null
      }

      return {
        intelligenceId:
          (data.id as string) || `intel_${feed.name}_${Date.now()}`,
        feedName: feed.name,
        iocType,
        iocValue,
        threatType,
        severity: this.mapSeverity(String(data.confidence || 'medium')),
        confidence: this.extractConfidence(data.confidence || 50),
        firstSeen: new Date((data.created || Date.now()) as any),
        lastSeen: new Date((data.modified || Date.now()) as any),
        source: (data.created_by_ref as string) || feed.name,
        tags: Array.isArray(data.labels) ? (data.labels as string[]) : [],
        metadata: {
          stixType: String(data.type || 'unknown'),
          specVersion: (data.spec_version as string) || '2.0',
          transformationDate: new Date(),
        },
      }
    } catch (error) {
      logger.error('Failed to transform STIX2 item:', { error })
      return null
    }
  }

  /**
   * Map severity string to standardized value
   */
  private mapSeverity(severity: string): ThreatIntelligence['severity'] {
    const severityMap: Record<string, ThreatIntelligence['severity']> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      critical: 'critical',
      info: 'low',
      warning: 'medium',
      error: 'high',
      severe: 'critical',
    }

    return severityMap[severity.toLowerCase()] || 'medium'
  }

  /**
   * Extract confidence score from various formats
   */
  private extractConfidence(confidence: unknown): number {
    if (typeof confidence === 'number') {
      return Math.max(0, Math.min(1, confidence / 100)) // Convert percentage to 0-1
    }

    if (typeof confidence === 'string') {
      const num = parseFloat(confidence)
      if (!isNaN(num)) {
        return Math.max(0, Math.min(1, num / 100))
      }
    }

    return 0.5 // Default confidence
  }

  /**
   * Process and store threat intelligence data
   */
  private async processAndStoreIntelligence(
    feed: ThreatIntelligenceFeed,
    intelligence: ThreatIntelligence[],
  ): Promise<void> {
    try {
      const db = this.mongoClient.db('threat_detection')

      for (const intel of intelligence) {
        try {
          // Check if intelligence already exists
          const existing = await db.collection('threat_intelligence').findOne({
            feedName: intel.feedName,
            iocType: intel.iocType,
            iocValue: intel.iocValue,
          })

          if (existing) {
            // Update existing intelligence
            await db.collection('threat_intelligence').updateOne(
              { _id: existing._id },
              {
                $set: {
                  lastSeen: intel.lastSeen,
                  confidence: intel.confidence,
                  severity: intel.severity,
                  tags: intel.tags,
                  metadata: intel.metadata,
                },
                $inc: { updateCount: 1 },
              },
            )
          } else {
            // Insert new intelligence
            await db.collection('threat_intelligence').insertOne({
              ...intel,
              updateCount: 1,
              createdAt: new Date(),
            })
          }

          // Cache in Redis for fast lookups
          await this.cacheIntelligence(intel)
        } catch (error) {
          logger.error(`Failed to process intelligence item:`, { error, intel })
        }
      }

      logger.info(
        `Processed ${intelligence.length} intelligence items from ${feed.name}`,
      )
    } catch (error) {
      logger.error(
        `Failed to process and store intelligence from ${feed.name}:`,
        { error },
      )
      throw error
    }
  }

  /**
   * Cache threat intelligence in Redis
   */
  private async cacheIntelligence(intel: ThreatIntelligence): Promise<void> {
    try {
      const cacheKey = `threat_intel:${intel.iocType}:${intel.iocValue}`
      const cacheData = {
        intelligenceId: intel.intelligenceId,
        feedName: intel.feedName,
        threatType: intel.threatType,
        severity: intel.severity,
        confidence: intel.confidence,
        lastSeen: intel.lastSeen,
        tags: intel.tags,
      }

      await this.redis.setex(
        cacheKey,
        Math.floor(this.config.cacheTimeout / 1000),
        JSON.stringify(cacheData),
      )
    } catch (error) {
      logger.error('Failed to cache intelligence:', {
        error,
        intelligenceId: intel.intelligenceId,
      })
    }
  }

  /**
   * Query threat intelligence
   */
  async queryIntelligence(
    query: ThreatIntelligenceQuery,
  ): Promise<ThreatIntelligenceResult> {
    try {
      const startTime = Date.now()

      // Try cache first
      const cacheResult = await this.queryCache(query)
      if (cacheResult.intelligence.length > 0) {
        return {
          ...cacheResult,
          queryTime: new Date(),
          cacheHit: true,
        }
      }

      // Query database
      const dbResult = await this.queryDatabase(query)

      const result: ThreatIntelligenceResult = {
        ...dbResult,
        queryTime: new Date(),
        cacheHit: false,
      }

      const queryTime = Date.now() - startTime
      logger.info(`Threat intelligence query completed in ${queryTime}ms`, {
        resultCount: result.intelligence.length,
        sources: result.sources,
        cacheHit: result.cacheHit,
      })

      return result
    } catch (error) {
      logger.error('Failed to query threat intelligence:', { error })
      return {
        intelligence: [],
        totalCount: 0,
        sources: [],
        queryTime: new Date(),
        cacheHit: false,
      }
    }
  }

  /**
   * Query threat intelligence cache
   */
  private async queryCache(
    query: ThreatIntelligenceQuery,
  ): Promise<ThreatIntelligenceResult> {
    try {
      if (!query.iocValue || !query.iocType) {
        return {
          intelligence: [],
          totalCount: 0,
          sources: [],
          queryTime: new Date(),
          cacheHit: false,
        }
      }

      const cacheKey = `threat_intel:${query.iocType}:${query.iocValue}`
      const cachedData = await this.redis.get(cacheKey)

      if (cachedData) {
        const intel = JSON.parse(cachedData) as Partial<ThreatIntelligence>

        // Check if cached intelligence matches query criteria
        if (this.matchesQuery(intel, query)) {
          return {
            intelligence: [intel as ThreatIntelligence],
            totalCount: 1,
            sources: [intel.feedName || 'cache'],
            queryTime: new Date(),
            cacheHit: true,
          }
        }
      }

      return {
        intelligence: [],
        totalCount: 0,
        sources: [],
        queryTime: new Date(),
        cacheHit: false,
      }
    } catch (error) {
      logger.error('Failed to query cache:', { error })
      return {
        intelligence: [],
        totalCount: 0,
        sources: [],
        queryTime: new Date(),
        cacheHit: false,
      }
    }
  }

  /**
   * Query threat intelligence database
   */
  private async queryDatabase(
    query: ThreatIntelligenceQuery,
  ): Promise<ThreatIntelligenceResult> {
    try {
      const db = this.mongoClient.db('threat_detection')
      const filter: Record<string, unknown> = {}

      // Build query filter
      if (query.iocType) {
        filter.iocType = query.iocType
      }

      if (query.iocValue) {
        filter.iocValue = query.iocValue
      }

      if (query.threatType) {
        filter.threatType = query.threatType
      }

      if (query.severity) {
        filter.severity = query.severity
      }

      if (query.tags && query.tags.length > 0) {
        filter.tags = { $in: query.tags }
      }

      if (query.source) {
        filter.source = query.source
      }

      if (query.timeRange) {
        filter.lastSeen = {
          $gte: query.timeRange.start,
          $lte: query.timeRange.end,
        }
      }

      // Add expiration filter
      filter.$or = [
        { expirationDate: { $exists: false } },
        { expirationDate: { $gt: new Date() } },
      ]

      const intelligence = await db
        .collection('threat_intelligence')
        .find(filter)
        .sort({ confidence: -1, lastSeen: -1 })
        .limit(100)
        .toArray()

      const sources = Array.from(new Set(intelligence.map((i) => (i as any).feedName as string)))

      return {
        intelligence: intelligence as unknown as ThreatIntelligence[],
        totalCount: intelligence.length,
        sources,
        queryTime: new Date(),
        cacheHit: false,
      }
    } catch (error) {
      logger.error('Failed to query database:', { error })
      return {
        intelligence: [],
        totalCount: 0,
        sources: [],
        queryTime: new Date(),
        cacheHit: false,
      }
    }
  }

  /**
   * Check if intelligence matches query criteria
   */
  private matchesQuery(
    intel: Partial<ThreatIntelligence>,
    query: ThreatIntelligenceQuery,
  ): boolean {
    if (query.threatType && intel.threatType !== query.threatType) {
      return false
    }

    if (query.severity && intel.severity !== query.severity) {
      return false
    }

    if (query.source && intel.source !== query.source) {
      return false
    }

    if (query.tags && query.tags.length > 0) {
      const intelTags = intel.tags || []
      const hasMatchingTag = query.tags.some((tag) => intelTags.includes(tag))
      if (!hasMatchingTag) {
        return false
      }
    }

    return true
  }

  /**
   * Check if IOC is malicious
   */
  async checkIOC(
    iocType: string,
    iocValue: string,
  ): Promise<{
    isMalicious: boolean
    intelligence?: ThreatIntelligence
    sources: string[]
  }> {
    try {
      const result = await this.queryIntelligence({
        iocType,
        iocValue,
      })

      if (result.intelligence.length > 0) {
        // Sort by confidence and severity
        const sorted = result.intelligence.sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
          const severityDiff =
            severityOrder[b.severity] - severityOrder[a.severity]
          if (severityDiff !== 0) {
            return severityDiff
          }
          return b.confidence - a.confidence
        })

        return {
          isMalicious: true,
          intelligence: sorted[0],
          sources: result.sources,
        }
      }

      return {
        isMalicious: false,
        sources: [],
      }
    } catch (error) {
      logger.error('Failed to check IOC:', { error, iocType, iocValue })
      return {
        isMalicious: false,
        sources: [],
      }
    }
  }

  /**
   * Enrich threat response with external intelligence
   */
  async enrichThreatResponse(
    threatResponse: ThreatResponse,
  ): Promise<ThreatResponse> {
    try {
      const enrichedResponse = { ...threatResponse }
      const intelligenceFindings: Record<string, unknown>[] = []

      // Extract IOCs from threat response
      const iocs = this.extractIOCsFromResponse(threatResponse)

      for (const ioc of iocs) {
        const checkResult = await this.checkIOC(ioc.type, ioc.value)

        if (checkResult.isMalicious && checkResult.intelligence) {
          intelligenceFindings.push({
            ioc: ioc,
            intelligence: checkResult.intelligence,
            sources: checkResult.sources,
          })
        }
      }

      if (intelligenceFindings.length > 0) {
        enrichedResponse.metadata = {
          ...enrichedResponse.metadata,
          externalIntelligence: {
            findings: intelligenceFindings,
            enrichmentTimestamp: new Date(),
            sources: Array.from(new Set(
              intelligenceFindings.flatMap((f) => f.sources as string[]),
            )),
          },
        }
      }

      return enrichedResponse
    } catch (error) {
      logger.error('Failed to enrich threat response:', {
        error,
        responseId: threatResponse.responseId,
      })
      return threatResponse
    }
  }

  /**
   * Extract IOCs from threat response
   */
  private extractIOCsFromResponse(
    threatResponse: ThreatResponse,
  ): Array<{ type: string; value: string }> {
    const iocs: Array<{ type: string; value: string }> = []

    try {
      // Extract from actions
      for (const action of threatResponse.actions) {
        if (action.actionType === 'ip_block' && action.parameters.sourceIp) {
          iocs.push({ type: 'ip', value: action.parameters.sourceIp as string })
        }

        if (action.actionType === 'domain_block' && action.parameters.domain) {
          iocs.push({
            type: 'domain',
            value: action.parameters.domain as string,
          })
        }
      }

      // Extract from metadata
      if (threatResponse.metadata?.ip) {
        iocs.push({ type: 'ip', value: threatResponse.metadata.ip as string })
      }

      if (threatResponse.metadata?.userAgent) {
        iocs.push({
          type: 'user_agent',
          value: threatResponse.metadata.userAgent as string,
        })
      }
    } catch (error) {
      logger.error('Failed to extract IOCs from response:', {
        error,
        responseId: threatResponse.responseId,
      })
    }

    return iocs
  }

  /**
   * Get threat intelligence statistics
   */
  async getStatistics(): Promise<{
    totalIntelligence: number
    activeIntelligence: number
    feedStats: Record<
      string,
      {
        total: number
        active: number
        lastUpdate: Date
      }
    >
    topThreatTypes: Array<{ type: string; count: number }>
    severityDistribution: Record<string, number>
  }> {
    try {
      const db = this.mongoClient.db('threat_detection')

      const [
        totalIntelligence,
        activeIntelligence,
        feedStats,
        topThreatTypes,
        severityDistribution,
      ] = await Promise.all([
        db.collection('threat_intelligence').countDocuments(),
        db.collection('threat_intelligence').countDocuments({
          $or: [
            { expirationDate: { $exists: false } },
            { expirationDate: { $gt: new Date() } },
          ],
        }),
        this.getFeedStatistics(db),
        this.getTopThreatTypes(db),
        this.getSeverityDistribution(db),
      ])

      return {
        totalIntelligence,
        activeIntelligence,
        feedStats,
        topThreatTypes,
        severityDistribution,
      }
    } catch (error) {
      logger.error('Failed to get threat intelligence statistics:', { error })
      return {
        totalIntelligence: 0,
        activeIntelligence: 0,
        feedStats: {},
        topThreatTypes: [],
        severityDistribution: {},
      }
    }
  }

  /**
   * Get feed statistics
   */
  private async getFeedStatistics(
    db: Db,
  ): Promise<
    Record<string, { total: number; active: number; lastUpdate: Date }>
  > {
    const feedStats: Record<
      string,
      { total: number; active: number; lastUpdate: Date }
    > = {}

    for (const feed of this.config.feeds) {
      if (!feed.enabled) {
        continue
      }

      const [total, active, lastUpdate] = await Promise.all([
        db
          .collection('threat_intelligence')
          .countDocuments({ feedName: feed.name }),
        db.collection('threat_intelligence').countDocuments({
          feedName: feed.name,
          $or: [
            { expirationDate: { $exists: false } },
            { expirationDate: { $gt: new Date() } },
          ],
        }),
        db
          .collection('threat_intelligence')
          .findOne({ feedName: feed.name }, { sort: { lastSeen: -1 } }),
      ])

      feedStats[feed.name] = {
        total,
        active,
        lastUpdate: lastUpdate?.lastSeen || new Date(0),
      }
    }

    return feedStats
  }

  /**
   * Get top threat types
   */
  private async getTopThreatTypes(
    db: Db,
  ): Promise<Array<{ type: string; count: number }>> {
    const pipeline = [
      {
        $group: {
          _id: '$threatType',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          type: '$_id',
          count: 1,
          _id: 0,
        },
      },
    ]

    const results = await db
      .collection('threat_intelligence')
      .aggregate(pipeline)
      .toArray() as unknown as Array<{ type: string; count: number }>

    return results
  }

  /**
   * Get severity distribution
   */
  private async getSeverityDistribution(
    db: Db,
  ): Promise<Record<string, number>> {
    const pipeline = [
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          severity: '$_id',
          count: 1,
          _id: 0,
        },
      },
    ]

    const results = await db
      .collection('threat_intelligence')
      .aggregate(pipeline)
      .toArray() as unknown as Array<{ severity: string; count: number }>

    const distribution: Record<string, number> = {}
    for (const result of results) {
      distribution[result.severity] = result.count
    }

    return distribution
  }

  /**
   * Clean up expired intelligence
   */
  async cleanupExpiredIntelligence(): Promise<number> {
    try {
      const db = this.mongoClient.db('threat_detection')

      const result = await db.collection('threat_intelligence').deleteMany({
        expirationDate: { $lt: new Date() },
      })

      logger.info(
        `Cleaned up ${result.deletedCount} expired intelligence items`,
      )

      // Clean up Redis cache
      const keys = await this.redis.keys('threat_intel:*')
      for (const key of keys) {
        const ttl = await this.redis.ttl(key)
        if (ttl < 0) {
          await this.redis.del(key)
        }
      }

      return result.deletedCount
    } catch (error) {
      logger.error('Failed to cleanup expired intelligence:', { error })
      return 0
    }
  }

  /**
   * Sync with external threat intelligence platforms
   */
  async syncWithPlatforms(platforms: string[]): Promise<void> {
    try {
      for (const platform of platforms) {
        await this.syncWithPlatform(platform)
      }
    } catch (error) {
      logger.error('Failed to sync with platforms:', { error, platforms })
      throw error
    }
  }

  /**
   * Sync with a specific threat intelligence platform
   */
  private async syncWithPlatform(platform: string): Promise<void> {
    try {
      logger.info(`Syncing with threat intelligence platform: ${platform}`)

      // Platform-specific sync logic would go here
      // This is a placeholder for different platform integrations

      switch (platform.toLowerCase()) {
        case 'virustotal':
          await this.syncWithVirusTotal()
          break

        case 'abuseipdb':
          await this.syncWithAbuseIPDB()
          break

        case 'alienvault':
          await this.syncWithAlienVault()
          break

        default:
          logger.warn(`Unknown threat intelligence platform: ${platform}`)
      }
    } catch (error) {
      logger.error(`Failed to sync with platform ${platform}:`, { error })
      throw error
    }
  }

  /**
   * Sync with VirusTotal
   */
  private async syncWithVirusTotal(): Promise<void> {
    // Implementation for VirusTotal API integration
    logger.info('Syncing with VirusTotal')
  }

  /**
   * Sync with AbuseIPDB
   */
  private async syncWithAbuseIPDB(): Promise<void> {
    // Implementation for AbuseIPDB API integration
    logger.info('Syncing with AbuseIPDB')
  }

  /**
   * Sync with AlienVault OTX
   */
  private async syncWithAlienVault(): Promise<void> {
    // Implementation for AlienVault OTX API integration
    logger.info('Syncing with AlienVault OTX')
  }

  async shutdown(): Promise<void> {
    try {
      await this.stopUpdates()

      if (this.mongoClient) {
        await this.mongoClient.close()
      }

      if (this.redis) {
        await this.redis.quit()
      }

      logger.info('External threat intelligence service shutdown completed')
      this.emit('intelligence_shutdown')
    } catch (error) {
      logger.error('Failed to shutdown threat intelligence service:', { error })
      throw error
    }
  }
}
