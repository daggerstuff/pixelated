import { z } from 'zod'

// Event type definitions
export enum EventType {
  PAGE_VIEW = 'page_view',
  USER_ACTION = 'user_action',
  THERAPY_SESSION = 'therapy_session',
  NOTIFICATION = 'notification',
  ERROR = 'error',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  CUSTOM = 'custom',
}

export enum EventPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Schema definitions
export const EventDataSchema = z.object({
  type: z.enum([
    EventType.PAGE_VIEW,
    EventType.USER_ACTION,
    EventType.THERAPY_SESSION,
    EventType.NOTIFICATION,
    EventType.ERROR,
    EventType.SECURITY,
    EventType.PERFORMANCE,
    EventType.CUSTOM,
  ]),
  priority: z.enum([
    EventPriority.LOW,
    EventPriority.NORMAL,
    EventPriority.HIGH,
    EventPriority.CRITICAL,
  ]).default(EventPriority.NORMAL),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.number().default(() => Date.now()),
  properties: z.any().default({}),
  metadata: z.any().default({}),
})

export type EventData = z.infer<typeof EventDataSchema>

export const EventSchema = EventDataSchema.extend({
  id: z.string(),
  processedAt: z.number().optional(),
  error: z.string().optional(),
})

export type Event = z.infer<typeof EventSchema>

export const MetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  timestamp: z.number().default(() => Date.now()),
  tags: z.any().default({}),
})

export type Metric = z.infer<typeof MetricSchema>

export interface RedisClient {
  [x: string]: any
  lrange(key: string, start: number, stop: number): Promise<string[]>
  zrangebyscore(
    key: string,
    min: string | number,
    max: string | number,
    limitKeyword?: string,
    offset?: number,
    limit?: number,
  ): Promise<string[]>
  lpush(key: string, ...values: string[]): Promise<number>
  lrem(key: string, count: number, value: string): Promise<number>
  zadd(key: string, score: number, member: string): Promise<number>
  zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<number>
  hset(key: string, field: string, value: string): Promise<number>
  keys(pattern: string): Promise<string[]>
}

// Analytics service options
export interface AnalyticsServiceOptions {
  retentionDays?: number
  batchSize?: number
  processingInterval?: number
}

// Event query options
export interface EventQueryOptions {
  type: EventType
  startTime?: number
  endTime?: number
  limit?: number
  offset?: number
}

// Metric query options
export interface MetricQueryOptions {
  name: string
  startTime?: number
  endTime?: number
  tags?: Record<string, string>
}

// WebSocket message types
export interface AnalyticsWebSocketMessage {
  type: 'analytics_event'
  event: Event
}

// Type guards
export function isEvent(value: unknown): value is Event {
  try {
    EventSchema.parse(value)
    return true
  } catch {
    return false
  }
}

export function isMetric(value: unknown): value is Metric {
  try {
    MetricSchema.parse(value)
    return true
  } catch {
    return false
  }
}

export function isValidEventJson(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as unknown
    return isEvent(parsed)
  } catch {
    return false
  }
}

export function isValidMetricJson(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as unknown
    return isMetric(parsed)
  } catch {
    return false
  }
}

// Error types
export class AnalyticsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AnalyticsError'
  }
}

export class ValidationError extends AnalyticsError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class ProcessingError extends AnalyticsError {
  constructor(message: string, details?: unknown) {
    super(message, 'PROCESSING_ERROR', details)
    this.name = 'ProcessingError'
  }
}
