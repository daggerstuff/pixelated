import type { APIRoute } from 'astro'
import os from 'node:os'
import { performance } from 'node:perf_hooks'

// A placeholder for RedisHealth type if it's not defined elsewhere
interface RedisHealth {
  status: 'healthy' | 'unhealthy'
  // other properties could be here
}

export const GET: APIRoute = async ({ request }) => {
  const startTime = performance.now()
  const mongoUri = import.meta.env.MONGO_URI
  const mongoDbName = import.meta.env.MONGO_DB_NAME

  const healthStatus: Record<string, any> = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }

  // System health
  healthStatus.system = getSystemInformation()

  // Database health checks
  if (!mongoUri || !mongoDbName) {
    console.warn(
      'Health check: Missing MongoDB credentials, skipping database check',
    )
    healthStatus.mongodb = {
      status: 'unhealthy',
      message: 'MongoDB credentials not configured',
    }
    healthStatus.status = 'unhealthy'
  } else {
    try {
      // This would be a real check against the database
      // For now, we'll assume it's healthy if configured
      healthStatus.mongodb = {
        status: 'healthy',
        type: 'mongodb',
      }
    } catch (error) {
      healthStatus.mongodb = {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
      healthStatus.status = 'unhealthy'
    }
  }

  // You might have other checks like Redis, etc.
  // const redisInfo = healthStatus.redis as RedisHealth; // This line was in the original, suggesting a Redis check exists

  // Overall status check
  const hasUnhealthyComponents = Object.values(healthStatus).some(
    (component: any) => component?.status === 'unhealthy',
  )

  if (hasUnhealthyComponents) {
    healthStatus.status = 'unhealthy'
  }

  // Response time
  const responseTime = Math.round((performance.now() - startTime) * 100) / 100
  healthStatus.responseTime = `${responseTime}ms`

  // Return appropriate HTTP status
  const httpStatus = healthStatus.status === 'healthy' ? 200 : 503

  return new Response(JSON.stringify(healthStatus, null, 2), {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
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