export const prerender = false
import type { APIRoute } from 'astro'
import * as os from 'node:os'
import { createClient } from '@supabase/supabase-js'
import { getRedisHealth } from '../../../lib/redis'

/**
 * V1 Health check API endpoint
 *
 * This endpoint checks and reports the health of system components:
 * 1. API service itself
 * 2. Supabase connection (if credentials available)
 * 3. Redis connection (if credentials available)
 * 4. System resources (memory, CPU load)
 * 5. Node.js runtime information
 */
export const GET: APIRoute = async ({ request }) => {
  const startTime = performance.now()
  const healthStatus: Record<string, unknown> = {
    status: 'healthy',
    api: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: 'v1',
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
    version: 'v1',
  })

  // If no Supabase credentials, return partial health status
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

  interface RedisHealth {
    status: string
    [key: string]: unknown
  }

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
      // Check if Supabase is unhealthy
      const supabaseInfo = healthStatus.supabase as { status: string }
      if (supabaseInfo && supabaseInfo.status === 'unhealthy') {
        healthStatus.status = 'unhealthy'
      }
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
    const redisInfo = healthStatus.redis as RedisHealth
    if (redisInfo && redisInfo.status === 'unhealthy') {
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

  // Add system information
  healthStatus.system = getSystemInformation()

  // Calculate response time
  const endTime = performance.now()
  if (
    healthStatus.api &&
    typeof healthStatus.api === 'object' &&
    healthStatus.api !== null &&
    'responseTimeMs' in healthStatus.api
  ) {
    ;(healthStatus.api as { responseTimeMs: number }).responseTimeMs =
      Math.round(endTime - startTime)
  }

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
): Promise<Record<string, unknown>> {
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

/**
 * Get system information including memory, CPU, and runtime details
 */
function getSystemInformation(): Record<string, unknown> {
  // Get memory usage
  const totalMemory = os.totalmem()
  const freeMemory = os.freemem()
  const usedMemory = totalMemory - freeMemory
  const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100)

  // Get CPU information
  const cpuInfo = os.cpus()
  const cpuModel = cpuInfo.length > 0 ? cpuInfo[0].model : 'Unknown'
  const cpuCores = cpuInfo.length
  const loadAverage = os.loadavg()

  // Get OS information
  const platform = os.platform()
  const release = os.release()
  const uptime = os.uptime()

  // Get Node.js process information
  const nodeVersion = process.version
  const processMemory = process.memoryUsage()
  const processUptime = process.uptime()

  return {
    memory: {
      total: formatBytes(totalMemory),
      free: formatBytes(freeMemory),
      used: formatBytes(usedMemory),
      usagePercent: memoryUsagePercent,
    },
    cpu: {
      model: cpuModel,
      cores: cpuCores,
      loadAverage: {
        '1m': loadAverage[0].toFixed(2),
        '5m': loadAverage[1].toFixed(2),
        '15m': loadAverage[2].toFixed(2),
      },
    },
    os: {
      platform,
      release,
      uptime: formatUptime(uptime),
    },
    runtime: {
      nodeVersion,
      processMemory: {
        rss: formatBytes(processMemory.rss),
        heapTotal: formatBytes(processMemory.heapTotal),
        heapUsed: formatBytes(processMemory.heapUsed),
        external: formatBytes(processMemory.external),
      },
      processUptime: formatUptime(processUptime),
    },
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes'
  }

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Format uptime in seconds to human-readable string
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (3600 * 24))
  const hours = Math.floor((seconds % (3600 * 24)) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`
}
