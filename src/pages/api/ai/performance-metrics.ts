import type { APIRoute } from 'astro'
import { getSession } from '../../../lib/auth/session'
import mongodb from '../../../config/mongodb.config'

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Require authentication and admin role
    const session = await getSession(request)
    if (session?.user?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    const { user } = session

    // Get query parameters
    const searchParams = new URL(request.url).searchParams
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

    const query: any = {
      timestamp: { $gte: startTime, $lte: now },
    }

    if (modelType !== 'all') {
      query.model_type = modelType
    }

    const results = await metricsCollection.find(query).toArray()

    // Process and format the results
    const metrics =
      results?.map(
        (row: {
          _id: string
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
        }) => ({
          date: row.timestamp,
          model: row.model_type,
          requestCount: Number(row.request_count),
          latency: {
            avg: Number(row.avg_latency),
            max: Number(row.max_latency),
            min: Number(row.min_latency),
          },
          tokens: {
            input: Number(row.total_input_tokens),
            output: Number(row.total_output_tokens),
            total: Number(row.total_tokens),
          },
          successRate: Number(row.success_count) / Number(row.request_count),
          cacheHitRate: Number(row.cached_count) / Number(row.request_count),
          optimizationRate:
            Number(row.optimized_count) / Number(row.request_count),
        }),
      ) ?? []

    // Get model breakdown
    const modelBreakdown = results.reduce((acc: any, row: any) => {
      const {
        model_type,
        request_count,
        success_count,
        cached_count,
        optimized_count,
        total_tokens,
      } = row

      const existingModel = acc.find((item: any) => item.model === model_type)

      if (existingModel) {
        existingModel.requestCount += request_count
        existingModel.totalTokens += total_tokens
        existingModel.successCount += success_count
        existingModel.cachedCount += cached_count
        existingModel.optimizedCount += optimized_count
      } else {
        acc.push({
          model: model_type,
          requestCount: request_count,
          totalTokens: total_tokens,
          successCount: success_count,
          cachedCount: cached_count,
          optimizedCount: optimized_count,
        })
      }

      return acc
    }, [])

    // Get error breakdown
    const errorBreakdown = results.reduce((acc: any, row: any) => {
      const { error_code } = row

      const existingError = acc.find(
        (item: any) => item.errorCode === error_code,
      )

      if (existingError) {
        existingError.count += 1
      } else {
        acc.push({
          errorCode: error_code,
          count: 1,
        })
      }

      return acc
    }, [])

    // Return the metrics
    return new Response(
      JSON.stringify({
        metrics,
        modelBreakdown:
          modelBreakdown?.map(
            (row: {
              model: string
              request_count: number
              total_tokens: number
              success_count: number
              cached_count: number
              optimized_count: number
            }) => ({
              model: row.model,
              requestCount: Number(row.request_count),
              totalTokens: Number(row.total_tokens),
              successRate:
                Number(row.success_count) / Number(row.request_count),
              cacheHitRate:
                Number(row.cached_count) / Number(row.request_count),
              optimizationRate:
                Number(row.optimized_count) / Number(row.request_count),
            }),
          ) ?? [],
        errorBreakdown:
          errorBreakdown?.map((row: { errorCode: string; count: number }) => ({
            errorCode: row.errorCode,
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
  } catch (error) {
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
