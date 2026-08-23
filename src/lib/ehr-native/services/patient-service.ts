/**
 * EHR Native — Patient Service (F1.7)
 *
 * Domain service for patient chart management.
 * Orchestrates PatientRepository with EncounterRepository,
 * AppointmentRepository, and ObservationRepository to provide
 * a unified chart view and patient lifecycle operations.
 *
 * All operations enforce RLS via the injected RLSContext.
 * No singleton — RLS context varies per request.
 *
 * @see repositories/ for data access layer
 * @see types/ for FHIR R4 type definitions
 */

import type { Patient, Encounter, Appointment, Observation } from '../types'
import {
  type RLSContext,
  PatientRepository,
  EncounterRepository,
  AppointmentRepository,
  ObservationRepository,
} from '../repositories'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PatientChart {
  /** The patient resource, or null if not found. */
  readonly patient: Patient | null
  /** Recent encounters for the patient. */
  readonly encounters: Encounter[]
  /** Upcoming and recent appointments for the patient. */
  readonly appointments: Appointment[]
  /** Recent clinical observations for the patient. */
  readonly observations: Observation[]
}

export interface PatientChartSummary {
  /** The patient resource, or null if not found. */
  readonly patient: Patient | null
  /** Total number of encounters on record. */
  readonly encounterCount: number
  /** Total number of appointments on record. */
  readonly appointmentCount: number
  /** Total number of observations on record. */
  readonly observationCount: number
}

export interface PatientSearchParams {
  /** Partial name to search (family or given), case-insensitive. */
  readonly nameQuery?: string
  /** Filter by active status. Defaults to true. */
  readonly activeOnly?: boolean
  /** Maximum results to return. Defaults to 20. */
  readonly limit?: number
  /** Pagination offset. Defaults to 0. */
  readonly offset?: number
}

export interface CreatePatientInput {
  /** The FHIR Patient resource to create. */
  readonly fhirResource: unknown
}

export interface UpdatePatientInput {
  /** Partial FHIR Patient fields to merge with the existing record. */
  readonly fhirResource: Partial<Patient>
}

// ---------------------------------------------------------------------------
// Patient Service
// ---------------------------------------------------------------------------

export class PatientService {
  private readonly patientRepo: PatientRepository
  private readonly encounterRepo: EncounterRepository
  private readonly appointmentRepo: AppointmentRepository
  private readonly observationRepo: ObservationRepository

  /**
   * @param rlsContext - RLS context for tenant isolation and consent enforcement
   */
  constructor(rlsContext: RLSContext) {
    this.patientRepo = new PatientRepository(rlsContext)
    this.encounterRepo = new EncounterRepository(rlsContext)
    this.appointmentRepo = new AppointmentRepository(rlsContext)
    this.observationRepo = new ObservationRepository(rlsContext)
  }

  /**
   * Creates a new patient record with FHIR resource validation.
   *
   * @param input - Contains the FHIR Patient resource to create
   * @returns The created Patient resource
   */
  async createPatient(input: CreatePatientInput): Promise<Patient> {
    return this.patientRepo.create(input.fhirResource)
  }

  /**
   * Retrieves a patient by their UUID.
   *
   * @param patientId - UUID of the patient
   * @returns The Patient resource, or null if not found
   */
  async getPatient(patientId: string): Promise<Patient | null> {
    return this.patientRepo.findById(patientId)
  }

  /**
   * Retrieves a patient by their Medical Record Number (MRN).
   *
   * @param mrn - Medical Record Number to search for
   * @returns The Patient resource, or null if not found
   */
  async getPatientByMRN(mrn: string): Promise<Patient | null> {
    return this.patientRepo.findByMRN(mrn)
  }

  /**
   * Updates an existing patient's demographics.
   *
   * @param patientId - UUID of the patient to update
   * @param input - Partial FHIR Patient fields to merge
   * @returns The updated Patient resource, or null if not found
   */
  async updatePatient(
    patientId: string,
    input: UpdatePatientInput,
  ): Promise<Patient | null> {
    return this.patientRepo.update(patientId, input.fhirResource)
  }

  /**
   * Searches for patients by name or lists active patients.
   *
   * @param params - Search parameters (nameQuery, activeOnly, limit, offset)
   * @returns Array of matching Patient resources
   */
  async searchPatients(params: PatientSearchParams = {}): Promise<Patient[]> {
    const {
      nameQuery,
      activeOnly = true,
      limit = 20,
      offset = 0,
    } = params

    if (nameQuery) {
      if (nameQuery.length > 200) {
        throw new Error('nameQuery exceeds maximum length of 200 characters')
      }
      const results = await this.patientRepo.searchByName(
        nameQuery,
        limit,
        offset,
      )
      return activeOnly
        ? results.filter((p) => p.active === true)
        : results
    }

    if (activeOnly) {
      return this.patientRepo.findActive(limit, offset)
    }

    return this.patientRepo.searchByName('', limit, offset)
  }

  /**
   * Deactivates a patient by setting active = false.
   * This is a soft delete — the record remains for audit purposes.
   *
   * @param patientId - UUID of the patient to deactivate
   * @returns The updated (inactive) Patient resource, or null if not found
   */
  async deactivatePatient(patientId: string): Promise<Patient | null> {
    return this.patientRepo.update(patientId, { active: false })
  }

  /**
   * Retrieves the complete patient chart: demographics, encounters,
   * appointments, and observations in a single call.
   *
   * @param patientId - UUID of the patient
   * @param resourceLimit - Maximum number of each resource type to return. Defaults to 50.
   * @returns A PatientChart containing the patient and related resources
   */
  async getPatientChart(
    patientId: string,
    resourceLimit = 50,
  ): Promise<PatientChart> {
    const [patient, encounters, appointments, observations] =
      await Promise.all([
        this.patientRepo.findById(patientId),
        this.encounterRepo.findByPatient(patientId, resourceLimit),
        this.appointmentRepo.findByPatient(patientId, resourceLimit),
        this.observationRepo.findByPatient(patientId, resourceLimit),
      ])

    return { patient, encounters, appointments, observations }
  }

  /**
   * Retrieves a summary of the patient chart with resource counts.
   * Useful for dashboard views and quick patient overviews.
   *
   * @param patientId - UUID of the patient
   * @returns A summary with the patient and counts of each resource type
   */
  async getPatientChartSummary(
    patientId: string,
  ): Promise<PatientChartSummary> {
    const [patient, encounterCount, appointmentCount, observationCount] =
      await Promise.all([
        this.patientRepo.findById(patientId),
        this.encounterRepo.countByPatient(patientId),
        this.appointmentRepo.countByPatient(patientId),
        this.observationRepo.countByPatient(patientId),
      ])

    return {
      patient,
      encounterCount,
      appointmentCount,
      observationCount,
    }
  }

  /**
   * Lists encounters for a patient, paginated.
   *
   * @param patientId - UUID of the patient
   * @param limit - Maximum results. Defaults to 50.
   * @param offset - Pagination offset. Defaults to 0.
   * @returns Array of Encounter resources
   */
  async getPatientEncounters(
    patientId: string,
    limit = 50,
    offset = 0,
  ): Promise<Encounter[]> {
    return this.encounterRepo.findByPatient(patientId, limit, offset)
  }

  /**
   * Lists appointments for a patient, paginated and ordered by most recent first.
   *
   * @param patientId - UUID of the patient
   * @param limit - Maximum results. Defaults to 50.
   * @param offset - Pagination offset. Defaults to 0.
   * @returns Array of Appointment resources
   */
  async getPatientAppointments(
    patientId: string,
    limit = 50,
    offset = 0,
  ): Promise<Appointment[]> {
    return this.appointmentRepo.findByPatient(patientId, limit, offset)
  }

  /**
   * Lists clinical observations for a patient, paginated.
   *
   * @param patientId - UUID of the patient
   * @param limit - Maximum results. Defaults to 50.
   * @param offset - Pagination offset. Defaults to 0.
   * @returns Array of Observation resources
   */
  async getPatientObservations(
    patientId: string,
    limit = 50,
    offset = 0,
  ): Promise<Observation[]> {
    return this.observationRepo.findByPatient(patientId, limit, offset)
  }

  /**
   * Creates a new encounter for a patient.
   *
   * @param patientId - UUID of the patient this encounter belongs to
   * @param encounter - The FHIR Encounter resource to create
   * @returns The created Encounter resource
   */
  async createEncounter(
    patientId: string,
    encounter: unknown,
  ): Promise<Encounter> {
    const resource = encounter as Record<string, unknown>
    const subjectRef = (
      resource.subject as { reference?: string } | undefined
    )?.reference
    if (
      !subjectRef ||
      subjectRef.replace('Patient/', '') !== patientId
    ) {
      throw new Error(
        'Encounter subject.reference does not match the provided patientId',
      )
    }
    return this.encounterRepo.create(encounter)
  }

  /**
   * Creates a new appointment for a patient.
   *
   * @param patientId - UUID of the patient this appointment belongs to
   * @param appointment - The FHIR Appointment resource to create
   * @returns The created Appointment resource
   */
  async createAppointment(
    patientId: string,
    appointment: unknown,
  ): Promise<Appointment> {
    const resource = appointment as Record<string, unknown>
    const participants = resource.participant as
      | Array<{ actor?: { reference?: string } }>
      | undefined
    const patientRef = participants?.find((p) =>
      p.actor?.reference?.startsWith('Patient/'),
    )?.actor?.reference
    if (
      !patientRef ||
      patientRef.replace('Patient/', '') !== patientId
    ) {
      throw new Error(
        'Appointment participant patient reference does not match the provided patientId',
      )
    }
    return this.appointmentRepo.create(appointment)
  }

  /**
   * Creates a new clinical observation for a patient.
   *
   * @param patientId - UUID of the patient this observation belongs to
   * @param observation - The FHIR Observation resource to create
   * @returns The created Observation resource
   */
  async createObservation(
    patientId: string,
    observation: unknown,
  ): Promise<Observation> {
    const resource = observation as Record<string, unknown>
    const subjectRef = (
      resource.subject as { reference?: string } | undefined
    )?.reference
    if (
      !subjectRef ||
      subjectRef.replace('Patient/', '') !== patientId
    ) {
      throw new Error(
        'Observation subject.reference does not match the provided patientId',
      )
    }
    return this.observationRepo.create(observation)
  }
}
