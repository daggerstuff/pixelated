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
  type: z.nativeEnum(EventType),
  priority: z.nativeEnum(EventPriority).default(EventPriority.NORMAL),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.number().default(() => Date.now()),
  properties: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
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
  tags: z.record(z.string()).default({}),
})

export type Metric = z.infer<typeof MetricSchema>

// Redis client interface
export interface RedisClient {
  [x: string]: unknown
  lRange(arg0: string, arg1: number, arg2: number): unknown
  zrangebyscore(
    arg0: string,
    start: string | number,
    end: string | number,
    arg3: string,
    offset: number,
    limit: number,
  ): string[] | PromiseLike<string[]>
  lpush(key: string, value: string): Promise<void>
  lrange(key: string, start: number, stop: number): Promise<string[]>
  lrem(key: string, count: number, value: string): Promise<void>
  zadd(key: string, score: number, member: string): Promise<void>
  zremrangebyscore(key: string, min: number, max: number): Promise<void>
  hset(key: string, field: string, value: string): Promise<void>
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
