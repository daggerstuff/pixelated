export const prerender = false

import type { APIRoute } from 'astro'
import type { APIContext } from 'astro'
import { createClient } from '@supabase/supabase-js'
import { getRedisHealth } from '../../lib/redis'

interface HealthStatusDetail {
  status: 'healthy' | 'unhealthy' | 'unknown' | 'degraded'
  timestamp?: string
  message?: string
  error?: string
  responseTimeMs?: number
}

interface OverallHealthStatus {
  status: 'healthy' | 'unhealthy'
  api: HealthStatusDetail
  supabase?: HealthStatusDetail
  redis?: HealthStatusDetail
}

/**
 * Health check API endpoint
 *
 * This endpoint checks and reports the health of system components:
 * 1. API service itself
 * 2. Supabase connection (if credentials available)
 * 3. Redis connection (if credentials available)
 */
export const GET: APIRoute = async ({ request }: APIContext) => {
  const startTime = performance.now()
  const healthStatus: OverallHealthStatus = {
    status: 'healthy',
    api: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  }

  // Get request info for debugging
  const url = new URL(request.url)
  const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'

  console.info('Health check requested', {
    path: url.pathname,
    clientIp,
    userAgent,
  })

  // If no Supabase credentials, return partial health status
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      'Health check: Missing Supabase credentials, skipping database check',
    )
    healthStatus.supabase = {
      status: 'unknown',
      message: 'No credentials available',
    }
  } else {
    try {
      // Check Supabase connection
      healthStatus.supabase = await checkSupabaseConnection(
        supabaseUrl,
        supabaseAnonKey,
      )
    } catch (error) {
      console.error('Error during Supabase health check:', error)
      healthStatus.supabase = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      }
      // If a critical component fails, the overall status is unhealthy
      healthStatus.status = 'unhealthy'
    }
  }

  // Check Redis connection
  try {
    healthStatus.redis = await getRedisHealth()
    if (healthStatus.redis && healthStatus.redis.status === 'unhealthy') {
      healthStatus.status = 'unhealthy'
    }
  } catch (error) {
    console.error('Error during Redis health check:', error)
    healthStatus.redis = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
    }
    healthStatus.status = 'unhealthy'
  }

  // Calculate response time
  const endTime = performance.now()
  healthStatus.api.responseTimeMs = Math.round(endTime - startTime)

  // Return the health status
  return new Response(JSON.stringify(healthStatus, null, 2), {
    status: healthStatus.status === 'healthy' ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

/**
 * Check Supabase connection
 */
async function checkSupabaseConnection(
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<HealthStatusDetail> {
  // Create Supabase client if credentials are available
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Check connection by querying health table
  try {
    const { error } = await supabase
      .from('_health')
      .select('status')
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(`Supabase connection check failed: ${error.message}`)
    }

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Supabase health check failed:', error)
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }
  }
}
