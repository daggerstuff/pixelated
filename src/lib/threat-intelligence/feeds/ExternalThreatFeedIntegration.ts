/**
 * External Threat Feed Integration System
 * Integrates with external threat intelligence feeds and services
 */

import { EventEmitter } from 'events'
import { Redis } from 'ioredis'
import { MongoClient, Db } from 'mongodb'
import axios, { AxiosInstance } from 'axios'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

import {
  FeedConfig,
  FeedItem,
  FeedSubscription,
  FeedProcessingResult,
  GlobalThreatIntelligence,
} from '../global/types'

const logger = createBuildSafeLogger('external-threat-feed-integration')

export interface ExternalThreatFeedIntegration {
  initialize(): Promise<void>
  subscribeToFeed(feedConfig: FeedConfig): Promise<string>
  unsubscribeFromFeed(subscriptionId: string): Promise<boolean>
  processFeedItems(
    subscriptionId: string,
    items: FeedItem[],
  ): Promise<FeedProcessingResult>
  getFeedStatus(subscriptionId: string): Promise<FeedStatus>
  getAllSubscriptions(): Promise<FeedSubscription[]>
  updateFeedConfig(
    subscriptionId: string,
    config: Partial<FeedConfig>,
  ): Promise<boolean>
  getFeedMetrics(): Promise<FeedMetrics>
  getHealthStatus(): Promise<HealthStatus>
  shutdown(): Promise<void>
}

export interface FeedStatus {
  subscriptionId: string
  feedId: string
  status: 'active' | 'inactive' | 'error' | 'expired'
  lastFetchTime?: Date
  lastProcessedTime?: Date
  itemsProcessed: number
  errors: number
  nextFetchTime?: Date
  errorMessage?: string
}

export interface FeedMetrics {
  totalSubscriptions: number
  activeSubscriptions: number
  totalItemsProcessed: number
  totalThreatsDiscovered: number
  averageProcessingTime: number
  feedsByType: Record<string, number>
  feedsByProvider: Record<string, number>
}

export interface HealthStatus {
  healthy: boolean
  message: string
  responseTime?: number
  activeFeeds?: number
  successRate?: number
}

export class ExternalThreatFeedIntegrationCore
  extends EventEmitter
  implements ExternalThreatFeedIntegration
{
  private redis: Redis
  private mongoClient: MongoClient
  private db: Db
  private httpClient: AxiosInstance
  private subscriptions: Map<string, FeedSubscription> = new Map()
  private feedProcessors: Map<string, FeedProcessor> = new Map()
  private activeTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(private config: FeedConfig) {
    super()
    this.initializeHttpClient()
    this.initializeFeedProcessors()
  }

  private initializeHttpClient(): void {
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Pixelated-Threat-Feed-Integration/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })

    // Add request/response interceptors for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.debug('HTTP request', {
          method: config.method,
          url: config.url,
          headers: config.headers,
        })
        return config
      },
      (error) => {
        logger.error('HTTP request error', { error })
        return Promise.reject(error)
      },
    )

    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug('HTTP response', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url,
        })
        return response
      },
      (error) => {
        logger.error('HTTP response error', {
          error: error.message,
          status: error.response?.status,
          url: error.config?.url,
        })
        return Promise.reject(error)
      },
    )
  }

  private initializeFeedProcessors(): void {
    // Register default feed processors
    this.registerFeedProcessor('stix', new STIXFeedProcessor())
    this.registerFeedProcessor('taxii', new TAXIIFeedProcessor())
    this.registerFeedProcessor('misp', new MISPFeedProcessor())
    this.registerFeedProcessor('otx', new OTXFeedProcessor())
    this.registerFeedProcessor('virustotal', new VirusTotalFeedProcessor())
    this.registerFeedProcessor('generic', new GenericFeedProcessor())
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing External Threat Feed Integration System')

      // Initialize Redis connection
      await this.initializeRedis()

      // Initialize MongoDB connection
      await this.initializeMongoDB()

      // Load existing subscriptions
      await this.loadSubscriptions()

      // Start feed processing
      await this.startFeedProcessing()

      // Start metrics collection
      await this.startMetricsCollection()

      this.emit('feed_integration_initialized')
      logger.info(
        'External Threat Feed Integration System initialized successfully',
      )
    } catch (error) {
      logger.error(
        'Failed to initialize External Threat Feed Integration System:',
        { error },
      )
      this.emit('initialization_error', { error })
      throw error
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      await this.redis.ping()
      logger.info('Redis connection established for feed integration')
    } catch (error) {
      logger.error('Failed to connect to Redis:', { error })
      throw new Error('Redis connection failed', { cause: error })
    }
  }

  private async initializeMongoDB(): Promise<void> {
    try {
      this.mongoClient = new MongoClient(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/threat_feeds',
      )
      await this.mongoClient.connect()
      this.db = this.mongoClient.db('threat_feeds')
      logger.info('MongoDB connection established for feed integration')
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', { error })
      throw new Error('MongoDB connection failed', { cause: error })
    }
  }

  private async loadSubscriptions(): Promise<void> {
    try {
      const subscriptionsCollection = this.db.collection('feed_subscriptions')
      const subscriptions = await subscriptionsCollection
        .find({ status: 'active' })
        .toArray()

      for (const subscription of subscriptions) {
        this.subscriptions.set(subscription.subscriptionId, subscription)

        // Restart feed processing for active subscriptions
        await this.startFeedProcessingForSubscription(subscription)
      }

      logger.info(`Loaded ${subscriptions.length} active feed subscriptions`)
    } catch (error) {
      logger.error('Failed to load subscriptions:', { error })
    }
  }

  private async startFeedProcessing(): Promise<void> {
    // Process feeds every 5 minutes
    setInterval(async () => {
      try {
        await this.processAllActiveFeeds()
      } catch (error) {
        logger.error('Feed processing error:', { error })
      }
    }, 300000)
  }

  private async startMetricsCollection(): Promise<void> {
    // Collect metrics every 10 minutes
    setInterval(async () => {
      try {
        await this.collectMetrics()
      } catch (error) {
        logger.error('Metrics collection error:', { error })
      }
    }, 600000)
  }

  async subscribeToFeed(feedConfig: FeedConfig): Promise<string> {
    try {
      logger.info('Subscribing to threat feed', {
        feedId: feedConfig.feedId,
        provider: feedConfig.provider,
        feedType: feedConfig.feedType,
      })

      // Validate feed configuration
      this.validateFeedConfig(feedConfig)

      // Create subscription
      const subscription = await this.createSubscription(feedConfig)

      // Store subscription
      await this.storeSubscription(subscription)

      // Start feed processing for this subscription
      await this.startFeedProcessingForSubscription(subscription)

      this.emit('feed_subscribed', {
        subscriptionId: subscription.subscriptionId,
        feedId: feedConfig.feedId,
      })

      return subscription.subscriptionId
    } catch (error) {
      logger.error('Failed to subscribe to feed:', { error })
      throw error
    }
  }

  private validateFeedConfig(feedConfig: FeedConfig): void {
    if (!feedConfig.feedId) {
      throw new Error('Feed ID is required')
    }

    if (!feedConfig.provider) {
      throw new Error('Feed provider is required')
    }

    if (!feedConfig.feedType) {
      throw new Error('Feed type is required')
    }

    if (!feedConfig.endpoint) {
      throw new Error('Feed endpoint is required')
    }

    if (!feedConfig.apiKey && feedConfig.requiresAuth) {
      throw new Error('API key is required for authenticated feeds')
    }

    // Validate feed type
    const validFeedTypes = [
      'stix',
      'taxii',
      'misp',
      'otx',
      'virustotal',
      'generic',
    ]
    if (!validFeedTypes.includes(feedConfig.feedType)) {
      throw new Error(`Invalid feed type: ${feedConfig.feedType}`)
    }

    // Validate update frequency
    const validFrequencies = ['real-time', 'hourly', 'daily', 'weekly']
    if (
      feedConfig.updateFrequency &&
      !validFrequencies.includes(feedConfig.updateFrequency)
    ) {
      throw new Error(`Invalid update frequency: ${feedConfig.updateFrequency}`)
    }
  }

  private async createSubscription(
    feedConfig: FeedConfig,
  ): Promise<FeedSubscription> {
    const subscriptionId = this.generateSubscriptionId()

    return {
      subscriptionId,
      feedId: feedConfig.feedId,
      provider: feedConfig.provider,
      feedType: feedConfig.feedType,
      endpoint: feedConfig.endpoint,
      apiKey: feedConfig.apiKey,
      parameters: feedConfig.parameters || {},
      filters: feedConfig.filters || {},
      updateFrequency: feedConfig.updateFrequency || 'hourly',
      status: 'active',
      createdAt: new Date(),
      lastFetchTime: undefined,
      lastProcessedTime: undefined,
      itemsProcessed: 0,
      errors: 0,
      config: feedConfig,
    }
  }

  private async storeSubscription(
    subscription: FeedSubscription,
  ): Promise<void> {
    try {
      const subscriptionsCollection = this.db.collection('feed_subscriptions')
      await subscriptionsCollection.insertOne(subscription)

      this.subscriptions.set(subscription.subscriptionId, subscription)
    } catch (error) {
      logger.error('Failed to store subscription:', { error })
      throw error
    }
  }

  private async startFeedProcessingForSubscription(
    subscription: FeedSubscription,
  ): Promise<void> {
    try {
      const interval = this.getFeedProcessingInterval(
        subscription.updateFrequency,
      )

      const timer = setInterval(async () => {
        try {
          await this.processFeedForSubscription(subscription)
        } catch (error) {
          logger.error('Feed processing failed for subscription:', {
            error,
            subscriptionId: subscription.subscriptionId,
          })
        }
      }, interval)

      this.activeTimers.set(subscription.subscriptionId, timer)

      logger.info('Started feed processing for subscription', {
        subscriptionId: subscription.subscriptionId,
        interval: interval,
      })
    } catch (error) {
      logger.error('Failed to start feed processing for subscription:', {
        error,
      })
    }
  }

  private getFeedProcessingInterval(updateFrequency: string): number {
    const intervals: Record<string, number> = {
      'real-time': 5 * 60 * 1000, // 5 minutes
      'hourly': 60 * 60 * 1000, // 1 hour
      'daily': 24 * 60 * 60 * 1000, // 24 hours
      'weekly': 7 * 24 * 60 * 60 * 1000, // 7 days
    }

    return intervals[updateFrequency] || 60 * 60 * 1000 // Default to hourly
  }

  private async processFeedForSubscription(
    subscription: FeedSubscription,
  ): Promise<void> {
    try {
      logger.info('Processing feed for subscription', {
        subscriptionId: subscription.subscriptionId,
        feedId: subscription.feedId,
      })

      // Update last fetch time
      subscription.lastFetchTime = new Date()

      // Fetch feed items
      const feedItems = await this.fetchFeedItems(subscription)

      if (feedItems.length === 0) {
        logger.info('No new feed items found', {
          subscriptionId: subscription.subscriptionId,
        })
        return
      }

      logger.info(`Fetched ${feedItems.length} feed items`, {
        subscriptionId: subscription.subscriptionId,
      })

      // Process feed items
      const processingResult = await this.processFeedItems(
        subscription.subscriptionId,
        feedItems,
      )

      // Update subscription statistics
      subscription.lastProcessedTime = new Date()
      subscription.itemsProcessed += processingResult.itemsProcessed

      if (processingResult.errors > 0) {
        subscription.errors += processingResult.errors
      }

      // Update subscription in database
      await this.updateSubscription(subscription)

      this.emit('feed_processed', {
        subscriptionId: subscription.subscriptionId,
        itemsProcessed: processingResult.itemsProcessed,
        threatsDiscovered: processingResult.threatsDiscovered,
        errors: processingResult.errors,
      })
    } catch (error) {
      logger.error('Feed processing failed for subscription:', {
        error,
        subscriptionId: subscription.subscriptionId,
      })

      subscription.errors++
      await this.updateSubscription(subscription)

      throw error
    }
  }

  private async fetchFeedItems(
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const processor = this.getFeedProcessor(subscription.feedType)
      if (!processor) {
        throw new Error(
          `No processor found for feed type: ${subscription.feedType}`,
        )
      }

      // Build request configuration
      const requestConfig = await this.buildFeedRequestConfig(subscription)

      // Fetch feed data
      const response = await this.httpClient.request(requestConfig)

      // Parse feed items
      const feedItems = await processor.parseFeed(response.data, subscription)

      // Filter items based on subscription filters
      const filteredItems = this.filterFeedItems(
        feedItems,
        subscription.filters,
      )

      // Deduplicate items
      const deduplicatedItems = await this.deduplicateFeedItems(
        filteredItems,
        subscription,
      )

      return deduplicatedItems
    } catch (error) {
      logger.error('Failed to fetch feed items:', {
        error,
        subscriptionId: subscription.subscriptionId,
      })
      throw error
    }
  }

  private async buildFeedRequestConfig(
    subscription: FeedSubscription,
  ): Promise<any> {
    const config: any = {
      method: subscription.config.method || 'GET',
      url: subscription.endpoint,
      headers: {
        ...subscription.config.headers,
      },
    }

    // Add authentication
    if (subscription.apiKey) {
      switch (subscription.config.authType) {
        case 'api_key':
          config.headers['X-API-Key'] = subscription.apiKey
          break
        case 'bearer':
          config.headers['Authorization'] = `Bearer ${subscription.apiKey}`
          break
        case 'basic':
          config.auth = {
            username: subscription.config.username || '',
            password: subscription.apiKey,
          }
          break
      }
    }

    // Add query parameters
    if (subscription.config.queryParams) {
      config.params = subscription.config.queryParams
    }

    // Add request body for POST requests
    if (config.method === 'POST' && subscription.config.requestBody) {
      config.data = subscription.config.requestBody
    }

    return config
  }

  private getFeedProcessor(feedType: string): FeedProcessor | undefined {
    return this.feedProcessors.get(feedType)
  }

  private filterFeedItems(
    items: FeedItem[],
    filters: Record<string, any>,
  ): FeedItem[] {
    if (!filters || Object.keys(filters).length === 0) {
      return items
    }

    return items.filter((item) => {
      // Apply severity filter
      if (filters.severity && item.severity !== filters.severity) {
        return false
      }

      // Apply confidence filter
      if (filters.minConfidence && item.confidence < filters.minConfidence) {
        return false
      }

      // Apply time filter
      if (filters.maxAge) {
        const itemAge = Date.now() - new Date(item.timestamp).getTime()
        if (itemAge > filters.maxAge) {
          return false
        }
      }

      // Apply custom filter function if provided
      if (filters.customFilter && typeof filters.customFilter === 'function') {
        return filters.customFilter(item)
      }

      return true
    })
  }

  private async deduplicateFeedItems(
    items: FeedItem[],
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const seenItems = new Set<string>()
      const deduplicatedItems: FeedItem[] = []

      // Get recently processed item IDs from Redis
      const cacheKey = `feed_dedup:${subscription.subscriptionId}`
      const recentItemIds = await this.redis.smembers(cacheKey)
      recentItemIds.forEach((id) => seenItems.add(id))

      for (const item of items) {
        const itemKey = this.generateItemKey(item)

        if (!seenItems.has(itemKey)) {
          deduplicatedItems.push(item)
          seenItems.add(itemKey)

          // Add to Redis cache with expiration
          await this.redis.sadd(cacheKey, itemKey)
        }
      }

      // Set expiration on the deduplication set (24 hours)
      await this.redis.expire(cacheKey, 24 * 60 * 60)

      return deduplicatedItems
    } catch (error) {
      logger.error('Failed to deduplicate feed items:', { error })
      return items // Return original items if deduplication fails
    }
  }

  private generateItemKey(item: FeedItem): string {
    // Generate a unique key based on item characteristics
    const keyParts = [
      item.itemId || '',
      item.indicator || '',
      item.indicatorType || '',
      item.timestamp || '',
    ]

    return keyParts.join('|')
  }

  async processFeedItems(
    subscriptionId: string,
    items: FeedItem[],
  ): Promise<FeedProcessingResult> {
    try {
      logger.info('Processing feed items', {
        subscriptionId,
        itemCount: items.length,
      })

      const subscription = this.subscriptions.get(subscriptionId)
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`)
      }

      const processor = this.getFeedProcessor(subscription.feedType)
      if (!processor) {
        throw new Error(
          `No processor found for feed type: ${subscription.feedType}`,
        )
      }

      let itemsProcessed = 0
      let threatsDiscovered = 0
      let errors = 0
      const processedThreats: GlobalThreatIntelligence[] = []

      // Process items in batches to avoid memory issues
      const batchSize = 100
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)

        try {
          const batchResult = await this.processFeedBatch(
            batch,
            processor,
            subscription,
          )

          itemsProcessed += batchResult.itemsProcessed
          threatsDiscovered += batchResult.threatsDiscovered
          errors += batchResult.errors
          processedThreats.push(...batchResult.threats)
        } catch (error) {
          logger.error('Batch processing failed:', {
            error,
            subscriptionId,
            batchIndex: i / batchSize,
          })
          errors += batch.length
        }
      }

      // Store processed threats
      if (processedThreats.length > 0) {
        await this.storeProcessedThreats(processedThreats, subscription)
      }

      const result: FeedProcessingResult = {
        subscriptionId,
        itemsProcessed,
        threatsDiscovered,
        errors,
        processingTime: Date.now() - Date.now(), // Will be calculated by caller
        threats: processedThreats,
      }

      this.emit('feed_items_processed', result)

      return result
    } catch (error) {
      logger.error('Failed to process feed items:', { error, subscriptionId })
      throw error
    }
  }

  private async processFeedBatch(
    batch: FeedItem[],
    processor: FeedProcessor,
    subscription: FeedSubscription,
  ): Promise<BatchProcessingResult> {
    try {
      let itemsProcessed = 0
      let threatsDiscovered = 0
      let errors = 0
      const threats: GlobalThreatIntelligence[] = []

      for (const item of batch) {
        try {
          // Convert feed item to threat intelligence
          const threat = await processor.convertToThreat(item, subscription)

          if (threat) {
            threats.push(threat)
            threatsDiscovered++
          }

          itemsProcessed++
        } catch (error) {
          logger.error('Failed to process feed item:', {
            error,
            itemId: item.itemId,
            subscriptionId: subscription.subscriptionId,
          })
          errors++
        }
      }

      return {
        itemsProcessed,
        threatsDiscovered,
        errors,
        threats,
      }
    } catch (error) {
      logger.error('Batch processing failed:', { error })
      throw error
    }
  }

  private async storeProcessedThreats(
    threats: GlobalThreatIntelligence[],
    subscription: FeedSubscription,
  ): Promise<void> {
    try {
      const threatsCollection = this.db.collection('external_threats')

      // Add metadata to threats
      const threatsWithMetadata = threats.map((threat) => ({
        ...threat,
        source: 'external_feed',
        subscriptionId: subscription.subscriptionId,
        feedId: subscription.feedId,
        provider: subscription.provider,
        processedAt: new Date(),
      }))

      await threatsCollection.insertMany(threatsWithMetadata)

      // Publish to Redis for real-time processing
      for (const threat of threatsWithMetadata) {
        await this.redis.publish('external_threats', JSON.stringify(threat))
      }

      logger.info('Processed threats stored successfully', {
        subscriptionId: subscription.subscriptionId,
        threatCount: threats.length,
      })
    } catch (error) {
      logger.error('Failed to store processed threats:', { error })
      throw error
    }
  }

  private async updateSubscription(
    subscription: FeedSubscription,
  ): Promise<void> {
    try {
      const subscriptionsCollection = this.db.collection('feed_subscriptions')
      await subscriptionsCollection.updateOne(
        { subscriptionId: subscription.subscriptionId },
        { $set: subscription },
      )

      this.subscriptions.set(subscription.subscriptionId, subscription)
    } catch (error) {
      logger.error('Failed to update subscription:', { error })
      throw error
    }
  }

  async unsubscribeFromFeed(subscriptionId: string): Promise<boolean> {
    try {
      logger.info('Unsubscribing from feed', { subscriptionId })

      const subscription = this.subscriptions.get(subscriptionId)
      if (!subscription) {
        logger.warn('Subscription not found', { subscriptionId })
        return false
      }

      // Stop feed processing timer
      const timer = this.activeTimers.get(subscriptionId)
      if (timer) {
        clearInterval(timer)
        this.activeTimers.delete(subscriptionId)
      }

      // Update subscription status
      subscription.status = 'inactive'
      await this.updateSubscription(subscription)

      // Remove from memory
      this.subscriptions.delete(subscriptionId)

      this.emit('feed_unsubscribed', { subscriptionId })

      return true
    } catch (error) {
      logger.error('Failed to unsubscribe from feed:', {
        error,
        subscriptionId,
      })
      return false
    }
  }

  async getFeedStatus(subscriptionId: string): Promise<FeedStatus> {
    try {
      const subscription = this.subscriptions.get(subscriptionId)
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`)
      }

      const nextFetchTime = this.calculateNextFetchTime(subscription)

      return {
        subscriptionId: subscription.subscriptionId,
        feedId: subscription.feedId,
        status: subscription.status,
        lastFetchTime: subscription.lastFetchTime,
        lastProcessedTime: subscription.lastProcessedTime,
        itemsProcessed: subscription.itemsProcessed,
        errors: subscription.errors,
        nextFetchTime,
      }
    } catch (error) {
      logger.error('Failed to get feed status:', { error, subscriptionId })
      throw error
    }
  }

  private calculateNextFetchTime(subscription: FeedSubscription): Date {
    const interval = this.getFeedProcessingInterval(
      subscription.updateFrequency,
    )
    const lastFetch = subscription.lastFetchTime || new Date()

    return new Date(lastFetch.getTime() + interval)
  }

  async getAllSubscriptions(): Promise<FeedSubscription[]> {
    try {
      const subscriptionsCollection = this.db.collection('feed_subscriptions')
      const subscriptions = await subscriptionsCollection.find({}).toArray()

      return subscriptions
    } catch (error) {
      logger.error('Failed to get all subscriptions:', { error })
      throw error
    }
  }

  async updateFeedConfig(
    subscriptionId: string,
    config: Partial<FeedConfig>,
  ): Promise<boolean> {
    try {
      logger.info('Updating feed configuration', { subscriptionId })

      const subscription = this.subscriptions.get(subscriptionId)
      if (!subscription) {
        logger.warn('Subscription not found', { subscriptionId })
        return false
      }

      // Update subscription configuration
      const updatedConfig = { ...subscription.config, ...config }

      // Validate updated configuration
      this.validateFeedConfig(updatedConfig)

      subscription.config = updatedConfig

      // Update in database
      await this.updateSubscription(subscription)

      this.emit('feed_config_updated', { subscriptionId })

      return true
    } catch (error) {
      logger.error('Failed to update feed configuration:', {
        error,
        subscriptionId,
      })
      return false
    }
  }

  async getFeedMetrics(): Promise<FeedMetrics> {
    try {
      const subscriptionsCollection = this.db.collection('feed_subscriptions')
      const threatsCollection = this.db.collection('external_threats')

      const [
        totalSubscriptions,
        activeSubscriptions,
        totalItemsProcessed,
        totalThreatsDiscovered,
        averageProcessingTime,
        feedsByType,
        feedsByProvider,
      ] = await Promise.all([
        subscriptionsCollection.countDocuments(),
        subscriptionsCollection.countDocuments({ status: 'active' }),
        this.calculateTotalItemsProcessed(),
        threatsCollection.countDocuments(),
        this.calculateAverageProcessingTime(),
        this.getFeedsByType(),
        this.getFeedsByProvider(),
      ])

      return {
        totalSubscriptions,
        activeSubscriptions,
        totalItemsProcessed,
        totalThreatsDiscovered,
        averageProcessingTime,
        feedsByType,
        feedsByProvider,
      }
    } catch (error) {
      logger.error('Failed to get feed metrics:', { error })
      return {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        totalItemsProcessed: 0,
        totalThreatsDiscovered: 0,
        averageProcessingTime: 0,
        feedsByType: {},
        feedsByProvider: {},
      }
    }
  }

  private async calculateTotalItemsProcessed(): Promise<number> {
    try {
      const subscriptionsCollection = this.db.collection('feed_subscriptions')
      const result = await subscriptionsCollection
        .aggregate([
          { $group: { _id: null, totalItems: { $sum: '$itemsProcessed' } } },
        ])
        .toArray()

      return result[0]?.totalItems || 0
    } catch (error) {
      logger.error('Failed to calculate total items processed:', { error })
      return 0
    }
  }

  private async calculateAverageProcessingTime(): Promise<number> {
    try {
      const processingLogsCollection = this.db.collection(
        'feed_processing_logs',
      )
      const result = await processingLogsCollection
        .aggregate([
          { $group: { _id: null, avgTime: { $avg: '$processingTime' } } },
        ])
        .toArray()

      return result[0]?.avgTime || 0
    } catch (error) {
      logger.error('Failed to calculate average processing time:', { error })
      return 0
    }
  }

  private async getFeedsByType(): Promise<Record<string, number>> {
    try {
      const subscriptionsCollection = this.db.collection('feed_subscriptions')
      const pipeline = [
        { $group: { _id: '$feedType', count: { $sum: 1 } } },
        { $project: { feedType: '$_id', count: 1, _id: 0 } },
      ]

      const results = await subscriptionsCollection
        .aggregate(pipeline)
        .toArray()

      const feedsByType: Record<string, number> = {}
      for (const result of results) {
        feedsByType[result.feedType] = result.count
      }

      return feedsByType
    } catch (error) {
      logger.error('Failed to get feeds by type:', { error })
      return {}
    }
  }

  private async getFeedsByProvider(): Promise<Record<string, number>> {
    try {
      const subscriptionsCollection = this.db.collection('feed_subscriptions')
      const pipeline = [
        { $group: { _id: '$provider', count: { $sum: 1 } } },
        { $project: { provider: '$_id', count: 1, _id: 0 } },
      ]

      const results = await subscriptionsCollection
        .aggregate(pipeline)
        .toArray()

      const feedsByProvider: Record<string, number> = {}
      for (const result of results) {
        feedsByProvider[result.provider] = result.count
      }

      return feedsByProvider
    } catch (error) {
      logger.error('Failed to get feeds by provider:', { error })
      return {}
    }
  }

  private async processAllActiveFeeds(): Promise<void> {
    try {
      const activeSubscriptions = Array.from(
        this.subscriptions.values(),
      ).filter((sub) => sub.status === 'active')

      logger.info('Processing all active feeds', {
        activeFeedCount: activeSubscriptions.length,
      })

      for (const subscription of activeSubscriptions) {
        try {
          await this.processFeedForSubscription(subscription)
        } catch (error) {
          logger.error('Failed to process feed for subscription:', {
            error,
            subscriptionId: subscription.subscriptionId,
          })
        }
      }
    } catch (error) {
      logger.error('Failed to process all active feeds:', { error })
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getFeedMetrics()

      this.emit('metrics_collected', metrics)
    } catch (error) {
      logger.error('Metrics collection failed:', { error })
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const startTime = Date.now()

      // Check Redis connection
      const redisHealthy = await this.checkRedisHealth()
      if (!redisHealthy) {
        return {
          healthy: false,
          message: 'Redis connection failed',
        }
      }

      // Check MongoDB connection
      const mongodbHealthy = await this.checkMongoDBHealth()
      if (!mongodbHealthy) {
        return {
          healthy: false,
          message: 'MongoDB connection failed',
        }
      }

      // Calculate success rate
      const metrics = await this.getFeedMetrics()
      const successRate =
        metrics.totalSubscriptions > 0
          ? (metrics.activeSubscriptions / metrics.totalSubscriptions) * 100
          : 0

      const responseTime = Date.now() - startTime

      return {
        healthy: true,
        message: 'External Threat Feed Integration System is healthy',
        responseTime,
        activeFeeds: metrics.activeSubscriptions,
        successRate,
      }
    } catch (error) {
      logger.error('Health check failed:', { error })
      return {
        healthy: false,
        message: `Health check failed: ${error}`,
      }
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      const result = await this.redis.ping()
      return result === 'PONG'
    } catch (error) {
      logger.error('Redis health check failed:', { error })
      return false
    }
  }

  private async checkMongoDBHealth(): Promise<boolean> {
    try {
      await this.db.admin().ping()
      return true
    } catch (error) {
      logger.error('MongoDB health check failed:', { error })
      return false
    }
  }

  private generateSubscriptionId(): string {
    return `feed_sub_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  registerFeedProcessor(feedType: string, processor: FeedProcessor): void {
    this.feedProcessors.set(feedType, processor)
    logger.info('Registered feed processor', { feedType })
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down External Threat Feed Integration System')

      // Stop all active timers
      for (const [subscriptionId, timer] of this.activeTimers) {
        clearInterval(timer)
        this.activeTimers.delete(subscriptionId)
      }

      // Close database connections
      if (this.mongoClient) {
        await this.mongoClient.close()
      }

      if (this.redis) {
        await this.redis.quit()
      }

      this.emit('feed_integration_shutdown')
      logger.info('External Threat Feed Integration System shutdown completed')
    } catch (error) {
      logger.error('Error during shutdown:', { error })
      throw error
    }
  }
}

// Feed Processor Interface and Implementations
export interface FeedProcessor {
  parseFeed(data: any, subscription: FeedSubscription): Promise<FeedItem[]>
  convertToThreat(
    item: FeedItem,
    subscription: FeedSubscription,
  ): Promise<GlobalThreatIntelligence | null>
}

interface BatchProcessingResult {
  itemsProcessed: number
  threatsDiscovered: number
  errors: number
  threats: GlobalThreatIntelligence[]
}

// STIX Feed Processor
class STIXFeedProcessor implements FeedProcessor {
  async parseFeed(
    data: any,
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const items: FeedItem[] = []

      // Parse STIX 2.x format
      if (data.objects) {
        for (const obj of data.objects) {
          if (obj.type === 'indicator') {
            items.push({
              itemId: obj.id,
              indicator: obj.pattern,
              indicatorType: this.extractIndicatorType(obj.pattern),
              severity: this.mapSTIXThreatLevel(obj.labels),
              confidence: obj.confidence || 0.5,
              timestamp: new Date(obj.created),
              description: obj.description || '',
              source: subscription.provider,
              metadata: {
                stixVersion: data.spec_version,
                objectType: obj.type,
                labels: obj.labels,
              },
            })
          }
        }
      }

      return items
    } catch (error) {
      logger.error('STIX feed parsing failed:', { error })
      return []
    }
  }

  private extractIndicatorType(pattern: string): string {
    if (pattern.includes('file:hashes')) return 'file_hash'
    if (pattern.includes('ipv4-addr')) return 'ip'
    if (pattern.includes('domain-name')) return 'domain'
    if (pattern.includes('url')) return 'url'
    return 'unknown'
  }

  private mapSTIXThreatLevel(labels: string[]): string {
    if (labels.includes('malicious-activity')) return 'high'
    if (labels.includes('suspicious-activity')) return 'medium'
    return 'low'
  }

  async convertToThreat(
    item: FeedItem,
    subscription: FeedSubscription,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      const threatId = `external_${item.itemId}`

      return {
        threatId,
        threatType: this.mapIndicatorToThreatType(item.indicatorType),
        severity: item.severity,
        confidence: item.confidence,
        indicators: [
          {
            indicatorType: item.indicatorType as any,
            value: item.indicator,
            confidence: item.confidence,
            firstSeen: new Date(item.timestamp),
            lastSeen: new Date(item.timestamp),
          },
        ],
        firstSeen: new Date(item.timestamp),
        lastSeen: new Date(item.timestamp),
        regions: ['global'],
        attribution: {
          family: subscription.provider,
          campaign: `feed_${subscription.feedId}`,
          confidence: item.confidence,
        },
        metadata: {
          source: 'external_feed',
          feedId: subscription.feedId,
          provider: subscription.provider,
          itemId: item.itemId,
          description: item.description,
        },
      }
    } catch (error) {
      logger.error('STIX threat conversion failed:', { error })
      return null
    }
  }

  private mapIndicatorToThreatType(indicatorType: string): string {
    const typeMap: Record<string, string> = {
      ip: 'network_intrusion',
      domain: 'c2',
      url: 'malware_distribution',
      file_hash: 'malware',
      email: 'phishing',
      unknown: 'general',
    }

    return typeMap[indicatorType] || 'general'
  }
}

// TAXII Feed Processor
class TAXIIFeedProcessor implements FeedProcessor {
  async parseFeed(
    data: any,
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const items: FeedItem[] = []

      // Parse TAXII 2.x format
      if (data.objects) {
        for (const obj of data.objects) {
          if (
            obj.type === 'indicator' ||
            obj.type === 'malware' ||
            obj.type === 'attack-pattern'
          ) {
            items.push({
              itemId: obj.id,
              indicator: this.extractIndicatorFromTAXII(obj),
              indicatorType: this.extractIndicatorTypeFromTAXII(obj),
              severity: this.mapTAXIIThreatLevel(obj),
              confidence: obj.confidence || 0.5,
              timestamp: new Date(obj.created),
              description: obj.description || '',
              source: subscription.provider,
              metadata: {
                taxiiVersion: data.spec_version,
                objectType: obj.type,
                labels: obj.labels || [],
              },
            })
          }
        }
      }

      return items
    } catch (error) {
      logger.error('TAXII feed parsing failed:', { error })
      return []
    }
  }

  private extractIndicatorFromTAXII(obj: any): string {
    if (obj.pattern) return obj.pattern
    if (obj.name) return obj.name
    if (obj.external_references && obj.external_references.length > 0) {
      return (
        obj.external_references[0].url || obj.external_references[0].external_id
      )
    }
    return obj.id
  }

  private extractIndicatorTypeFromTAXII(obj: any): string {
    if (obj.pattern) {
      if (obj.pattern.includes('file:hashes')) return 'file_hash'
      if (obj.pattern.includes('ipv4-addr')) return 'ip'
      if (obj.pattern.includes('domain-name')) return 'domain'
      if (obj.pattern.includes('url')) return 'url'
    }
    return 'unknown'
  }

  private mapTAXIIThreatLevel(obj: any): string {
    if (obj.labels && obj.labels.includes('malicious-activity')) return 'high'
    if (obj.labels && obj.labels.includes('suspicious-activity'))
      return 'medium'
    return 'low'
  }

  async convertToThreat(
    item: FeedItem,
    subscription: FeedSubscription,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      const threatId = `external_${item.itemId}`

      return {
        threatId,
        threatType: this.mapIndicatorToThreatType(item.indicatorType),
        severity: item.severity,
        confidence: item.confidence,
        indicators: [
          {
            indicatorType: item.indicatorType as any,
            value: item.indicator,
            confidence: item.confidence,
            firstSeen: new Date(item.timestamp),
            lastSeen: new Date(item.timestamp),
          },
        ],
        firstSeen: new Date(item.timestamp),
        lastSeen: new Date(item.timestamp),
        regions: ['global'],
        attribution: {
          family: subscription.provider,
          campaign: `taxii_${subscription.feedId}`,
          confidence: item.confidence,
        },
        metadata: {
          source: 'external_feed',
          feedId: subscription.feedId,
          provider: subscription.provider,
          itemId: item.itemId,
          description: item.description,
        },
      }
    } catch (error) {
      logger.error('TAXII threat conversion failed:', { error })
      return null
    }
  }

  private mapIndicatorToThreatType(indicatorType: string): string {
    const typeMap: Record<string, string> = {
      ip: 'network_intrusion',
      domain: 'c2',
      url: 'malware_distribution',
      file_hash: 'malware',
      unknown: 'general',
    }

    return typeMap[indicatorType] || 'general'
  }
}

// MISP Feed Processor
class MISPFeedProcessor implements FeedProcessor {
  async parseFeed(
    data: any,
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const items: FeedItem[] = []

      // Parse MISP format
      if (data.response) {
        for (const event of data.response) {
          if (event.Event && event.Event.Attribute) {
            for (const attribute of event.Event.Attribute) {
              items.push({
                itemId: attribute.id,
                indicator: attribute.value,
                indicatorType: this.mapMISPType(attribute.type),
                severity: this.mapMISPSeverity(attribute.comment),
                confidence: this.mapMISPConfidence(attribute.comment),
                timestamp: new Date(attribute.timestamp * 1000),
                description: attribute.comment || '',
                source: subscription.provider,
                metadata: {
                  eventId: event.Event.id,
                  eventInfo: event.Event.info,
                  category: attribute.category,
                  type: attribute.type,
                },
              })
            }
          }
        }
      }

      return items
    } catch (error) {
      logger.error('MISP feed parsing failed:', { error })
      return []
    }
  }

  private mapMISPType(mispType: string): string {
    const typeMap: Record<string, string> = {
      'ip-dst': 'ip',
      'ip-src': 'ip',
      'domain': 'domain',
      'url': 'url',
      'md5': 'file_hash',
      'sha1': 'file_hash',
      'sha256': 'file_hash',
      'filename': 'file_name',
      'email': 'email',
    }

    return typeMap[mispType] || 'unknown'
  }

  private mapMISPSeverity(comment: string): string {
    if (comment.includes('critical') || comment.includes('high'))
      return 'critical'
    if (comment.includes('medium')) return 'medium'
    return 'low'
  }

  private mapMISPConfidence(comment: string): number {
    if (comment.includes('high confidence')) return 0.9
    if (comment.includes('medium confidence')) return 0.6
    if (comment.includes('low confidence')) return 0.3
    return 0.5
  }

  async convertToThreat(
    item: FeedItem,
    subscription: FeedSubscription,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      const threatId = `external_${item.itemId}`

      return {
        threatId,
        threatType: this.mapIndicatorToThreatType(item.indicatorType),
        severity: item.severity,
        confidence: item.confidence,
        indicators: [
          {
            indicatorType: item.indicatorType as any,
            value: item.indicator,
            confidence: item.confidence,
            firstSeen: new Date(item.timestamp),
            lastSeen: new Date(item.timestamp),
          },
        ],
        firstSeen: new Date(item.timestamp),
        lastSeen: new Date(item.timestamp),
        regions: ['global'],
        attribution: {
          family: subscription.provider,
          campaign: `misp_${subscription.feedId}`,
          confidence: item.confidence,
        },
        metadata: {
          source: 'external_feed',
          feedId: subscription.feedId,
          provider: subscription.provider,
          itemId: item.itemId,
          description: item.description,
          eventId: item.metadata?.eventId,
        },
      }
    } catch (error) {
      logger.error('MISP threat conversion failed:', { error })
      return null
    }
  }

  private mapIndicatorToThreatType(indicatorType: string): string {
    const typeMap: Record<string, string> = {
      ip: 'network_intrusion',
      domain: 'c2',
      url: 'malware_distribution',
      file_hash: 'malware',
      file_name: 'malware',
      email: 'phishing',
      unknown: 'general',
    }

    return typeMap[indicatorType] || 'general'
  }
}

// OTX (AlienVault Open Threat Exchange) Feed Processor
class OTXFeedProcessor implements FeedProcessor {
  async parseFeed(
    data: any,
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const items: FeedItem[] = []

      // Parse OTX format
      if (data.results) {
        for (const pulse of data.results) {
          if (pulse.indicators) {
            for (const indicator of pulse.indicators) {
              items.push({
                itemId: indicator.id,
                indicator: indicator.indicator,
                indicatorType: this.mapOTXType(indicator.type),
                severity: this.mapOTXSeverity(pulse.tlp),
                confidence: 0.7, // OTX default confidence
                timestamp: new Date(indicator.created),
                description: pulse.description || '',
                source: subscription.provider,
                metadata: {
                  pulseId: pulse.id,
                  pulseName: pulse.name,
                  pulseAuthor: pulse.author_name,
                  tlp: pulse.tlp,
                  tags: pulse.tags || [],
                },
              })
            }
          }
        }
      }

      return items
    } catch (error) {
      logger.error('OTX feed parsing failed:', { error })
      return []
    }
  }

  private mapOTXType(otxType: string): string {
    const typeMap: Record<string, string> = {
      'IPv4': 'ip',
      'domain': 'domain',
      'hostname': 'domain',
      'URL': 'url',
      'FileHash-MD5': 'file_hash',
      'FileHash-SHA1': 'file_hash',
      'FileHash-SHA256': 'file_hash',
      'email': 'email',
    }

    return typeMap[otxType] || 'unknown'
  }

  private mapOTXSeverity(tlp: string): string {
    const severityMap: Record<string, string> = {
      white: 'low',
      green: 'medium',
      amber: 'high',
      red: 'critical',
    }

    return severityMap[tlp] || 'medium'
  }

  async convertToThreat(
    item: FeedItem,
    subscription: FeedSubscription,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      const threatId = `external_${item.itemId}`

      return {
        threatId,
        threatType: this.mapIndicatorToThreatType(item.indicatorType),
        severity: item.severity,
        confidence: item.confidence,
        indicators: [
          {
            indicatorType: item.indicatorType as any,
            value: item.indicator,
            confidence: item.confidence,
            firstSeen: new Date(item.timestamp),
            lastSeen: new Date(item.timestamp),
          },
        ],
        firstSeen: new Date(item.timestamp),
        lastSeen: new Date(item.timestamp),
        regions: ['global'],
        attribution: {
          family: subscription.provider,
          campaign: `otx_${subscription.feedId}`,
          confidence: item.confidence,
        },
        metadata: {
          source: 'external_feed',
          feedId: subscription.feedId,
          provider: subscription.provider,
          itemId: item.itemId,
          description: item.description,
          pulseId: item.metadata?.pulseId,
          tags: item.metadata?.tags,
        },
      }
    } catch (error) {
      logger.error('OTX threat conversion failed:', { error })
      return null
    }
  }

  private mapIndicatorToThreatType(indicatorType: string): string {
    const typeMap: Record<string, string> = {
      ip: 'network_intrusion',
      domain: 'c2',
      url: 'malware_distribution',
      file_hash: 'malware',
      email: 'phishing',
      unknown: 'general',
    }

    return typeMap[indicatorType] || 'general'
  }
}

// VirusTotal Feed Processor
class VirusTotalFeedProcessor implements FeedProcessor {
  async parseFeed(
    data: any,
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const items: FeedItem[] = []

      // Parse VirusTotal format
      if (data.data) {
        for (const file of data.data) {
          if (file.attributes && file.attributes.last_analysis_stats) {
            const stats = file.attributes.last_analysis_stats
            const maliciousCount = stats.malicious || 0
            const totalCount =
              stats.malicious +
              stats.suspicious +
              stats.undetected +
              stats.harmless

            if (maliciousCount > 0) {
              items.push({
                itemId: file.id,
                indicator: file.id, // File hash
                indicatorType: this.detectHashType(file.id),
                severity: this.mapVTSeverity(maliciousCount, totalCount),
                confidence: maliciousCount / totalCount,
                timestamp: new Date(file.attributes.last_analysis_date * 1000),
                description:
                  file.attributes.meaningful_name || 'Malicious file',
                source: subscription.provider,
                metadata: {
                  fileName: file.attributes.meaningful_name,
                  fileSize: file.attributes.size,
                  fileType: file.attributes.type_description,
                  maliciousCount,
                  totalCount,
                  vtLink: `https://www.virustotal.com/gui/file/${file.id}`,
                },
              })
            }
          }
        }
      }

      return items
    } catch (error) {
      logger.error('VirusTotal feed parsing failed:', { error })
      return []
    }
  }

  private detectHashType(hash: string): string {
    if (hash.length === 32) return 'file_hash' // MD5
    if (hash.length === 40) return 'file_hash' // SHA1
    if (hash.length === 64) return 'file_hash' // SHA256
    return 'unknown'
  }

  private mapVTSeverity(malicious: number, total: number): string {
    const ratio = malicious / total
    if (ratio > 0.5) return 'critical'
    if (ratio > 0.2) return 'high'
    if (ratio > 0.05) return 'medium'
    return 'low'
  }

  async convertToThreat(
    item: FeedItem,
    subscription: FeedSubscription,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      const threatId = `external_${item.itemId}`

      return {
        threatId,
        threatType: 'malware',
        severity: item.severity,
        confidence: item.confidence,
        indicators: [
          {
            indicatorType: item.indicatorType as any,
            value: item.indicator,
            confidence: item.confidence,
            firstSeen: new Date(item.timestamp),
            lastSeen: new Date(item.timestamp),
          },
        ],
        firstSeen: new Date(item.timestamp),
        lastSeen: new Date(item.timestamp),
        regions: ['global'],
        attribution: {
          family: subscription.provider,
          campaign: `virustotal_${subscription.feedId}`,
          confidence: item.confidence,
        },
        metadata: {
          source: 'external_feed',
          feedId: subscription.feedId,
          provider: subscription.provider,
          itemId: item.itemId,
          description: item.description,
          fileName: item.metadata?.fileName,
          fileSize: item.metadata?.fileSize,
          fileType: item.metadata?.fileType,
          vtLink: item.metadata?.vtLink,
        },
      }
    } catch (error) {
      logger.error('VirusTotal threat conversion failed:', { error })
      return null
    }
  }
}

// Generic Feed Processor
class GenericFeedProcessor implements FeedProcessor {
  async parseFeed(
    data: any,
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const items: FeedItem[] = []

      // Handle generic JSON format
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.indicator || item.value || item.ioc) {
            items.push({
              itemId: item.id || item.indicator || item.value || item.ioc,
              indicator: item.indicator || item.value || item.ioc,
              indicatorType: item.type || item.indicator_type || 'unknown',
              severity: item.severity || item.threat_level || 'medium',
              confidence: item.confidence || item.reliability || 0.5,
              timestamp: new Date(item.timestamp || item.created || Date.now()),
              description: item.description || item.notes || '',
              source: subscription.provider,
              metadata: {
                rawData: item,
                sourceFormat: 'generic',
              },
            })
          }
        }
      } else if (data.indicators) {
        // Handle nested indicator format
        for (const indicator of data.indicators) {
          items.push({
            itemId: indicator.id || indicator.value,
            indicator: indicator.value,
            indicatorType: indicator.type || 'unknown',
            severity: indicator.severity || 'medium',
            confidence: indicator.confidence || 0.5,
            timestamp: new Date(indicator.timestamp || Date.now()),
            description: indicator.description || '',
            source: subscription.provider,
            metadata: {
              rawData: indicator,
              sourceFormat: 'generic_nested',
            },
          })
        }
      }

      return items
    } catch (error) {
      logger.error('Generic feed parsing failed:', { error })
      return []
    }
  }

  async convertToThreat(
    item: FeedItem,
    subscription: FeedSubscription,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      const threatId = `external_${item.itemId}`

      return {
        threatId,
        threatType: this.mapGenericToThreatType(item.indicatorType),
        severity: item.severity,
        confidence: item.confidence,
        indicators: [
          {
            indicatorType: item.indicatorType as any,
            value: item.indicator,
            confidence: item.confidence,
            firstSeen: new Date(item.timestamp),
            lastSeen: new Date(item.timestamp),
          },
        ],
        firstSeen: new Date(item.timestamp),
        lastSeen: new Date(item.timestamp),
        regions: ['global'],
        attribution: {
          family: subscription.provider,
          campaign: `generic_${subscription.feedId}`,
          confidence: item.confidence,
        },
        metadata: {
          source: 'external_feed',
          feedId: subscription.feedId,
          provider: subscription.provider,
          itemId: item.itemId,
          description: item.description,
          rawData: item.metadata?.rawData,
        },
      }
    } catch (error) {
      logger.error('Generic threat conversion failed:', { error })
      return null
    }
  }

  private mapGenericToThreatType(indicatorType: string): string {
    const typeMap: Record<string, string> = {
      ip: 'network_intrusion',
      domain: 'c2',
      url: 'malware_distribution',
      file_hash: 'malware',
      hash: 'malware',
      email: 'phishing',
      unknown: 'general',
    }

    return typeMap[indicatorType] || 'general'
  }
}
