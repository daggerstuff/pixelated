import {
  questionnaireSchema,
  questionnaireResponseSchema,
  type Questionnaire,
  type QuestionnaireResponse,
} from '../types'
import { BaseRepository, type RLSContext } from './base-repository'

/**
 * Repository for FHIR Questionnaire resources backed by the `ehr_questionnaire` table.
 *
 * Stores standardized outcome measure definitions (PHQ-9, GAD-7, OQ-45) as
 * FHIR R4 Questionnaire JSONB alongside denormalized columns (`name`, `url`,
 * `version`, `status`) for efficient lookup.
 *
 * RLS: tenant isolation via `app.tenant_id` session variable.
 */
export class QuestionnaireRepository extends BaseRepository<Questionnaire> {
  protected readonly tableName = 'ehr_questionnaire'
  protected readonly idColumn = 'questionnaire_id'
  protected readonly resourceType = 'Questionnaire'

  constructor(rlsContext: RLSContext) {
    super(rlsContext)
  }

  /**
   * Creates a new questionnaire record with FHIR resource validation.
   */
  async create(questionnaire: unknown): Promise<Questionnaire> {
    const validated = questionnaireSchema.parse(questionnaire)
    const name = validated.name ?? null
    const url = validated.url ?? null
    const version = validated.version ?? null
    const status = validated.status ?? 'active'

    return this.withRLS(async (client) => {
      const res = await client.query<{
        questionnaire_id: string
        fhir_resource: Questionnaire
      }>(
        `INSERT INTO ehr_questionnaire (tenant_id, name, url, version, status, fhir_resource)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING questionnaire_id, fhir_resource`,
        [
          this.rlsContext.tenantId,
          name,
          url,
          version,
          status,
          JSON.stringify(validated),
        ],
      )
      const row = res.rows[0]
      if (!row) {
        throw new Error('Failed to create questionnaire: no row returned')
      }
      // Stamp the DB-generated id into the stored fhir_resource JSONB
      const updateRes = await client.query<{ fhir_resource: Questionnaire }>(
        `UPDATE ehr_questionnaire
         SET fhir_resource = jsonb_set(fhir_resource, '{id}', to_jsonb($2))
         WHERE questionnaire_id = $1
         RETURNING fhir_resource`,
        [row.questionnaire_id, row.questionnaire_id],
      )
      return updateRes.rows[0]?.fhir_resource ?? row.fhir_resource
    })
  }

  /**
   * Finds a questionnaire by its canonical URL (e.g., the measure definition URL).
   */
  async findByUrl(url: string): Promise<Questionnaire | null> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Questionnaire }>(
        `SELECT fhir_resource FROM ehr_questionnaire
         WHERE url = $1 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [url],
      )
      return res.rows[0]?.fhir_resource ?? null
    })
  }

  /**
   * Finds questionnaires by name within the tenant.
   */
  async findByName(name: string): Promise<Questionnaire[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: Questionnaire }>(
        `SELECT fhir_resource FROM ehr_questionnaire
         WHERE name = $1 AND status = 'active'
         ORDER BY created_at DESC`,
        [name],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }
}

/**
 * Repository for FHIR QuestionnaireResponse resources backed by the
 * `ehr_questionnaire_response` table.
 *
 * Stores client-completed outcome measure responses as FHIR R4
 * QuestionnaireResponse JSONB alongside denormalized columns
 * (`patient_id`, `questionnaire`, `status`, `authored`) for efficient querying.
 *
 * RLS: SELECT requires active patient consent via `ehr_patient_has_consent()`
 * OR break-glass OR complianceOfficer/systemAdmin role.
 */
export class QuestionnaireResponseRepository extends BaseRepository<QuestionnaireResponse> {
  protected readonly tableName = 'ehr_questionnaire_response'
  protected readonly idColumn = 'questionnaire_response_id'
  protected readonly resourceType = 'QuestionnaireResponse'

  constructor(rlsContext: RLSContext) {
    super(rlsContext)
  }

  /**
   * Creates a new questionnaire response record with FHIR resource validation.
   */
  async create(response: unknown): Promise<QuestionnaireResponse> {
    const validated = questionnaireResponseSchema.parse(response)
    const patientId =
      validated.subject?.reference?.replace('Patient/', '') ?? null
    const questionnaire = validated.questionnaire ?? null
    const status = validated.status ?? 'completed'
    const authored = validated.authored ?? null

    return this.withRLS(async (client) => {
      const res = await client.query<{
        questionnaire_response_id: string
        fhir_resource: QuestionnaireResponse
      }>(
        `INSERT INTO ehr_questionnaire_response (tenant_id, patient_id, questionnaire, status, authored, fhir_resource)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING questionnaire_response_id, fhir_resource`,
        [
          this.rlsContext.tenantId,
          patientId,
          questionnaire,
          status,
          authored,
          JSON.stringify(validated),
        ],
      )
      const row = res.rows[0]
      if (!row) {
        throw new Error('Failed to create questionnaire response: no row returned')
      }
      // Stamp the DB-generated id into the stored fhir_resource JSONB
      const updateRes = await client.query<{
        fhir_resource: QuestionnaireResponse
      }>(
        `UPDATE ehr_questionnaire_response
         SET fhir_resource = jsonb_set(fhir_resource, '{id}', to_jsonb($2))
         WHERE questionnaire_response_id = $1
         RETURNING fhir_resource`,
        [row.questionnaire_response_id, row.questionnaire_response_id],
      )
      return updateRes.rows[0]?.fhir_resource ?? row.fhir_resource
    })
  }

  /**
   * Finds all questionnaire responses for a patient, ordered by authored date descending.
   */
  async findByPatientAndQuestionnaire(
    patientId: string,
    questionnaireUrl: string,
    limit = 50,
    offset = 0,
  ): Promise<QuestionnaireResponse[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: QuestionnaireResponse }>(
        `SELECT fhir_resource FROM ehr_questionnaire_response
         WHERE patient_id = $1 AND questionnaire = $2 AND status = 'completed'
         ORDER BY authored DESC NULLS LAST
         LIMIT $3 OFFSET $4`,
        [patientId, questionnaireUrl, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }

  /**
   * Finds all questionnaire responses for a patient, ordered by authored date descending.
   */
  override async findByPatient(
    patientId: string,
    limit = 50,
    offset = 0,
  ): Promise<QuestionnaireResponse[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: QuestionnaireResponse }>(
        `SELECT fhir_resource FROM ehr_questionnaire_response
         WHERE patient_id = $1 AND status = 'completed'
         ORDER BY authored DESC NULLS LAST
         LIMIT $2 OFFSET $3`,
        [patientId, limit, offset],
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }

  /**
   * Finds the most recent completed questionnaire response for a patient and questionnaire.
   */
  async findMostRecentByPatientAndQuestionnaire(
    patientId: string,
    questionnaireUrl: string,
  ): Promise<QuestionnaireResponse | null> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: QuestionnaireResponse }>(
        `SELECT fhir_resource FROM ehr_questionnaire_response
         WHERE patient_id = $1 AND questionnaire = $2 AND status = 'completed'
         ORDER BY authored DESC NULLS LAST
         LIMIT 1`,
        [patientId, questionnaireUrl],
      )
      return res.rows[0]?.fhir_resource ?? null
    })
  }
}
