import { getLogger } from '../logging'

const logger = getLogger({ module: 'unified-monitor' })

export interface MonitorEvent {
  source: 'fhe' | 'audit' | 'secrets' | 'governance'
  event: string
  timestamp: string
  details?: Record<string, unknown>
}

export type AlertHandler = (alert: { type: string; count: number; source: string }) => void

const ALERT_THRESHOLD = 5

export class UnifiedMonitor {
  private events: MonitorEvent[] = []
  private alertHandlers: AlertHandler[] = []
  private failureCounts: Map<string, number> = new Map()

  async record(event: MonitorEvent): Promise<void> {
    this.events.push(event)
    logger.info(`Recorded event: ${event.source}/${event.event}`)

    // Check alert thresholds for compliance failures
    if (event.event === 'compliance_failure') {
      const key = `${event.source}:compliance_failure`
      const count = (this.failureCounts.get(key) || 0) + 1
      this.failureCounts.set(key, count)

      if (count >= ALERT_THRESHOLD) {
        await this.triggerAlert({ type: 'compliance_failure', count, source: event.source })
        // Reset counter after alert
        this.failureCounts.set(key, 0)
      }
    }
  }

  onAlert(handler: AlertHandler): void {
    this.alertHandlers.push(handler)
  }

  getEvents(source: string): MonitorEvent[] {
    return this.events.filter(e => e.source === source)
  }

  getAllEvents(): MonitorEvent[] {
    return [...this.events]
  }

  clearEvents(): void {
    this.events = []
    this.failureCounts.clear()
  }

  private async triggerAlert(alert: { type: string; count: number; source: string }): Promise<void> {
    for (const handler of this.alertHandlers) {
      handler(alert)
    }
    logger.warn(`ALERT: ${alert.type} (count: ${alert.count}, source: ${alert.source})`)
  }
}
