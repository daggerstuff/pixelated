import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EventPriority, EventType } from '../analytics-types'
import { AnalyticsService } from '../AnalyticsService'

const { mockRedisClient } = vi.hoisted(() => ({
  mockRedisClient: {
    lpush: vi.fn(async () => 1),
    lRange: vi.fn(async () => [] as string[]),
    lrem: vi.fn(async () => 1),
    zadd: vi.fn(async () => 1),
    zrangebyscore: vi.fn(async () => [] as string[]),
    hset: vi.fn(async () => 1),
  },
}))

vi.mock('@/lib/redis', () => ({
  redis: mockRedisClient,
}))

vi.mock('../../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

class MockWebSocket {
  public readonly url: string
  public sent: string[] = []
  private handlers = new Map<string, Array<() => void>>()

  constructor(url: string) {
    this.url = url
  }

  send(payload: string) {
    this.sent.push(payload)
  }

  on(event: string, handler: () => void) {
    const existing = this.handlers.get(event) ?? []
    existing.push(handler)
    this.handlers.set(event, existing)
  }

  emit(event: string) {
    for (const handler of this.handlers.get(event) ?? []) {
      handler()
    }
  }
}

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService

  const mockEvent = {
    type: EventType.USER_ACTION,
    priority: EventPriority.NORMAL,
    userId: 'test-user',
    sessionId: 'test-session',
    timestamp: Date.now(),
    properties: {
      action: 'click',
      target: 'button',
    },
    metadata: {
      browser: 'Chrome',
      os: 'macOS',
    },
  }

  const mockMetric = {
    name: 'response_time',
    value: 150,
    timestamp: Date.now(),
    tags: {
      endpoint: '/api/therapy',
      method: 'POST',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    analyticsService = new AnalyticsService()
  })

  it('tracks an event and stores it in the queue and time series', async () => {
    const eventId = await analyticsService.trackEvent(mockEvent)

    expect(eventId).toMatch(/^event_/)
    expect(mockRedisClient.lpush).toHaveBeenCalledWith(
      'analytics:events:queue',
      expect.stringContaining('"userId":"test-user"'),
    )
    expect(mockRedisClient.zadd).toHaveBeenCalledWith(
      'analytics:events:time:user_action',
      expect.any(Number),
      expect.stringContaining('"type":"user_action"'),
    )
  })

  it('notifies only the subscribed user when tracking an event', async () => {
    const userSocket = new MockWebSocket('ws://user')
    const otherSocket = new MockWebSocket('ws://other')

    analyticsService.registerClient('test-user', userSocket as never)
    analyticsService.registerClient('other-user', otherSocket as never)

    await analyticsService.trackEvent(mockEvent)

    expect(userSocket.sent).toHaveLength(1)
    expect(userSocket.sent[0]).toContain('"userId":"test-user"')
    expect(otherSocket.sent).toHaveLength(0)
  })

  it('tracks a metric and stores tag metadata', async () => {
    await analyticsService.trackMetric(mockMetric)

    expect(mockRedisClient.zadd).toHaveBeenCalledWith(
      'analytics:metrics:response_time',
      mockMetric.timestamp,
      expect.stringContaining('"name":"response_time"'),
    )
    expect(mockRedisClient.hset).toHaveBeenCalledWith(
      'analytics:metrics:tags:response_time',
      mockMetric.timestamp.toString(),
      expect.stringContaining('"endpoint":"/api/therapy"'),
    )
  })

  it('processes queued events into the processed hash', async () => {
    const queuedEvent = JSON.stringify({
      ...mockEvent,
      id: 'event-1',
    })
    mockRedisClient.lRange.mockResolvedValueOnce([queuedEvent])

    await analyticsService.processEvents()

    expect(mockRedisClient.hset).toHaveBeenCalledWith(
      'analytics:events:processed:user_action',
      'event-1',
      expect.stringContaining('"processedAt"'),
    )
    expect(mockRedisClient.lrem).toHaveBeenCalledWith(
      'analytics:events:queue',
      1,
      queuedEvent,
    )
  })

  it('returns events by type and metrics by name from Redis time series', async () => {
    const storedEvent = JSON.stringify({
      ...mockEvent,
      id: 'event-2',
    })
    const storedMetric = JSON.stringify(mockMetric)

    mockRedisClient.zrangebyscore
      .mockResolvedValueOnce([storedEvent])
      .mockResolvedValueOnce([storedMetric])

    const events = await analyticsService.getEvents({
      type: EventType.USER_ACTION,
      startTime: 0,
      endTime: Date.now(),
    })

    const metrics = await analyticsService.getMetrics({
      name: 'response_time',
      startTime: 0,
      endTime: Date.now(),
      tags: {
        endpoint: '/api/therapy',
      },
    })

    expect(events).toHaveLength(1)
    expect(events[0]?.id).toBe('event-2')
    expect(metrics).toHaveLength(1)
    expect(metrics[0]?.tags?.endpoint).toBe('/api/therapy')
  })

  it('unregisters websocket clients on close', () => {
    const socket = new MockWebSocket('ws://close-test')
    analyticsService.registerClient('closable-user', socket as never)

    socket.emit('close')

    expect(() =>
      analyticsService.registerClient('closable-user', socket as never),
    ).not.toThrow()
  })
})
