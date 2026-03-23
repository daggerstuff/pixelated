// Unified monitoring with event aggregation and alerting

export interface MonitorEvent {
  source: 'fhe' | 'audit' | 'secrets' | 'governance'
  type: string
  status: string
  timestamp?: number
}

export interface AlertPayload {
  source: string
  type: string
  count: number
  threshold: number
}

export type AlertHandler = (payload: AlertPayload) => void

export class UnifiedMonitor {
  private events: Map<string, MonitorEvent[]> = new Map()
  private failureCounts: Map<string, number> = new Map()
  private alertHandlers: AlertHandler[] = []
  private readonly complianceFailureThreshold = 5

  /**
   * Record an event from a source module
   */
  record(event: MonitorEvent): void {
    const timestampedEvent: MonitorEvent = {
      ...event,
      timestamp: event.timestamp ?? Date.now(),
    }

    // Aggregate event by source
    const sourceEvents = this.events.get(event.source) ?? []
    sourceEvents.push(timestampedEvent)
    this.events.set(event.source, sourceEvents)

    // Track compliance failures
    if (event.status === 'failure' && event.type === 'compliance_failure') {
      const currentCount = this.failureCounts.get(event.source) ?? 0
      const newCount = currentCount + 1
      this.failureCounts.set(event.source, newCount)

      // Trigger alert if threshold breached
      if (newCount >= this.complianceFailureThreshold) {
        this.triggerAlert({
          source: event.source,
          type: event.type,
          count: newCount,
          threshold: this.complianceFailureThreshold,
        })
      }
    }
  }

  /**
   * Get events filtered by source
   */
  getEvents(source?: string): MonitorEvent[] {
    if (source) {
      return this.events.get(source) ?? []
    }
    // Return all events if no source specified
    return Array.from(this.events.values()).flat()
  }

  /**
   * Register an alert handler
   */
  onAlert(handler: AlertHandler): void {
    this.alertHandlers.push(handler)
  }

  /**
   * Get failure counts (for testing/monitoring)
   */
  getFailureCounts(): Map<string, number> {
    return new Map(this.failureCounts)
  }

  /**
   * Clear all events and counts
   */
  clear(): void {
    this.events.clear()
    this.failureCounts.clear()
  }

  /**
   * Trigger alert to all registered handlers
   */
  private triggerAlert(payload: AlertPayload): void {
    for (const handler of this.alertHandlers) {
      handler(payload)
    }
  }
}
