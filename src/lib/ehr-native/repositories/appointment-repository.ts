import { appointmentSchema, type Appointment } from '../types'
import { BaseRepository, type RLSContext } from './base-repository'

/**
 * Repository for EHR Appointment resources backed by the `ehr_appointment` table.
 *
 * The `ehr_appointment` table stores the full FHIR Appointment resource as JSONB
 * alongside denormalized columns (`patient_id`, `practitioner_id`, `status`,
 * `start_time`, `end_time`) for efficient scheduling queries.
 *
 * RLS: No consent check required (schedule management). Accessible to
 * physician, nurse, medicalAssistant, careCoordinator, frontDesk, and systemAdmin roles.
 */
export class AppointmentRepository extends BaseRepository<Appointment> {
  protected readonly tableName = 'ehr_appointment'
  protected readonly idColumn = 'appointment_id'
  protected readonly resourceType = 'Appointment'

  constructor(rlsContext: RLSContext) {
    super(rlsContext)
  }

  /**
   * Creates a new appointment record with FHIR resource validation.
   */
  async create(appointment: unknown): Promise<Appointment> {
    const validated = appointmentSchema.parse(appointment)
    const patientId =
      validated.participant?.[0]?.actor?.reference?.replace('Patient/', '') ??
      null
    const practitionerId =
      validated.participant
        ?.find((p) => p.actor?.reference?.startsWith('Practitioner/'))
        ?.actor?.reference?.replace('Practitioner/', '') ?? null
    const startTime = validated.start ?? null
    const endTime = validated.end ?? null

    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Appointment }>(
        `INSERT INTO ehr_appointment (tenant_id, patient_id, practitioner_id, status, start_time, end_time, fhir_resource)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING fhir_resource`,
        [
          this.rlsContext.tenantId,
          patientId,
          practitionerId,
          validated.status ?? 'proposed',
          startTime,
          endTime,
          JSON.stringify(validated),
        ],
      )
      return res.rows[0].fhir_resource
    })
  }

  /**
   * Updates an existing appointment's FHIR resource and denormalized columns.
   */
  async update(
    id: string,
    appointment: Partial<Appointment>,
  ): Promise<Appointment | null> {
    const existing = await this.findById(id)
    if (!existing) return null
    const merged = appointmentSchema.parse({
      ...existing,
      ...appointment,
      resourceType: 'Appointment',
    })
    const patientId =
      merged.participant?.[0]?.actor?.reference?.replace('Patient/', '') ?? null
    const practitionerId =
      merged.participant
        ?.find((p) => p.actor?.reference?.startsWith('Practitioner/'))
        ?.actor?.reference?.replace('Practitioner/', '') ?? null
    const startTime = merged.start ?? null
    const endTime = merged.end ?? null

    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Appointment }>(
        `UPDATE ehr_appointment
         SET patient_id = $2, practitioner_id = $3, status = $4, start_time = $5, end_time = $6,
             fhir_resource = $7, updated_at = NOW()
         WHERE appointment_id = $1
         RETURNING fhir_resource`,
        [
          id,
          patientId,
          practitionerId,
          merged.status ?? 'proposed',
          startTime,
          endTime,
          JSON.stringify(merged),
        ],
      )
      return res.rows[0]?.fhir_resource ?? null
    })
  }

  /**
   * Finds appointments by status within the tenant.
   */
  async findByStatus(
    status: string,
    limit = 50,
    offset = 0,
  ): Promise<Appointment[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Appointment }>(
        `SELECT fhir_resource FROM ehr_appointment
         WHERE status = $1
         ORDER BY start_time ASC NULLS LAST
         LIMIT $2 OFFSET $3`,
        [status, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }

  /**
   * Finds appointments within a date range (by start_time).
   */
  async findByDateRange(
    start: string,
    end: string,
    limit = 50,
    offset = 0,
  ): Promise<Appointment[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Appointment }>(
        `SELECT fhir_resource FROM ehr_appointment
         WHERE start_time >= $1 AND start_time <= $2
         ORDER BY start_time ASC
         LIMIT $3 OFFSET $4`,
        [start, end, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }

  /**
   * Finds upcoming appointments for a practitioner.
   */
  async findUpcomingByPractitioner(
    practitionerId: string,
    limit = 20,
    offset = 0,
  ): Promise<Appointment[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Appointment }>(
        `SELECT fhir_resource FROM ehr_appointment
         WHERE practitioner_id = $1 AND start_time >= NOW()
         ORDER BY start_time ASC
         LIMIT $2 OFFSET $3`,
        [practitionerId, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }

  /**
   * Finds appointments for a specific patient.
   */
  override async findByPatient(
    patientId: string,
    limit = 50,
    offset = 0,
  ): Promise<Appointment[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Appointment }>(
        `SELECT fhir_resource FROM ehr_appointment
         WHERE patient_id = $1
         ORDER BY start_time DESC NULLS LAST
         LIMIT $2 OFFSET $3`,
        [patientId, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }
}
