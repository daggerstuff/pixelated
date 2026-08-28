/**
 * AI Usage Analytics
 *
 * Tracks token usage, latency, and model calls per session.
 * Provides aggregated statistics for dashboard display.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('ai-analytics')

/** A single recorded AI model invocation. */
export interface AIUsageEvent {
  /** Model identifier (e.g. "gpt-4", "claude-3-opus"). */
  model: string
  /** Session ID the call belongs to. */
  sessionId: string
  /** Input tokens consumed. */
  tokensIn: number
  /** Output tokens produced. */
  tokensOut: number
  /** Round-trip latency in milliseconds. */
  latencyMs: number
  /** Whether the call succeeded. */
  success: boolean
  /** Timestamp of the call. */
  timestamp: Date
  /** Optional user ID for per-user filtering. */
  userId?: string
  /** Optional error message on failure. */
  error?: string
}

/** Per-model usage breakdown. */
interface ModelUsageStats {
  model: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalTokensIn: number
  totalTokensOut: number
  averageResponseTime: number
}

/** Aggregated AI usage statistics for dashboard display. */
export interface AIUsageStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  totalTokensIn: number
  totalTokensOut: number
  totalTokens: number
  uniqueSessions: number
  uniqueModels: number
  successRate: number
  errorRate: number
  period: string
  modelBreakdown: ModelUsageStats[]
}

/** Options for filtering usage statistics. */
export interface AIUsageStatsOptions {
  period?: string
  userId?: string
  sessionId?: string
  model?: string
  startDate?: Date
  endDate?: Date
}

// ---------------------------------------------------------------------------
// In-memory event store
// ---------------------------------------------------------------------------

const eventStore: AIUsageEvent[] = []

/**
 * Record an AI model invocation for analytics tracking.
 * Call this after every model call (success or failure).
 */
export function recordAIUsage(event: Omit<AIUsageEvent, 'timestamp'> & { timestamp?: Date }): void {
  const fullEvent: AIUsageEvent = {
    ...event,
    timestamp: event.timestamp ?? new Date(),
  }
  eventStore.push(fullEvent)
  logger.debug('recordAIUsage', {
    model: fullEvent.model,
    sessionId: fullEvent.sessionId,
    tokensIn: fullEvent.tokensIn,
    tokensOut: fullEvent.tokensOut,
    success: fullEvent.success,
  })
}

/**
 * Clear all recorded AI usage events.
 * Primarily for testing and dashboard reset.
 */
export function clearAIUsageEvents(): void {
  eventStore.length = 0
  logger.debug('clearAIUsageEvents', 'Event store cleared')
}

/** Get the raw list of recorded events (read-only view). */
export function getAIUsageEvents(): readonly AIUsageEvent[] {
  return [...eventStore]
}

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

function filterEvents(events: AIUsageEvent[], options: AIUsageStatsOptions): AIUsageEvent[] {
  return events.filter((event) => {
    if (options.userId !== undefined && event.userId !== options.userId) return false
    if (options.sessionId !== undefined && event.sessionId !== options.sessionId) return false
    if (options.model !== undefined && event.model !== options.model) return false
    if (options.startDate !== undefined && event.timestamp < options.startDate) return false
    if (options.endDate !== undefined && event.timestamp > options.endDate) return false
    return true
  })
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function computeModelBreakdown(events: AIUsageEvent[]): ModelUsageStats[] {
  const modelMap = new Map<string, AIUsageEvent[]>()

  for (const event of events) {
    const bucket = modelMap.get(event.model)
    if (bucket) {
      bucket.push(event)
    } else {
      modelMap.set(event.model, [event])
    }
  }

  const breakdown: ModelUsageStats[] = []

  for (const [model, modelEvents] of modelMap) {
    const total = modelEvents.length
    const successful = modelEvents.filter((e) => e.success).length
    const failed = total - successful
    const totalTokensIn = modelEvents.reduce((sum, e) => sum + e.tokensIn, 0)
    const totalTokensOut = modelEvents.reduce((sum, e) => sum + e.tokensOut, 0)
    const avgResponseTime =
      total > 0 ? modelEvents.reduce((sum, e) => sum + e.latencyMs, 0) / total : 0

    breakdown.push({
      model,
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: failed,
      totalTokensIn,
      totalTokensOut,
      averageResponseTime: Math.round(avgResponseTime),
    })
  }

  // Sort by total requests descending for consistent dashboard display
  breakdown.sort((a, b) => b.totalRequests - a.totalRequests)

  return breakdown
}

/**
 * Get aggregated AI usage statistics.
 *
 * Supports filtering by period, userId, sessionId, model, and date range.
 * Returns zeroed stats when no events match the filter.
 */
export async function getAIUsageStats(
  options: AIUsageStatsOptions = {},
): Promise<AIUsageStats> {
  const period = options.period ?? 'day'
  const filtered = filterEvents(eventStore, options)

  // Empty state — return zeros so the dashboard always has a valid shape
  if (filtered.length === 0) {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalTokens: 0,
      uniqueSessions: 0,
      uniqueModels: 0,
      successRate: 0,
      errorRate: 0,
      period,
      modelBreakdown: [],
    }
  }

  const totalRequests = filtered.length
  const successfulRequests = filtered.filter((e) => e.success).length
  const failedRequests = totalRequests - successfulRequests
  const totalTokensIn = filtered.reduce((sum, e) => sum + e.tokensIn, 0)
  const totalTokensOut = filtered.reduce((sum, e) => sum + e.tokensOut, 0)
  const averageResponseTime = Math.round(
    filtered.reduce((sum, e) => sum + e.latencyMs, 0) / totalRequests,
  )

  const uniqueSessions = new Set(filtered.map((e) => e.sessionId)).size
  const uniqueModels = new Set(filtered.map((e) => e.model)).size
  const successRate = Math.round((successfulRequests / totalRequests) * 1000) / 10 // 1 decimal
  const errorRate = Math.round((failedRequests / totalRequests) * 1000) / 10

  const modelBreakdown = computeModelBreakdown(filtered)

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    averageResponseTime,
    totalTokensIn,
    totalTokensOut,
    totalTokens: totalTokensIn + totalTokensOut,
    uniqueSessions,
    uniqueModels,
    successRate,
    errorRate,
    period,
    modelBreakdown,
  }
}
