/**
 * EHR Native — Consent Repository (F1.4)
 *
 * Data-access layer for the `ehr_consent` table.
 * Maps between PostgreSQL rows and typed FHIR Consent resources.
 *
 * @see db/migrations/015_ehr_native_tables.sql
 */

import type { QueryResultRow } from '@/lib/db'
import { query, transaction } from '@/lib/db'

import type { Consent } from '../types/consent'

// ---------------------------------------------------------------------------
// Row type (maps to ehr_consent table columns)
// ---------------------------------------------------------------------------

export interface ConsentRow extends QueryResultRow {
  consent_id: string
  tenant_id: string
  patient_id: string
  status: string
  scope: string | null
  category: string | null
  consent_level: string
  period_start: string | null
  period_end: string | null
  fhir_resource: Consent
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateConsentInput {
  tenantId: string
  patientId: string
  status?: string
  scope?: string
  category?: string
  consentLevel: string
  periodStart?: string
  periodEnd?: string
  fhirResource: Consent
}

export interface UpdateConsentInput {
  status?: string
  consentLevel?: string
  periodEnd?: string
  fhirResource?: Consent
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class ConsentRepository {
  /**
   * Create a new consent record.
   */
  async create(input: CreateConsentInput): Promise<ConsentRow> {
    const result = await query<ConsentRow>(
      `INSERT INTO ehr_consent
        (tenant_id, patient_id, status, scope, category, consent_level,
         period_start, period_end, fhir_resource)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.tenantId,
        input.patientId,
        input.status ?? 'active',
        input.scope ?? null,
        input.category ?? null,
        input.consentLevel,
        input.periodStart ?? null,
        input.periodEnd ?? null,
        JSON.stringify(input.fhirResource),
      ],
    )
    return result.rows[0] as ConsentRow
  }

  /**
   * Get a consent record by ID.
   */
  async getById(
    consentId: string,
    tenantId: string,
  ): Promise<ConsentRow | null> {
    const result = await query<ConsentRow>(
      `SELECT * FROM ehr_consent
       WHERE consent_id = $1 AND tenant_id = $2`,
      [consentId, tenantId],
    )
    return result.rows[0] ?? null
  }

  /**
   * Get all consent records for a patient within a tenant.
   */
  async getByPatient(
    patientId: string,
    tenantId: string,
  ): Promise<ConsentRow[]> {
    const result = await query<ConsentRow>(
      `SELECT * FROM ehr_consent
       WHERE patient_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC`,
      [patientId, tenantId],
    )
    return result.rows
  }

  /**
   * Get the most recent active consent for a patient.
   */
  async getActiveByPatient(
    patientId: string,
    tenantId: string,
  ): Promise<ConsentRow | null> {
    const result = await query<ConsentRow>(
      `SELECT * FROM ehr_consent
       WHERE patient_id = $1 AND tenant_id = $2 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [patientId, tenantId],
    )
    return result.rows[0] ?? null
  }

  /**
   * List all consent records for a tenant (paginated).
   */
  async listByTenant(
    tenantId: string,
    limit = 50,
    offset = 0,
  ): Promise<ConsentRow[]> {
    const result = await query<ConsentRow>(
      `SELECT * FROM ehr_consent
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    )
    return result.rows
  }

  /**
   * Update a consent record.
   */
  async update(
    consentId: string,
    tenantId: string,
    input: UpdateConsentInput,
  ): Promise<ConsentRow | null> {
    const sets: string[] = []
    const params: unknown[] = []
    let paramIdx = 1

    if (input.status !== undefined) {
      sets.push(`status = $${paramIdx++}`)
      params.push(input.status)
    }
    if (input.consentLevel !== undefined) {
      sets.push(`consent_level = $${paramIdx++}`)
      params.push(input.consentLevel)
    }
    if (input.periodEnd !== undefined) {
      sets.push(`period_end = $${paramIdx++}`)
      params.push(input.periodEnd)
    }
    if (input.fhirResource !== undefined) {
      sets.push(`fhir_resource = $${paramIdx++}`)
      params.push(JSON.stringify(input.fhirResource))
    }

    if (sets.length === 0) {
      return this.getById(consentId, tenantId)
    }

    sets.push(`updated_at = NOW()`)
    params.push(consentId, tenantId)

    const result = await query<ConsentRow>(
      `UPDATE ehr_consent
       SET ${sets.join(', ')}
       WHERE consent_id = $${paramIdx++} AND tenant_id = $${paramIdx++}
       RETURNING *`,
      params,
    )
    return result.rows[0] ?? null
  }

  /**
   * Revoke (mark inactive) a consent record.
   * Uses a transaction to ensure atomicity.
   */
  async revoke(
    consentId: string,
    tenantId: string,
  ): Promise<ConsentRow | null> {
    return await transaction(async (client) => {
      const result = await client.query<ConsentRow>(
        `UPDATE ehr_consent
         SET status = 'inactive', updated_at = NOW()
         WHERE consent_id = $1 AND tenant_id = $2
         RETURNING *`,
        [consentId, tenantId],
      )
      return (result.rows[0] as ConsentRow) ?? null
    })
  }

  /**
   * Delete a consent record permanently.
   * Uses a transaction for safety.
   */
  async delete(consentId: string, tenantId: string): Promise<boolean> {
    return await transaction(async (client) => {
      const result = await client.query(
        `DELETE FROM ehr_consent
         WHERE consent_id = $1 AND tenant_id = $2`,
        [consentId, tenantId],
      )
      return (result.rowCount ?? 0) > 0
    })
  }
}
