/**
 * Portal Statement Service — F1.11 Client Portal Feature #5
 *
 * Patient financial statements: view claim summaries and download statements.
 * Uses FHIR Claim resources stored in the existing ehr_claim table.
 */

import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository'
import { BaseRepository } from '@/lib/ehr-native/repositories/base-repository'
import { claimSchema, type Claim } from '@/lib/ehr-native/types'

// ── Validation helpers (local, matching pattern in scheduling-service.ts) ──

function validateId(id: string, label: string): string {
  const sanitized = id.trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitized)) {
    throw new Error(`Invalid ${label} format: expected UUID`)
  }
  return sanitized
}

function sanitizeLimit(value: number | undefined, max = 100): number {
  return Math.max(1, Math.min(max, Math.floor(value ?? 20)))
}

function sanitizeOffset(value: number | undefined): number {
  return Math.max(0, Math.floor(value ?? 0))
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface PatientStatement {
  id: string
  patientId: string
  claimId: string
  status: string
  use: string
  created: string
  provider: string
  totalAmount: number
  currency: string
  diagnosis: Array<{ description?: string; code?: string }>
  items: Array<{ sequence: number; description?: string; serviceCode?: string; quantity?: number; unitPrice?: number; net?: number }>
  insurance: Array<{ coverage?: string; focal?: boolean; preauthRef?: string[] }>
}

export interface StatementSummary {
  totalStatements: number
  totalBilled: number
  totalPaid: number
  totalOutstanding: number
  currency: string
  recentStatements: Array<{ id: string; created: string; totalAmount: number; status: string }>
}

export interface StatementSearchParams {
  status?: string
  limit?: number
  offset?: number
}

export interface StatementDownload {
  filename: string
  contentType: string
  data: string
}

// ── Repository ──────────────────────────────────────────────────────────────

class StatementRepository extends BaseRepository<Claim & { id?: string }> {
  protected readonly tableName = 'ehr_claim'
  protected readonly idColumn = 'claim_id'
  protected readonly resourceType = 'Claim'

  override async findByPatient(
    patientId: string,
    limit: number,
    offset: number,
    statusFilter?: string,
  ): Promise<Claim[]> {
    return this.withRLS(async (client) => {
      let query = `SELECT fhir_resource FROM ${this.tableName}
        WHERE patient_id = $1`
      const params: unknown[] = [patientId]

      if (statusFilter) {
        query += ` AND fhir_resource->>'status' = $${params.length + 1}`
        params.push(statusFilter)
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
      params.push(limit, offset)

      const result = await client.query(query, params)
      return (result.rows as Array<{ fhir_resource: Claim }>).map((r) => r.fhir_resource)
    })
  }

  override async countByPatient(patientId: string, statusFilter?: string): Promise<number> {
    return this.withRLS(async (client) => {
      let query = `SELECT COUNT(*)::int as count FROM ${this.tableName} WHERE patient_id = $1`
      const params: unknown[] = [patientId]

      if (statusFilter) {
        query += ` AND fhir_resource->>'status' = $${params.length + 1}`
        params.push(statusFilter)
      }

      const result = await client.query(query, params)
      return (result.rows[0] as { count?: number } | undefined)?.count ?? 0
    })
  }

  override async findById(id: string): Promise<Claim | null> {
    return super.findById(id)
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

export class PortalStatementService {
  private readonly statementRepo: StatementRepository

  constructor(rlsContext: RLSContext) {
    this.statementRepo = new StatementRepository(rlsContext)
  }

  /**
   * List patient statements with optional status filter.
   */
  async listStatements(
    patientId: string,
    params: StatementSearchParams = {},
  ): Promise<{ statements: PatientStatement[]; total: number }> {
    validateId(patientId, 'patientId')
    const limit = sanitizeLimit(params.limit)
    const offset = sanitizeOffset(params.offset)

    const [claims, total] = await Promise.all([
      this.statementRepo.findByPatient(patientId, limit, offset, params.status),
      this.statementRepo.countByPatient(patientId, params.status),
    ])

    const statements = claims.map((c) => this.toStatement(c))
    return { statements, total }
  }

  /**
   * Get a single statement by ID.
   */
  async getStatement(
    statementId: string,
    patientId: string,
  ): Promise<PatientStatement | null> {
    validateId(statementId, 'statementId')
    validateId(patientId, 'patientId')

    const claim = await this.statementRepo.findById(statementId)
    if (!claim) return null

    const statement = this.toStatement(claim)
    if (statement.patientId !== patientId) {
      throw new Error('Statement does not belong to this patient')
    }

    return statement
  }

  /**
   * Get statement summary for dashboard widget.
   */
  async getSummary(patientId: string): Promise<StatementSummary> {
    validateId(patientId, 'patientId')
    const { statements } = await this.listStatements(patientId, { limit: 100 })

    const currency = statements[0]?.currency ?? 'USD'
    const totalBilled = statements.reduce((sum, s) => sum + s.totalAmount, 0)
    const totalPaid = statements
      .filter((s) => s.status === 'active' && s.use === 'claim')
      .reduce((sum, s) => sum + s.totalAmount, 0)
    const totalOutstanding = statements
      .filter((s) => s.status !== 'cancelled' && s.status !== 'entered-in-error')
      .reduce((sum, s) => sum + s.totalAmount, 0)

    return {
      totalStatements: statements.length,
      totalBilled,
      totalPaid,
      totalOutstanding,
      currency,
      recentStatements: statements.slice(0, 5).map((s) => ({
        id: s.id,
        created: s.created,
        totalAmount: s.totalAmount,
        status: s.status,
      })),
    }
  }

  /**
   * Download a statement as a CSV file.
   */
  async downloadStatement(
    statementId: string,
    patientId: string,
  ): Promise<StatementDownload | null> {
    const statement = await this.getStatement(statementId, patientId)
    if (!statement) return null

    const rows = [
      ['Field', 'Value'],
      ['Statement ID', statement.id],
      ['Patient ID', statement.patientId],
      ['Claim ID', statement.claimId],
      ['Status', statement.status],
      ['Use', statement.use],
      ['Created', statement.created],
      ['Provider', statement.provider],
      ['Total Amount', `${statement.totalAmount} ${statement.currency}`],
      ['', ''],
      ['Line Items', ''],
      ['Sequence', 'Description', 'Service Code', 'Quantity', 'Unit Price', 'Net'],
      ...statement.items.map((i) => [
        String(i.sequence),
        i.description ?? '',
        i.serviceCode ?? '',
        String(i.quantity ?? ''),
        String(i.unitPrice ?? ''),
        String(i.net ?? ''),
      ]),
      ['', ''],
      ['Diagnoses', ''],
      ...statement.diagnosis.map((d) => [d.code ?? '', d.description ?? '']),
      ['', ''],
      ['Insurance', ''],
      ...statement.insurance.map((i) => [
        i.coverage ?? '',
        i.focal ? 'Focal' : 'Non-focal',
        (i.preauthRef ?? []).join('; '),
      ]),
    ]

    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const filename = `statement-${statement.id}.csv`

    return {
      filename,
      contentType: 'text/csv',
      data: csv,
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private toStatement(claim: Claim): PatientStatement {
    const claimId = (claim as Claim & { id?: string }).id ?? ''
    const patientId = (claim.patient?.reference ?? '').replace('Patient/', '')
    const providerRef = claim.provider?.reference ?? ''

    const total = claim.total?.value ?? 0
    const currency = claim.total?.currency ?? 'USD'

    const items = (claim.item ?? []).map((i) => ({
      sequence: i.sequence,
      description: i.productOrService?.text,
      serviceCode: i.productOrService?.coding?.[0]?.code,
      quantity: i.quantity?.value,
      unitPrice: i.unitPrice?.value,
      net: i.net?.value,
    }))

    const diagnosis = (claim.diagnosis ?? []).map((d) => ({
      description: d.diagnosisCodeableConcept?.text,
      code: d.diagnosisCodeableConcept?.coding?.[0]?.code,
    }))

    const insurance = (claim.insurance ?? []).map((i) => ({
      coverage: i.coverage?.reference,
      focal: i.focal,
      preauthRef: i.preAuthRef,
    }))

    return {
      id: claimId,
      patientId,
      claimId: claimId,
      status: claim.status,
      use: claim.use,
      created: claim.created ?? new Date().toISOString(),
      provider: providerRef,
      totalAmount: total,
      currency,
      diagnosis,
      items,
      insurance,
    }
  }
}
