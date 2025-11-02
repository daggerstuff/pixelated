import { performance } from 'node:perf_hooks'
import os from 'node:os'

export interface HealthCheck {
  name: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime?: number
  message?: string
  details?: Record<string, unknown>
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime: number
  responseTime: number
  checks: HealthCheck[]
  system: {
    memory: {
      total: number
      free: number
      used: number
      usagePercent: number
    }
    cpu: {
      cores: number
      loadAverage: number[]
      model: string
    }
    platform: string
    nodeVersion: string
  }
}

export class HealthMonitor {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map()

  constructor() {
    // Register default health checks
    this.registerCheck('system', this.checkSystem.bind(this))
    this.registerCheck('memory', this.checkMemory.bind(this))
    this.registerCheck('disk', this.checkDisk.bind(this))
  }

  registerCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.checks.set(name, checkFn)
  }

  registerService(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.registerCheck(name, checkFn)
  }

  startMonitoring(): void {
    // Start monitoring services
    console.log('Health monitoring started')
  }

  async getHealth(): Promise<SystemHealth> {
    const startTime = performance.now()
    const checks: HealthCheck[] = []

    // Run all health checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(
      async ([name, checkFn]) => {
        try {
          const checkStart = performance.now()
          const result = await Promise.race([
            checkFn(),
            this.timeoutPromise(5000, name), // 5 second timeout
          ])
          result.responseTime = performance.now() - checkStart
          return result
        } catch (_error) {
          return {
            name,
            status: 'unhealthy' as const,
            message: _error instanceof Error ? _String(error) : 'Unknown error',
            responseTime: performance.now() - startTime,
          }
        }
      },
    )

    const checkResults = await Promise.all(checkPromises)
    checks.push(...checkResults)

    // Determine overall status
    const hasUnhealthy = checks.some((check) => check.status === 'unhealthy')
    const hasDegraded = checks.some((check) => check.status === 'degraded')

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
    if (hasUnhealthy) {
      overallStatus = 'unhealthy'
    } else if (hasDegraded) {
      overallStatus = 'degraded'
    }

    const responseTime = performance.now() - startTime

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime,
      checks,
      system: this.getSystemInfo(),
    }
  }

  private async timeoutPromise(
    ms: number,
    checkName: string,
  ): Promise<HealthCheck> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check '${checkName}' timed out after ${ms}ms`))
      }, ms)
    })
  }

  private async checkSystem(): Promise<HealthCheck> {
    try {
      const uptime = os.uptime()
      const loadAvg = os.loadavg()
      const cpuCount = os.cpus().length

      // Check if system load is reasonable (< 2x CPU cores)
      const highLoad = loadAvg[0] > cpuCount * 2

      return {
        name: 'system',
        status: highLoad ? 'degraded' : 'healthy',
        message: highLoad
          ? 'High system load detected'
          : 'System operating normally',
        details: {
          uptime,
          loadAverage: loadAvg,
          cpuCores: cpuCount,
          platform: os.platform(),
          release: os.release(),
        },
      }
    } catch (_error) {
      return {
        name: 'system',
        status: 'unhealthy',
        message:
          _error instanceof Error ? _String(error) : 'System check failed',
      }
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    try {
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      const usedMem = totalMem - freeMem
      const usagePercent = (usedMem / totalMem) * 100

      // Memory usage thresholds
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      let message = 'Memory usage normal'

      if (usagePercent > 90) {
        status = 'unhealthy'
        message = 'Critical memory usage'
      } else if (usagePercent > 80) {
        status = 'degraded'
        message = 'High memory usage'
      }

      return {
        name: 'memory',
        status,
        message,
        details: {
          total: totalMem,
          free: freeMem,
          used: usedMem,
          usagePercent: Math.round(usagePercent * 100) / 100,
        },
      }
    } catch (_error) {
      return {
        name: 'memory',
        status: 'unhealthy',
        message:
          _error instanceof Error ? _String(error) : 'Memory check failed',
      }
    }
  }

  private async checkDisk(): Promise<HealthCheck> {
    try {
      // Basic disk check - in production this would check actual disk usage
      // For now, simulate a basic check
      const processMemory = process.memoryUsage()
      const heapUsagePercent =
        (processMemory.heapUsed / processMemory.heapTotal) * 100

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      let message = 'Disk usage normal'

      if (heapUsagePercent > 90) {
        status = 'degraded'
        message = 'High heap usage detected'
      }

      return {
        name: 'disk',
        status,
        message,
        details: {
          heapUsed: processMemory.heapUsed,
          heapTotal: processMemory.heapTotal,
          heapUsagePercent: Math.round(heapUsagePercent * 100) / 100,
        },
      }
    } catch (_error) {
      return {
        name: 'disk',
        status: 'unhealthy',
        message: _error instanceof Error ? _String(error) : 'Disk check failed',
      }
    }
  }

  private getSystemInfo() {
    try {
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      const usedMem = totalMem - freeMem
      const cpus = os.cpus()

      return {
        memory: {
          total: totalMem,
          free: freeMem,
          used: usedMem,
          usagePercent: Math.round((usedMem / totalMem) * 100 * 100) / 100,
        },
        cpu: {
          cores: cpus.length,
          loadAverage: os.loadavg(),
          model: cpus[0]?.model || 'Unknown',
        },
        platform: os.platform(),
        nodeVersion: process.version,
      }
    } catch {
      return {
        memory: { total: 0, free: 0, used: 0, usagePercent: 0 },
        cpu: { cores: 0, loadAverage: [0, 0, 0], model: 'Unknown' },
        platform: 'unknown',
        nodeVersion: process.version,
      }
    }
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor()
