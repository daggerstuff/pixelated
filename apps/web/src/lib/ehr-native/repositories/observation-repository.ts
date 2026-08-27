import { observationSchema, type Observation } from '../types'
import { BaseRepository, type RLSContext } from './base-repository'

/**
 * Repository for EHR Observation resources backed by the `ehr_observation` table.
 *
 * The `ehr_observation` table stores the full FHIR Observation resource as JSONB
 * alongside denormalized columns (`patient_id`, `encounter_id`, `status`,
 * `code`, `effective_date`) for efficient clinical data queries.
 *
 * RLS: SELECT requires active patient consent via `ehr_patient_has_consent()`
 * OR break-glass OR complianceOfficer/systemAdmin role.
 */
export class ObservationRepository extends BaseRepository<Observation> {
  protected readonly tableName = 'ehr_observation'
  protected readonly idColumn = 'observation_id'
  protected readonly resourceType = 'Observation'

  constructor(rlsContext: RLSContext) {
    super(rlsContext)
  }

  /**
   * Creates a new observation record with FHIR resource validation.
   */
  async create(observation: unknown): Promise<Observation> {
    const validated = observationSchema.parse(observation)
    const patientId =
      validated.subject?.reference?.replace('Patient/', '') ?? null
    const encounterId =
      validated.encounter?.reference?.replace('Encounter/', '') ?? null
    const code =
      validated.code?.coding?.[0]?.code ?? validated.code?.text ?? null
    const effectiveDate = validated.effectiveDateTime ?? null

    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Observation }>(
        `INSERT INTO ehr_observation (tenant_id, patient_id, encounter_id, status, code, effective_date, fhir_resource)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING fhir_resource`,
        [
          this.rlsContext.tenantId,
          patientId,
          encounterId,
          validated.status ?? 'final',
          code,
          effectiveDate,
          JSON.stringify(validated),
        ],
      )
      return res.rows[0].fhir_resource
    })
  }

  /**
   * Updates an existing observation's FHIR resource and denormalized columns.
   */
  async update(
    id: string,
    observation: Partial<Observation>,
  ): Promise<Observation | null> {
    const existing = await this.findById(id)
    if (!existing) return null
    const merged = observationSchema.parse({
      ...existing,
      ...observation,
      resourceType: 'Observation',
    })
    const patientId = merged.subject?.reference?.replace('Patient/', '') ?? null
    const encounterId =
      merged.encounter?.reference?.replace('Encounter/', '') ?? null
    const code = merged.code?.coding?.[0]?.code ?? merged.code?.text ?? null
    const effectiveDate = merged.effectiveDateTime ?? null

    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Observation }>(
        `UPDATE ehr_observation
         SET patient_id = $2, encounter_id = $3, status = $4, code = $5, effective_date = $6,
             fhir_resource = $7, updated_at = NOW()
         WHERE observation_id = $1
         RETURNING fhir_resource`,
        [
          id,
          patientId,
          encounterId,
          merged.status ?? 'final',
          code,
          effectiveDate,
          JSON.stringify(merged),
        ],
      )
      return res.rows[0]?.fhir_resource ?? null
    })
  }

  /**
   * Finds observations by status within the tenant.
   */
  async findByStatus(
    status: string,
    limit = 50,
    offset = 0,
  ): Promise<Observation[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Observation }>(
        `SELECT fhir_resource FROM ehr_observation
         WHERE status = $1
         ORDER BY effective_date DESC NULLS LAST
         LIMIT $2 OFFSET $3`,
        [status, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }

  /**
   * Finds observations by LOINC code (e.g., "2951-2" for sodium).
   */
  async findByCode(
    code: string,
    limit = 50,
    offset = 0,
  ): Promise<Observation[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Observation }>(
        `SELECT fhir_resource FROM ehr_observation
         WHERE code = $1
         ORDER BY effective_date DESC NULLS LAST
         LIMIT $2 OFFSET $3`,
        [code, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }

  /**
   * Finds observations for a specific patient filtered by LOINC code.
   * Used for outcome measure queries (e.g., all PHQ-9 observations for a patient).
   */
  async findByPatientAndCode(
    patientId: string,
    code: string,
    limit = 100,
    offset = 0,
  ): Promise<Observation[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Observation }>(
        `SELECT fhir_resource FROM ehr_observation
         WHERE patient_id = $1 AND code = $2
         ORDER BY effective_date DESC NULLS LAST
         LIMIT $3 OFFSET $4`,
        [patientId, code, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }

  /**
   * Finds observations for a patient within a date range.
   */
  async findByPatientAndDateRange(
    patientId: string,
    start: string,
    end: string,
    limit = 50,
    offset = 0,
  ): Promise<Observation[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Observation }>(
        `SELECT fhir_resource FROM ehr_observation
         WHERE patient_id = $1 AND effective_date >= $2 AND effective_date <= $3
         ORDER BY effective_date DESC
         LIMIT $4 OFFSET $5`,
        [patientId, start, end, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }

  /**
   * Finds observations by encounter ID.
   */
  async findByEncounter(
    encounterId: string,
    limit = 100,
    offset = 0,
  ): Promise<Observation[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Observation }>(
        `SELECT fhir_resource FROM ehr_observation
         WHERE encounter_id = $1
         ORDER BY effective_date DESC NULLS LAST
         LIMIT $2 OFFSET $3`,
        [encounterId, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }
}
