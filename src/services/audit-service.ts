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

/**
 * Service responsible for managing the creation and lifecycle of audit events.
 * 
 * Provides a standardized foundation for tracking security-sensitive actions and 
 * maintaining an audit trail. While the service handles event generation and metadata 
 * consistency, full compliance guarantees (such as encrypted persistence, immutability, 
 * and retention policies) are managed by the underlying storage implementation 
 * in the `storeEvent` hook.
 */
export class AuditService {
  /**
   * Generates a new audit event from the provided data.
   * Ensures consistent timestamping and unique identifier generation.
   * 
   * @param eventData The raw event data to be audited
   * @returns The fully constructed AuditEvent
   */
  async createAuditEvent(eventData: AuditEventData): Promise<AuditEvent> {
    const newEvent: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...eventData,
    }

    await this.storeEvent(newEvent)
    return newEvent
  }

  /**
   * Delegates event persistence to the storage layer.
   * 
   * @remarks
   * Current implementation is a placeholder. Future storage adapters will handle 
   * encrypted storage and regulatory retention requirements.
   * 
   * @param _event The event to be persisted
   * @private
   */
  private async storeEvent(_event: AuditEvent): Promise<void> {
    // Implementation for storing the event
  }
}
