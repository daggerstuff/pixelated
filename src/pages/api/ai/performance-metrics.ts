import type { APIContext } from 'astro'

import mongodb from '../../../config/mongodb.config'
import { getSession } from '../../../lib/auth/session'
import type { Session } from '../../../lib/auth/session'

export const GET = async ({ request }: APIContext) => {
  try {
    // Require authentication and admin role
    const session: Session | null = await getSession(request)
    if (session?.user?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    // const { user } = session

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '24h'
    const modelType = searchParams.get('modelType') || 'all'

    // Calculate time bounds
    const now = new Date()
    let startTime: Date
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    const db = await mongodb.connect()

    // Query AI performance metrics from MongoDB
    const metricsCollection = db.collection('ai_performance_metrics')

    type RawMetric = {
      _id?: string
      timestamp: Date
      model_type: string
      request_count: number
      success_count: number
      cached_count: number
      optimized_count: number
      total_input_tokens: number
      total_output_tokens: number
      total_tokens: number
      avg_latency: number
      max_latency: number
      min_latency: number
      error_code?: string
    }

    const query: Partial<Record<string, unknown>> = {
      timestamp: { $gte: startTime, $lte: now },
    }

    if (modelType !== 'all') {
      ;(query['model_type'] as string | undefined) = modelType
    }

    // Optimize fetching and processing using aggregation to avoid in-memory reductions on large datasets.
    const [aggregateResult] = await metricsCollection.aggregate([
      { $match: query },
      {
        $facet: {
          metrics: [
            {
              $project: {
                _id: 0,
                date: "$timestamp",
                model: "$model_type",
                requestCount: "$request_count",
                latency: {
                  avg: "$avg_latency",
                  max: "$max_latency",
                  min: "$min_latency",
                },
                tokens: {
                  input: "$total_input_tokens",
                  output: "$total_output_tokens",
                  total: "$total_tokens",
                },
                successRate: { $cond: [ { $gt: ["$request_count", 0] }, { $divide: ["$success_count", "$request_count"] }, 0 ] },
                cacheHitRate: { $cond: [ { $gt: ["$request_count", 0] }, { $divide: ["$cached_count", "$request_count"] }, 0 ] },
                optimizationRate: { $cond: [ { $gt: ["$request_count", 0] }, { $divide: ["$optimized_count", "$request_count"] }, 0 ] },
              },
            },
          ],
          modelBreakdown: [
            {
              $group: {
                _id: "$model_type",
                requestCount: { $sum: "$request_count" },
                totalTokens: { $sum: "$total_tokens" },
                successCount: { $sum: "$success_count" },
                cachedCount: { $sum: "$cached_count" },
                optimizedCount: { $sum: "$optimized_count" },
              },
            },
          ],
          errorBreakdown: [
            {
              $group: {
                _id: { $ifNull: ["$error_code", "unknown"] },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]).toArray() as unknown as [{
       metrics: any[],
       modelBreakdown: { _id: string, requestCount: number, totalTokens: number, successCount: number, cachedCount: number, optimizedCount: number }[],
       errorBreakdown: { _id: string, count: number }[]
    }]

    const { metrics = [], modelBreakdown = [], errorBreakdown = [] } = aggregateResult || {}

    // Return the metrics
    return new Response(
      JSON.stringify({
        metrics,
        modelBreakdown:
          modelBreakdown?.map((row) => {
            const requestCount = Number(row.requestCount);
            return {
              model: row._id,
              requestCount: requestCount,
              totalTokens: Number(row.totalTokens),
              successRate: requestCount > 0 ? Number(row.successCount) / requestCount : 0,
              cacheHitRate: requestCount > 0 ? Number(row.cachedCount) / requestCount : 0,
              optimizationRate: requestCount > 0 ? Number(row.optimizedCount) / requestCount : 0,
            };
          }) ?? [],
        errorBreakdown:
          errorBreakdown?.map((row) => ({
            errorCode: row._id,
            count: Number(row.count),
          })) ?? [],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    console.error('Error fetching AI performance metrics:', error)

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch AI performance metrics',
        details: error instanceof Error ? error?.message : String(error),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
