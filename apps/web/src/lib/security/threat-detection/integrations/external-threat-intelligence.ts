import { EventEmitter } from 'events'

import axios, { AxiosInstance } from 'axios'
import Redis from 'ioredis'
import { MongoClient, type Db } from 'mongodb'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import {
  addRateLimitingInterceptor,
  mapSeverity,
  extractConfidence,
  matchesQuery,
  extractIOCsFromResponse,
  getTopThreatTypes,
  getSeverityDistribution,
  syncWithVirusTotal,
  syncWithAbuseIPDB,
  syncWithAlienVault,
  queryDatabase,
  getFeedStatistics,
} from './external-threat-intelligence.utils'
export type {
  ThreatIntelligenceConfig,
  ThreatIntelligenceFeed,
  ThreatIntelligence,
  ThreatIntelligenceQuery,
  ThreatIntelligenceResult,
} from './external-threat-intelligence.types'
import type { ThreatResponse } from '../response-orchestration'

const logger = createBuildSafeLogger('external-threat-intelligence')

export class ExternalThreatIntelligenceService extends EventEmitter {
  private mongoClient!: MongoClient
  private redis!: Redis
  private readonly config: ThreatIntelligenceConfig
  private readonly httpClients: Map<string, AxiosInstance> = new Map()
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
        this.config.mongoUrl ??
          process.env['MONGODB_URI'] ??
          'mongodb://localhost:27017/threat_detection',
      )
      await this.mongoClient.connect()

      this.redis = new Redis(
        this.config.redisUrl ??
          process.env['REDIS_URL'] ??
          'redis://localhost:6379',
      )

      // Initialize HTTP clients for each feed
      this.initializeHttpClients()

      logger.info('External threat intelligence service initialized')
      this.emit('intelligence_initialized')
    } catch (error: unknown) {
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
      addRateLimitingInterceptor(client, feed)

      this.httpClients.set(feed.name, client)
    }
  }

  /**
   * Add rate limiting interceptor to HTTP client
   */

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
          } catch (error: unknown) {
            logger.error(`Failed to update feed ${feed.name}:`, { error })
          }
        }, feed.updateFrequency)

        this.updateIntervals.push(interval)
      }

      logger.info('External threat intelligence updates started')
      this.emit('intelligence_updates_started')
    } catch (error: unknown) {
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
      } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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

        if (obj['threats'] && Array.isArray(obj['threats'])) {
          // Format: { threats: [...] }
          for (const item of obj['threats']) {
            const transformed = this.transformIntelligenceItem(feed, item)
            if (transformed) {
              intelligence.push(transformed)
            }
          }
        } else if (obj['data'] && Array.isArray(obj['data'])) {
          // Format: { data: [...] }
          for (const item of obj['data']) {
            const transformed = this.transformIntelligenceItem(feed, item)
            if (transformed) {
              intelligence.push(transformed)
            }
          }
        } else if (obj['objects'] && Array.isArray(obj['objects'])) {
          // STIX2 format
          for (const item of obj['objects']) {
            const transformed = this.transformSTIX2Item(feed, item)
            if (transformed) {
              intelligence.push(transformed)
            }
          }
        }
      }

      return intelligence
    } catch (error: unknown) {
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
      const iocValue = String(
        data['value'] ?? data['ioc'] ?? data['indicator'] ?? '',
      )
      const iocType = String(data['type'] ?? data['ioc_type'] ?? 'unknown')
      const threatType = String(
        data['threat_type'] ?? data['malware_family'] ?? 'unknown',
      )
      const severity = mapSeverity(
        String(data['severity'] ?? data['confidence'] ?? 'medium'),
      )
      const confidence = extractConfidence(
        data['confidence'] ?? data['score'] ?? 50,
      )

      if (!iocValue) {
        return null
      }

      return {
        intelligenceId: `intel_${feed.name}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        feedName: feed.name,
        iocType: iocType,
        iocValue: iocValue,
        threatType: threatType,
        severity,
        confidence,
        firstSeen: new Date(
          (data['first_seen'] ?? data['created'] ?? Date.now()) as string | number | Date,
        ),
        lastSeen: new Date(
          (data['last_seen'] ?? data['updated'] ?? Date.now()) as string | number | Date,
        ),
        expirationDate: data['expiration_date']
          ? new Date(data['expiration_date'] as string)
          : undefined,
        source: String(data['source'] ?? feed.name),
        tags: Array.isArray(data['tags']) ? (data['tags'] as string[]) : [],
        metadata: {
          originalData: data,
          feedType: feed.type,
          transformationDate: new Date(),
        },
        relatedIOCs: Array.isArray(data['related_iocs'])
          ? (data['related_iocs'] as string[])
          : undefined,
        attribution: data['attribution']
          ? {
              actor:
                ((data['attribution'] as Record<string, unknown>)[
                  'actor'
                ] as string) || 'unknown',
              campaign:
                ((data['attribution'] as Record<string, unknown>)[
                  'campaign'
                ] as string) || 'unknown',
              family:
                ((data['attribution'] as Record<string, unknown>)[
                  'family'
                ] as string) ?? 'unknown',
            }
          : undefined,
      }
    } catch (error: unknown) {
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
      if (data['type'] !== 'indicator' && data['type'] !== 'malware') {
        return null
      }

      let iocValue = ''
      let iocType = 'unknown'
      let threatType = 'unknown'

      if (data['type'] === 'indicator') {
        // Extract IOC from pattern
        const pattern = (data['pattern'] as string) || ''
        const patternMatch = pattern.match(/([a-zA-Z]+)\s*=\s*['"]([^'"]+)['"]/)

        if (patternMatch) {
          iocType = patternMatch?.[1].toLowerCase()
          iocValue = patternMatch[2]
        }
      } else if (data['type'] === 'malware') {
        iocType = 'malware'
        iocValue = (data['name'] as string) || 'unknown'
        threatType = data['labels']
          ? (data['labels'] as string[]).join(', ')
          : 'malware'
      }

      if (!iocValue) {
        return null
      }

      return {
        intelligenceId:
          (data['id'] as string) || `intel_${feed.name}_${Date.now()}`,
        feedName: feed.name,
        iocType,
        iocValue,
        threatType,
        severity: mapSeverity(String(data['confidence'] ?? 'medium')),
        confidence: extractConfidence(data['confidence'] ?? 50),
        firstSeen: new Date((data['created'] ?? Date.now()) as string | number | Date),
        lastSeen: new Date((data['modified'] ?? Date.now()) as string | number | Date),
        source: (data['created_by_ref'] as string) || feed.name,
        tags: Array.isArray(data['labels']) ? (data['labels'] as string[]) : [],
        metadata: {
          stixType: data['type'] || 'unknown',
          specVersion: data['spec_version'] ?? '2.0',
          transformationDate: new Date(),
        },
      }
    } catch (error: unknown) {
      logger.error('Failed to transform STIX2 item:', { error })
      return null
    }
  }

  /**
   * Map severity string to standardized value
   */

  /**
   * Extract confidence score from various formats
   */

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
            const existingId = existing['_id']
            await db.collection('threat_intelligence').updateOne(
              { ['_id']: existingId },
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
        } catch (error: unknown) {
          logger.error(`Failed to process intelligence item:`, { error, intel })
        }
      }

      logger.info(
        `Processed ${intelligence.length} intelligence items from ${feed.name}`,
      )
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
      const dbResult = await queryDatabase(this.mongoClient, query)

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
    } catch (error: unknown) {
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
        if (matchesQuery(intel, query)) {
          return {
            intelligence: [intel as ThreatIntelligence],
            totalCount: 1,
            sources: [intel.feedName ?? 'cache'],
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
    } catch (error: unknown) {
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

  /**
   * Check if intelligence matches query criteria
   */

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
    } catch (error: unknown) {
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
      const iocs = extractIOCsFromResponse(threatResponse)

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
            sources: Array.from(
              new Set(
                intelligenceFindings.flatMap((f) => f['sources'] as string[]),
              ),
            ),
          },
        }
      }

      return enrichedResponse
    } catch (error: unknown) {
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
        getFeedStatistics(this.config, db),
        getTopThreatTypes(db),
        getSeverityDistribution(db),
      ])

      return {
        totalIntelligence,
        activeIntelligence,
        feedStats,
        topThreatTypes,
        severityDistribution,
      }
    } catch (error: unknown) {
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

  /**
   * Get top threat types
   */

  /**
   * Get severity distribution
   */

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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
          await syncWithVirusTotal()
          break

        case 'abuseipdb':
          await syncWithAbuseIPDB()
          break

        case 'alienvault':
          await syncWithAlienVault()
          break

        default:
          logger.warn(`Unknown threat intelligence platform: ${platform}`)
      }
    } catch (error: unknown) {
      logger.error(`Failed to sync with platform ${platform}:`, { error })
      throw error
    }
  }

  /**
   * Sync with VirusTotal
   */

  /**
   * Sync with AbuseIPDB
   */

  /**
   * Sync with AlienVault OTX
   */

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
    } catch (error: unknown) {
      logger.error('Failed to shutdown threat intelligence service:', { error })
      throw error
    }
  }
}
