import type { APIRoute, APIContext } from 'astro'
/**
 * AI Performance Metrics API Endpoint
 *
 * Provides AI model performance metrics including request volumes,
 * response times, token usage, success rates, and model comparisons.
 * Supports time range and model filtering.
 */

export const prerender = false

import { z } from 'zod'

// Schema for validating query parameters
const performanceQuerySchema = z.object({
  timeRange: z.enum(['24h', '7d', '30d', '90d']).optional().default('7d'),
  model: z.string().optional(),
})

type PerformanceQuery = z.infer<typeof performanceQuerySchema>

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PerformanceSummary {
  totalRequests: number
  averageResponseTime: number
  totalTokens: number
  successRate: number
  period: string
}

interface TimeSeriesPoint {
  timestamp: string
  requests: number
  responseTime: number
  tokens: number
  successRate: number
}

interface ModelComparison {
  model: string
  avgResponseTime: number
  tokensPerRequest: number
  successRate: number
  totalRequests: number
}

interface PerformanceMetricsResponse {
  timestamp: number
  timeRange: string
  model: string | null
  summary: PerformanceSummary
  timeSeries: TimeSeriesPoint[]
  modelComparison: ModelComparison[]
  meta: {
    requestDuration: number
  }
}

// ---------------------------------------------------------------------------
// Mock data generators
// ---------------------------------------------------------------------------

const MODEL_NAMES = ['Mixtral-8x7B', 'Llama-3-70B', 'Qwen-1.5-72B'] as const

const MODEL_BASELINE: Record<
  string,
  {
    responseTime: number
    tokens: number
    successRate: number
    requests: number
  }
> = {
  'Mixtral-8x7B': {
    responseTime: 285,
    tokens: 1245,
    successRate: 99.8,
    requests: 980,
  },
  'Llama-3-70B': {
    responseTime: 312,
    tokens: 1312,
    successRate: 99.7,
    requests: 1050,
  },
  'Qwen-1.5-72B': {
    responseTime: 325,
    tokens: 1185,
    successRate: 99.5,
    requests: 517,
  },
}

/**
 * Deterministic pseudo-random generator seeded by a string.
 * Returns a function that produces values in [0, 1).
 */
function seededRandom(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generates time-series data points for the requested range.
 * Uses deterministic seeded random for stable per-range output.
 */
function generateTimeSeries(
  timeRange: string,
  modelFilter: string | undefined,
): TimeSeriesPoint[] {
  const rangeConfig: Record<string, { points: number; intervalMs: number }> = {
    '24h': { points: 24, intervalMs: 3_600_000 }, // hourly
    '7d': { points: 28, intervalMs: 21_600_000 }, // 6-hourly
    '30d': { points: 30, intervalMs: 86_400_000 }, // daily
    '90d': { points: 30, intervalMs: 259_200_000 }, // 3-day
  }

  const config = rangeConfig[timeRange] ?? rangeConfig['7d']
  const now = Date.now()
  const rng = seededRandom(`${timeRange}:${modelFilter ?? 'all'}`)

  const points: TimeSeriesPoint[] = []
  for (let i = config.points - 1; i >= 0; i--) {
    const ts = now - i * config.intervalMs
    const baseRequests = modelFilter ? 120 : 360
    const requests = Math.round(baseRequests + rng() * 80 - 40)
    const responseTime = Math.round(300 + rng() * 60 - 30)
    const tokens = Math.round(1200 + rng() * 200 - 100)
    const successRate = Math.round((99.2 + rng() * 0.7) * 10) / 10

    points.push({
      timestamp: new Date(ts).toISOString(),
      requests,
      responseTime,
      tokens,
      successRate,
    })
  }
  return points
}

/**
 * Generates model comparison data, optionally filtered by model name.
 */
function generateModelComparison(
  modelFilter: string | undefined,
): ModelComparison[] {
  const all = MODEL_NAMES.map((name) => {
    const base = MODEL_BASELINE[name]
    return {
      model: name,
      avgResponseTime: base.responseTime,
      tokensPerRequest: base.tokens,
      successRate: base.successRate,
      totalRequests: base.requests,
    }
  })

  if (modelFilter) {
    return all.filter((m) => m.model === modelFilter)
  }
  return all
}

/**
 * Aggregates summary metrics from time series and model comparison data.
 */
function buildSummary(
  timeSeries: TimeSeriesPoint[],
  modelComparison: ModelComparison[],
  timeRange: string,
): PerformanceSummary {
  const totalRequests = timeSeries.reduce((sum, p) => sum + p.requests, 0)
  const avgResponseTime = Math.round(
    timeSeries.reduce((sum, p) => sum + p.responseTime, 0) / timeSeries.length,
  )
  const totalTokens = timeSeries.reduce(
    (sum, p) => sum + p.tokens * p.requests,
    0,
  )
  const avgSuccessRate =
    Math.round(
      (timeSeries.reduce((sum, p) => sum + p.successRate, 0) /
        timeSeries.length) *
        10,
    ) / 10

  // If filtered to a single model, use its success rate for more precision
  if (modelComparison.length === 1) {
    return {
      totalRequests,
      averageResponseTime: modelComparison[0].avgResponseTime,
      totalTokens,
      successRate: modelComparison[0].successRate,
      period: timeRange,
    }
  }

  return {
    totalRequests,
    averageResponseTime: avgResponseTime,
    totalTokens,
    successRate: avgSuccessRate,
    period: timeRange,
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const GET: APIRoute = async ({ url }: APIContext) => {
  const startTime = Date.now()

  try {
    const queryParams = Object.fromEntries(url.searchParams.entries())

    const queryResult = performanceQuerySchema.safeParse(queryParams)
    if (!queryResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const query: PerformanceQuery = queryResult.data

    // Validate model filter against known models if provided
    if (
      query.model &&
      !MODEL_NAMES.includes(query.model as (typeof MODEL_NAMES)[number])
    ) {
      return new Response(
        JSON.stringify({
          error: 'Invalid model filter',
          validModels: MODEL_NAMES,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const timeSeries = generateTimeSeries(query.timeRange, query.model)
    const modelComparison = generateModelComparison(query.model)
    const summary = buildSummary(timeSeries, modelComparison, query.timeRange)

    const response: PerformanceMetricsResponse = {
      timestamp: Date.now(),
      timeRange: query.timeRange,
      model: query.model ?? null,
      summary,
      timeSeries,
      modelComparison,
      meta: {
        requestDuration: Date.now() - startTime,
      },
    }

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error: unknown) {
    console.error('AI performance metrics endpoint error:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? String(error) : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
