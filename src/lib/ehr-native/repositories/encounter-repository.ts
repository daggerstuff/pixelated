import { encounterSchema, type Encounter } from '../types'
import { BaseRepository, type RLSContext } from './base-repository'

/**
 * Repository for EHR Encounter resources backed by the `ehr_encounter` table.
 *
 * The `ehr_encounter` table stores the full FHIR Encounter resource as JSONB
 * alongside denormalized columns (`patient_id`, `practitioner_id`, `status`,
 * `class`, `period_start`, `period_end`) for efficient querying.
 *
 * RLS: SELECT requires active patient consent via `ehr_patient_has_consent()`
 * OR break-glass OR complianceOfficer/systemAdmin role.
 */
export class EncounterRepository extends BaseRepository<Encounter> {
  protected readonly tableName = 'ehr_encounter'
  protected readonly idColumn = 'encounter_id'
  protected readonly resourceType = 'Encounter'

  constructor(rlsContext: RLSContext) {
    super(rlsContext)
  }

  /**
   * Creates a new encounter record with FHIR resource validation.
   */
  async create(encounter: unknown): Promise<Encounter> {
    const validated = encounterSchema.parse(encounter)
    const patientId =
      validated.subject?.reference?.replace('Patient/', '') ?? null
    const practitionerId =
      validated.participant
        ?.find((p) => p.individual?.reference?.startsWith('Practitioner/'))
        ?.individual?.reference?.replace('Practitioner/', '') ?? null
    const periodStart = validated.period?.start ?? null
    const periodEnd = validated.period?.end ?? null
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Encounter }>(
        `INSERT INTO ehr_encounter (tenant_id, patient_id, practitioner_id, status, class, period_start, period_end, fhir_resource)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING fhir_resource`,
        [
          this.rlsContext.tenantId,
          patientId,
          practitionerId,
          validated.status ?? 'planned',
          validated.class?.code ?? null,
          periodStart,
          periodEnd,
          JSON.stringify(validated),
        ],
      )
      return res.rows[0].fhir_resource
    })
  }

  /**
   * Updates an existing encounter's FHIR resource and denormalized columns.
   */
  async update(
    id: string,
    encounter: Partial<Encounter>,
  ): Promise<Encounter | null> {
    const existing = await this.findById(id)
    if (!existing) return null
    const merged = encounterSchema.parse({
      ...existing,
      ...encounter,
      resourceType: 'Encounter',
    })
    const patientId = merged.subject?.reference?.replace('Patient/', '') ?? null
    const practitionerId =
      merged.participant
        ?.find((p) => p.individual?.reference?.startsWith('Practitioner/'))
        ?.individual?.reference?.replace('Practitioner/', '') ?? null
    const periodStart = merged.period?.start ?? null
    const periodEnd = merged.period?.end ?? null

    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Encounter }>(
        `UPDATE ehr_encounter
         SET patient_id = $2, practitioner_id = $3, status = $4, class = $5,
             period_start = $6, period_end = $7, fhir_resource = $8, updated_at = NOW()
         WHERE encounter_id = $1
         RETURNING fhir_resource`,
        [
          id,
          patientId,
          practitionerId,
          merged.status ?? 'planned',
          merged.class?.code ?? null,
          null,
          null,
          JSON.stringify(merged),
        ],
      )
      return res.rows[0]?.fhir_resource ?? null
    })
  }

  /**
   * Finds encounters by status within the tenant.
   */
  async findByStatus(
    status: string,
    limit = 50,
    offset = 0,
  ): Promise<Encounter[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Encounter }>(
        `SELECT fhir_resource FROM ehr_encounter
         WHERE status = $1
         ORDER BY period_start DESC NULLS LAST
         LIMIT $2 OFFSET $3`,
        [status, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }

  /**
   * Finds encounters within a date range.
   */
  async findByDateRange(
    start: string,
    end: string,
    limit = 50,
    offset = 0,
  ): Promise<Encounter[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Encounter }>(
        `SELECT fhir_resource FROM ehr_encounter
         WHERE period_start >= $1 AND (period_end <= $2 OR period_end IS NULL)
         ORDER BY period_start DESC
         LIMIT $3 OFFSET $4`,
        [start, end, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }

  /**
   * Finds encounters by practitioner ID.
   */
  async findByPractitioner(
    practitionerId: string,
    limit = 50,
    offset = 0,
  ): Promise<Encounter[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Encounter }>(
        `SELECT fhir_resource FROM ehr_encounter
         WHERE practitioner_id = $1
         ORDER BY period_start DESC NULLS LAST
         LIMIT $2 OFFSET $3`,
        [practitionerId, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }
}
