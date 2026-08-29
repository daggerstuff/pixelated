/**
 * Tests for StubCalendlyAdapter — in-memory Calendly adapter for dev/testing.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { StubCalendlyAdapter } from '../calendly/stub-adapter'
import {
  calendlyUserSchema,
  calendlyEventTypeSchema,
  calendlyScheduledEventSchema,
  calendlyInviteeSchema,
} from '../calendly/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_TOKEN = 'stub-access-token'
const SEEDED_EVENT_URI =
  'https://api.calendly.com/scheduled_events/stub-event-001'
const SEEDED_EVENT_TYPE_URI = 'https://api.calendly.com/event_types/stub-30min'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StubCalendlyAdapter', () => {
  let adapter: StubCalendlyAdapter

  beforeEach(() => {
    adapter = new StubCalendlyAdapter()
  })

  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  describe('identity', () => {
    it('exposes name as "stub-calendly"', () => {
      expect(adapter.name).toBe('stub-calendly')
    })
  })

  // -------------------------------------------------------------------------
  // getCurrentUser
  // -------------------------------------------------------------------------

  describe('getCurrentUser', () => {
    it('returns a user that validates against calendlyUserSchema', async () => {
      const user = await adapter.getCurrentUser(VALID_TOKEN)
      const parsed = calendlyUserSchema.parse(user)
      expect(parsed.uri).toBe('https://api.calendly.com/users/stub-user-001')
      expect(parsed.email).toBe('stub@example.com')
      expect(parsed.slug).toBe('stub-user')
    })

    it('throws when accessToken is empty', async () => {
      await expect(adapter.getCurrentUser('')).rejects.toThrow(
        'accessToken is required',
      )
    })
  })

  // -------------------------------------------------------------------------
  // listEventTypes
  // -------------------------------------------------------------------------

  describe('listEventTypes', () => {
    it('returns seeded event types', async () => {
      const result = await adapter.listEventTypes(VALID_TOKEN)
      expect(result.data).toHaveLength(1)
      expect(result.pagination.count).toBe(1)
      const parsed = calendlyEventTypeSchema.parse(result.data[0])
      expect(parsed.uri).toBe(SEEDED_EVENT_TYPE_URI)
      expect(parsed.name).toBe('30 Minute Meeting')
    })

    it('filters by active=true', async () => {
      const result = await adapter.listEventTypes(VALID_TOKEN, { active: true })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].active).toBe(true)
    })

    it('filters by active=false returns empty', async () => {
      const result = await adapter.listEventTypes(VALID_TOKEN, {
        active: false,
      })
      expect(result.data).toHaveLength(0)
      expect(result.pagination.count).toBe(0)
    })

    it('returns all when no params', async () => {
      const result = await adapter.listEventTypes(VALID_TOKEN, undefined)
      expect(result.data.length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // getScheduledEvent
  // -------------------------------------------------------------------------

  describe('getScheduledEvent', () => {
    it('returns seeded event by URI', async () => {
      const event = await adapter.getScheduledEvent(
        VALID_TOKEN,
        SEEDED_EVENT_URI,
      )
      const parsed = calendlyScheduledEventSchema.parse(event)
      expect(parsed.uri).toBe(SEEDED_EVENT_URI)
      expect(parsed.status).toBe('active')
    })

    it('throws for unknown event URI', async () => {
      await expect(adapter.getCurrentUser(VALID_TOKEN)).resolves.toBeDefined()
      await expect(
        adapter.getScheduledEvent(
          VALID_TOKEN,
          'https://api.calendly.com/scheduled_events/nonexistent',
        ),
      ).rejects.toThrow('scheduled event not found')
    })
  })

  // -------------------------------------------------------------------------
  // listScheduledEvents
  // -------------------------------------------------------------------------

  describe('listScheduledEvents', () => {
    it('returns seeded events', async () => {
      const result = await adapter.listScheduledEvents(VALID_TOKEN)
      expect(result.data.length).toBeGreaterThan(0)
      for (const event of result.data) {
        calendlyScheduledEventSchema.parse(event)
      }
      expect(result.pagination.count).toBe(result.data.length)
    })

    it('filters by status=active', async () => {
      const result = await adapter.listScheduledEvents(VALID_TOKEN, {
        status: 'active',
      })
      expect(result.data.every((e) => e.status === 'active')).toBe(true)
    })

    it('filters by status=canceled returns empty initially', async () => {
      const result = await adapter.listScheduledEvents(VALID_TOKEN, {
        status: 'canceled',
      })
      expect(result.data).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // listInvitees
  // -------------------------------------------------------------------------

  describe('listInvitees', () => {
    it('returns seeded invitees for known event', async () => {
      const result = await adapter.listInvitees(VALID_TOKEN, SEEDED_EVENT_URI)
      expect(result.data).toHaveLength(1)
      const parsed = calendlyInviteeSchema.parse(result.data[0])
      expect(parsed.email).toBe('patient@example.com')
      expect(parsed.name).toBe('Test Patient')
    })

    it('returns empty for unknown event URI', async () => {
      const result = await adapter.listInvitees(
        VALID_TOKEN,
        'https://api.calendly.com/scheduled_events/nonexistent',
      )
      expect(result.data).toHaveLength(0)
      expect(result.pagination.count).toBe(0)
    })

    it('filters by status=active', async () => {
      const result = await adapter.listInvitees(VALID_TOKEN, SEEDED_EVENT_URI, {
        status: 'active',
      })
      expect(result.data.every((i) => i.status === 'active')).toBe(true)
    })

    it('filters by status=canceled returns empty', async () => {
      const result = await adapter.listInvitees(VALID_TOKEN, SEEDED_EVENT_URI, {
        status: 'canceled',
      })
      expect(result.data).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // cancelScheduledEvent
  // -------------------------------------------------------------------------

  describe('cancelScheduledEvent', () => {
    it('cancels a known event and returns canceled=true', async () => {
      const result = await adapter.cancelScheduledEvent(
        VALID_TOKEN,
        SEEDED_EVENT_URI,
        'Patient requested cancellation',
      )
      expect(result.canceled).toBe(true)
      expect(result.eventUri).toBe(SEEDED_EVENT_URI)

      // Verify state mutation
      const event = await adapter.getScheduledEvent(
        VALID_TOKEN,
        SEEDED_EVENT_URI,
      )
      expect(event.status).toBe('canceled')
      expect(event.cancellation_reason).toBe('Patient requested cancellation')
      expect(event.canceler_name).toBe('Stub User')
    })

    it('cancels without a reason', async () => {
      const result = await adapter.cancelScheduledEvent(
        VALID_TOKEN,
        SEEDED_EVENT_URI,
      )
      expect(result.canceled).toBe(true)
      const event = await adapter.getScheduledEvent(
        VALID_TOKEN,
        SEEDED_EVENT_URI,
      )
      expect(event.status).toBe('canceled')
    })

    it('throws for unknown event URI', async () => {
      await expect(
        adapter.cancelScheduledEvent(
          VALID_TOKEN,
          'https://api.calendly.com/scheduled_events/nonexistent',
        ),
      ).rejects.toThrow('scheduled event not found')
    })

    it('canceled event appears in listScheduledEvents with status=canceled', async () => {
      await adapter.cancelScheduledEvent(VALID_TOKEN, SEEDED_EVENT_URI)
      const result = await adapter.listScheduledEvents(VALID_TOKEN, {
        status: 'canceled',
      })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].uri).toBe(SEEDED_EVENT_URI)
    })
  })

  // -------------------------------------------------------------------------
  // Schema validation — all seeded data must pass Zod
  // -------------------------------------------------------------------------

  describe('schema validation of seeded data', () => {
    it('getCurrentUser passes calendlyUserSchema', async () => {
      const user = await adapter.getCurrentUser(VALID_TOKEN)
      expect(() => calendlyUserSchema.parse(user)).not.toThrow()
    })

    it('listEventTypes passes calendlyEventTypeSchema', async () => {
      const result = await adapter.listEventTypes(VALID_TOKEN)
      for (const et of result.data) {
        expect(() => calendlyEventTypeSchema.parse(et)).not.toThrow()
      }
    })

    it('getScheduledEvent passes calendlyScheduledEventSchema', async () => {
      const event = await adapter.getScheduledEvent(
        VALID_TOKEN,
        SEEDED_EVENT_URI,
      )
      expect(() => calendlyScheduledEventSchema.parse(event)).not.toThrow()
    })

    it('listInvitees passes calendlyInviteeSchema', async () => {
      const result = await adapter.listInvitees(VALID_TOKEN, SEEDED_EVENT_URI)
      for (const inv of result.data) {
        expect(() => calendlyInviteeSchema.parse(inv)).not.toThrow()
      }
    })
  })
})
