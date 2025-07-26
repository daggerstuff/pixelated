import type { APIRoute } from 'astro'
import { createAuditLog } from '../../../lib/audit'
import { getSession } from '../../../lib/auth/session'
import { supabase } from '../../../lib/db/supabase'

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
    const period = url.searchParams.get('period') || 'weekly'
    const startDate = url.searchParams.get('startDate')
      ? new Date(url.searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Default to last 30 days
    const endDate = url.searchParams.get('endDate')
      ? new Date(url.searchParams.get('endDate')!)
      : new Date()
    const model = url.searchParams.get('model') || undefined
    const limit = Number.parseInt(url.searchParams.get('limit') || '100', 10)

    // Log the analytics request
    await createAuditLog({
      userId: user.id,
      action: 'ai.performance.metrics.request',
      resource: 'ai',
      metadata: {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        model,
        limit,
      },
    })

    // Build the query
    const { data: results, error } = await supabase
      .rpc('get_ai_metrics', {
        p_period: period,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_model: model,
        p_limit: limit,
      })
      .then((response) => response.data)

    if (error) {
      throw error
    }

    // Process and format the results
    const metrics =
      results?.map(
        (row: {
          date_trunc: string
          model: string
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
          date: row.date_trunc,
          model: row.model,
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
    const { data: modelBreakdown, error: modelBreakdownError } = await supabase
      .rpc('get_ai_model_breakdown', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      })
      .then((response) => response.data)

    if (modelBreakdownError) {
      throw modelBreakdownError
    }

    // Get error breakdown
    const { data: errorBreakdown, error: errorBreakdownError } = await supabase
      .rpc('get_ai_error_breakdown', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      })
      .then((response) => response.data)

    if (errorBreakdownError) {
      throw errorBreakdownError
    }

    if (errorBreakdownError) {
      throw errorBreakdownError
    }

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
          errorBreakdown?.map(
            (row: { error_code: string; error_count: number }) => ({
              errorCode: row.error_code,
              count: Number(row.error_count),
            }),
          ) ?? [],
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
