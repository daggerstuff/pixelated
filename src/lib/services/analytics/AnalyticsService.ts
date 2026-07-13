import type { WebSocket } from 'ws'

import { redis } from '@/lib/redis'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import {
  type Event,
  type EventData,
  type Metric,
  type RedisClient,
  type AnalyticsServiceOptions,
  type EventQueryOptions,
  type MetricQueryOptions,
  type AnalyticsWebSocketMessage,
  EventType,
  EventDataSchema,
  EventSchema,
  MetricSchema,
  isValidEventJson,
  isValidMetricJson,
  ValidationError,
  ProcessingError,
} from './analytics-types'

// Use a meaningful component name so log lines are attributable
const logger = createBuildSafeLogger('analytics')

/**
 * Simple ID generator for analytics events
 */
function generateEventId(): string {
  return `event_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Analytics service for tracking events and metrics with HIPAA compliance
 */
export class AnalyticsService {
  private readonly wsClients: Map<string, WebSocket>
  private readonly retentionDays: number
  private readonly batchSize: number
  private readonly redisClient: RedisClient
  private readonly keyPrefix: string

  private buildKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key
  }

  constructor(options: AnalyticsServiceOptions = {}) {
    this.wsClients = new Map()
    this.retentionDays = options.retentionDays ?? 90 // Default 90 days retention
    this.batchSize = options.batchSize ?? 100
    this.keyPrefix = options.redisKeyPrefix ?? ''
    this.redisClient = options.redisClient ?? (redis as unknown as RedisClient) // Safe because we control the Redis client implementation
  }

  /**
   * Track an event
   */
  async trackEvent(data: EventData): Promise<string> {
    try {
      // Validate event data
      logger.debug('Validating event data:', data)
      const validatedData = EventDataSchema.parse(data)
      logger.debug('Event data validated successfully:', validatedData)

      // Generate event ID
      const eventId = generateEventId()

      // Create event object
      const event = EventSchema.parse({
        ...validatedData,
        id: eventId,
      })

      // Queue event for processing
      await this.redisClient.lpush(
        this.buildKey('analytics:events:queue'),
        JSON.stringify(event),
      )

      // Store event in time series
      await this.storeEventInTimeSeries(event)

      // Notify real-time subscribers
      this.notifySubscribers(event)

      return eventId
    } catch (error: unknown) {
      logger.error('Error tracking event:', error)
      throw new ValidationError('Invalid event data', error)
    }
  }

  /**
   * Track a metric
   */
  async trackMetric(data: Metric): Promise<void> {
    try {
      // Validate metric data
      logger.debug('Validating metric data:', data)
      const metric = MetricSchema.parse(data)
      logger.debug('Metric data validated successfully:', metric)

      // Store metric in time series
      await this.redisClient.zadd(
        this.buildKey(`analytics:metrics:${metric.name}`),
        metric.timestamp,
        JSON.stringify(metric),
      )

      // Store metric tags for filtering
      if (metric.tags && Object.keys(metric.tags).length > 0) {
        await this.redisClient.hset(
          this.buildKey(`analytics:metrics:tags:${metric.name}`),
          metric.timestamp.toString(),
          JSON.stringify(metric.tags),
        )
      }
    } catch (error: unknown) {
      logger.error('Error tracking metric:', error)
      throw new ValidationError('Invalid metric data', error)
    }
  }

  /**
   * Process queued events
   */
  async processEvents(): Promise<void> {
    try {
      // Process events in batches
      const events = (await this.redisClient.lRange(
        this.buildKey('analytics:events:queue'),
        0,
        this.batchSize - 1,
      )) as string[]

      if (events.length === 0) {
        return
      }

      // Process each event
      for (const eventJson of events) {
        try {
          if (!isValidEventJson(eventJson)) {
            logger.error('Invalid event JSON:', eventJson)
            continue
          }

          const event = JSON.parse(eventJson) as unknown as Event

          // Mark event as processed
          const processedEvent = EventSchema.parse({
            ...event,
            processedAt: Date.now(),
          })

          // Store processed event
          await this.redisClient.hset(
            this.buildKey(`analytics:events:processed:${processedEvent.type}`),
            processedEvent.id,
            JSON.stringify(processedEvent),
          )

          // Remove from queue
          await this.redisClient.lrem(
            this.buildKey('analytics:events:queue'),
            1,
            eventJson,
          )
        } catch (error: unknown) {
          logger.error('Error processing event:', error)
          throw new ProcessingError('Failed to process event', error)
        }
      }
    } catch (error: unknown) {
      logger.error('Error in event processing:', error)
      throw new ProcessingError('Event processing failed', error)
    }
  }

  /**
   * Get events by type and time range
   */
  async getEvents(options: EventQueryOptions): Promise<Event[]> {
    const { type, limit, offset } = options
    const queryNow = Date.now()
    const hasRecentEnd =
      typeof options.endTime === 'number' &&
      Math.abs(options.endTime - queryNow) <= 10_000
    const endTime =
      typeof options.endTime === 'number'
        ? hasRecentEnd
          ? queryNow + 10_000
          : options.endTime
        : '+inf'
    const startLookbehindMs = hasRecentEnd ? 5_000 : 500

    try {
      // Get events from time series
      // ioredis compatibility: use zrangebyscore and limit as needed
      const start =
        typeof options.startTime === 'number'
          ? options.startTime - startLookbehindMs
          : '-inf'
      const end = endTime
      let eventJsons: string[] = []
      if (typeof offset === 'number' && typeof limit === 'number') {
        eventJsons = await this.redisClient.zrangebyscore(
          this.buildKey(`analytics:events:time:${type}`),
          start,
          end,
          'LIMIT',
          offset,
          limit,
        )
      } else {
        eventJsons = await this.redisClient.zrangebyscore(
          this.buildKey(`analytics:events:time:${type}`),
          start,
          end,
        )
      }

      return eventJsons
        .map((json) => {
          try {
            if (!isValidEventJson(json)) {
              logger.warn('Invalid event JSON in storage:', json)
              return null
            }
            return JSON.parse(json)
          } catch (error: unknown) {
            logger.error('Error parsing event JSON:', error)
            return null
          }
        })
        .filter((event): event is Event => {
          if (event === null) {
            return false
          }

          const ttlValue = event.metadata?.['ttl']
          if (typeof ttlValue === 'undefined') {
            return true
          }

          const ttlSeconds = Number.parseInt(String(ttlValue), 10)
          if (
            Number.isNaN(ttlSeconds) ||
            !Number.isFinite(ttlSeconds) ||
            ttlSeconds <= 0
          ) {
            return true
          }

          return event.timestamp + ttlSeconds * 1000 >= Date.now()
        })
    } catch (error: unknown) {
      logger.error('Error getting events:', error)
      throw new ProcessingError('Failed to retrieve events', error)
    }
  }

  /**
   * Get metric values by name and time range
   */
  async getMetrics(options: MetricQueryOptions): Promise<Metric[]> {
    const { name, tags } = options
    const queryNow = Date.now()
    const hasRecentEnd =
      typeof options.endTime === 'number' &&
      Math.abs(options.endTime - queryNow) <= 10_000
    const endTime =
      typeof options.endTime === 'number'
        ? hasRecentEnd
          ? queryNow + 10_000
          : options.endTime
        : '+inf'
    const startLookbehindMs = hasRecentEnd ? 5_000 : 500

    try {
      // Get metrics from time series
      // ioredis compatibility: use zrangebyscore
      const start =
        typeof options.startTime === 'number'
          ? options.startTime - startLookbehindMs
          : '-inf'
      const end = endTime
      const metricJsons = await this.redisClient.zrangebyscore(
        this.buildKey(`analytics:metrics:${name}`),
        start,
        end,
      )

      const metrics = metricJsons
        .map((json) => {
          try {
            if (!isValidMetricJson(json)) {
              logger.warn('Invalid metric JSON in storage:', json)
              return null
            }
            return JSON.parse(json)
          } catch (error: unknown) {
            logger.error('Error parsing metric JSON:', error)
            return null
          }
        })
        .filter((metric): metric is Metric => {
          if (metric === null) {
            return false
          }

          const ttlValue = metric.tags?.['ttl']
          if (typeof ttlValue === 'undefined') {
            return true
          }

          const ttlSeconds = Number.parseInt(ttlValue, 10)
          if (
            Number.isNaN(ttlSeconds) ||
            !Number.isFinite(ttlSeconds) ||
            ttlSeconds <= 0
          ) {
            return true
          }

          return metric.timestamp + ttlSeconds * 1000 >= Date.now()
        })

      // Filter by tags if provided
      if (tags) {
        return metrics.filter((metric) => {
          return Object.entries(tags).every(
            ([key, value]) => metric.tags[key] === value,
          )
        })
      }

      return metrics
    } catch (error: unknown) {
      logger.error('Error getting metrics:', error)
      throw new ProcessingError('Failed to retrieve metrics', error)
    }
  }

  /**
   * Register a WebSocket client for real-time updates
   */
  registerClient(userId: string, ws: WebSocket): void {
    this.wsClients.set(userId, ws)

    ws.on('close', () => {
      this.wsClients.delete(userId)
    })
  }

  /**
   * Check if a client is registered
   */
  hasClient(userId: string): boolean {
    return this.wsClients.has(userId)
  }

  /**
   * Clean up old events and metrics
   */
  async cleanup(): Promise<void> {
    try {
      const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000

      // Clean up events
      for (const type of Object.values(EventType)) {
        await this.redisClient.zremrangebyscore(
          this.buildKey(`analytics:events:time:${type}`),
          0,
          cutoff,
        )
      }

      // Clean up metrics
      const metricKeys = await this.redisClient.keys(
        this.buildKey('analytics:metrics:*'),
      )
      for (const key of metricKeys) {
        if (!key.includes(':tags:')) {
          await this.redisClient.zremrangebyscore(key, 0, cutoff)
        }
      }

      logger.info('Analytics cleanup completed')
    } catch (error: unknown) {
      logger.error('Error in analytics cleanup:', error)
      throw new ProcessingError('Cleanup operation failed', error)
    }
  }

  /**
   * Store event in time series for efficient querying
   */
  private async storeEventInTimeSeries(event: Event): Promise<void> {
    await this.redisClient.zadd(
      this.buildKey(`analytics:events:time:${event.type}`),
      event.timestamp,
      JSON.stringify(event),
    )
  }

  /**
   * Notify WebSocket subscribers of new events
   */
  private notifySubscribers(event: Event): void {
    if (event.userId) {
      const ws = this.wsClients.get(event.userId)
      if (ws) {
        const message: AnalyticsWebSocketMessage = {
          type: 'analytics_event',
          event,
        }
        ws.send(JSON.stringify(message))
      }
    }
  }
}

// Re-export commonly used types and enums for consumers
export { EventType } from './analytics-types'
export { EventPriority } from './analytics-types'
export type { EventData } from './analytics-types'
