export interface AuditEventData {
  userId: string
  action: string
  resource: string
  metadata?: Record<string, unknown>
}

export interface AuditEvent extends AuditEventData {
  id: string
  timestamp: string
}

export class AuditService {
  async createAuditEvent(eventData: AuditEventData): Promise<AuditEvent> {
    const newEvent: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...eventData,
    }

    await this.storeEvent(newEvent)
    return newEvent
  }

  private async storeEvent(_event: AuditEvent): Promise<void> {
    // Implementation for storing the event
  }
}
