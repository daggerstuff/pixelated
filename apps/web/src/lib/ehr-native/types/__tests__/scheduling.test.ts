import { describe, it, expect } from 'vitest'

import {
  appointmentSchema,
  appointmentResponseSchema,
  scheduleSchema,
  slotSchema,
} from '../index.js'

// ---------------------------------------------------------------------------
// Appointment
// ---------------------------------------------------------------------------

describe('appointmentSchema', () => {
  it('validates a minimal appointment with status and one participant', () => {
    const result = appointmentSchema.parse({
      resourceType: 'Appointment',
      status: 'booked',
      participant: [{ status: 'accepted' }],
    })
    expect(result.status).toBe('booked')
  })
  it('validates a complete appointment resource', () => {
    const result = appointmentSchema.parse({
      resourceType: 'Appointment',
      id: 'appt-1',
      status: 'booked',
      serviceCategory: [{ text: 'General Practice' }],
      serviceType: [{ text: 'Consultation' }],
      specialty: [{ text: 'Cardiology' }],
      appointmentType: { text: 'Routine' },
      priority: 1,
      description: 'Annual checkup',
      start: '2024-01-15T10:00:00Z',
      end: '2024-01-15T10:30:00Z',
      minutesDuration: 30,
      created: '2024-01-01',
      participant: [
        {
          actor: { reference: 'Patient/123' },
          status: 'accepted',
          required: 'required',
        },
        {
          actor: { reference: 'Practitioner/456' },
          status: 'accepted',
        },
      ],
    })
    expect(result.participant?.length).toBe(2)
  })
  it('rejects missing status', () => {
    expect(
      appointmentSchema.safeParse({
        resourceType: 'Appointment',
        participant: [{ status: 'accepted' }],
      }).success,
    ).toBe(false)
  })
  it('rejects missing participant array', () => {
    expect(
      appointmentSchema.safeParse({
        resourceType: 'Appointment',
        status: 'booked',
      }).success,
    ).toBe(false)
  })
  it('rejects empty participant array (min 1)', () => {
    expect(
      appointmentSchema.safeParse({
        resourceType: 'Appointment',
        status: 'booked',
        participant: [],
      }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      appointmentSchema.safeParse({
        resourceType: 'Patient',
        status: 'booked',
        participant: [{ status: 'accepted' }],
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      appointmentSchema.safeParse({
        resourceType: 'Appointment',
        status: 'invalid',
        participant: [{ status: 'accepted' }],
      }).success,
    ).toBe(false)
  })
  it('rejects participant with missing status', () => {
    expect(
      appointmentSchema.safeParse({
        resourceType: 'Appointment',
        status: 'booked',
        participant: [{}],
      }).success,
    ).toBe(false)
  })
  it('validates all status enum values', () => {
    for (const status of [
      'proposed',
      'booked',
      'arrived',
      'fulfilled',
      'cancelled',
      'noshow',
      'entered-in-error',
      'checked-in',
      'waitlist',
    ]) {
      expect(
        appointmentSchema.safeParse({
          resourceType: 'Appointment',
          status,
          participant: [{ status: 'accepted' }],
        }).success,
      ).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// AppointmentResponse
// ---------------------------------------------------------------------------

describe('appointmentResponseSchema', () => {
  it('validates a minimal appointmentResponse with appointment and participantStatus', () => {
    const result = appointmentResponseSchema.parse({
      resourceType: 'AppointmentResponse',
      appointment: { reference: 'Appointment/123' },
      participantStatus: 'accepted',
    })
    expect(result.participantStatus).toBe('accepted')
  })
  it('validates a complete appointmentResponse resource', () => {
    const result = appointmentResponseSchema.parse({
      resourceType: 'AppointmentResponse',
      id: 'appt-resp-1',
      appointment: { reference: 'Appointment/123' },
      start: '2024-01-15T10:00:00Z',
      end: '2024-01-15T10:30:00Z',
      actor: { reference: 'Patient/456' },
      participantStatus: 'accepted',
      comment: 'Will attend',
    })
    expect(result.appointment?.reference).toBe('Appointment/123')
  })
  it('rejects missing appointment', () => {
    expect(
      appointmentResponseSchema.safeParse({
        resourceType: 'AppointmentResponse',
        participantStatus: 'accepted',
      }).success,
    ).toBe(false)
  })
  it('rejects missing participantStatus', () => {
    expect(
      appointmentResponseSchema.safeParse({
        resourceType: 'AppointmentResponse',
        appointment: { reference: 'Appointment/123' },
      }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      appointmentResponseSchema.safeParse({
        resourceType: 'Patient',
        appointment: { reference: 'Appointment/123' },
        participantStatus: 'accepted',
      }).success,
    ).toBe(false)
  })
  it('rejects invalid participantStatus enum', () => {
    expect(
      appointmentResponseSchema.safeParse({
        resourceType: 'AppointmentResponse',
        appointment: { reference: 'Appointment/123' },
        participantStatus: 'invalid',
      }).success,
    ).toBe(false)
  })
  it('validates all participantStatus enum values', () => {
    for (const participantStatus of [
      'accepted',
      'declined',
      'tentative',
      'needs-action',
    ]) {
      expect(
        appointmentResponseSchema.safeParse({
          resourceType: 'AppointmentResponse',
          appointment: { reference: 'Appointment/123' },
          participantStatus,
        }).success,
      ).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

describe('scheduleSchema', () => {
  it('validates a minimal schedule with one actor', () => {
    const result = scheduleSchema.parse({
      resourceType: 'Schedule',
      actor: [{ reference: 'Practitioner/123' }],
    })
    expect(result.actor?.length).toBe(1)
  })
  it('validates a complete schedule resource', () => {
    const result = scheduleSchema.parse({
      resourceType: 'Schedule',
      id: 'schedule-1',
      active: true,
      serviceCategory: [{ text: 'General' }],
      serviceType: [{ text: 'Consultation' }],
      specialty: [{ text: 'Cardiology' }],
      actor: [{ reference: 'Practitioner/123' }, { reference: 'Location/456' }],
      planningHorizon: { start: '2024-01-01', end: '2024-12-31' },
      comment: 'Regular schedule',
    })
    expect(result.active).toBe(true)
  })
  it('rejects missing actor array', () => {
    expect(scheduleSchema.safeParse({ resourceType: 'Schedule' }).success).toBe(
      false,
    )
  })
  it('rejects empty actor array (min 1)', () => {
    expect(
      scheduleSchema.safeParse({
        resourceType: 'Schedule',
        actor: [],
      }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      scheduleSchema.safeParse({
        resourceType: 'Patient',
        actor: [{ reference: 'Practitioner/123' }],
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Slot
// ---------------------------------------------------------------------------

describe('slotSchema', () => {
  it('validates a minimal slot with schedule, status, start, end', () => {
    const result = slotSchema.parse({
      resourceType: 'Slot',
      schedule: { reference: 'Schedule/123' },
      status: 'busy',
      start: '2024-01-15T10:00:00Z',
      end: '2024-01-15T10:30:00Z',
    })
    expect(result.status).toBe('busy')
  })
  it('validates a complete slot resource', () => {
    const result = slotSchema.parse({
      resourceType: 'Slot',
      id: 'slot-1',
      schedule: { reference: 'Schedule/123' },
      status: 'free',
      start: '2024-01-15T10:00:00Z',
      end: '2024-01-15T10:30:00Z',
      comment: 'Available slot',
      appointmentType: { text: 'Routine' },
      serviceCategory: [{ text: 'General' }],
      serviceType: [{ text: 'Consultation' }],
      specialty: [{ text: 'Cardiology' }],
    })
    expect(result.status).toBe('free')
  })
  it('rejects missing schedule', () => {
    expect(
      slotSchema.safeParse({
        resourceType: 'Slot',
        status: 'busy',
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T10:30:00Z',
      }).success,
    ).toBe(false)
  })
  it('rejects missing status', () => {
    expect(
      slotSchema.safeParse({
        resourceType: 'Slot',
        schedule: { reference: 'Schedule/123' },
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T10:30:00Z',
      }).success,
    ).toBe(false)
  })
  it('rejects missing start', () => {
    expect(
      slotSchema.safeParse({
        resourceType: 'Slot',
        schedule: { reference: 'Schedule/123' },
        status: 'busy',
        end: '2024-01-15T10:30:00Z',
      }).success,
    ).toBe(false)
  })
  it('rejects missing end', () => {
    expect(
      slotSchema.safeParse({
        resourceType: 'Slot',
        schedule: { reference: 'Schedule/123' },
        status: 'busy',
        start: '2024-01-15T10:00:00Z',
      }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      slotSchema.safeParse({
        resourceType: 'Patient',
        schedule: { reference: 'Schedule/123' },
        status: 'busy',
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T10:30:00Z',
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      slotSchema.safeParse({
        resourceType: 'Slot',
        schedule: { reference: 'Schedule/123' },
        status: 'invalid',
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T10:30:00Z',
      }).success,
    ).toBe(false)
  })
  it('rejects start without timezone (instant requires TZ)', () => {
    expect(
      slotSchema.safeParse({
        resourceType: 'Slot',
        schedule: { reference: 'Schedule/123' },
        status: 'busy',
        start: '2024-01-15T10:00:00',
        end: '2024-01-15T10:30:00Z',
      }).success,
    ).toBe(false)
  })
  it('validates all status enum values', () => {
    for (const status of [
      'busy',
      'free',
      'busy-unavailable',
      'busy-tentative',
      'entered-in-error',
    ]) {
      expect(
        slotSchema.safeParse({
          resourceType: 'Slot',
          schedule: { reference: 'Schedule/123' },
          status,
          start: '2024-01-15T10:00:00Z',
          end: '2024-01-15T10:30:00Z',
        }).success,
      ).toBe(true)
    }
  })
})
