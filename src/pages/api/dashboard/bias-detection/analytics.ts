import { initializeDatabase, query } from '@/lib/db'
import { getCache } from '@/lib/cache/redis-cache'
import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ url }) => {
  try {
    // Initialize database connection if not already done
    initializeDatabase()

    const { searchParams } = url
    const days = parseInt(searchParams.get('days') || '30')
    const cache = getCache()

    // Try to get cached analytics data first
    let cachedData = await cache.getAnalyticsData('comprehensive', days)

    if (cachedData) {
      console.log('✅ Analytics data served from cache')
      return new Response(
        JSON.stringify({
          ...cachedData,
          cached: true,
          cacheTimestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    console.log('🔄 Computing fresh analytics data...')

    // Get historical data for the specified number of days
    const historicalQuery = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as session_count,
        AVG(overall_bias_score) as avg_bias_score,
        COUNT(CASE WHEN alert_level IN ('high', 'critical') THEN 1 END) as alert_count,
        MIN(overall_bias_score) as min_bias,
        MAX(overall_bias_score) as max_bias
      FROM bias_analyses
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `

    const historicalResult = await query(historicalQuery)

    // Get demographic breakdown
    const demographicQuery = `
      SELECT
        demographics->>'gender' as gender,
        demographics->>'ethnicity' as ethnicity,
        demographics->>'age' as age_group,
        COUNT(*) as count,
        AVG(overall_bias_score) as avg_bias
      FROM bias_analyses
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY demographics->>'gender', demographics->>'ethnicity', demographics->>'age'
      ORDER BY count DESC
    `

    const demographicResult = await query(demographicQuery)

    // Get bias distribution by score ranges
    const distributionQuery = `
      SELECT
        CASE
          WHEN overall_bias_score < 0.2 THEN 'Very Low (0-20%)'
          WHEN overall_bias_score < 0.4 THEN 'Low (20-40%)'
          WHEN overall_bias_score < 0.6 THEN 'Medium (40-60%)'
          WHEN overall_bias_score < 0.8 THEN 'High (60-80%)'
          ELSE 'Critical (80-100%)'
        END as bias_range,
        COUNT(*) as count
      FROM bias_analyses
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY
        CASE
          WHEN overall_bias_score < 0.2 THEN 'Very Low (0-20%)'
          WHEN overall_bias_score < 0.4 THEN 'Low (20-40%)'
          WHEN overall_bias_score < 0.6 THEN 'Medium (40-60%)'
          WHEN overall_bias_score < 0.8 THEN 'High (60-80%)'
          ELSE 'Critical (80-100%)'
        END
      ORDER BY count DESC
    `

    const distributionResult = await query(distributionQuery)

    // Get top bias patterns
    const patternsQuery = `
      SELECT
        layer_results->'preprocessing'->>'layer' as layer,
        AVG((layer_results->'preprocessing'->>'bias_score')::float) as avg_score,
        COUNT(*) as occurrences
      FROM bias_analyses
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND (layer_results->'preprocessing'->>'bias_score')::float > 0.3
      GROUP BY layer_results->'preprocessing'->>'layer'
      ORDER BY avg_score DESC
      LIMIT 5
    `

    const patternsResult = await query(patternsQuery)

    // Cache the computed data
    const computedData = {
      historical: historicalResult.rows.map((row) => ({
        date: row.date,
        biasScore: parseFloat(row.avg_bias_score || '0'),
        sessionCount: parseInt(row.session_count || '0'),
        alertCount: parseInt(row.alert_count || '0'),
        minBias: parseFloat(row.min_bias || '0'),
        maxBias: parseFloat(row.max_bias || '0'),
      })),
      demographics: demographicResult.rows.map((row) => ({
        gender: row.gender || 'Unknown',
        ethnicity: row.ethnicity || 'Unknown',
        ageGroup: row.age_group || 'Unknown',
        count: parseInt(row.count || '0'),
        avgBias: parseFloat(row.avg_bias || '0'),
      })),
      distribution: distributionResult.rows.map((row) => ({
        range: row.bias_range,
        count: parseInt(row.count || '0'),
      })),
      patterns: patternsResult.rows.map((row) => ({
        layer: row.layer || 'Unknown',
        avgScore: parseFloat(row.avg_score || '0'),
        occurrences: parseInt(row.occurrences || '0'),
      })),
      metadata: {
        days,
        totalRecords: historicalResult.rows.length,
        dateRange: {
          start: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          end: new Date().toISOString().split('T')[0],
        },
        generatedAt: new Date().toISOString(),
      },
    }

    // Cache the data for 15 minutes
    await cache.setAnalyticsData('comprehensive', days, computedData)
    console.log('💾 Analytics data cached for 15 minutes')

    // Format response
    const response = {
      historical: historicalResult.rows.map((row) => ({
        date: row.date,
        biasScore: parseFloat(row.avg_bias_score || '0'),
        sessionCount: parseInt(row.session_count || '0'),
        alertCount: parseInt(row.alert_count || '0'),
        minBias: parseFloat(row.min_bias || '0'),
        maxBias: parseFloat(row.max_bias || '0'),
      })),
      demographics: demographicResult.rows.map((row) => ({
        gender: row.gender || 'Unknown',
        ethnicity: row.ethnicity || 'Unknown',
        ageGroup: row.age_group || 'Unknown',
        count: parseInt(row.count || '0'),
        avgBias: parseFloat(row.avg_bias || '0'),
      })),
      distribution: distributionResult.rows.map((row) => ({
        range: row.bias_range,
        count: parseInt(row.count || '0'),
      })),
      patterns: patternsResult.rows.map((row) => ({
        layer: row.layer || 'Unknown',
        avgScore: parseFloat(row.avg_score || '0'),
        occurrences: parseInt(row.occurrences || '0'),
      })),
      metadata: {
        days,
        totalRecords: historicalResult.rows.length,
        dateRange: {
          start: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          end: new Date().toISOString().split('T')[0],
        },
        generatedAt: new Date().toISOString(),
      },
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Analytics API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch analytics data',
        details:
          process.env['NODE_ENV'] === 'development' ? error.message : undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
