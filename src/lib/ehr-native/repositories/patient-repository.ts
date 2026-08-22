import { patientSchema, type Patient } from '../types'
import { BaseRepository, type RLSContext } from './base-repository'

/**
 * Repository for EHR Patient resources backed by the `ehr_patient` table.
 *
 * The `ehr_patient` table stores the full FHIR Patient resource as JSONB
 * alongside denormalized columns (`mrn`, `active`, `family_name`, `given_name`,
 * `birth_date`, `gender`) for efficient querying and RLS policy enforcement.
 *
 * RLS: SELECT requires active consent via `ehr_patient_has_consent()` OR
 * break-glass OR complianceOfficer/systemAdmin role.
 */
export class PatientRepository extends BaseRepository<Patient> {
  protected readonly tableName = 'ehr_patient'
  protected readonly idColumn = 'patient_id'
  protected readonly resourceType = 'Patient'

  constructor(rlsContext: RLSContext) {
    super(rlsContext)
  }

  /**
   * Creates a new patient record with FHIR resource validation.
   */
  async create(patient: unknown): Promise<Patient> {
    const validated = patientSchema.parse(patient)
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Patient }>(
        `INSERT INTO ehr_patient (tenant_id, mrn, active, family_name, given_name, birth_date, gender, fhir_resource)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING fhir_resource`,
        [
          this.rlsContext.tenantId,
          validated.identifier?.[0]?.value ?? null,
          validated.active ?? true,
          validated.name?.[0]?.family ?? null,
          validated.name?.[0]?.given?.[0] ?? null,
          validated.birthDate ?? null,
          validated.gender ?? null,
          JSON.stringify(validated),
        ]
      )
      return res.rows[0].fhir_resource
    })
  }

  /**
   * Updates an existing patient's FHIR resource and denormalized columns.
   */
  async update(id: string, patient: Partial<Patient>): Promise<Patient | null> {
    const existing = await this.findById(id)
    if (!existing) return null
    const merged = patientSchema.parse({ ...existing, ...patient, resourceType: 'Patient' })
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Patient }>(
        `UPDATE ehr_patient
         SET mrn = $2, active = $3, family_name = $4, given_name = $5, birth_date = $6, gender = $7,
             fhir_resource = $8, updated_at = NOW()
         WHERE patient_id = $1
         RETURNING fhir_resource`,
        [
          id,
          merged.identifier?.[0]?.value ?? null,
          merged.active ?? true,
          merged.name?.[0]?.family ?? null,
          merged.name?.[0]?.given?.[0] ?? null,
          merged.birthDate ?? null,
          merged.gender ?? null,
          JSON.stringify(merged),
        ]
      )
      return res.rows[0]?.fhir_resource ?? null
    })
  }

  /**
   * Finds a patient by their Medical Record Number (MRN) within the tenant.
   */
  async findByMRN(mrn: string): Promise<Patient | null> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Patient }>(
        `SELECT fhir_resource FROM ehr_patient WHERE mrn = $1`,
        [mrn]
      )
      return res.rows[0]?.fhir_resource ?? null
    })
  }

  /**
   * Lists active patients within the tenant, paginated.
   */
  async findActive(limit = 50, offset = 0): Promise<Patient[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Patient }>(
        `SELECT fhir_resource FROM ehr_patient WHERE active = true
         ORDER BY family_name, given_name
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }

  /**
   * Searches patients by name (family or given), case-insensitive partial match.
   */
  async searchByName(nameQuery: string, limit = 20, offset = 0): Promise<Patient[]> {
    const pattern = `%${nameQuery}%`
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Patient }>(
        `SELECT fhir_resource FROM ehr_patient
         WHERE family_name ILIKE $1 OR given_name ILIKE $1
         ORDER BY family_name, given_name
         LIMIT $2 OFFSET $3`,
        [pattern, limit, offset]
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }
}
