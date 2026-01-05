import { performance } from 'node:perf_hooks'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export interface UptimeRecord {
  timestamp: string
  status: 'up' | 'down' | 'degraded'
  responseTime: number
  error?: string
}

export interface UptimeStats {
  uptime: number // percentage
  totalChecks: number
  upChecks: number
  downChecks: number
  degradedChecks: number
  averageResponseTime: number
  lastCheck: UptimeRecord
  period: string
}

export class UptimeMonitor {
  private records: UptimeRecord[] = []
  private readonly maxRecords = 10000 // Keep last 10k records
  private readonly dataFile = join(process.cwd(), 'logs', 'uptime.json')
  private checkInterval: NodeJS.Timeout | null = null

  constructor() {
    this.loadRecords()
  }

  start(intervalMs: number = 60000): void {
    // Default: check every minute
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    this.checkInterval = setInterval(() => {
      this.performCheck()
    }, intervalMs)

    // Perform initial check
    this.performCheck()
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  private async performCheck(): Promise<void> {
    const startTime = performance.now()

    try {
      // Perform health check with AbortController timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch('http://localhost:4321/api/v1/health', {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const responseTime = performance.now() - startTime
      let status: 'up' | 'down' | 'degraded' = 'up'

      if (response.status >= 500) {
        status = 'down'
      } else if (response.status >= 400 || responseTime > 2000) {
        status = 'degraded'
      }

      const record: UptimeRecord = {
        timestamp: new Date().toISOString(),
        status,
        responseTime,
      }

      this.addRecord(record)
    } catch (error: unknown) {
      const record: UptimeRecord = {
        timestamp: new Date().toISOString(),
        status: 'down',
        responseTime: performance.now() - startTime,
        error: error instanceof Error ? String(error) : 'Unknown error',
      }

      this.addRecord(record)
    }
  }

  private addRecord(record: UptimeRecord): void {
    this.records.push(record)

    // Keep only the most recent records
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords)
    }

    this.saveRecords()
  }

  getStats(periodHours: number = 24): UptimeStats {
    const cutoffTime = new Date(Date.now() - periodHours * 60 * 60 * 1000)
    const relevantRecords = this.records.filter(
      (record) => new Date(record.timestamp) >= cutoffTime,
    )

    if (relevantRecords.length === 0) {
      return {
        uptime: 0,
        totalChecks: 0,
        upChecks: 0,
        downChecks: 0,
        degradedChecks: 0,
        averageResponseTime: 0,
        lastCheck: {
          timestamp: new Date().toISOString(),
          status: 'down',
          responseTime: 0,
          error: 'No data available',
        },
        period: `${periodHours}h`,
      }
    }

    const upChecks = relevantRecords.filter((r) => r.status === 'up').length
    const downChecks = relevantRecords.filter((r) => r.status === 'down').length
    const degradedChecks = relevantRecords.filter(
      (r) => r.status === 'degraded',
    ).length

    const uptime = (upChecks / relevantRecords.length) * 100
    const averageResponseTime =
      relevantRecords.reduce((sum, r) => sum + r.responseTime, 0) /
      relevantRecords.length

    return {
      uptime: Math.round(uptime * 100) / 100,
      totalChecks: relevantRecords.length,
      upChecks,
      downChecks,
      degradedChecks,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      lastCheck: relevantRecords[relevantRecords.length - 1]!,
      period: `${periodHours}h`,
    }
  }

  getUptimePercentage(periodHours: number = 24): number {
    return this.getStats(periodHours).uptime
  }

  isTargetMet(targetUptime: number = 99.9, periodHours: number = 24): boolean {
    return this.getUptimePercentage(periodHours) >= targetUptime
  }

  private loadRecords() {
    try {
      if (existsSync(this.dataFile)) {
        const data = readFileSync(this.dataFile, 'utf8')
        this.records = JSON.parse(data) as UptimeRecord[]
      }
    } catch (error: unknown) {
      console.warn('Failed to load uptime records:', error)
      this.records = []
    }
  }

  private saveRecords() {
    try {
      // Ensure logs directory exists
      const logsDir = join(process.cwd(), 'logs')
      if (!existsSync(logsDir)) {
        // Ensure logs directory exists
        mkdirSync(logsDir, { recursive: true })
      }

      writeFileSync(this.dataFile, JSON.stringify(this.records, null, 2))
    } catch (error: unknown) {
      console.error('Failed to save uptime records:', error)
    }
  }

  generateReport(): string {
    const stats24h = this.getStats(24)
    const stats7d = this.getStats(24 * 7)
    const stats30d = this.getStats(24 * 30)

    return `
# Uptime Report

Generated: ${new Date().toISOString()}

## 24 Hour Summary
- Uptime: ${stats24h.uptime}%
- Total Checks: ${stats24h.totalChecks}
- Up: ${stats24h.upChecks} | Down: ${stats24h.downChecks} | Degraded: ${stats24h.degradedChecks}
- Average Response Time: ${stats24h.averageResponseTime}ms
- Target Met (99.9%): ${stats24h.uptime >= 99.9 ? '✅ YES' : '❌ NO'}

## 7 Day Summary  
- Uptime: ${stats7d.uptime}%
- Total Checks: ${stats7d.totalChecks}
- Up: ${stats7d.upChecks} | Down: ${stats7d.downChecks} | Degraded: ${stats7d.degradedChecks}
- Average Response Time: ${stats7d.averageResponseTime}ms
- Target Met (99.9%): ${stats7d.uptime >= 99.9 ? '✅ YES' : '❌ NO'}

## 30 Day Summary
- Uptime: ${stats30d.uptime}%
- Total Checks: ${stats30d.totalChecks}
- Up: ${stats30d.upChecks} | Down: ${stats30d.downChecks} | Degraded: ${stats30d.degradedChecks}
- Average Response Time: ${stats30d.averageResponseTime}ms
- Target Met (99.9%): ${stats30d.uptime >= 99.9 ? '✅ YES' : '❌ NO'}

## Last Check
- Time: ${stats24h.lastCheck.timestamp}
- Status: ${stats24h.lastCheck.status.toUpperCase()}
- Response Time: ${stats24h.lastCheck.responseTime}ms
${stats24h.lastCheck.error ? `- Error: ${stats24h.lastCheck.error}` : ''}
`
  }
}

// Singleton instance
export const uptimeMonitor = new UptimeMonitor()
