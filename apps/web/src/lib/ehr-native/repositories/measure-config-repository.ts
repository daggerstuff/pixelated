import { z } from 'zod'

import type { MeasureConfig } from '../types/index.js'
import { BaseRepository, type RLSContext } from './base-repository.js'

/**
 * Repository for persisting outcome measure configurations (F2.4).
 *
 * Each row stores a per-patient measure cadence and active status as a FHIR
 * Questionnaire-derived JSONB resource. The table follows the `ehr_<resource>`
 * convention with RLS enforced at the database layer.
 */
export class MeasureConfigRepository extends BaseRepository<MeasureConfig> {
  protected readonly tableName = 'ehr_measure_config'
  protected readonly idColumn = 'measure_config_id'
  protected readonly resourceType = 'MeasureConfig'

  constructor(rlsContext: RLSContext) {
    super(rlsContext)
  }

  /**
   * Inserts a new measure configuration row.
   * Returns the persisted resource from the database.
   */
  async create(config: MeasureConfig): Promise<MeasureConfig> {
    const fhirResource = config
    const query = `
      INSERT INTO ${this.tableName} (
        tenant_id, patient_id, measure_type, cadence, active, fhir_resource
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING fhir_resource
    `
    const result = await this.withRLS(async (client) => {
      const res = await client.query(query, [
        this.rlsContext.tenantId,
        config.patientId,
        config.measureType,
        config.cadence,
        config.active,
        JSON.stringify(fhirResource),
      ])
      return (res.rows as { fhir_resource: MeasureConfig }[])[0]?.fhir_resource
    })
    if (!result) throw new Error('Failed to create measure configuration.')
    return result
  }

  /**
   * Finds all measure configurations for a patient.
   */
  override async findByPatient(patientId: string): Promise<MeasureConfig[]> {
    const query = `
      SELECT fhir_resource FROM ${this.tableName}
      WHERE patient_id = $1
      ORDER BY updated_at DESC
    `
    return this.withRLS(async (client) => {
      const res = await client.query(query, [patientId])
      return (res.rows as { fhir_resource: MeasureConfig }[]).map(
        (row) => row.fhir_resource,
      )
    })
  }

  /**
   * Finds a specific measure configuration for a patient.
   */
  async findByPatientAndMeasure(
    patientId: string,
    measureType: string,
  ): Promise<MeasureConfig | null> {
    const query = `
      SELECT fhir_resource FROM ${this.tableName}
      WHERE patient_id = $1 AND measure_type = $2
      LIMIT 1
    `
    const result = await this.withRLS(async (client) => {
      const res = await client.query(query, [patientId, measureType])
      return (res.rows as { fhir_resource: MeasureConfig }[])[0]?.fhir_resource
    })
    return result ?? null
  }

  /**
   * Updates an existing measure configuration by patient + measure type.
   * Upserts if no existing row is found.
   */
  async upsert(config: MeasureConfig): Promise<MeasureConfig> {
    const query = `
      INSERT INTO ${this.tableName} (
        tenant_id, patient_id, measure_type, cadence, active, fhir_resource
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tenant_id, patient_id, measure_type)
      DO UPDATE SET
        cadence = EXCLUDED.cadence,
        active = EXCLUDED.active,
        fhir_resource = EXCLUDED.fhir_resource,
        updated_at = CURRENT_TIMESTAMP
      RETURNING fhir_resource
    `
    const result = await this.withRLS(async (client) => {
      const res = await client.query(query, [
        this.rlsContext.tenantId,
        config.patientId,
        config.measureType,
        config.cadence,
        config.active,
        JSON.stringify(config),
      ])
      return (res.rows as { fhir_resource: MeasureConfig }[])[0]?.fhir_resource
    })
    if (!result) throw new Error('Failed to upsert measure configuration.')
    return result
  }
}
