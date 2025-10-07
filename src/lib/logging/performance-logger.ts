import type { PerformanceMetrics } from '../ai/performance'
import { logger } from '../logger'

export class PerformanceLogger {
  private static instance: PerformanceLogger
  private logDir: string
  private metricsBuffer: PerformanceMetrics[] = []
  private readonly BUFFER_SIZE = 100
  private readonly FLUSH_INTERVAL = 60000 // 1 minute

  private constructor() {
    this.logDir = process.env['LOG_DIR'] || './logs/performance'
    this.initializeLogDir()
    this.startPeriodicFlush()
  }

  public static getInstance(): PerformanceLogger {
    if (!PerformanceLogger.instance) {
      PerformanceLogger.instance = new PerformanceLogger()
    }
    return PerformanceLogger.instance
  }

  private async initializeLogDir() {
    try {
      const fs = await import('node:fs/promises')
      await fs.mkdir(this.logDir, { recursive: true })
    } catch (error: unknown) {
      logger.error('Failed to create performance log directory:', error)
    }
  }

  private startPeriodicFlush() {
    setInterval(() => {
      this.flushMetricsBuffer().catch((error) => {
        logger.error('Failed to flush metrics buffer:', error)
      })
    }, this.FLUSH_INTERVAL)
  }

  public async logMetric(metric: PerformanceMetrics): void {
    this.metricsBuffer.push(metric)

    // Log warnings for performance issues
    if (metric['latency'] > 3000) {
      // 3 seconds threshold
      logger.warn(
        `[Performance Warning] Slow request detected (${metric['latency']}ms) for model ${metric['model']}`,
      )
    }

    if (metric['totalTokens'] && metric['totalTokens'] > 1000) {
      logger.warn(
        `[Performance Warning] High token usage detected (${metric['totalTokens']} tokens) for model ${metric['model']}`,
      )
    }

    if (this.metricsBuffer.length >= this.BUFFER_SIZE) {
      await this.flushMetricsBuffer()
    }
  }

  private async flushMetricsBuffer() {
    if (this.metricsBuffer.length === 0) {
      return
    }

    try {
      const fs = await import('node:fs/promises')
      const timestamp = new Date().toISOString().split('T')[0]
      const logFile = `${this.logDir}/metrics-${timestamp}.jsonl`

      const metricsToWrite = `${this.metricsBuffer
        .map((metric) => JSON.stringify(metric))
        .join('\n')}\n`
      await fs.appendFile(logFile, metricsToWrite)

      // Clear the buffer
      this.metricsBuffer = []

      // Log summary
      logger.info(
        `Flushed ${this.metricsBuffer.length} performance metrics to ${logFile}`,
      )
    } catch (error: unknown) {
      logger.error('Failed to flush performance metrics:', error)
    }
  }

  public async getMetrics(timeRange: { start: Date; end: Date }) {
    if (!timeRange?.['start'] || !timeRange?.['end']) {
      logger.error('Invalid time range provided')
      return []
    }

    try {
      const fs = await import('node:fs/promises')
      const files = await fs.readdir(this.logDir)

      const metrics: PerformanceMetrics[] = []
      for (const file of files) {
        if (!file.startsWith('metrics-') || !file.endsWith('.jsonl')) {
          continue
        }

        const fileDate = file.replace('metrics-', '').replace('.jsonl', '')
        if (
          fileDate >= timeRange['start'].toISOString().split('T')[0] &&
          fileDate <= timeRange['end'].toISOString().split('T')[0]
        ) {
          const content = await fs.readFile(`${this.logDir}/${file}`, 'utf-8')
          const fileMetrics = content
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line) as unknown)
          metrics.push(...fileMetrics)
        }
      }

      return metrics
    } catch (error: unknown) {
      logger.error('Failed to get performance metrics:', error)
      return []
    }
  }

  public async cleanup(retentionDays = 30): void {
    try {
      const fs = await import('node:fs/promises')
      const files = await fs.readdir(this.logDir)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      for (const file of files) {
        if (!file.startsWith('metrics-') || !file.endsWith('.jsonl')) {
          continue
        }

        const fileDate = file.replace('metrics-', '').replace('.jsonl', '')
        if (new Date(fileDate) < cutoffDate) {
          await fs.unlink(`${this.logDir}/${file}`)
          logger.info(`Cleaned up old performance log file: ${file}`)
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to clean up performance logs:', error)
    }
  }
}
