import { getLogger } from '../logging'
import type { SlackAlerter } from './slack-alert'

const logger = getLogger({ module: 'unified-monitor' })

export interface MonitorEvent {
  source: 'fhe' | 'audit' | 'secrets' | 'governance'
  event: string
  timestamp: string
  details?: Record<string, unknown>
}

export type AlertHandler = (alert: { type: string; count: number; source: string }) => void

const ALERT_THRESHOLD = 5
const MAX_EVENTS_PER_SOURCE = 1000 // Memory limit

export class UnifiedMonitor {
  // Source-keyed storage for O(1) lookups
  private eventsBySource: Map<string, MonitorEvent[]> = new Map()
  private alertHandlers: AlertHandler[] = []
  private failureCounts: Map<string, number> = new Map()

  async record(event: MonitorEvent): Promise<void> {
    // Store event in source-keyed map (O(1) insertion)
    const sourceEvents = this.eventsBySource.get(event.source) || []
    sourceEvents.push(event)
    
    // Enforce memory limit - remove oldest events if exceeded
    if (sourceEvents.length > MAX_EVENTS_PER_SOURCE) {
      sourceEvents.shift() // Remove oldest
    }
    
    this.eventsBySource.set(event.source, sourceEvents)
    
    logger.info(`Recorded event: ${event.source}/${event.event}`)

    // Check alert thresholds synchronously before any await
    if (event.event === 'compliance_failure') {
      const key = `${event.source}:compliance_failure`
      const count = (this.failureCounts.get(key) || 0) + 1
      this.failureCounts.set(key, count)

      // Trigger alert synchronously if threshold reached
      if (count >= ALERT_THRESHOLD) {
        // Reset counter immediately to prevent duplicate alerts
        this.failureCounts.set(key, 0)
        // Log and notify handlers (async but after sync state update)
        this.triggerAlert({ type: 'compliance_failure', count, source: event.source })
      }
    }
  }

  onAlert(handler: AlertHandler): void {
    this.alertHandlers.push(handler)
  }

  getEvents(source: string): MonitorEvent[] {
    return this.eventsBySource.get(source) || []
  }

  getAllEvents(): MonitorEvent[] {
    const all: MonitorEvent[] = []
    for (const events of this.eventsBySource.values()) {
      all.push(...events)
    }
    return all
  }

  clearEvents(): void {
    this.eventsBySource.clear()
    this.failureCounts.clear()
  }

  /**
   * Register a Slack alerter to receive all governance alerts.
   * The SlackAlerter will be called for each alert triggered by threshold breaches.
   */
  connectSlack(alerter: SlackAlerter): void {
    this.onAlert(async (alert) => {
      await alerter.send({
        text: `🚨 Governance Alert: ${alert.type} (count: ${alert.count}, source: ${alert.source})`,
      })
    })
  }

  private triggerAlert(alert: { type: string; count: number; source: string }): void {
    for (const handler of this.alertHandlers) {
      handler(alert)
    }
    logger.warn(`ALERT: ${alert.type} (count: ${alert.count}, source: ${alert.source})`)
  }
}
