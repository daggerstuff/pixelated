/**
 * External Threat Feed Integration System
 * Integrates with external threat intelligence feeds and services
 */

import { EventEmitter } from 'events'

import type { AxiosInstance } from 'axios'
import Redis from 'ioredis'
import { MongoClient, Db } from 'mongodb'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import {
  FeedConfig,
  FeedItem,
  FeedSubscription,
  FeedSubscriptionRequestConfig,
  FeedProcessingResult,
  GlobalThreatIntelligence,
} from '../global/types'
import {
  buildFeedRequestConfig,
  calculateNextFetchTime,
  createThreatFeedHttpClient,
  deduplicateFeedItems,
  filterFeedItems,
  generateItemKey,
  generateSubscriptionId,
  getFeedProcessingInterval,
  validateFeedConfig,
} from './feed-helpers'
import {
  type FeedProcessor,
  MISPFeedProcessor,
  STIXFeedProcessor,
  TAXIIFeedProcessor,
} from './feed-processors'
import {
  GenericFeedProcessor,
  OTXFeedProcessor,
  VirusTotalFeedProcessor,
} from './feed-processors-additional'

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
  private redis!: Redis
  private mongoClient!: MongoClient
  private db!: Db
  private readonly httpClient!: AxiosInstance
  private readonly subscriptions: Map<string, FeedSubscription> = new Map()
  private readonly feedProcessors: Map<string, FeedProcessor> = new Map()
  private readonly activeTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(_config: FeedConfig) {
    super()
    this.httpClient = createThreatFeedHttpClient()
    this.initializeFeedProcessors()
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
    } catch (error: unknown) {
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
      this.redis = new Redis(
        process.env['REDIS_URL'] ?? 'redis://localhost:6379',
      )
      await this.redis.ping()
      logger.info('Redis connection established for feed integration')
    } catch (error: unknown) {
      logger.error('Failed to connect to Redis:', { error })
      throw new Error('Redis connection failed', { cause: error })
    }
  }

  private async initializeMongoDB(): Promise<void> {
    try {
      this.mongoClient = new MongoClient(
        process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/threat_feeds',
      )
      await this.mongoClient.connect()
      this.db = this.mongoClient.db('threat_feeds')
      logger.info('MongoDB connection established for feed integration')
    } catch (error: unknown) {
      logger.error('Failed to connect to MongoDB:', { error })
      throw new Error('MongoDB connection failed', { cause: error })
    }
  }

  private async loadSubscriptions(): Promise<void> {
    try {
      const subscriptionsCollection = this.db.collection('feed_subscriptions')
      const subscriptions = (await subscriptionsCollection
        .find({ status: 'active' })
        .toArray()) as unknown as FeedSubscription[]

      for (const subscription of subscriptions) {
        this.subscriptions.set(subscription.subscriptionId, subscription)

        // Restart feed processing for active subscriptions
        await this.startFeedProcessingForSubscription(subscription)
      }

      logger.info(`Loaded ${subscriptions.length} active feed subscriptions`)
    } catch (error: unknown) {
      logger.error('Failed to load subscriptions:', { error })
    }
  }

  private async startFeedProcessing(): Promise<void> {
    // Process feeds every 5 minutes
    setInterval(async () => {
      try {
        await this.processAllActiveFeeds()
      } catch (error: unknown) {
        logger.error('Feed processing error:', { error })
      }
    }, 300000)
  }

  private async startMetricsCollection(): Promise<void> {
    // Collect metrics every 10 minutes
    setInterval(async () => {
      try {
        await this.collectMetrics()
      } catch (error: unknown) {
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
      validateFeedConfig(feedConfig)

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
    } catch (error: unknown) {
      logger.error('Failed to subscribe to feed:', { error })
      throw error
    }
  }

  private async createSubscription(
    feedConfig: FeedConfig,
  ): Promise<FeedSubscription> {
    const subscriptionId = generateSubscriptionId()

    return {
      subscriptionId,
      feedId: feedConfig.feedId,
      provider: feedConfig.provider,
      feedType: feedConfig.feedType,
      endpoint: feedConfig.endpoint,
      apiKey: feedConfig.apiKey,
      parameters: feedConfig.parameters ?? {},
      filters: feedConfig.filters ?? {},
      updateFrequency: feedConfig.updateFrequency ?? 'hourly',
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
    } catch (error: unknown) {
      logger.error('Failed to store subscription:', { error })
      throw error
    }
  }

  private async startFeedProcessingForSubscription(
    subscription: FeedSubscription,
  ): Promise<void> {
    try {
      const interval = getFeedProcessingInterval(
        subscription.updateFrequency,
      )

      const timer = setInterval(async () => {
        try {
          await this.processFeedForSubscription(subscription)
        } catch (error: unknown) {
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
    } catch (error: unknown) {
      logger.error('Failed to start feed processing for subscription:', {
        error,
      })
    }
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
      subscription.itemsProcessed =
        (subscription.itemsProcessed ?? 0) + processingResult.itemsProcessed

      if (processingResult.errors > 0) {
        subscription.errors =
          (subscription.errors ?? 0) + processingResult.errors
      }

      // Update subscription in database
      await this.updateSubscription(subscription)

      this.emit('feed_processed', {
        subscriptionId: subscription.subscriptionId,
        itemsProcessed: processingResult.itemsProcessed,
        threatsDiscovered: processingResult.threatsDiscovered,
        errors: processingResult.errors,
      })
    } catch (error: unknown) {
      logger.error('Feed processing failed for subscription:', {
        error,
        subscriptionId: subscription.subscriptionId,
      })

      subscription.errors = (subscription.errors ?? 0) + 1
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
      const requestConfig = await buildFeedRequestConfig(subscription)

      // Fetch feed data
      const response = await this.httpClient.request(requestConfig)

      // Parse feed items
      const feedItems = await processor.parseFeed(response.data, subscription)

      // Filter items based on subscription filters
      const filteredItems = filterFeedItems(
        feedItems,
        subscription.filters,
      )

      // Deduplicate items
      const deduplicatedItems = await deduplicateFeedItems(
        filteredItems,
        subscription,
        this.redis,
      )

      return deduplicatedItems
    } catch (error: unknown) {
      logger.error('Failed to fetch feed items:', {
        error,
        subscriptionId: subscription.subscriptionId,
      })
      throw error
    }
  }

  private getFeedProcessor(feedType: string): FeedProcessor | undefined {
    return this.feedProcessors.get(feedType)
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
        } catch (error: unknown) {
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
    } catch (error: unknown) {
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
        } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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

      const nextFetchTime = calculateNextFetchTime(subscription)

      return {
        subscriptionId: subscription.subscriptionId,
        feedId: subscription.feedId,
        status: subscription.status,
        lastFetchTime: subscription.lastFetchTime,
        lastProcessedTime: subscription.lastProcessedTime,
        itemsProcessed: subscription.itemsProcessed ?? 0,
        errors: subscription.errors ?? 0,
        nextFetchTime,
      }
    } catch (error: unknown) {
      logger.error('Failed to get feed status:', { error, subscriptionId })
      throw error
    }
  }

  async getAllSubscriptions(): Promise<FeedSubscription[]> {
    try {
      const subscriptionsCollection = this.db.collection('feed_subscriptions')
      const subscriptions = (await subscriptionsCollection
        .find({})
        .toArray()) as unknown as FeedSubscription[]

      return subscriptions
    } catch (error: unknown) {
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
      const updatedConfig = {
        ...subscription.config,
        ...config,
      } as FeedConfig & FeedSubscriptionRequestConfig

      // Validate updated configuration (requires required fields to be present)
      validateFeedConfig(updatedConfig)

      subscription.config = updatedConfig

      // Update in database
      await this.updateSubscription(subscription)

      this.emit('feed_config_updated', { subscriptionId })

      return true
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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

      return result[0]?.['totalItems'] ?? 0
    } catch (error: unknown) {
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

      return result[0]?.['avgTime'] ?? 0
    } catch (error: unknown) {
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
        feedsByType[result['feedType']] = result['count']
      }

      return feedsByType
    } catch (error: unknown) {
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
        feedsByProvider[result['provider']] = result['count']
      }

      return feedsByProvider
    } catch (error: unknown) {
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
        } catch (error: unknown) {
          logger.error('Failed to process feed for subscription:', {
            error,
            subscriptionId: subscription.subscriptionId,
          })
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to process all active feeds:', { error })
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getFeedMetrics()

      this.emit('metrics_collected', metrics)
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      logger.error('Redis health check failed:', { error })
      return false
    }
  }

  private async checkMongoDBHealth(): Promise<boolean> {
    try {
      await this.db.admin().ping()
      return true
    } catch (error: unknown) {
      logger.error('MongoDB health check failed:', { error })
      return false
    }
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
    } catch (error: unknown) {
      logger.error('Error during shutdown:', { error })
      throw error
    }
  }
}
export type { FeedProcessor } from './feed-processors'

interface BatchProcessingResult {
  itemsProcessed: number
  threatsDiscovered: number
  errors: number
  threats: GlobalThreatIntelligence[]
}
