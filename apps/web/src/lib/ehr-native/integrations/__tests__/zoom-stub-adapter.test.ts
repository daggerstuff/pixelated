/**
 * Tests for StubZoomAdapter — in-memory Zoom adapter for dev/testing.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { StubZoomAdapter } from '../zoom/stub-adapter'
import {
  zoomUserSchema,
  zoomMeetingSchema,
  zoomRecordingSchema,
} from '../zoom/types'
import type { CreateMeetingInput } from '../zoom/adapter'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_TOKEN = 'stub-access-token'
const SEEDED_MEETING_ID_1 = '100000001'
const SEEDED_MEETING_ID_2 = '100000002'

const baseMeetingInput: CreateMeetingInput = {
  topic: 'New Therapy Session',
  type: 2,
  start_time: '2025-07-01T10:00:00.000Z',
  duration: 30,
  timezone: 'America/New_York',
  password: 'newpass123',
  agenda: 'Follow-up session',
  settings: {
    host_video: true,
    participant_video: false,
    join_before_host: false,
    mute_upon_entry: true,
    waiting_room: true,
    auto_recording: 'cloud',
  },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StubZoomAdapter', () => {
  let adapter: StubZoomAdapter

  beforeEach(() => {
    adapter = new StubZoomAdapter()
  })

  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  describe('identity', () => {
    it('exposes name as "stub-zoom"', () => {
      expect(adapter.name).toBe('stub-zoom')
    })
  })

  // -------------------------------------------------------------------------
  // getCurrentUser
  // -------------------------------------------------------------------------

  describe('getCurrentUser', () => {
    it('returns a user that validates against zoomUserSchema', async () => {
      const user = await adapter.getCurrentUser(VALID_TOKEN)
      const parsed = zoomUserSchema.parse(user)
      expect(parsed.id).toBe('stub-user-001')
      expect(parsed.email).toBe('stub@example.com')
      expect(parsed.status).toBe('active')
    })

    it('throws when accessToken is empty', async () => {
      await expect(adapter.getCurrentUser('')).rejects.toThrow(
        'accessToken is required',
      )
    })
  })

  // -------------------------------------------------------------------------
  // listMeetings
  // -------------------------------------------------------------------------

  describe('listMeetings', () => {
    it('returns seeded meetings (2)', async () => {
      const result = await adapter.listMeetings(VALID_TOKEN)
      expect(result.data).toHaveLength(2)
      expect(result.pagination.count).toBe(2)
      for (const m of result.data) {
        zoomMeetingSchema.parse(m)
      }
    })

    it('filters by type=scheduled (type=2)', async () => {
      const result = await adapter.listMeetings(VALID_TOKEN, {
        type: 'scheduled',
      })
      expect(result.data.every((m) => m.type === 2)).toBe(true)
      expect(result.data).toHaveLength(2)
    })

    it('filters by type=live returns empty (no type=1 meetings)', async () => {
      const result = await adapter.listMeetings(VALID_TOKEN, { type: 'live' })
      expect(result.data).toHaveLength(0)
    })

    it('filters by type=upcoming returns scheduled meetings', async () => {
      const result = await adapter.listMeetings(VALID_TOKEN, {
        type: 'upcoming',
      })
      expect(result.data.every((m) => m.type === 2)).toBe(true)
    })

    it('returns all when no params', async () => {
      const result = await adapter.listMeetings(VALID_TOKEN, undefined)
      expect(result.data.length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // getMeeting
  // -------------------------------------------------------------------------

  describe('getMeeting', () => {
    it('returns seeded meeting by ID', async () => {
      const meeting = await adapter.getMeeting(VALID_TOKEN, SEEDED_MEETING_ID_1)
      const parsed = zoomMeetingSchema.parse(meeting)
      expect(parsed.id).toBe(100000001)
      expect(parsed.topic).toBe('Therapy Session - Initial Consultation')
    })

    it('throws for unknown meeting ID', async () => {
      await expect(
        adapter.getMeeting(VALID_TOKEN, '999999999'),
      ).rejects.toThrow('meeting not found')
    })
  })

  // -------------------------------------------------------------------------
  // createMeeting
  // -------------------------------------------------------------------------

  describe('createMeeting', () => {
    it('creates a new meeting and stores it', async () => {
      const meeting = await adapter.createMeeting(VALID_TOKEN, baseMeetingInput)
      const parsed = zoomMeetingSchema.parse(meeting)
      expect(parsed.topic).toBe('New Therapy Session')
      expect(parsed.host_id).toBe('stub-host-001')
      expect(parsed.join_url).toContain('zoom.us')
      expect(parsed.settings?.auto_recording).toBe('cloud')

      // Verify it's retrievable
      const retrieved = await adapter.getMeeting(VALID_TOKEN, String(parsed.id))
      expect(retrieved.topic).toBe('New Therapy Session')
    })

    it('creates meeting without settings (settings undefined)', async () => {
      const minimalInput: CreateMeetingInput = {
        topic: 'Minimal Meeting',
        type: 2,
      }
      const meeting = await adapter.createMeeting(VALID_TOKEN, minimalInput)
      const parsed = zoomMeetingSchema.parse(meeting)
      expect(parsed.topic).toBe('Minimal Meeting')
      expect(parsed.settings).toBeUndefined()
    })

    it('increments id counter across multiple creates', async () => {
      const m1 = await adapter.createMeeting(VALID_TOKEN, {
        topic: 'Meeting A',
        type: 2,
      })
      const m2 = await adapter.createMeeting(VALID_TOKEN, {
        topic: 'Meeting B',
        type: 2,
      })
      expect(m2.id).toBeGreaterThan(m1.id)
    })

    it('new meeting appears in listMeetings', async () => {
      const before = await adapter.listMeetings(VALID_TOKEN)
      await adapter.createMeeting(VALID_TOKEN, baseMeetingInput)
      const after = await adapter.listMeetings(VALID_TOKEN)
      expect(after.data.length).toBe(before.data.length + 1)
    })
  })

  // -------------------------------------------------------------------------
  // updateMeeting
  // -------------------------------------------------------------------------

  describe('updateMeeting', () => {
    it('updates topic of an existing meeting', async () => {
      await adapter.updateMeeting(VALID_TOKEN, SEEDED_MEETING_ID_1, {
        topic: 'Updated Topic',
      })
      const meeting = await adapter.getMeeting(VALID_TOKEN, SEEDED_MEETING_ID_1)
      expect(meeting.topic).toBe('Updated Topic')
    })

    it('updates duration and timezone', async () => {
      await adapter.updateMeeting(VALID_TOKEN, SEEDED_MEETING_ID_1, {
        duration: 90,
        timezone: 'Europe/London',
      })
      const meeting = await adapter.getMeeting(VALID_TOKEN, SEEDED_MEETING_ID_1)
      expect(meeting.duration).toBe(90)
      expect(meeting.timezone).toBe('Europe/London')
    })

    it('updates settings', async () => {
      await adapter.updateMeeting(VALID_TOKEN, SEEDED_MEETING_ID_1, {
        settings: {
          host_video: false,
          participant_video: true,
          join_before_host: true,
          mute_upon_entry: false,
          waiting_room: false,
          auto_recording: 'none',
        },
      })
      const meeting = await adapter.getMeeting(VALID_TOKEN, SEEDED_MEETING_ID_1)
      expect(meeting.settings?.host_video).toBe(false)
      expect(meeting.settings?.waiting_room).toBe(false)
      expect(meeting.settings?.auto_recording).toBe('none')
    })

    it('preserves unmodified fields', async () => {
      const original = await adapter.getMeeting(VALID_TOKEN, SEEDED_MEETING_ID_1)
      await adapter.updateMeeting(VALID_TOKEN, SEEDED_MEETING_ID_1, {
        topic: 'Changed',
      })
      const updated = await adapter.getMeeting(VALID_TOKEN, SEEDED_MEETING_ID_1)
      expect(updated.topic).toBe('Changed')
      expect(updated.duration).toBe(original.duration)
      expect(updated.host_id).toBe(original.host_id)
    })

    it('throws for unknown meeting ID', async () => {
      await expect(
        adapter.updateMeeting(VALID_TOKEN, '999999999', { topic: 'X' }),
      ).rejects.toThrow('meeting not found')
    })
  })

  // -------------------------------------------------------------------------
  // deleteMeeting
  // -------------------------------------------------------------------------

  describe('deleteMeeting', () => {
    it('deletes an existing meeting', async () => {
      await adapter.deleteMeeting(VALID_TOKEN, SEEDED_MEETING_ID_1)
      await expect(
        adapter.getMeeting(VALID_TOKEN, SEEDED_MEETING_ID_1),
      ).rejects.toThrow('meeting not found')
    })

    it('removes meeting from listMeetings', async () => {
      const before = await adapter.listMeetings(VALID_TOKEN)
      await adapter.deleteMeeting(VALID_TOKEN, SEEDED_MEETING_ID_2)
      const after = await adapter.listMeetings(VALID_TOKEN)
      expect(after.data.length).toBe(before.data.length - 1)
    })

    it('throws for unknown meeting ID', async () => {
      await expect(
        adapter.deleteMeeting(VALID_TOKEN, '999999999'),
      ).rejects.toThrow('meeting not found')
    })
  })

  // -------------------------------------------------------------------------
  // listRecordings
  // -------------------------------------------------------------------------

  describe('listRecordings', () => {
    it('returns seeded recordings (1)', async () => {
      const result = await adapter.listRecordings(VALID_TOKEN)
      expect(result.data).toHaveLength(1)
      expect(result.pagination.count).toBe(1)
      const parsed = zoomRecordingSchema.parse(result.data[0])
      expect(parsed.id).toBe('stub-recording-001')
      expect(parsed.topic).toBe('Therapy Session - Initial Consultation')
    })

    it('filters by from date', async () => {
      const result = await adapter.listRecordings(VALID_TOKEN, {
        from: '2025-06-16T00:00:00.000Z',
      })
      expect(result.data).toHaveLength(0)
    })

    it('includes recordings before from boundary', async () => {
      const result = await adapter.listRecordings(VALID_TOKEN, {
        from: '2025-06-01T00:00:00.000Z',
      })
      expect(result.data).toHaveLength(1)
    })

    it('filters by to date', async () => {
      const result = await adapter.listRecordings(VALID_TOKEN, {
        to: '2025-06-01T00:00:00.000Z',
      })
      expect(result.data).toHaveLength(0)
    })

    it('includes recordings before to boundary', async () => {
      const result = await adapter.listRecordings(VALID_TOKEN, {
        to: '2025-06-30T00:00:00.000Z',
      })
      expect(result.data).toHaveLength(1)
    })

    it('combines from and to filters', async () => {
      const result = await adapter.listRecordings(VALID_TOKEN, {
        from: '2025-06-01T00:00:00.000Z',
        to: '2025-06-30T00:00:00.000Z',
      })
      expect(result.data).toHaveLength(1)
    })

    it('returns all when no params', async () => {
      const result = await adapter.listRecordings(VALID_TOKEN, undefined)
      expect(result.data.length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // Schema validation — all seeded data must pass Zod
  // -------------------------------------------------------------------------

  describe('schema validation of seeded data', () => {
    it('getCurrentUser passes zoomUserSchema', async () => {
      const user = await adapter.getCurrentUser(VALID_TOKEN)
      expect(() => zoomUserSchema.parse(user)).not.toThrow()
    })

    it('listMeetings passes zoomMeetingSchema', async () => {
      const result = await adapter.listMeetings(VALID_TOKEN)
      for (const m of result.data) {
        expect(() => zoomMeetingSchema.parse(m)).not.toThrow()
      }
    })

    it('getMeeting passes zoomMeetingSchema', async () => {
      const meeting = await adapter.getMeeting(VALID_TOKEN, SEEDED_MEETING_ID_1)
      expect(() => zoomMeetingSchema.parse(meeting)).not.toThrow()
    })

    it('listRecordings passes zoomRecordingSchema', async () => {
      const result = await adapter.listRecordings(VALID_TOKEN)
      for (const r of result.data) {
        expect(() => zoomRecordingSchema.parse(r)).not.toThrow()
      }
    })
  })
})
