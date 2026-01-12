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
  return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Analytics service for tracking events and metrics with HIPAA compliance
 */
export class AnalyticsService {
  private readonly wsClients: Map<string, WebSocket>
  private readonly retentionDays: number
  private readonly batchSize: number
  private readonly redisClient: RedisClient

  constructor(options: AnalyticsServiceOptions = {}) {
    this.wsClients = new Map()
    this.retentionDays = options.retentionDays || 90 // Default 90 days retention
    this.batchSize = options.batchSize || 100
    this.redisClient = redis as unknown as RedisClient // Safe because we control the Redis client implementation
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
        'analytics:events:queue',
        JSON.stringify(event),
      )

      // Store event in time series
      await this.storeEventInTimeSeries(event)

      // Notify real-time subscribers
      this.notifySubscribers(event)

      return eventId
    } catch (error: any) {
      logger.error('Error tracking event:', error)
      const errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      throw new ValidationError(`Invalid event data: Input=${JSON.stringify(data)} Error=${errorDetails} Issues=${JSON.stringify(error.issues || [])}`, error)
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
        `analytics:metrics:${metric.name}`,
        metric.timestamp,
        JSON.stringify(metric),
      )

      // Store metric tags for filtering
      if (metric.tags && Object.keys(metric.tags).length > 0) {
        await this.redisClient.hset(
          `analytics:metrics:tags:${metric.name}`,
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
      const events = await this.redisClient.lrange(
        'analytics:events:queue',
        0,
        this.batchSize - 1,
      )

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
            `analytics:events:processed:${processedEvent.type}`,
            processedEvent.id,
            JSON.stringify(processedEvent),
          )

          // Remove from queue
          await this.redisClient.lrem('analytics:events:queue', 1, eventJson)
        } catch (error: unknown) {
          logger.error('Error processing event:', error)
          // Import fs dynamically to avoid import errors if not available, or use global require if needed, but here simple console is safer if fs is issue.
          // BUT user asked for file log.
          try {
            const fs = await import('node:fs');
            fs.appendFileSync('/tmp/debug_analytics.log', `[ProcessError] ${JSON.stringify(error, Object.getOwnPropertyNames(error))}\n`);
          } catch { }
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
    const { type, limit = 100, offset = 0 } = options

    try {
      // Get events from time series
      // ioredis compatibility: use zrangebyscore and limit as needed
      const start =
        typeof options.startTime === 'number' ? options.startTime : '-inf'
      const end = typeof options.endTime === 'number' ? options.endTime : '+inf'
      let eventJsons: string[] = []
      if (typeof offset === 'number' && typeof limit === 'number') {
        eventJsons = await this.redisClient.zrangebyscore(
          `analytics:events:time:${type}`,
          start,
          end,
          'LIMIT',
          offset,
          limit,
        )
      } else {
        eventJsons = await this.redisClient.zrangebyscore(
          `analytics:events:time:${type}`,
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
            return JSON.parse(json) as unknown as Event
          } catch (error: unknown) {
            logger.error('Error parsing event JSON:', error)
            return null
          }
        })
        .filter((event): event is Event => event !== null)
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

    try {
      // Get metrics from time series
      // ioredis compatibility: use zrangebyscore
      const start =
        typeof options.startTime === 'number' ? options.startTime : '-inf'
      const end = typeof options.endTime === 'number' ? options.endTime : '+inf'
      const metricJsons = await this.redisClient.zrangebyscore(
        `analytics:metrics:${name}`,
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
            return JSON.parse(json) as unknown as Metric
          } catch (error: unknown) {
            logger.error('Error parsing metric JSON:', error)
            return null
          }
        })
        .filter((metric): metric is Metric => metric !== null)

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
          `analytics:events:time:${type}`,
          0,
          cutoff,
        )
      }

      // Clean up metrics
      const metricKeys = await this.redisClient.keys('analytics:metrics:*')
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
      `analytics:events:time:${event.type}`,
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
