/**
 * AI Usage Analytics
 */

import { aiRepository } from '../db/ai/repository'

export interface AIUsageStatsOptions {
  period?: string
  userId?: string
  startDate?: Date
  endDate?: Date
}

export interface AIUsageStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  period: string
}

/**
 * Resolve the [start, end) window for a stats query.
 *
 * Explicit `startDate`/`endDate` always win. Otherwise the named `period`
 * anchors to a whole day/week/month ending at `end` (defaults to now):
 * 'daily'/'day' = 24h, 'weekly'/'week' = 7 days, 'monthly'/'month' = 30 days,
 * anything else (or undefined) = 24h.
 */
function resolvePeriodWindow(
  period: string | undefined,
  startDate: Date | undefined,
  endDate: Date | undefined,
): { since: Date; until: Date } {
  if (startDate || endDate) {
    const end = endDate ?? new Date()
    return { since: startDate ?? end, until: end }
  }
  const end = new Date()
  const normalized = period?.toLowerCase() ?? 'daily'
  let days: number
  if (normalized === 'weekly' || normalized === 'week') {
    days = 7
  } else if (normalized === 'monthly' || normalized === 'month') {
    days = 30
  } else {
    days = 1
  }
  const since = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  return { since, until: end }
}

/**
 * Get AI usage statistics by aggregating stored AI response generation
 * results (one row per AI request recorded by the response routes).
 */
export async function getAIUsageStats(
  options: AIUsageStatsOptions = {},
): Promise<AIUsageStats> {
  const period = options.period ?? 'day'
  const window = resolvePeriodWindow(options.period, options.startDate, options.endDate)
  const stats = await aiRepository.getUsageStats({
    userId: options.userId,
    since: window.since,
    until: window.until,
  })

  return {
    ...stats,
    period,
  }
}
