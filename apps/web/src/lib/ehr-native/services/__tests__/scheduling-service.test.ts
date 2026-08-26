/**
 * Tests for EHR Native Scheduling Service (F1.9)
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAppointmentRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  findByPatient: vi.fn(),
  findByPractitioner: vi.fn(),
  findUpcomingByPractitioner: vi.fn(),
  findByDateRange: vi.fn(),
  findByStatus: vi.fn(),
}

const mockPatientRepo = {
  findById: vi.fn(),
}

const mockEncounterRepo = {
  findById: vi.fn(),
}

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/ehr-native/repositories/appointment-repository', () => ({
  AppointmentRepository: class MockAppointmentRepository {
    create = mockAppointmentRepo.create
    findById = mockAppointmentRepo.findById
    update = mockAppointmentRepo.update
    findByPatient = mockAppointmentRepo.findByPatient
    findByPractitioner = mockAppointmentRepo.findByPractitioner
    findUpcomingByPractitioner = mockAppointmentRepo.findUpcomingByPractitioner
    findByDateRange = mockAppointmentRepo.findByDateRange
    findByStatus = mockAppointmentRepo.findByStatus
  },
}))

vi.mock('@/lib/ehr-native/repositories/patient-repository', () => ({
  PatientRepository: class MockPatientRepository {
    findById = mockPatientRepo.findById
  },
}))

vi.mock('@/lib/ehr-native/repositories/encounter-repository', () => ({
  EncounterRepository: class MockEncounterRepository {
    findById = mockEncounterRepo.findById
  },
}))

const { SchedulingService } = await import('../scheduling-service')

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const rlsContext: RLSContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  role: 'physician',
  breakGlass: false,
}

const validAppointmentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const validPatientId = 'ffffffff-1111-2222-3333-444444444444'

const validAppointment = {
  resourceType: 'Appointment' as const,
  status: 'booked' as const,
  serviceType: [
    {
      coding: [
        {
          system: 'http://hl7.org/fhir/ValueSet/service-type',
          code: 'therapy',
        },
      ],
    },
  ],
  start: '2026-01-15T10:00:00Z',
  end: '2026-01-15T11:00:00Z',
  participant: [
    {
      actor: { reference: `Patient/${validPatientId}` },
      status: 'accepted' as const,
    },
    {
      actor: { reference: 'Practitioner/provider-001' },
      status: 'accepted' as const,
    },
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SchedulingService', () => {
  let service: InstanceType<typeof SchedulingService>

  beforeEach(() => {
    vi.clearAllMocks()
    service = new SchedulingService(rlsContext)
  })

  describe('createAppointment', () => {
    it('creates an appointment through the repository', async () => {
      mockAppointmentRepo.create.mockResolvedValue(validAppointment)
      const result = await service.createAppointment({
        fhirResource: validAppointment,
      })
      expect(result).toEqual(validAppointment)
      expect(mockAppointmentRepo.create).toHaveBeenCalledWith(validAppointment)
    })
  })

  describe('getAppointment', () => {
    it('returns the appointment when found', async () => {
      mockAppointmentRepo.findById.mockResolvedValue(validAppointment)
      const result = await service.getAppointment(validAppointmentId)
      expect(result).toEqual(validAppointment)
    })

    it('returns null when appointment not found', async () => {
      mockAppointmentRepo.findById.mockResolvedValue(null)
      const result = await service.getAppointment(validAppointmentId)
      expect(result).toBeNull()
    })

    it('throws on invalid appointment ID', async () => {
      await expect(service.getAppointment('not-a-uuid')).rejects.toThrow()
    })
  })

  describe('cancelAppointment', () => {
    it('cancels an appointment with reason', async () => {
      const cancelled = {
        ...validAppointment,
        status: 'cancelled' as const,
        cancelationReason: 'Patient request',
      }
      mockAppointmentRepo.findById.mockResolvedValue(validAppointment)
      mockAppointmentRepo.update.mockResolvedValue(cancelled)
      const result = await service.cancelAppointment(
        validAppointmentId,
        'Patient request',
      )
      expect(result?.status).toBe('cancelled')
    })
  })

  describe('rescheduleAppointment', () => {
    it('reschedules an appointment to new times', async () => {
      const rescheduled = {
        ...validAppointment,
        start: '2026-01-20T14:00:00Z',
        end: '2026-01-20T15:00:00Z',
      }
      mockAppointmentRepo.findById.mockResolvedValue(validAppointment)
      mockAppointmentRepo.update.mockResolvedValue(rescheduled)
      const result = await service.rescheduleAppointment(
        validAppointmentId,
        '2026-01-20T14:00:00Z',
        '2026-01-20T15:00:00Z',
      )
      expect(result?.start).toBe('2026-01-20T14:00:00Z')
    })
  })

  describe('checkInAppointment', () => {
    it('checks in a booked appointment', async () => {
      const checkedIn = { ...validAppointment, status: 'checked-in' as const }
      mockAppointmentRepo.findById.mockResolvedValue(validAppointment)
      mockAppointmentRepo.update.mockResolvedValue(checkedIn)
      const result = await service.checkInAppointment(validAppointmentId)
      expect(result?.status).toBe('checked-in')
      expect(mockAppointmentRepo.update).toHaveBeenCalledWith(
        validAppointmentId,
        { status: 'checked-in' },
      )
    })
  })

  describe('completeAppointment', () => {
    it('completes a checked-in appointment', async () => {
      const completed = { ...validAppointment, status: 'fulfilled' as const }
      mockAppointmentRepo.update.mockResolvedValue(completed)
      const result = await service.completeAppointment(validAppointmentId)
      expect(result?.status).toBe('fulfilled')
      expect(mockAppointmentRepo.update).toHaveBeenCalledWith(
        validAppointmentId,
        { status: 'fulfilled' },
      )
    })
  })

  describe('markNoShow', () => {
    it('marks a booked appointment as no-show', async () => {
      const noShow = { ...validAppointment, status: 'no-show' as const }
      mockAppointmentRepo.findById.mockResolvedValue(validAppointment)
      mockAppointmentRepo.update.mockResolvedValue(noShow)
      const result = await service.markNoShow(validAppointmentId)
      expect(result?.status).toBe('no-show')
      expect(mockAppointmentRepo.update).toHaveBeenCalledWith(
        validAppointmentId,
        { status: 'no-show' },
      )
    })
  })

  describe('getPatientAppointments', () => {
    it('returns appointments for a valid patient', async () => {
      mockAppointmentRepo.findByPatient.mockResolvedValue([validAppointment])
      const result = await service.getPatientAppointments(validPatientId, {
        limit: 10,
        offset: 0,
      })
      expect(result).toEqual([validAppointment])
    })
  })

  describe('getPractitionerSchedule', () => {
    it('returns appointments for a practitioner (non-upcoming)', async () => {
      mockAppointmentRepo.findByPractitioner.mockResolvedValue([
        validAppointment,
      ])
      const result = await service.getPractitionerSchedule(validAppointmentId, {
        upcomingOnly: false,
        limit: 20,
        offset: 0,
      })
      expect(result).toEqual([validAppointment])
    })

    it('returns upcoming appointments for a practitioner', async () => {
      mockAppointmentRepo.findUpcomingByPractitioner.mockResolvedValue([
        validAppointment,
      ])
      const result = await service.getPractitionerSchedule(validAppointmentId, {
        upcomingOnly: true,
        limit: 20,
        offset: 0,
      })
      expect(result).toEqual([validAppointment])
    })
  })

  describe('getAppointmentsByDateRange', () => {
    it('returns appointments within the date range', async () => {
      mockAppointmentRepo.findByDateRange.mockResolvedValue([validAppointment])
      const result = await service.getAppointmentsByDateRange({
        start: '2026-01-01T00:00:00Z',
        end: '2026-01-31T23:59:59Z',
        limit: 50,
        offset: 0,
      })
      expect(result).toEqual([validAppointment])
    })

    it('throws when end date is before start date', async () => {
      await expect(
        service.getAppointmentsByDateRange({
          start: '2026-01-31T00:00:00Z',
          end: '2026-01-01T00:00:00Z',
          limit: 50,
          offset: 0,
        }),
      ).rejects.toThrow()
    })
  })

  describe('getAppointmentsByStatus', () => {
    it('returns appointments filtered by status', async () => {
      mockAppointmentRepo.findByStatus.mockResolvedValue([validAppointment])
      const result = await service.getAppointmentsByStatus('booked', {
        limit: 50,
        offset: 0,
      })
      expect(result).toEqual([validAppointment])
    })
  })

  describe('checkSchedulingConflict', () => {
    it('returns conflicting appointments when overlaps exist', async () => {
      mockAppointmentRepo.findByPatient.mockResolvedValue([validAppointment])
      const result = await service.checkSchedulingConflict(
        validPatientId,
        '2026-01-15T09:00:00Z',
        '2026-01-15T12:00:00Z',
      )
      expect(Array.isArray(result)).toBe(true)
    })

    it('returns empty array when no overlaps', async () => {
      mockAppointmentRepo.findByPatient.mockResolvedValue([])
      const result = await service.checkSchedulingConflict(
        validPatientId,
        '2026-01-15T09:00:00Z',
        '2026-01-15T12:00:00Z',
      )
      expect(result).toEqual([])
    })
  })
})
