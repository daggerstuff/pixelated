import {
  AnalyticsService,
  EventType,
  EventPriority,
  type EventData,
} from '@/lib/services/analytics/AnalyticsService'
import { Redis } from 'ioredis'
import { RedisService } from '../RedisService'
import {
  cleanupTestKeys,
  generateTestKey,
  monitorMemoryUsage,
  runConcurrentOperations,
  sleep,
  verifyRedisConnection,
} from './test-utils'

// Conditionally skip Redis integration tests in CI or when explicitly requested
const SKIP_REDIS_TESTS =
  process.env['SKIP_REDIS_TESTS'] === 'true' || process.env['CI'] === 'true'
const describeFn = SKIP_REDIS_TESTS ? describe.skip : describe

describeFn('analytics Integration', () => {
  let redis: RedisService
  let analytics: AnalyticsService
  let pubClient: Redis
  let subClient: Redis

  beforeAll(async () => {
    await verifyRedisConnection()

    // Set up Redis pub/sub clients
    pubClient = new Redis(process.env['REDIS_URL']!)
    subClient = new Redis(process.env['REDIS_URL']!)
  })

  beforeEach(async () => {
    redis = new RedisService({
      url: process.env['REDIS_URL']!,
      keyPrefix: process.env['REDIS_KEY_PREFIX']!,
      maxRetries: 3,
      retryDelay: 100,
      connectTimeout: 5000,
      maxConnections: 10,
      minConnections: 2,
    })
    await redis.connect()

    analytics = new AnalyticsService({
      retentionDays: 1,
      batchSize: 100,
      processingInterval: 100,
    })
  })

  afterEach(async () => {
    await cleanupTestKeys()
    await analytics.cleanup()
    await redis.disconnect()
  })

  afterAll(async () => {
    await pubClient.quit()
    await subClient.quit()
  })

  describe('event Tracking', () => {
    it('should track individual events', async () => {
      const event: EventData = {
        type: EventType.USER_ACTION,
        priority: EventPriority.NORMAL,
        userId: 'user123',
        timestamp: Date.now(),
        properties: {},
        metadata: { browser: 'Chrome', os: 'MacOS' },
      }

      const eventId = await analytics.trackEvent(event)
      const events = await analytics.getEvents({ type: EventType.USER_ACTION })

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ ...event, id: eventId })
    })

    it('should handle concurrent event tracking', async () => {
      const userId = 'user123'
      const eventCount = 100
      const events = Array.from({ length: eventCount }, (_, i) => ({
        type: EventType.USER_ACTION,
        priority: EventPriority.NORMAL,
        userId,
        timestamp: Date.now() + i,
        properties: {},
        metadata: { index: i },
      }))

      const operations = events.map(
        (event) => () => analytics.trackEvent(event),
      )

      await runConcurrentOperations(operations, {
        description: 'Concurrent event tracking',
        expectedDuration: 2000,
        minThroughput: 50,
      })

      const storedEvents = await analytics.getEvents({
        type: EventType.USER_ACTION,
        startTime: Date.now() - 2000,
        endTime: Date.now(),
      })
      expect(storedEvents.filter((e) => e.userId === userId)).toHaveLength(
        eventCount,
      )
    })

    it('should maintain event order', async () => {
      const baseTime = Date.now()
      const events: EventData[] = Array.from({ length: 5 }, (_, i) => ({
        type: EventType.USER_ACTION,
        priority: EventPriority.NORMAL,
        userId: 'user123',
        timestamp: baseTime + i * 1000,
        properties: {},
        metadata: { sequence: i },
      }))

      // Track events in reverse order
      for (const event of events.reverse()) {
        await analytics.trackEvent(event)
      }

      const storedEvents = await analytics.getEvents({
        type: EventType.USER_ACTION,
        startTime: baseTime,
        endTime: baseTime + 5000,
      })
      expect(storedEvents).toHaveLength(events.length)

      // Verify events are stored in chronological order
      storedEvents.forEach((event, i) => {
        expect(event.metadata['sequence']).toBe(i)
      })
    })
  })

  describe('metrics Tracking', () => {
    it('should track metrics over time', async () => {
      const metricName = generateTestKey('response_time')
      const values = Array.from({ length: 100 }, () => Math.random() * 100)

      // Record metric values
      await Promise.all(
        values.map((value) =>
          analytics.trackMetric({
            name: metricName,
            value,
            timestamp: Date.now(),
            tags: {},
          }),
        ),
      )

      const metrics = await analytics.getMetrics({
        name: metricName,
        startTime: Date.now() - 1000,
        endTime: Date.now(),
      })
      expect(metrics).toHaveLength(values.length)
    })

    it('should maintain metric history', async () => {
      const metricName = generateTestKey('cpu_usage')
      const intervals = 5
      const valuesPerInterval = 10

      // Record metrics for different time intervals
      for (let i = 0; i < intervals; i++) {
        const timestamp = Date.now() - (intervals - i) * 60000 // 1 minute intervals
        for (let j = 0; j < valuesPerInterval; j++) {
          await analytics.trackMetric({
            name: metricName,
            value: Math.random() * 100,
            timestamp,
            tags: { interval: i.toString() },
          })
        }
      }

      const metrics = await analytics.getMetrics({
        name: metricName,
        startTime: Date.now() - intervals * 60000,
        endTime: Date.now(),
      })
      expect(metrics).toHaveLength(intervals * valuesPerInterval)

      // Group metrics by interval
      const metricsByInterval = metrics.reduce(
        (acc: Record<string, number>, metric) => {
          const key = metric.tags?.['interval'] ?? 'unknown'
          acc[key] = (acc[key] || 0) + 1
          return acc
        },
        {},
      )

      // Verify each interval has the correct number of metrics
      Object.values(metricsByInterval).forEach((count) => {
        expect(count).toBe(valuesPerInterval)
      })
    })

    it('should handle metric expiration', async () => {
      const metricName = generateTestKey('temp_metric')
      const ttl = 2 // 2 seconds

      await analytics.trackMetric({
        name: metricName,
        value: 100,
        timestamp: Date.now(),
        tags: { ttl: ttl.toString() },
      })

      // Verify metric exists
      let metrics = await analytics.getMetrics({
        name: metricName,
        startTime: Date.now() - 1000,
        endTime: Date.now(),
      })
      expect(metrics).toHaveLength(1)

      // Wait for expiration
      await sleep(ttl * 1000 + 100)

      // Verify metric is expired
      metrics = await analytics.getMetrics({
        name: metricName,
        startTime: Date.now() - ttl * 1000 - 200,
        endTime: Date.now(),
      })
      expect(metrics).toHaveLength(0)
    })
  })

  describe('real-time Analytics', () => {
    it('should track active users', async () => {
      const users = Array.from({ length: 5 }, (_, i) => `user${i}`)

      // Track user activity through events
      await Promise.all(
        users.map((userId) =>
          analytics.trackEvent({
            type: EventType.USER_ACTION,
            priority: EventPriority.NORMAL,
            userId,
            timestamp: Date.now(),
            properties: { action: 'login' },
            metadata: {},
          }),
        ),
      )

      // Get recent user activity
      const recentEvents = await analytics.getEvents({
        type: EventType.USER_ACTION,
        startTime: Date.now() - 1000,
        endTime: Date.now(),
      })

      const activeUsers = [...new Set(recentEvents.map((e) => e.userId!))]
      expect(activeUsers).toHaveLength(users.length)
      users.forEach((userId) => {
        expect(activeUsers).toContain(userId)
      })
    })

    it('should handle user session timeouts', async () => {
      const userId = 'user123'
      const sessionTtl = 2 // 2 seconds

      // Track user session start
      await analytics.trackEvent({
        type: EventType.USER_ACTION,
        priority: EventPriority.NORMAL,
        userId,
        timestamp: Date.now(),
        properties: { action: 'session_start' },
        metadata: { ttl: sessionTtl },
      })

      // Verify user is active
      let activeUsers = await analytics.getEvents({
        type: EventType.USER_ACTION,
        startTime: Date.now() - 1000,
        endTime: Date.now(),
      })
      expect(activeUsers.some((e) => e.userId === userId)).toBe(true)

      // Wait for session timeout
      await sleep(sessionTtl * 1000 + 100)

      // Verify user is no longer active
      activeUsers = await analytics.getEvents({
        type: EventType.USER_ACTION,
        startTime: Date.now() - 1000,
        endTime: Date.now(),
      })
      expect(activeUsers.some((e) => e.userId === userId)).toBe(false)
    })

    it('should track concurrent sessions', async () => {
      const baseUserId = 'user'
      const sessionCount = 1000
      const users = Array.from(
        { length: sessionCount },
        (_, i) => `${baseUserId}${i}`,
      )

      await monitorMemoryUsage(
        async () => {
          const operations = users.map(
            (userId) => () =>
              analytics.trackEvent({
                type: EventType.USER_ACTION,
                priority: EventPriority.NORMAL,
                userId,
                timestamp: Date.now(),
                properties: { action: 'session_start' },
                metadata: {},
              }),
          )

          await runConcurrentOperations(operations, {
            description: 'Concurrent session tracking',
            expectedDuration: 5000,
            minThroughput: 200,
          })
        },
        {
          description: 'Memory usage during session tracking',
          maxMemoryIncrease: 50, // Max 50MB increase
        },
      )

      const activeUsers = await analytics.getEvents({
        type: EventType.USER_ACTION,
        startTime: Date.now() - 1000,
        endTime: Date.now(),
      })
      expect(activeUsers.length).toBe(sessionCount)
    })
  })

  describe('error Handling', () => {
    it('should handle Redis connection failures', async () => {
      const event: EventData = {
        type: EventType.ERROR,
        priority: EventPriority.HIGH,
        userId: 'user123',
        timestamp: Date.now(),
        properties: { error: 'test_error' },
        metadata: {},
      }

      // Force Redis disconnection
      await redis.disconnect()

      // Attempt to track event
      await expect(analytics.trackEvent(event)).rejects.toThrow()

      // Reconnect for cleanup
      await redis.connect()
    })

    it('should handle invalid metric values', async () => {
      const metricName = generateTestKey('invalid_metric')

      await expect(
        analytics.trackMetric({
          name: metricName,
          value: Number.NaN,
          timestamp: Date.now(),
          tags: {},
        }),
      ).rejects.toThrow()

      await expect(
        analytics.trackMetric({
          name: metricName,
          value: Infinity,
          timestamp: Date.now(),
          tags: {},
        }),
      ).rejects.toThrow()
    })

    it('should handle Redis memory limits', async () => {
      const metricName = generateTestKey('memory_test')
      const largeValue = 'x'.repeat(1024 * 1024) // 1MB string

      // Attempt to store large values
      const promises = Array.from({ length: 100 }, () =>
        analytics.trackMetric({
          name: metricName,
          value: 1,
          timestamp: Date.now(),
          tags: { largeValue },
        }),
      )

      await expect(Promise.all(promises)).rejects.toThrow()
    })
  })

  describe('performance', () => {
    it('should handle high event throughput', async () => {
      const userId = 'user123'
      const eventCount = 10000
      const events = Array.from({ length: eventCount }, (_, i) => ({
        type: EventType.PERFORMANCE,
        priority: EventPriority.NORMAL,
        userId,
        timestamp: Date.now() + i,
        properties: { index: i },
        metadata: {},
      }))

      const { duration, throughput } = await runConcurrentOperations(
        events.map((event) => () => analytics.trackEvent(event)),
        {
          description: 'High throughput event tracking',
          expectedDuration: 10000,
          minThroughput: 1000,
        },
      )

      expect(duration).toBeLessThan(10000)
      expect(throughput).toBeGreaterThan(1000)

      // Get all events for this user
      const storedEvents = await analytics.getEvents({
        type: EventType.PERFORMANCE,
        startTime: Date.now() - 1000,
        endTime: Date.now() + eventCount,
      })
      expect(storedEvents.filter((e) => e.userId === userId)).toHaveLength(
        eventCount,
      )
    })

    it('should maintain performance with large datasets', async () => {
      const userCount = 100
      const eventsPerUser = 100
      const users = Array.from({ length: userCount }, (_, i) => `user${i}`)

      await monitorMemoryUsage(
        async () => {
          for (const userId of users) {
            const events = Array.from({ length: eventsPerUser }, (_, i) => ({
              type: EventType.PERFORMANCE,
              priority: EventPriority.NORMAL,
              userId,
              timestamp: Date.now() + i,
              properties: { index: i },
              metadata: {},
            }))

            await Promise.all(
              events.map((event) => analytics.trackEvent(event)),
            )
          }
        },
        {
          description: 'Memory usage during bulk event tracking',
          maxMemoryIncrease: 100, // Max 100MB increase
        },
      )

      // Verify data integrity
      for (const userId of users) {
        const events = await analytics.getEvents({
          type: EventType.PERFORMANCE,
          startTime: Date.now() - 1000,
          endTime: Date.now() + eventsPerUser,
        })
        expect(events.filter((e) => e.userId === userId)).toHaveLength(
          eventsPerUser,
        )
      }
    })
  })
})
