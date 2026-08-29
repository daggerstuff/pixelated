/**
 * Stub Calendly adapter — in-memory simulation for development and testing.
 *
 * @file Following the clearinghouse stub-adapter pattern: implements the
 *       CalendlyAdapter interface with deterministic responses based on input.
 *       No real network calls are made. State is maintained in Maps.
 */

import type {
  CalendlyAdapter,
  ListScheduledEventsParams,
  ListInviteesParams,
  ListEventTypesParams,
  PaginatedResponse,
} from './adapter'
import type {
  CalendlyUser,
  CalendlyEventType,
  CalendlyScheduledEvent,
  CalendlyInvitee,
} from './types'

/**
 * In-memory stub implementation of the Calendly adapter.
 *
 * Generates deterministic test data based on input parameters.
 * All responses match the Zod schemas defined in types.ts.
 */
export class StubCalendlyAdapter implements CalendlyAdapter {
  readonly name = 'stub-calendly'

  private readonly eventTypes: Map<string, CalendlyEventType> = new Map()
  private readonly scheduledEvents: Map<string, CalendlyScheduledEvent> =
    new Map()
  private readonly invitees: Map<string, CalendlyInvitee[]> = new Map()
  private idCounter = 0

  constructor() {
    this.seedTestData()
  }

  /**
   * Pre-populate with deterministic test data.
   */
  private seedTestData(): void {
    const eventType: CalendlyEventType = {
      uri: 'https://api.calendly.com/event_types/stub-30min',
      name: '30 Minute Meeting',
      slug: '30min',
      active: true,
      kind: 'solo',
      scheduling_url: 'https://calendly.com/stub-user/30min',
      duration: 30,
      profile_name: 'Dr. Stub',
      profile_type: 'User',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    }
    this.eventTypes.set(eventType.uri, eventType)

    const event: CalendlyScheduledEvent = {
      uri: 'https://api.calendly.com/scheduled_events/stub-event-001',
      name: '30 Minute Meeting',
      status: 'active',
      start_time: '2025-06-15T10:00:00.000Z',
      end_time: '2025-06-15T10:30:00.000Z',
      event_type: eventType.uri,
      invitees_counter: { total: 1, active: 1, limit: 1 },
      created_at: '2025-06-01T00:00:00.000Z',
      updated_at: '2025-06-01T00:00:00.000Z',
    }
    this.scheduledEvents.set(event.uri, event)

    const invitee: CalendlyInvitee = {
      uri: 'https://api.calendly.com/scheduled_events/stub-event-001/invitees/stub-invitee-001',
      email: 'patient@example.com',
      name: 'Test Patient',
      status: 'active',
      event: event.uri,
      created_at: '2025-06-01T00:00:00.000Z',
      updated_at: '2025-06-01T00:00:00.000Z',
    }
    this.invitees.set(event.uri, [invitee])
  }

  private nextId(prefix: string): string {
    this.idCounter += 1
    return `${prefix}-${this.idCounter.toString().padStart(3, '0')}`
  }

  async getCurrentUser(accessToken: string): Promise<CalendlyUser> {
    if (!accessToken) {
      throw new Error('StubCalendlyAdapter: accessToken is required')
    }
    return {
      uri: 'https://api.calendly.com/users/stub-user-001',
      name: 'Dr. Stub User',
      slug: 'stub-user',
      email: 'stub@example.com',
      scheduling_url: 'https://calendly.com/stub-user',
      timezone: 'America/New_York',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    }
  }

  async listEventTypes(
    _accessToken: string,
    params?: ListEventTypesParams,
  ): Promise<PaginatedResponse<CalendlyEventType>> {
    let items = [...this.eventTypes.values()]
    if (params?.active !== undefined) {
      items = items.filter((et) => et.active === params.active)
    }
    return {
      data: items,
      pagination: { count: items.length },
    }
  }

  async getScheduledEvent(
    _accessToken: string,
    eventUri: string,
  ): Promise<CalendlyScheduledEvent> {
    const event = this.scheduledEvents.get(eventUri)
    if (!event) {
      throw new Error(
        `StubCalendlyAdapter: scheduled event not found: ${eventUri}`,
      )
    }
    return event
  }

  async listScheduledEvents(
    _accessToken: string,
    params?: ListScheduledEventsParams,
  ): Promise<PaginatedResponse<CalendlyScheduledEvent>> {
    let items = [...this.scheduledEvents.values()]
    if (params?.status) {
      items = items.filter((e) => e.status === params.status)
    }
    return {
      data: items,
      pagination: { count: items.length },
    }
  }

  async listInvitees(
    _accessToken: string,
    eventUri: string,
    params?: ListInviteesParams,
  ): Promise<PaginatedResponse<CalendlyInvitee>> {
    let items = this.invitees.get(eventUri) ?? []
    if (params?.status) {
      items = items.filter((i) => i.status === params.status)
    }
    return {
      data: items,
      pagination: { count: items.length },
    }
  }

  async cancelScheduledEvent(
    _accessToken: string,
    eventUri: string,
    cancellationReason?: string,
  ): Promise<{ canceled: boolean; eventUri: string }> {
    const event = this.scheduledEvents.get(eventUri)
    if (!event) {
      throw new Error(
        `StubCalendlyAdapter: scheduled event not found: ${eventUri}`,
      )
    }
    const canceled: CalendlyScheduledEvent = {
      ...event,
      status: 'canceled',
      cancellation_reason: cancellationReason,
      canceler_name: 'Stub User',
      updated_at: new Date().toISOString(),
    }
    this.scheduledEvents.set(eventUri, canceled)
    return { canceled: true, eventUri }
  }
}

/**
 * Singleton stub instance for development and testing.
 */
export const stubCalendlyAdapter = new StubCalendlyAdapter()
