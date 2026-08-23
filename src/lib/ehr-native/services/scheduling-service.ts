/**
 * EHR Native — Scheduling Service (F1.9)
 *
 * Domain service for appointment scheduling and management.
 * Orchestrates AppointmentRepository with PatientRepository and
 * EncounterRepository to provide scheduling operations including
 * booking, rescheduling, cancellation, check-in, and conflict detection.
 *
 * All operations enforce RLS via the injected RLSContext.
 * No singleton — RLS context varies per request.
 *
 * @see repositories/appointment-repository.ts for data access layer
 * @see types/appointment.ts for FHIR R4 Appointment type definition
 */

import {
  type RLSContext,
  AppointmentRepository,
  PatientRepository,
  EncounterRepository,
} from '../repositories'
import type { Appointment } from '../types'

// ---------------------------------------------------------------------------
// Input sanitization helpers
// ---------------------------------------------------------------------------

function validateId(id: string, label: string): string {
  const sanitized = id.trim()
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      sanitized,
    )
  ) {
    throw new Error(`Invalid ${label} format: expected UUID`)
  }
  return sanitized
}

function validateIsoTimestamp(timestamp: string, label: string): string {
  const trimmed = timestamp.trim()
  if (!Number.isNaN(Date.parse(trimmed))) {
    return trimmed
  }
  throw new Error(`Invalid ${label}: expected ISO 8601 timestamp`)
}

function sanitizeLimit(value: number, max = 100): number {
  return Math.max(1, Math.min(max, Math.floor(value)))
}

function sanitizeOffset(value: number): number {
  return Math.max(0, Math.floor(value))
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateAppointmentInput {
  /** The FHIR Appointment resource to create. */
  readonly fhirResource: unknown
}

export interface UpdateAppointmentInput {
  /** Partial FHIR Appointment fields to merge with the existing record. */
  readonly fhirResource: Partial<Appointment>
}

export interface ScheduleSearchParams {
  /** Maximum results to return. Defaults to 50. */
  readonly limit?: number
  /** Pagination offset. Defaults to 0. */
  readonly offset?: number
}

export interface DateRangeParams extends ScheduleSearchParams {
  /** Start of the date range (ISO 8601). */
  readonly start: string
  /** End of the date range (ISO 8601). */
  readonly end: string
}

export interface PractitionerScheduleParams extends ScheduleSearchParams {
  /** If true, only include upcoming appointments (start_time >= NOW()). */
  readonly upcomingOnly?: boolean
}

export interface ScheduleSummary {
  /** The practitioner ID this summary covers. */
  readonly practitionerId: string
  /** Total appointments for the date. */
  readonly totalAppointments: number
  /** Appointments by status. */
  readonly byStatus: Record<string, number>
  /** First appointment start time, or null if none. */
  readonly firstAppointment: string | null
  /** Last appointment end time, or null if none. */
  readonly lastAppointment: string | null
}

// ---------------------------------------------------------------------------
// Scheduling Service
// ---------------------------------------------------------------------------

export class SchedulingService {
  private readonly appointmentRepo: AppointmentRepository
  private readonly patientRepo: PatientRepository
  private readonly encounterRepo: EncounterRepository

  /**
   * @param rlsContext - RLS context for tenant isolation and consent enforcement
   */
  constructor(rlsContext: RLSContext) {
    this.appointmentRepo = new AppointmentRepository(rlsContext)
    this.patientRepo = new PatientRepository(rlsContext)
    this.encounterRepo = new EncounterRepository(rlsContext)
  }

  /**
   * Creates a new appointment record with FHIR resource validation.
   *
   * @param input - Contains the FHIR Appointment resource to create
   * @returns The created Appointment resource
   */
  async createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
    return this.appointmentRepo.create(input.fhirResource)
  }

  /**
   * Retrieves an appointment by its UUID.
   *
   * @param appointmentId - UUID of the appointment
   * @returns The Appointment resource, or null if not found
   */
  async getAppointment(appointmentId: string): Promise<Appointment | null> {
    return this.appointmentRepo.findById(
      validateId(appointmentId, 'appointment ID'),
    )
  }

  /**
   * Updates an existing appointment's FHIR resource.
   *
   * @param appointmentId - UUID of the appointment to update
   * @param input - Partial FHIR Appointment fields to merge
   * @returns The updated Appointment resource, or null if not found
   */
  async updateAppointment(
    appointmentId: string,
    input: UpdateAppointmentInput,
  ): Promise<Appointment | null> {
    return this.appointmentRepo.update(
      validateId(appointmentId, 'appointment ID'),
      input.fhirResource,
    )
  }

  /**
   * Cancels an appointment by setting status to 'cancelled'.
   *
   * @param appointmentId - UUID of the appointment to cancel
   * @param cancelationReason - Optional FHIR CodeableConcept for the cancellation reason
   * @returns The updated (cancelled) Appointment resource, or null if not found
   */
  async cancelAppointment(
    appointmentId: string,
    cancelationReason?: unknown,
  ): Promise<Appointment | null> {
    const update: Partial<Appointment> = { status: 'cancelled' }
    if (cancelationReason) {
      update.cancelationReason =
        cancelationReason as Appointment['cancelationReason']
    }
    return this.appointmentRepo.update(
      validateId(appointmentId, 'appointment ID'),
      update,
    )
  }

  /**
   * Reschedules an appointment by updating its start and end times.
   *
   * @param appointmentId - UUID of the appointment to reschedule
   * @param newStart - New start time (ISO 8601)
   * @param newEnd - New end time (ISO 8601)
   * @returns The updated Appointment resource, or null if not found
   */
  async rescheduleAppointment(
    appointmentId: string,
    newStart: string,
    newEnd: string,
  ): Promise<Appointment | null> {
    const start = validateIsoTimestamp(newStart, 'new start time')
    const end = validateIsoTimestamp(newEnd, 'new end time')
    if (Date.parse(end) <= Date.parse(start)) {
      throw new Error('End time must be after start time')
    }
    return this.appointmentRepo.update(
      validateId(appointmentId, 'appointment ID'),
      { start, end },
    )
  }

  /**
   * Checks in a patient for an appointment by setting status to 'checked-in'.
   *
   * @param appointmentId - UUID of the appointment
   * @returns The updated (checked-in) Appointment resource, or null if not found
   */
  async checkInAppointment(appointmentId: string): Promise<Appointment | null> {
    return this.appointmentRepo.update(
      validateId(appointmentId, 'appointment ID'),
      { status: 'checked-in' },
    )
  }

  /**
   * Marks an appointment as fulfilled (completed).
   *
   * @param appointmentId - UUID of the appointment
   * @returns The updated (fulfilled) Appointment resource, or null if not found
   */
  async completeAppointment(
    appointmentId: string,
  ): Promise<Appointment | null> {
    return this.appointmentRepo.update(
      validateId(appointmentId, 'appointment ID'),
      { status: 'fulfilled' },
    )
  }

  /**
   * Marks an appointment as a no-show.
   *
   * @param appointmentId - UUID of the appointment
   * @returns The updated (no-show) Appointment resource, or null if not found
   */
  async markNoShow(appointmentId: string): Promise<Appointment | null> {
    return this.appointmentRepo.update(
      validateId(appointmentId, 'appointment ID'),
      { status: 'no-show' },
    )
  }

  /**
   * Lists appointments for a specific patient, ordered by most recent first.
   *
   * @param patientId - UUID of the patient
   * @param params - Pagination parameters
   * @returns Array of Appointment resources
   */
  async getPatientAppointments(
    patientId: string,
    params: ScheduleSearchParams = {},
  ): Promise<Appointment[]> {
    const { limit = 50, offset = 0 } = params
    return this.appointmentRepo.findByPatient(
      validateId(patientId, 'patient ID'),
      sanitizeLimit(limit),
      sanitizeOffset(offset),
    )
  }

  /**
   * Lists appointments for a practitioner.
   *
   * When `upcomingOnly` is true (default), returns only appointments with
   * start_time >= NOW(), ordered by start_time ascending. Otherwise returns
   * all appointments for the practitioner.
   *
   * @param practitionerId - UUID of the practitioner
   * @param params - Filter and pagination parameters
   * @returns Array of Appointment resources
   */
  async getPractitionerSchedule(
    practitionerId: string,
    params: PractitionerScheduleParams = {},
  ): Promise<Appointment[]> {
    const { upcomingOnly = true, limit = 20, offset = 0 } = params
    const safeLimit = sanitizeLimit(limit)
    const safeOffset = sanitizeOffset(offset)

    if (upcomingOnly) {
      return this.appointmentRepo.findUpcomingByPractitioner(
        validateId(practitionerId, 'practitioner ID'),
        safeLimit,
        safeOffset,
      )
    }

    return this.appointmentRepo.findByPractitioner(
      validateId(practitionerId, 'practitioner ID'),
      safeLimit,
      safeOffset,
    )
  }

  /**
   * Finds appointments within a date range.
   *
   * @param params - Date range and pagination parameters
   * @returns Array of Appointment resources ordered by start_time ascending
   */
  async getAppointmentsByDateRange(
    params: DateRangeParams,
  ): Promise<Appointment[]> {
    const { start, end, limit = 50, offset = 0 } = params
    const safeStart = validateIsoTimestamp(start, 'start date')
    const safeEnd = validateIsoTimestamp(end, 'end date')
    if (Date.parse(safeEnd) <= Date.parse(safeStart)) {
      throw new Error('End date must be after start date')
    }
    return this.appointmentRepo.findByDateRange(
      safeStart,
      safeEnd,
      sanitizeLimit(limit),
      sanitizeOffset(offset),
    )
  }

  /**
   * Finds appointments by their current status.
   *
   * @param status - FHIR Appointment status value (e.g. 'booked', 'cancelled', 'fulfilled')
   * @param params - Pagination parameters
   * @returns Array of Appointment resources ordered by start_time ascending
   */
  async getAppointmentsByStatus(
    status: string,
    params: ScheduleSearchParams = {},
  ): Promise<Appointment[]> {
    const { limit = 50, offset = 0 } = params
    return this.appointmentRepo.findByStatus(
      status,
      sanitizeLimit(limit),
      sanitizeOffset(offset),
    )
  }

  /**
   * Checks for scheduling conflicts by finding overlapping appointments
   * for a patient within the given time range.
   *
   * Only returns appointments that are not cancelled, no-show, or fulfilled
   * (i.e., only active bookings that would conflict).
   *
   * @param patientId - UUID of the patient
   * @param start - Start of the time window (ISO 8601)
   * @param end - End of the time window (ISO 8601)
   * @returns Array of conflicting Appointment resources
   */
  async checkSchedulingConflict(
    patientId: string,
    start: string,
    end: string,
  ): Promise<Appointment[]> {
    const safePatientId = validateId(patientId, 'patient ID')
    const safeStart = validateIsoTimestamp(start, 'start time')
    const safeEnd = validateIsoTimestamp(end, 'end time')
    if (Date.parse(safeEnd) <= Date.parse(safeStart)) {
      throw new Error('End time must be after start time')
    }

    const appointments = await this.appointmentRepo.findByPatient(
      safePatientId,
      100,
      0,
    )

    const activeStatuses = [
      'proposed',
      'booked',
      'tentative',
      'needs-action',
      'arrived',
      'waitlist',
      'checked-in',
    ]

    const windowStart = Date.parse(safeStart)
    const windowEnd = Date.parse(safeEnd)

    return appointments.filter((appt) => {
      if (!activeStatuses.includes(appt.status)) return false
      if (!appt.start || !appt.end) return false
      const apptStart = Date.parse(appt.start)
      const apptEnd = Date.parse(appt.end)
      return apptStart < windowEnd && apptEnd > windowStart
    })
  }

  /**
   * Retrieves a schedule summary for a practitioner on a given date.
   *
   * @param practitionerId - UUID of the practitioner
   * @param date - The date to summarize (ISO 8601 date or date-time)
   * @returns A ScheduleSummary with counts and time bounds
   */
  async getScheduleSummary(
    practitionerId: string,
    date: string,
  ): Promise<ScheduleSummary> {
    const safePractitionerId = validateId(practitionerId, 'practitioner ID')
    const parsedDate = new Date(date.trim())
    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error('Invalid date: expected ISO 8601 date or date-time')
    }

    const dayStart = new Date(parsedDate)
    dayStart.setUTCHours(0, 0, 0, 0)
    const dayEnd = new Date(parsedDate)
    dayEnd.setUTCHours(23, 59, 59, 999)

    const dayStartStr = dayStart.toISOString()
    const dayEndStr = dayEnd.toISOString()

    const appointments =
      await this.appointmentRepo.findByDateRangeAndPractitioner(
        dayStartStr,
        dayEndStr,
        safePractitionerId,
        100,
        0,
      )

    const byStatus: Record<string, number> = {}
    let firstStart: number | null = null
    let lastEnd: number | null = null

    for (const appt of appointments) {
      byStatus[appt.status] = (byStatus[appt.status] ?? 0) + 1
      if (appt.start) {
        const s = Date.parse(appt.start)
        if (firstStart === null || s < firstStart) firstStart = s
      }
      if (appt.end) {
        const e = Date.parse(appt.end)
        if (lastEnd === null || e > lastEnd) lastEnd = e
      }
    }

    return {
      practitionerId: safePractitionerId,
      totalAppointments: appointments.length,
      byStatus,
      firstAppointment:
        firstStart !== null ? new Date(firstStart).toISOString() : null,
      lastAppointment:
        lastEnd !== null ? new Date(lastEnd).toISOString() : null,
    }
  }
}
