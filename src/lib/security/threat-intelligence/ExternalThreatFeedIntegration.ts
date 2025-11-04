/**
 * External Threat Feed Integration System
 * Integrates with multiple external threat intelligence sources
 * Supports STIX/TAXII, MISP, commercial feeds, and custom APIs
 */

import { EventEmitter } from 'events'
import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { MongoClient, Db, Collection } from 'mongodb'
import { Redis } from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../../logger'
import https from 'https'

/**
 * Normalize unknown errors into Error instances with safe message
 */
function normalizeError(err: unknown): Error {
  if (err instanceof Error) return err
  try {
    return new Error(typeof err === 'string' ? err : JSON.stringify(err))
  } catch {
    return new Error(String(err))
  }
}

export interface ThreatFeed {
  id: string
  name: string
  description: string
  type: 'stix_taxii' | 'misp' | 'commercial_api' | 'open_source' | 'custom'
  provider: string
  endpoint: string
  authentication: FeedAuthentication
  configuration: FeedConfiguration
  status: 'active' | 'inactive' | 'error' | 'maintenance'
  last_sync?: Date
  next_sync?: Date
  sync_frequency: 'hourly' | 'daily' | 'weekly' | 'real_time'
  rate_limiting: RateLimitConfig
  data_quality: DataQualityMetrics
  created_at: Date
  updated_at: Date
}

export interface FeedAuthentication {
  type: 'api_key' | 'oauth2' | 'basic_auth' | 'certificate' | 'none'
  credentials: Record<string, unknown>
  headers?: Record<string, string>
}

export interface FeedConfiguration {
  format: 'stix' | 'misp' | 'json' | 'csv' | 'xml' | 'custom'
  version?: string
  fields_mapping?: Record<string, string>
  filters?: FeedFilters
  transformations?: DataTransformation[]
  deduplication_rules?: DeduplicationRule[]
}

export interface FeedFilters {
  confidence_threshold?: number
  severity_levels?: string[]
  threat_types?: string[]
  time_range?: {
    start?: Date
    end?: Date
  }
  geographic_regions?: string[]
  industry_sectors?: string[]
}

export interface DataTransformation {
  field: string
  operation: 'map' | 'filter' | 'normalize' | 'enrich' | 'validate'
  parameters: Record<string, unknown>
}

export interface DeduplicationRule {
  fields: string[]
  time_window: number // hours
  confidence_threshold: number
}

export interface RateLimitConfig {
  requests_per_minute?: number
  requests_per_hour?: number
  requests_per_day?: number
  burst_capacity?: number
  retry_after_header?: string
}

export interface DataQualityMetrics {
  completeness: number // 0-1
  accuracy: number // 0-1
  timeliness: number // 0-1
  uniqueness: number // 0-1
  validity: number // 0-1
  last_assessment?: Date
}

export interface ThreatIndicator {
  id: string
  feed_id: string
  type:
    | 'ip'
    | 'domain'
    | 'hash'
    | 'url'
    | 'email'
    | 'file'
    | 'behavior'
    | 'vulnerability'
  value: string
  confidence: number // 0-1
  severity: 'low' | 'medium' | 'high' | 'critical'
  threat_type: string
  description: string
  first_seen: Date
  last_seen: Date
  expiration_date?: Date
  source_reliability: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' // STIX reliability scale
  tags: string[]
  attributes: Record<string, unknown>
  relationships: ThreatRelationship[]
  raw_data?: Record<string, unknown>
}

export interface ThreatRelationship {
  type: 'related_to' | 'indicates' | 'uses' | 'targets' | 'attributed_to'
  target_id: string
  target_type: string
  confidence: number
  description?: string
}

export interface FeedSyncResult {
  id: string
  feed_id: string
  timestamp: Date
  status: 'success' | 'partial_success' | 'failed' | 'skipped'
  indicators_processed: number
  indicators_added: number
  indicators_updated: number
  indicators_removed: number
  errors: SyncError[]
  performance_metrics: SyncPerformanceMetrics
  data_quality_assessment: DataQualityMetrics
}

export interface SyncError {
  code: string
  message: string
  details?: Record<string, unknown>
  timestamp: Date
}

export interface SyncPerformanceMetrics {
  download_time: number
  processing_time: number
  total_time: number
  data_size: number
  api_calls: number
  rate_limit_hits: number
}

export interface ExternalThreatFeedIntegrationConfig {
  mongodb: {
    url: string
    database: string
  }
  redis: {
    url: string
    password?: string
  }
  feeds: ThreatFeed[]
  sync_settings: {
    max_concurrent_syncs: number
    retry_attempts: number
    retry_delay: number
    timeout: number
    batch_size: number
  }
  quality_thresholds: {
    min_completeness: number
    min_accuracy: number
    min_timeliness: number
    min_uniqueness: number
    min_validity: number
  }
  integration_apis: {
    stix_taxii_client: string
    misp_client: string
    threat_intel_platform: string
  }
}

// Generic JSON value type for unknown feed payloads
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | JSONValue[]

export interface OAuth2Credentials {
  client_id?: string
  client_secret?: string
  token_url?: string
  scope?: string
}

export type CertificateAgent =
  | https.Agent
  | { cert?: string; key?: string; ca?: string }

export class ExternalThreatFeedIntegration extends EventEmitter {
  private mongoClient: MongoClient
  private db: Db
  private feedsCollection: Collection<ThreatFeed>
  private indicatorsCollection: Collection<ThreatIndicator>
  private syncResultsCollection: Collection<FeedSyncResult>
  private redis: Redis
  private isInitialized = false
  private feedClients = new Map<string, AxiosInstance>()
  private syncQueue: string[] = []
  private isProcessing = false
  private activeSyncs = new Map<string, Promise<void>>()

  constructor(private _config: ExternalThreatFeedIntegrationConfig) {
    super()
    this.setMaxListeners(0)
  }

  /**
   * Initialize the external threat feed integration system
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing External Threat Feed Integration System')

      // Initialize MongoDB connection
      this.mongoClient = new MongoClient(this._config.mongodb.url)
      await this.mongoClient.connect()
      this.db = this.mongoClient.db(this._config.mongodb.database)

      // Initialize collections
      this.feedsCollection = this.db.collection<ThreatFeed>('threat_feeds')
      this.indicatorsCollection =
        this.db.collection<ThreatIndicator>('threat_indicators')
      this.syncResultsCollection =
        this.db.collection<FeedSyncResult>('feed_sync_results')

      // Create indexes for performance
      await this.createIndexes()

      // Initialize Redis connection
      this.redis = new Redis(this._config.redis.url, {
        password: this._config.redis.password,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      })

      // Set up Redis pub/sub for real-time coordination
      await this.setupRedisPubSub()

      // Initialize feed clients
      await this.initializeFeedClients()

      // Start background processing
      this.startSyncProcessing()

      this.isInitialized = true
      logger.info(
        'External Threat Feed Integration System initialized successfully',
      )

      this.emit('initialized', { timestamp: new Date() })
    } catch (error: unknown) {
      const normalized = normalizeError(error)
      logger.error(
        'Failed to initialize External Threat Feed Integration System',
        { error: normalized.message },
      )
      throw new Error(
        'Failed to initialize external threat feed integration system',
        { cause: error },
      )
    }
  }

  /**
   * Create database indexes for optimal performance
   */
  private async createIndexes(): Promise<void> {
    try {
      await Promise.all([
        // Feeds collection indexes
        this.feedsCollection.createIndex({ id: 1 }, { unique: true }),
        this.feedsCollection.createIndex({ type: 1 }),
        this.feedsCollection.createIndex({ status: 1 }),
        this.feedsCollection.createIndex({ provider: 1 }),
        this.feedsCollection.createIndex({ next_sync: 1 }),

        // Indicators collection indexes
        this.indicatorsCollection.createIndex({ id: 1 }, { unique: true }),
        this.indicatorsCollection.createIndex({ feed_id: 1 }),
        this.indicatorsCollection.createIndex({ type: 1 }),
        this.indicatorsCollection.createIndex({ value: 1 }),
        this.indicatorsCollection.createIndex({ confidence: -1 }),
        this.indicatorsCollection.createIndex({ severity: 1 }),
        this.indicatorsCollection.createIndex({ threat_type: 1 }),
        this.indicatorsCollection.createIndex({ first_seen: -1 }),
        this.indicatorsCollection.createIndex({ last_seen: -1 }),
        this.indicatorsCollection.createIndex({ expiration_date: 1 }),
        this.indicatorsCollection.createIndex({ tags: 1 }),
        this.indicatorsCollection.createIndex({ 'attributes.hash': 1 }),

        // Sync results collection indexes
        this.syncResultsCollection.createIndex({ id: 1 }, { unique: true }),
        this.syncResultsCollection.createIndex({ feed_id: 1 }),
        this.syncResultsCollection.createIndex({ timestamp: -1 }),
        this.syncResultsCollection.createIndex({ status: 1 }),
      ])

      logger.info('Database indexes created successfully')
    } catch (error: unknown) {
      const normalized = normalizeError(error)
      logger.error('Failed to create database indexes', {
        error: normalized.message,
      })
      throw error
    }
  }

  /**
   * Set up Redis pub/sub for real-time coordination
   */
  private async setupRedisPubSub(): Promise<void> {
    try {
      const subscriber = this.redis.duplicate()
      await subscriber.connect()

      // Subscribe to sync requests
      await subscriber.subscribe('feed:sync', async (message) => {
        try {
          const syncData = JSON.parse(message)
          await this.syncFeed(syncData.feed_id)
        } catch (error: unknown) {
          const normalized = normalizeError(error)
          logger.error('Failed to process feed sync request', {
            error: normalized.message,
          })
        }
      })

      // Subscribe to feed status updates
      await subscriber.subscribe('feed:status', async (message) => {
        try {
          const statusData = JSON.parse(message)
          await this.updateFeedStatus(statusData.feed_id, statusData.status)
        } catch (error: unknown) {
          const normalized = normalizeError(error)
          logger.error('Failed to process feed status update', {
            error: normalized.message,
          })
        }
      })

      logger.info('Redis pub/sub setup completed')
    } catch (error: unknown) {
      const normalized = normalizeError(error)
      logger.error('Failed to setup Redis pub/sub', {
        error: normalized.message,
      })
      throw error
    }
  }

  /**
   * Initialize HTTP clients for feeds
   */
  private async initializeFeedClients(): Promise<void> {
    try {
      for (const feed of this._config.feeds) {
        const client = this.createFeedClient(feed)
        this.feedClients.set(feed.id, client)
        logger.info('Feed client initialized', {
          feed_id: feed.id,
          provider: feed.provider,
        })
      }
    } catch (error: unknown) {
      const normalized = normalizeError(error)
      logger.error('Failed to initialize feed clients', {
        error: normalized.message,
      })
      throw error
    }
  }

  /**
   * Create HTTP client for a specific feed
   */
  private createFeedClient(feed: ThreatFeed): AxiosInstance {
    const client = axios.create({
      baseURL: feed.endpoint,
      timeout: this._config.sync_settings.timeout,
      headers: {
        'User-Agent': 'Pixelated-Threat-Intel-Client/1.0',
        'Content-Type': 'application/json',
        ...feed.authentication.headers,
      },
    })

    // Add authentication
    this.configureAuthentication(client, feed.authentication)

    // Add rate limiting
    this.configureRateLimiting(client, feed.rate_limiting)

    // Add response interceptors for error handling
    client.interceptors.response.use(
      (response) => response,
      (error) => this.handleFeedError(error, feed.id),
    )

    return client
  }

  /**
   * Configure authentication for feed client
   */
  private configureAuthentication(
    client: AxiosInstance,
    auth: FeedAuthentication,
  ): void {
    switch (auth.type) {
      case 'api_key':
        client.defaults.headers.common['X-API-Key'] = auth.credentials.api_key
        break
      case 'oauth2':
        // Implement OAuth2 token management
        this.setupOAuth2Authentication(client, auth.credentials)
        break
      case 'basic_auth':
        client.defaults.auth = {
          username: auth.credentials.username,
          password: auth.credentials.password,
        }
        break
      case 'certificate':
        // Implement certificate-based authentication
        client.defaults.httpsAgent = this.createCertificateAgent(
          auth.credentials,
        )
        break
      case 'none':
        // No authentication required
        break
      default:
        logger.warn('Unknown authentication type', { type: auth.type })
    }
  }

  /**
   * Set up OAuth2 authentication
   */
  private setupOAuth2Authentication(
    client: AxiosInstance,
    credentials: OAuth2Credentials,
  ): void {
    // Implement OAuth2 token refresh logic
    client.interceptors.request.use(async (config) => {
      // Check if token needs refresh
      const token = await this.getValidOAuth2Token(credentials)
      config.headers.Authorization = `Bearer ${token}`
      return config
    })
  }

  /**
   * Get valid OAuth2 token
   */
  private async getValidOAuth2Token(
    credentials: OAuth2Credentials,
  ): Promise<string> {
    // Implement token refresh logic
    // This is a simplified implementation
    const tokenKey = `oauth2_token:${credentials.client_id}`
    let token = await this.redis.get(tokenKey)

    if (!token) {
      // Request new token
      const response = await axios.post(credentials.token_url as string, {
        grant_type: 'client_credentials',
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        scope: credentials.scope,
      })

      token = response.data?.access_token
      const expiresIn = response.data?.expires_in as number | undefined

      // Store token with expiration
      await this.redis.setex(tokenKey, expiresIn - 60, token) // Refresh 1 minute early
    }

    return token
  }

  /**
   * Create certificate agent for mutual TLS
   */
  private createCertificateAgent(
    credentials: Record<string, unknown>,
  ): CertificateAgent {
    // Implement certificate-based authentication
    // Use https.Agent when PEM strings or buffers are provided
    try {
      const cert = credentials['certificate'] as string | undefined
      const key = credentials['private_key'] as string | undefined
      const ca = credentials['ca_certificate'] as string | undefined

      if (cert || key || ca) {
        return new https.Agent({ cert, key, ca })
      }

      return { cert, key, ca }
    } catch (_e) {
      logger.warn('Invalid certificate credentials provided')
      return {}
    }
  }

  /**
   * Configure rate limiting for feed client
   */
  private configureRateLimiting(
    client: AxiosInstance,
    rateLimit: RateLimitConfig,
  ): void {
    let requestQueue: Array<() => void> = []
    let _requestsThisMinute = 0
    let _requestsThisHour = 0
    let _requestsThisDay = 0

    const processQueue = () => {
      while (requestQueue.length > 0 && this.canMakeRequest(rateLimit)) {
        const request = requestQueue.shift()
        if (request) request()
      }
    }

    client.interceptors.request.use(async (config) => {
      return new Promise((resolve) => {
        if (this.canMakeRequest(rateLimit)) {
          this.incrementRequestCounters(rateLimit)
          resolve(config)
        } else {
          requestQueue.push(() => resolve(config))
          setTimeout(processQueue, 1000) // Check again in 1 second
        }
      })
    })

    // Reset counters periodically
    setInterval(() => {
      _requestsThisMinute = 0
      processQueue()
    }, 60000) // Every minute

    setInterval(() => {
      _requestsThisHour = 0
    }, 3600000) // Every hour

    setInterval(() => {
      _requestsThisDay = 0
    }, 86400000) // Every day
  }

  /**
   * Check if request can be made within rate limits
   */
  private canMakeRequest(_rateLimit: RateLimitConfig): boolean {
    // Simplified rate limiting logic
    return true // Implement actual rate limiting logic
  }

  /**
   * Increment request counters
   */
  private incrementRequestCounters(_rateLimit: RateLimitConfig): void {
    // Implement counter increment logic
  }

  /**
   * Handle feed errors
   */
  private handleFeedError(error: unknown, feedId: string): Promise<never> {
    const normalized = normalizeError(error)
    logger.error('Feed API error', {
      feed_id: feedId,
      error: normalized.message,
    })

    // Update feed status to error
    this.updateFeedStatus(feedId, 'error').catch((err: unknown) => {
      logger.error('Failed to update feed status', {
        error: normalizeError(err).message,
      })
    })

    return Promise.reject(error)
  }

  /**
   * Add new threat feed
   */
  async addFeed(feedData: Partial<ThreatFeed>): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('External threat feed integration system not initialized')
    }

    try {
      const feedId = uuidv4()
      const now = new Date()

      const feed: ThreatFeed = {
        id: feedId,
        name: feedData.name || 'Untitled Feed',
        description: feedData.description || '',
        type: (feedData.type as ThreatFeed['type']) || 'custom',
        provider: feedData.provider || 'unknown',
        endpoint: feedData.endpoint || '',
        authentication: feedData.authentication || {
          type: 'none',
          credentials: {},
        },
        configuration: feedData.configuration || {
          format: 'json',
          filters: {},
          transformations: [],
          deduplication_rules: [],
        },
        status: 'inactive',
        sync_frequency:
          (feedData.sync_frequency as ThreatFeed['sync_frequency']) || 'daily',
        rate_limiting: feedData.rate_limiting || {},
        data_quality: {
          completeness: 0,
          accuracy: 0,
          timeliness: 0,
          uniqueness: 0,
          validity: 0,
        },
        created_at: now,
        updated_at: now,
      }

      // Initialize feed client
      const client = this.createFeedClient(feed)
      this.feedClients.set(feedId, client)
      logger.info('Threat feed added', {
        feed_id: feedId,
        provider: feed.provider,
      })

      this.emit('feed:added', { feed_id: feedId })

      return feedId
    } catch (error) {
      logger.error('Failed to add threat feed', { error: error.message })
      throw error
    }
  }

  /**
   * Sync threat feed
   */
  async syncFeed(feedId: string): Promise<FeedSyncResult> {
    if (!this.isInitialized) {
      throw new Error('External threat feed integration system not initialized')
    }

    const startTime = Date.now()
    const resultId = uuidv4()

    try {
      const feed = await this.feedsCollection.findOne({ id: feedId })

      if (!feed) {
        throw new Error(`Feed not found: ${feedId}`)
      }

      if (feed.status === 'maintenance') {
        logger.info('Feed is in maintenance mode, skipping sync', {
          feed_id: feedId,
        })
        return this.createSkippedResult(resultId, feedId, startTime)
      }

      logger.info('Starting threat feed sync', {
        feed_id: feedId,
        provider: feed.provider,
        type: feed.type,
      })

      // Update feed status
      await this.updateFeedStatus(feedId, 'active')

      const client = this.feedClients.get(feedId)
      if (!client) {
        throw new Error(`Feed client not initialized: ${feedId}`)
      }

      // Download data from feed
      const downloadStart = Date.now()
      const feedData = await this.downloadFeedData(feed, client)
      const downloadTime = Date.now() - downloadStart

      // Process and transform data
      const processingStart = Date.now()
      const processedIndicators = await this.processFeedData(feedData, feed)
      const processingTime = Date.now() - processingStart

      // Apply quality checks
      const qualityMetrics = await this.assessDataQuality(
        processedIndicators,
        feed,
      )

      // Check if data meets quality thresholds
      if (!this.meetsQualityThresholds(qualityMetrics)) {
        logger.warn('Feed data quality below thresholds', {
          feed_id: feedId,
          quality_metrics: qualityMetrics,
        })
      }

      // Store indicators in database
      const storageResult = await this.storeIndicators(
        processedIndicators,
        feed,
      )

      // Create sync result
      const result: FeedSyncResult = {
        id: resultId,
        feed_id: feedId,
        timestamp: new Date(),
        status: storageResult.errors.length > 0 ? 'partial_success' : 'success',
        indicators_processed: processedIndicators.length,
        indicators_added: storageResult.added,
        indicators_updated: storageResult.updated,
        indicators_removed: storageResult.removed,
        errors: storageResult.errors,
        performance_metrics: {
          download_time: downloadTime,
          processing_time: processingTime,
          total_time: Date.now() - startTime,
          data_size: JSON.stringify(feedData).length,
          api_calls: 1,
          rate_limit_hits: 0,
        },
        data_quality_assessment: qualityMetrics,
      }

      // Store sync result
      await this.syncResultsCollection.insertOne(result)

      // Update feed metadata
      await this.updateFeedAfterSync(feedId, result)

      logger.info('Threat feed sync completed', {
        feed_id: feedId,
        indicators_processed: result.indicators_processed,
        total_time: result.performance_metrics.total_time,
      })

      this.emit('feed:sync_completed', {
        feed_id: feedId,
        result_id: resultId,
        indicators_processed: result.indicators_processed,
      })

      return result
    } catch (error: unknown) {
      logger.error('Failed to sync threat feed', {
        error: normalizeError(error).message,
        feed_id: feedId,
      })

      // Create failed result
      const failedResult: FeedSyncResult = {
        id: resultId,
        feed_id: feedId,
        timestamp: new Date(),
        status: 'failed',
        indicators_processed: 0,
        indicators_added: 0,
        indicators_updated: 0,
        indicators_removed: 0,
        errors: [
          {
            code: 'SYNC_FAILED',
            message: normalizeError(error).message,
            timestamp: new Date(),
          },
        ],
        performance_metrics: {
          download_time: 0,
          processing_time: 0,
          total_time: Date.now() - startTime,
          data_size: 0,
          api_calls: 0,
          rate_limit_hits: 0,
        },
        data_quality_assessment: {
          completeness: 0,
          accuracy: 0,
          timeliness: 0,
          uniqueness: 0,
          validity: 0,
        },
      }

      await this.syncResultsCollection.insertOne(failedResult)

      // Update feed status to error
      await this.updateFeedStatus(feedId, 'error')

      throw error
    }
  }

  /**
   * Download data from threat feed
   */
  private async downloadFeedData(
    feed: ThreatFeed,
    client: AxiosInstance,
  ): Promise<unknown> {
    try {
      let response: AxiosResponse

      switch (feed.type) {
        case 'stix_taxii':
          response = await this.downloadSTIXData(feed, client)
          break
        case 'misp':
          response = await this.downloadMISPData(feed, client)
          break
        case 'commercial_api':
          response = await this.downloadCommercialAPIData(feed, client)
          break
        case 'open_source':
          response = await this.downloadOpenSourceData(feed, client)
          break
        case 'custom':
          response = await this.downloadCustomData(feed, client)
          break
        default:
          throw new Error(`Unknown feed type: ${feed.type}`)
      }

      return response.data
    } catch (error: unknown) {
      const normalized = normalizeError(error)
      logger.error('Failed to download feed data', {
        error: normalized.message,
        feed_id: feed.id,
        feed_type: feed.type,
      })
      throw error
    }
  }

  /**
   * Download STIX/TAXII data
   */
  private async downloadSTIXData(
    feed: ThreatFeed,
    client: AxiosInstance,
  ): Promise<AxiosResponse> {
    // Implement STIX/TAXII protocol support
    const taxiiEndpoint = `${feed.endpoint}/taxii2/collections/objects/`

    return await client.get(taxiiEndpoint, {
      params: {
        'match[type]': 'indicator',
        'match[spec_version]': feed.configuration.version || '2.1',
      },
    })
  }

  /**
   * Download MISP data
   */
  private async downloadMISPData(
    feed: ThreatFeed,
    client: AxiosInstance,
  ): Promise<AxiosResponse> {
    // Implement MISP API support
    const mispEndpoint = `${feed.endpoint}/events/restSearch`

    return await client.post(mispEndpoint, {
      returnFormat: 'json',
      limit: 1000,
      published: 1,
      to_ids: 1,
    })
  }

  /**
   * Download commercial API data
   */
  private async downloadCommercialAPIData(
    feed: ThreatFeed,
    client: AxiosInstance,
  ): Promise<AxiosResponse> {
    // Implement commercial API support
    const apiEndpoint = feed.endpoint

    return await client.get(apiEndpoint, {
      params: {
        format: 'json',
        limit: 1000,
        ...feed.configuration.filters,
      },
    })
  }

  /**
   * Download open source data
   */
  private async downloadOpenSourceData(
    feed: ThreatFeed,
    client: AxiosInstance,
  ): Promise<AxiosResponse> {
    // Implement open source feed support
    return await client.get(feed.endpoint)
  }

  /**
   * Download custom data
   */
  private async downloadCustomData(
    feed: ThreatFeed,
    client: AxiosInstance,
  ): Promise<AxiosResponse> {
    // Implement custom feed support
    return await client.get(feed.endpoint, {
      params: feed.configuration.filters,
    })
  }

  /**
   * Process and transform feed data
   */
  private async processFeedData(
    rawData: unknown,
    feed: ThreatFeed,
  ): Promise<ThreatIndicator[]> {
    try {
      logger.info('Processing feed data', {
        feed_id: feed.id,
        data_format: feed.configuration.format,
      })

      let indicators: ThreatIndicator[] = []

      switch (feed.configuration.format) {
        case 'stix':
          indicators = await this.processSTIXData(rawData, feed)
          break
        case 'misp':
          indicators = await this.processMISPData(rawData, feed)
          break
        case 'json':
          indicators = await this.processJSONData(rawData, feed)
          break
        case 'csv':
          indicators = await this.processCSVData(rawData, feed)
          break
        case 'xml':
          indicators = await this.processXMLData(rawData, feed)
          break
        case 'custom':
          indicators = await this.processCustomData(rawData, feed)
          break
        default:
          throw new Error(`Unknown data format: ${feed.configuration.format}`)
      }

      // Apply transformations
      indicators = await this.applyTransformations(
        indicators,
        feed.configuration.transformations,
      )

      // Apply filters
      indicators = await this.applyFilters(
        indicators,
        feed.configuration.filters,
      )

      // Remove duplicates
      indicators = await this.removeDuplicates(
        indicators,
        feed.configuration.deduplication_rules,
      )

      logger.info('Feed data processing completed', {
        feed_id: feed.id,
        indicators_count: indicators.length,
      })

      return indicators
    } catch (error: unknown) {
      logger.error('Failed to process feed data', {
        error: normalizeError(error).message,
        feed_id: feed.id,
      })
      throw error
    }
  }

  /**
   * Process STIX data
   */
  private async processSTIXData(
    data: unknown,
    feed: ThreatFeed,
  ): Promise<ThreatIndicator[]> {
    const indicators: ThreatIndicator[] = []

    const objects = this.getNestedValue(data, 'objects')
    if (Array.isArray(objects)) {
      for (const obj of objects) {
        const type = this.getNestedValue(obj, 'type')
        if (type === 'indicator') {
          const indicator = this.convertSTIXToIndicator(obj, feed)
          if (indicator) indicators.push(indicator)
        }
      }
    }

    return indicators
  }

  /**
   * Convert STIX object to threat indicator
   */
  private convertSTIXToIndicator(
    stixObject: unknown,
    feed: ThreatFeed,
  ): ThreatIndicator | null {
    try {
      const pattern = this.getNestedValue(stixObject, 'pattern') as string
      const indicatorType = this.extractIndicatorTypeFromSTIXPattern(pattern)
      const value = this.extractIndicatorValueFromSTIXPattern(pattern)

      if (!indicatorType || !value) {
        return null
      }

      return {
        id: uuidv4(),
        feed_id: feed.id,
        type: indicatorType,
        value: value,
        confidence: this.mapSTIXConfidence(
          Number(this.getNestedValue(stixObject, 'confidence') ?? 50),
        ),
        severity: this.mapSTIXSeverity(
          (this.getNestedValue(stixObject, 'labels') as string[]) || [],
        ),
        threat_type: this.extractThreatTypeFromSTIX(stixObject),
        description:
          (this.getNestedValue(stixObject, 'description') as string) || '',
        first_seen: new Date(
          String(this.getNestedValue(stixObject, 'created') ?? Date.now()),
        ),
        last_seen: new Date(
          String(this.getNestedValue(stixObject, 'modified') ?? Date.now()),
        ),
        expiration_date: this.getNestedValue(stixObject, 'valid_until')
          ? new Date(String(this.getNestedValue(stixObject, 'valid_until')))
          : undefined,
        source_reliability: this.mapSTIXReliability(
          String(this.getNestedValue(stixObject, 'created_by_ref') ?? ''),
        ),
        tags: (this.getNestedValue(stixObject, 'labels') as string[]) || [],
        attributes: {
          stix_id: this.getNestedValue(stixObject, 'id'),
          pattern: pattern,
          kill_chain_phases: this.getNestedValue(
            stixObject,
            'kill_chain_phases',
          ),
        },
        relationships: [],
        raw_data: (stixObject as Record<string, unknown>) || {},
      }
    } catch (error) {
      logger.error('Failed to convert STIX to indicator', {
        error: normalizeError(error).message,
      })
      return null
    }
  }

  /**
   * Extract indicator type from STIX pattern
   */
  private extractIndicatorTypeFromSTIXPattern(pattern: string): string {
    if (pattern.includes('file:hashes.MD5')) return 'hash'
    if (pattern.includes('ipv4-addr')) return 'ip'
    if (pattern.includes('domain-name')) return 'domain'
    if (pattern.includes('url')) return 'url'
    if (pattern.includes('email-addr')) return 'email'
    return 'behavior'
  }

  /**
   * Extract indicator value from STIX pattern
   */
  private extractIndicatorValueFromSTIXPattern(pattern: string): string {
    const match = pattern.match(/'([^']+)'/)
    return match ? match[1] : ''
  }

  /**
   * Process MISP data
   */
  private async processMISPData(
    data: unknown,
    feed: ThreatFeed,
  ): Promise<ThreatIndicator[]> {
    const indicators: ThreatIndicator[] = []

    const response = this.getNestedValue(data, 'response')
    if (Array.isArray(response)) {
      for (const eventWrapper of response) {
        const event = this.getNestedValue(eventWrapper, 'Event')
        const attributes = this.getNestedValue(event, 'Attribute')
        if (Array.isArray(attributes)) {
          for (const attribute of attributes) {
            const indicator = this.convertMISPToIndicator(
              attribute,
              event,
              feed,
            )
            if (indicator) indicators.push(indicator)
          }
        }
      }
    }

    return indicators
  }

  /**
   * Convert MISP attribute to threat indicator
   */
  private convertMISPToIndicator(
    attribute: unknown,
    event: unknown,
    feed: ThreatFeed,
  ): ThreatIndicator | null {
    try {
      const typeStr = String(this.getNestedValue(attribute, 'type') || '')
      const indicatorType = this.mapMISPTypeToIndicatorType(typeStr)
      if (!indicatorType) return null

      const value = String(this.getNestedValue(attribute, 'value') ?? '')

      const tagsA = this.getNestedValue(attribute, 'Tag')
      const tagsE = this.getNestedValue(event, 'Tag')
      const tagNames: string[] = []
      if (Array.isArray(tagsA))
        tagsA.forEach((t) => {
          const n = this.getNestedValue(t, 'name')
          if (typeof n === 'string') tagNames.push(n)
        })
      if (Array.isArray(tagsE))
        tagsE.forEach((t) => {
          const n = this.getNestedValue(t, 'name')
          if (typeof n === 'string') tagNames.push(n)
        })

      return {
        id: uuidv4(),
        feed_id: feed.id,
        type: indicatorType,
        value,
        confidence: this.mapMISPToConfidence(attribute),
        severity: this.mapMISPToSeverity(attribute),
        threat_type: this.mapMISPToThreatType(attribute),
        description: String(
          this.getNestedValue(attribute, 'comment') ??
            this.getNestedValue(event, 'info') ??
            '',
        ),
        first_seen: new Date(
          String(
            this.getNestedValue(attribute, 'first_seen') ??
              this.getNestedValue(event, 'date') ??
              Date.now(),
          ),
        ),
        last_seen: new Date(
          String(
            this.getNestedValue(attribute, 'last_seen') ??
              this.getNestedValue(event, 'date') ??
              Date.now(),
          ),
        ),
        expiration_date: this.getNestedValue(attribute, 'expiration')
          ? new Date(String(this.getNestedValue(attribute, 'expiration')))
          : undefined,
        source_reliability: 'b', // MISP default reliability
        tags: tagNames,
        attributes: {
          misp_id: this.getNestedValue(attribute, 'id'),
          event_id: this.getNestedValue(event, 'id'),
          category: this.getNestedValue(attribute, 'category'),
          to_ids: this.getNestedValue(attribute, 'to_ids'),
        },
        relationships: [],
        raw_data: { attribute, event },
      }
    } catch (error) {
      logger.error('Failed to convert MISP to indicator', {
        error: normalizeError(error).message,
      })
      return null
    }
  }

  /**
   * Map MISP type to indicator type
   */
  private mapMISPTypeToIndicatorType(mispType: string): string {
    const typeMap: Record<string, string> = {
      'ip-dst': 'ip',
      'ip-src': 'ip',
      'domain': 'domain',
      'hostname': 'domain',
      'url': 'url',
      'md5': 'hash',
      'sha1': 'hash',
      'sha256': 'hash',
      'email-src': 'email',
      'email-dst': 'email',
      'filename': 'file',
    }

    return typeMap[mispType] || 'behavior'
  }

  /**
   * Process JSON data
   */
  private async processJSONData(
    data: unknown,
    feed: ThreatFeed,
  ): Promise<ThreatIndicator[]> {
    const indicators: ThreatIndicator[] = []

    // Handle different JSON structures
    if (Array.isArray(data)) {
      for (const item of data) {
        const indicator = this.convertJSONToIndicator(item, feed)
        if (indicator) indicators.push(indicator)
      }
    } else {
      const arr = this.getNestedValue(data, 'indicators')
      if (Array.isArray(arr)) {
        for (const item of arr) {
          const indicator = this.convertJSONToIndicator(item, feed)
          if (indicator) indicators.push(indicator)
        }
      }
    }

    return indicators
  }

  /**
   * Convert JSON object to threat indicator
   */
  private convertJSONToIndicator(
    data: unknown,
    feed: ThreatFeed,
  ): ThreatIndicator | null {
    try {
      const type = String(
        this.getNestedValue(data, 'type') ??
          this.getNestedValue(data, 'indicator') ??
          'ip',
      )
      const value = String(
        this.getNestedValue(data, 'value') ??
          this.getNestedValue(data, 'indicator') ??
          '',
      )
      const confidence = Number(this.getNestedValue(data, 'confidence') ?? 0.5)
      const severity = String(
        this.getNestedValue(data, 'severity') ?? 'medium',
      ) as 'low' | 'medium' | 'high' | 'critical'

      return {
        id: uuidv4(),
        feed_id: feed.id,
        type: type as ThreatIndicator['type'],
        value,
        confidence,
        severity,
        threat_type: String(
          this.getNestedValue(data, 'threat_type') ?? 'unknown',
        ),
        description: String(this.getNestedValue(data, 'description') ?? ''),
        first_seen: new Date(
          String(this.getNestedValue(data, 'first_seen') ?? Date.now()),
        ),
        last_seen: new Date(
          String(this.getNestedValue(data, 'last_seen') ?? Date.now()),
        ),
        expiration_date: this.getNestedValue(data, 'expiration_date')
          ? new Date(String(this.getNestedValue(data, 'expiration_date')))
          : undefined,
        source_reliability: String(
          this.getNestedValue(data, 'reliability') ?? 'c',
        ) as ThreatIndicator['source_reliability'],
        tags: (this.getNestedValue(data, 'tags') as string[]) ?? [],
        attributes:
          (this.getNestedValue(data, 'attributes') as Record<
            string,
            unknown
          >) ?? {},
        relationships: [],
        raw_data: (data as Record<string, unknown>) ?? {},
      }
    } catch (error) {
      logger.error('Failed to convert JSON to indicator', {
        error: normalizeError(error).message,
      })
      return null
    }
  }

  /**
   * Process CSV data
   */
  private async processCSVData(
    data: string,
    feed: ThreatFeed,
  ): Promise<ThreatIndicator[]> {
    const indicators: ThreatIndicator[] = []

    // Simple CSV parsing (in production, use a proper CSV parser)
    const lines = data.split('\n')
    const headers = lines[0].split(',').map((h) => h.trim())

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim())
      if (values.length === headers.length) {
        const item: Record<string, unknown> = {}
        headers.forEach((header, index) => {
          item[header] = values[index]
        })

        const indicator = this.convertJSONToIndicator(item, feed)
        if (indicator) {
          indicators.push(indicator)
        }
      }
    }

    return indicators
  }

  /**
   * Process XML data
   */
  private async processXMLData(
    data: string,
    feed: ThreatFeed,
  ): Promise<ThreatIndicator[]> {
    // Implement XML parsing
    // This is a placeholder - in production, use a proper XML parser
    logger.warn('XML processing not fully implemented', { feed_id: feed.id })
    return []
  }

  /**
   * Process custom data
   */
  private async processCustomData(
    data: unknown,
    feed: ThreatFeed,
  ): Promise<ThreatIndicator[]> {
    // Implement custom data processing
    if (feed.configuration.fields_mapping) {
      return this.applyFieldMapping(
        data,
        feed.configuration.fields_mapping,
        feed,
      )
    }
    return []
  }

  /**
   * Apply field mapping for custom data
   */
  private applyFieldMapping(
    data: unknown,
    mapping: Record<string, string>,
    feed: ThreatFeed,
  ): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = []

    if (Array.isArray(data)) {
      for (const item of data) {
        const mappedData: Record<string, unknown> = {}

        for (const [targetField, sourceField] of Object.entries(mapping)) {
          mappedData[targetField] = this.getNestedValue(item, sourceField)
        }

        const indicator = this.convertJSONToIndicator(mappedData, feed)
        if (indicator) indicators.push(indicator)
      }
    }

    return indicators
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    try {
      return path.split('.').reduce((current: unknown, key) => {
        if (
          current &&
          typeof current === 'object' &&
          key in (current as Record<string, unknown>)
        ) {
          return (current as Record<string, unknown>)[key]
        }
        return undefined
      }, obj)
    } catch {
      return undefined
    }
  }

  /**
   * Apply data transformations
   */
  private async applyTransformations(
    indicators: ThreatIndicator[],
    transformations?: DataTransformation[],
  ): Promise<ThreatIndicator[]> {
    if (!transformations || transformations.length === 0) {
      return indicators
    }

    for (const transformation of transformations) {
      indicators = await this.applyTransformation(indicators, transformation)
    }

    return indicators
  }

  /**
   * Apply single transformation
   */
  private async applyTransformation(
    indicators: ThreatIndicator[],
    transformation: DataTransformation,
  ): Promise<ThreatIndicator[]> {
    switch (transformation.operation) {
      case 'map':
        return this.applyMapTransformation(indicators, transformation)
      case 'filter':
        return this.applyFilterTransformation(indicators, transformation)
      case 'normalize':
        return this.applyNormalizeTransformation(indicators, transformation)
      case 'enrich':
        return this.applyEnrichTransformation(indicators, transformation)
      case 'validate':
        return this.applyValidateTransformation(indicators, transformation)
      default:
        logger.warn('Unknown transformation operation', {
          operation: transformation.operation,
        })
        return indicators
    }
  }

  /**
   * Apply map transformation
   */
  private applyMapTransformation(
    indicators: ThreatIndicator[],
    transformation: DataTransformation,
  ): ThreatIndicator[] {
    return indicators.map((indicator) => {
      if (transformation.field === 'severity') {
        indicator.severity = this.mapSeverity(
          indicator.severity,
          transformation.parameters,
        )
      } else if (transformation.field === 'confidence') {
        indicator.confidence = this.mapConfidence(
          indicator.confidence,
          transformation.parameters,
        )
      }
      return indicator
    })
  }

  /**
   * Apply filter transformation
   */
  private applyFilterTransformation(
    indicators: ThreatIndicator[],
    transformation: DataTransformation,
  ): ThreatIndicator[] {
    return indicators.filter((indicator) => {
      const fieldValue = (indicator as Record<string, unknown>)[
        transformation.field
      ]
      return this.evaluateFilterCondition(fieldValue, transformation.parameters)
    })
  }

  /**
   * Apply normalize transformation
   */
  private applyNormalizeTransformation(
    indicators: ThreatIndicator[],
    transformation: DataTransformation,
  ): ThreatIndicator[] {
    return indicators.map((indicator) => {
      if (transformation.field === 'value') {
        indicator.value = this.normalizeIndicatorValue(
          indicator.value,
          indicator.type,
        )
      }
      return indicator
    })
  }

  /**
   * Apply enrich transformation
   */
  private async applyEnrichTransformation(
    indicators: ThreatIndicator[],
    transformation: DataTransformation,
  ): Promise<ThreatIndicator[]> {
    // Implement data enrichment logic
    for (const indicator of indicators) {
      // Add enrichment data based on transformation parameters
      if (
        transformation.parameters.add_geolocation &&
        indicator.type === 'ip'
      ) {
        indicator.attributes.geolocation = await this.getIPGeolocation(
          indicator.value,
        )
      }
    }
    return indicators
  }

  /**
   * Apply validate transformation
   */
  private applyValidateTransformation(
    indicators: ThreatIndicator[],
    transformation: DataTransformation,
  ): ThreatIndicator[] {
    return indicators.filter((indicator) => {
      return this.validateIndicator(indicator, transformation.parameters)
    })
  }

  /**
   * Apply filters to indicators
   */
  private async applyFilters(
    indicators: ThreatIndicator[],
    filters?: FeedFilters,
  ): Promise<ThreatIndicator[]> {
    if (!filters) {
      return indicators
    }

    return indicators.filter((indicator) => {
      // Confidence filter
      if (
        filters.confidence_threshold &&
        indicator.confidence < filters.confidence_threshold
      ) {
        return false
      }

      // Severity filter
      if (
        filters.severity_levels &&
        !filters.severity_levels.includes(indicator.severity)
      ) {
        return false
      }

      // Threat type filter
      if (
        filters.threat_types &&
        !filters.threat_types.includes(indicator.threat_type)
      ) {
        return false
      }

      // Time range filter
      if (filters.time_range) {
        if (
          filters.time_range.start &&
          indicator.last_seen < filters.time_range.start
        ) {
          return false
        }
        if (
          filters.time_range.end &&
          indicator.first_seen > filters.time_range.end
        ) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Remove duplicate indicators
   */
  private async removeDuplicates(
    indicators: ThreatIndicator[],
    deduplicationRules?: DeduplicationRule[],
  ): Promise<ThreatIndicator[]> {
    if (!deduplicationRules || deduplicationRules.length === 0) {
      return indicators
    }

    const uniqueIndicators: ThreatIndicator[] = []
    const seenSignatures = new Set<string>()

    for (const indicator of indicators) {
      const signature = this.createIndicatorSignature(
        indicator,
        deduplicationRules,
      )

      if (!seenSignatures.has(signature)) {
        seenSignatures.add(signature)
        uniqueIndicators.push(indicator)
      }
    }

    return uniqueIndicators
  }

  /**
   * Create indicator signature for deduplication
   */
  private createIndicatorSignature(
    indicator: ThreatIndicator,
    _rules: DeduplicationRule[],
  ): string {
    // Simple signature based on value and type
    return `${indicator.type}:${indicator.value}`
  }

  /**
   * Store indicators in database
   */
  private async storeIndicators(
    indicators: ThreatIndicator[],
    feed: ThreatFeed,
  ): Promise<{
    added: number
    updated: number
    removed: number
    errors: SyncError[]
  }> {
    const result = {
      added: 0,
      updated: 0,
      removed: 0,
      errors: [] as SyncError[],
    }

    try {
      // Process indicators in batches
      const batchSize = this._config.sync_settings.batch_size
      const batches = this.createBatches(indicators, batchSize)

      for (const batch of batches) {
        const batchResult = await this.processIndicatorBatch(batch, feed)
        result.added += batchResult.added
        result.updated += batchResult.updated
        result.removed += batchResult.removed
        result.errors.push(...batchResult.errors)
      }

      // Remove expired indicators
      const removalResult = await this.removeExpiredIndicators(feed.id)
      result.removed += removalResult.removed
    } catch (error: unknown) {
      const normalized = normalizeError(error)
      logger.error('Failed to store indicators', {
        error: normalized.message,
        feed_id: feed.id,
      })
      result.errors.push({
        code: 'STORAGE_ERROR',
        message: normalized.message,
        timestamp: new Date(),
      })
    }

    return result
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Process indicator batch
   */
  private async processIndicatorBatch(
    batch: ThreatIndicator[],
    feed: ThreatFeed,
  ): Promise<{
    added: number
    updated: number
    removed: number
    errors: SyncError[]
  }> {
    const result = {
      added: 0,
      updated: 0,
      removed: 0,
      errors: [] as SyncError[],
    }

    try {
      const operations = []

      for (const indicator of batch) {
        // Check if indicator already exists
        const existing = await this.indicatorsCollection.findOne({
          feed_id: feed.id,
          type: indicator.type,
          value: indicator.value,
        })

        if (existing) {
          // Update existing indicator
          operations.push({
            updateOne: {
              filter: { id: existing.id },
              update: {
                $set: {
                  confidence: indicator.confidence,
                  severity: indicator.severity,
                  threat_type: indicator.threat_type,
                  description: indicator.description,
                  last_seen: indicator.last_seen,
                  tags: indicator.tags,
                  attributes: indicator.attributes,
                  relationships: indicator.relationships,
                  raw_data: indicator.raw_data,
                },
              },
            },
          })
          result.updated++
        } else {
          // Insert new indicator
          operations.push({
            insertOne: {
              document: indicator,
            },
          })
          result.added++
        }
      }

      // Execute bulk operations
      if (operations.length > 0) {
        await this.indicatorsCollection.bulkWrite(operations)
      }
    } catch (error: unknown) {
      const normalized = normalizeError(error)
      logger.error('Failed to process indicator batch', {
        error: normalized.message,
        feed_id: feed.id,
        batch_size: batch.length,
      })
      result.errors.push({
        code: 'BATCH_PROCESSING_ERROR',
        message: normalized.message,
        timestamp: new Date(),
      })
    }

    return result
  }

  /**
   * Remove expired indicators
   */
  private async removeExpiredIndicators(
    feedId: string,
  ): Promise<{ removed: number }> {
    try {
      const now = new Date()
      const result = await this.indicatorsCollection.deleteMany({
        feed_id: feedId,
        expiration_date: { $lt: now },
      })

      if (result.deletedCount > 0) {
        logger.info('Removed expired indicators', {
          feed_id: feedId,
          count: result.deletedCount,
        })
      }

      return { removed: result.deletedCount || 0 }
    } catch (error: unknown) {
      const normalized = normalizeError(error)
      logger.error('Failed to remove expired indicators', {
        error: normalized.message,
        feed_id: feedId,
      })
      return { removed: 0 }
    }
  }

  /**
   * Assess data quality
   */
  private async assessDataQuality(
    indicators: ThreatIndicator[],
    _feed: ThreatFeed,
  ): Promise<DataQualityMetrics> {
    try {
      const totalIndicators = indicators.length
      if (totalIndicators === 0) {
        return {
          completeness: 0,
          accuracy: 0,
          timeliness: 0,
          uniqueness: 0,
          validity: 0,
          last_assessment: new Date(),
        }
      }

      let completeCount = 0
      let accurateCount = 0
      let timelyCount = 0
      let uniqueCount = 0
      let validCount = 0

      const seenValues = new Set<string>()

      for (const indicator of indicators) {
        // Completeness check
        if (
          indicator.value &&
          indicator.type &&
          indicator.confidence !== undefined
        ) {
          completeCount++
        }

        // Accuracy check (simplified)
        if (indicator.confidence > 0.5) {
          accurateCount++
        }

        // Timeliness check (data from last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        if (indicator.last_seen >= thirtyDaysAgo) {
          timelyCount++
        }

        // Uniqueness check
        const signature = `${indicator.type}:${indicator.value}`
        if (!seenValues.has(signature)) {
          seenValues.add(signature)
          uniqueCount++
        }

        // Validity check (basic format validation)
        if (this.isValidIndicatorValue(indicator.value, indicator.type)) {
          validCount++
        }
      }

      const metrics: DataQualityMetrics = {
        completeness: completeCount / totalIndicators,
        accuracy: accurateCount / totalIndicators,
        timeliness: timelyCount / totalIndicators,
        uniqueness: uniqueCount / totalIndicators,
        validity: validCount / totalIndicators,
        last_assessment: new Date(),
      }

      return metrics
    } catch (error: unknown) {
      const normalized = normalizeError(error)
      logger.error('Failed to assess data quality', {
        error: normalized.message,
      })
      return {
        completeness: 0,
        accuracy: 0,
        timeliness: 0,
        uniqueness: 0,
        validity: 0,
        last_assessment: new Date(),
      }
    }
  }

  /**
   * Check if indicator value is valid for its type
   */
  private isValidIndicatorValue(value: string, type: string): boolean {
    try {
      switch (type) {
        case 'ip':
          return this.isValidIP(value)
        case 'domain':
          return this.isValidDomain(value)
        case 'hash':
          return this.isValidHash(value)
        case 'url':
          return this.isValidURL(value)
        case 'email':
          return this.isValidEmail(value)
        default:
          return true // Assume valid for unknown types
      }
    } catch (_error) {
      return false
    }
  }

  /**
   * Validate IP address
   */
  private isValidIP(ip: string): boolean {
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const ipv6Regex =
      /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/

    return ipv4Regex.test(ip) || ipv6Regex.test(ip)
  }

  /**
   * Validate domain name
   */
  private isValidDomain(domain: string): boolean {
    // Safer domain regex to avoid catastrophic backtracking (ReDoS).
    // - Enforces label rules: each label 1-63 chars, cannot start/end with '-'
    // - Lookahead limits total length to 253 characters
    const domainRegex =
      /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9][A-Za-z0-9-]{0,61}[A-Za-z0-9]$/
    return domainRegex.test(domain)
  }
}
