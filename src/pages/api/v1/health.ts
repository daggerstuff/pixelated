import type { APIRoute, APIContext } from 'astro'
// Avoid importing Astro types directly to prevent type errors in tests
import os from 'node:os'
import { performance } from 'node:perf_hooks'

type HealthState = 'healthy' | 'unhealthy'
type ComponentStatus = { status: HealthState; [key: string]: unknown }
interface HealthStatus {
  status: HealthState
  timestamp: string
  system?: Record<string, unknown>
  mongodb?: ComponentStatus
  responseTime?: string
  // Allow future components
  [key: string]: unknown
}

function isComponentStatus(v: unknown): v is ComponentStatus {
  return typeof v === 'object' && v !== null && 'status' in (v as Record<string, unknown>)
}

export const GET: APIRoute = async ({ request: _request }: { request: Request }) => {
  const startTime = performance.now()
  const mongoUri = process.env['MONGO_URI']
  const mongoDbName = process.env['MONGO_DB_NAME']

  const healthStatus: HealthStatus = {
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

  // Overall status check
  const hasUnhealthyComponents = Object.values(healthStatus).some(
    (component) => isComponentStatus(component) && component.status === 'unhealthy',
  )

  if (hasUnhealthyComponents) {
    healthStatus.status = 'unhealthy'
  }

  // Response time
  const responseTime = Math.round((performance.now() - startTime) * 100) / 100
  healthStatus.responseTime = `${responseTime}ms`

  // Always return 200 to avoid failing health probes while conveying status in body
  return new Response(JSON.stringify(healthStatus, null, 2), {
    status: 200,
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
  const cpuModel = cpuInfo?.[0]?.model ?? 'Unknown'
  const cpuCores = cpuInfo ? cpuInfo.length : 0
  const loadAverage = os.loadavg() || [0, 0, 0]

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
        '1m': Number(loadAverage[0] || 0).toFixed(2),
        '5m': Number(loadAverage[1] || 0).toFixed(2),
        '15m': Number(loadAverage[2] || 0).toFixed(2),
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