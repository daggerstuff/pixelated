/**
 * EHR Native — State Consent Rules Repository (F3.3)
 *
 * Data-access layer for the `ehr_state_consent_rules` and
 * `ehr_state_consent_rules_audit` tables.
 *
 * Provides CRUD operations with versioning, state-machine transitions
 * (draft→review→approved→active→superseded→archived), and audit logging.
 *
 * @see db/migrations/016_state_consent_rules.sql
 */

import type { PoolClient } from 'pg'

import type { QueryResultRow } from '@/lib/db'
import { query, transaction } from '@/lib/db'

import type {
  AuditAction,
  CreateStateRuleInput,
  RuleStatus,
  StateConsentRuleRecord,
  StateRuleAuditRecord,
  StateRuleConfig,
  UpdateStateRuleInput,
} from './schemas'

// ---------------------------------------------------------------------------
// Row types (map to table columns)
// ---------------------------------------------------------------------------

export interface StateConsentRuleRow extends QueryResultRow {
  rule_id: string
  tenant_id: string | null
  state_code: string
  version: number
  status: RuleStatus
  rule_config: StateRuleConfig
  created_by: string
  created_by_role: string
  reviewed_by: string | null
  reviewed_by_role: string | null
  reviewed_at: string | null
  approved_by: string | null
  approved_by_role: string | null
  approved_at: string | null
  activated_at: string | null
  superseded_by: string | null
  effective_date: string | null
  expiry_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StateRuleAuditRow extends QueryResultRow {
  audit_id: string
  rule_id: string | null
  tenant_id: string | null
  state_code: string
  version: number
  action: AuditAction
  actor_id: string
  actor_role: string
  old_status: RuleStatus | null
  new_status: RuleStatus | null
  changes: Record<string, unknown> | null
  timestamp: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Row → Record mappers (snake_case → camelCase)
// ---------------------------------------------------------------------------

function mapRuleRow(row: StateConsentRuleRow): StateConsentRuleRecord {
  return {
    ruleId: row.rule_id,
    tenantId: row.tenant_id,
    stateCode: row.state_code,
    version: row.version,
    status: row.status,
    ruleConfig: row.rule_config,
    createdBy: row.created_by,
    createdByRole: row.created_by_role,
    reviewedBy: row.reviewed_by,
    reviewedByRole: row.reviewed_by_role,
    reviewedAt: row.reviewed_at,
    approvedBy: row.approved_by,
    approvedByRole: row.approved_by_role,
    approvedAt: row.approved_at,
    activatedAt: row.activated_at,
    supersededBy: row.superseded_by,
    effectiveDate: row.effective_date,
    expiryDate: row.expiry_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapAuditRow(row: StateRuleAuditRow): StateRuleAuditRecord {
  return {
    auditId: row.audit_id,
    ruleId: row.rule_id,
    tenantId: row.tenant_id,
    stateCode: row.state_code,
    version: row.version,
    action: row.action,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    changes: row.changes,
    timestamp: row.timestamp,
    createdAt: row.created_at,
  }
}

// ---------------------------------------------------------------------------
// Actor context — who is performing the operation
// ---------------------------------------------------------------------------

export interface ActorContext {
  userId: string
  role: string
  tenantId?: string | null
}

const ADMIN_ROLE_TO_EHR_ROLE: Record<string, string> = {
  super_admin: 'systemAdmin',
  clinical_admin: 'complianceOfficer',
  security_admin: 'complianceOfficer',
  support_admin: 'healthInformationManager',
}

export function mapAdminRoleToEhrRole(role: string): string {
  return ADMIN_ROLE_TO_EHR_ROLE[role] ?? role
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class StateConsentRulesRepository {
  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  /**
   * Create a new draft state consent rule.
   * Uses `ehr_get_next_rule_version` to auto-assign the next version number.
   */
  async createDraft(
    input: CreateStateRuleInput,
    actor: ActorContext,
  ): Promise<StateConsentRuleRecord> {
    return await transaction(async (client) => {
      // Get next version number for this state_code + tenant
      const versionResult = await client.query<{ next_version: number }>(
        `SELECT ehr_get_next_rule_version($1, $2) AS next_version`,
        [input.stateCode, input.tenantId ?? null],
      )
      const version = versionResult.rows[0]?.next_version ?? 1

      const result = await client.query<StateConsentRuleRow>(
        `INSERT INTO ehr_state_consent_rules
           (tenant_id, state_code, version, status, rule_config,
            created_by, created_by_role, effective_date, expiry_date, notes)
         VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          input.tenantId ?? null,
          input.stateCode,
          version,
          JSON.stringify(input.ruleConfig),
          actor.userId,
          actor.role,
          input.effectiveDate ?? null,
          input.expiryDate ?? null,
          input.notes ?? null,
        ],
      )

      const row = result.rows[0]
      const record = mapRuleRow(row)

      // Audit log
      await this.insertAuditLog(client, {
        ruleId: row.rule_id,
        tenantId: row.tenant_id,
        stateCode: row.state_code,
        version: row.version,
        action: 'create',
        actorId: actor.userId,
        actorRole: actor.role,
        oldStatus: null,
        newStatus: 'draft',
        changes: { input: input.ruleConfig },
      })

      return record
    })
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  /**
   * Get a rule by its ID.
   */
  async getById(ruleId: string): Promise<StateConsentRuleRecord | null> {
    const result = await query<StateConsentRuleRow>(
      `SELECT * FROM ehr_state_consent_rules WHERE rule_id = $1`,
      [ruleId],
    )
    return result.rows[0] ? mapRuleRow(result.rows[0]) : null
  }

  /**
   * List rules with optional filters (state, status, tenant).
   */
  async list(
    filters: {
      stateCode?: string
      status?: RuleStatus
      tenantId?: string | null
      page?: number
      limit?: number
    } = {},
  ): Promise<StateConsentRuleRecord[]> {
    const conditions: string[] = []
    const params: unknown[] = []
    let paramIdx = 1

    if (filters.stateCode) {
      conditions.push(`state_code = $${paramIdx++}`)
      params.push(filters.stateCode.toUpperCase())
    }
    if (filters.status) {
      conditions.push(`status = $${paramIdx++}`)
      params.push(filters.status)
    }
    if (filters.tenantId !== undefined) {
      if (filters.tenantId === null) {
        conditions.push(`tenant_id IS NULL`)
      } else {
        conditions.push(`tenant_id = $${paramIdx++}`)
        params.push(filters.tenantId)
      }
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = filters.limit ?? 50
    const offset = ((filters.page ?? 1) - 1) * limit

    params.push(limit, offset)

    const result = await query<StateConsentRuleRow>(
      `SELECT * FROM ehr_state_consent_rules
       ${where}
       ORDER BY state_code ASC, version DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      params,
    )
    return result.rows.map((row) => mapRuleRow(row))
  }

  /**
   * Get the active rule for a state.
   * Tries tenant-specific first, falls back to global (NULL tenant).
   */
  async getActiveRule(
    stateCode: string,
    tenantId?: string | null,
  ): Promise<StateConsentRuleRecord | null> {
    const upperStateCode = stateCode.toUpperCase()
    if (tenantId) {
      const tenantResult = await query<StateConsentRuleRow>(
        `SELECT * FROM ehr_state_consent_rules
         WHERE state_code = $1 AND status = 'active' AND tenant_id = $2
           AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
         ORDER BY version DESC LIMIT 1`,
        [upperStateCode, tenantId],
      )
      if (tenantResult.rows[0]) {
        return mapRuleRow(tenantResult.rows[0])
      }
    }

    const result = await query<StateConsentRuleRow>(
      `SELECT * FROM ehr_state_consent_rules
       WHERE state_code = $1 AND status = 'active' AND tenant_id IS NULL
         AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
       ORDER BY version DESC LIMIT 1`,
      [upperStateCode],
    )
    return result.rows[0] ? mapRuleRow(result.rows[0]) : null
  }

  /**
   * Get all active rules (for cache warming).
   */
  async getAllActiveRules(): Promise<StateConsentRuleRecord[]> {
    const result = await query<StateConsentRuleRow>(
      `SELECT * FROM ehr_state_consent_rules
       WHERE status = 'active'
         AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
       ORDER BY state_code ASC`,
    )
    return result.rows.map((row) => mapRuleRow(row))
  }

  /**
   * Get the latest version number for a state_code + tenant.
   */
  async getLatestVersion(
    stateCode: string,
    tenantId?: string | null,
  ): Promise<number> {
    const result = await query<{ max_version: number }>(
      `SELECT COALESCE(MAX(version), 0) AS max_version
       FROM ehr_state_consent_rules
       WHERE state_code = $1
         AND COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE($2, '00000000-0000-0000-0000-000000000000'::uuid)`,
      [stateCode, tenantId ?? null],
    )
    return result.rows[0]?.max_version ?? 0
  }

  // -------------------------------------------------------------------------
  // Update (draft rules only)
  // -------------------------------------------------------------------------

  /**
   * Update a draft rule's configuration.
   * Only rules with status='draft' can be updated.
   */
  async updateDraft(
    ruleId: string,
    input: UpdateStateRuleInput,
    actor: ActorContext,
  ): Promise<StateConsentRuleRecord | null> {
    return await transaction(async (client) => {
      const sets: string[] = []
      const params: unknown[] = []
      let paramIdx = 1

      if (input.ruleConfig !== undefined) {
        sets.push(`rule_config = $${paramIdx++}`)
        params.push(JSON.stringify(input.ruleConfig))
      }
      if (input.effectiveDate !== undefined) {
        sets.push(`effective_date = $${paramIdx++}`)
        params.push(input.effectiveDate)
      }
      if (input.expiryDate !== undefined) {
        sets.push(`expiry_date = $${paramIdx++}`)
        params.push(input.expiryDate)
      }
      if (input.notes !== undefined) {
        sets.push(`notes = $${paramIdx++}`)
        params.push(input.notes)
      }

      if (sets.length === 0) {
        const row = await client.query<StateConsentRuleRow>(
          `SELECT * FROM ehr_state_consent_rules WHERE rule_id = $1`,
          [ruleId],
        )
        return row.rows[0] ? mapRuleRow(row.rows[0]) : null
      }

      params.push(ruleId)

      const result = await client.query<StateConsentRuleRow>(
        `UPDATE ehr_state_consent_rules
         SET ${sets.join(', ')}
         WHERE rule_id = $${paramIdx++} AND status = 'draft'
         RETURNING *`,
        params,
      )

      if (!result.rows[0]) return null
      const row = result.rows[0]
      const record = mapRuleRow(row)

      // Audit log
      await this.insertAuditLog(client, {
        ruleId: row.rule_id,
        tenantId: row.tenant_id,
        stateCode: row.state_code,
        version: row.version,
        action: 'update',
        actorId: actor.userId,
        actorRole: actor.role,
        oldStatus: 'draft',
        newStatus: 'draft',
        changes: {
          ruleConfig: input.ruleConfig,
          effectiveDate: input.effectiveDate,
          expiryDate: input.expiryDate,
          notes: input.notes,
        },
      })

      return record
    })
  }

  // -------------------------------------------------------------------------
  // State machine transitions
  // -------------------------------------------------------------------------

  /**
   * Submit a draft rule for review.
   * Transition: draft → review
   */
  async submitForReview(
    ruleId: string,
    actor: ActorContext,
    notes?: string,
  ): Promise<StateConsentRuleRecord | null> {
    return await this.transitionStatus(
      ruleId,
      'draft',
      'review',
      'submit_for_review',
      actor,
      {
        reviewedBy: actor.userId,
        reviewedByRole: actor.role,
        reviewedAt: new Date().toISOString(),
        ...(notes !== undefined ? { notes } : {}),
      },
    )
  }

  /**
   * Approve a rule that's in review.
   * Transition: review → approved
   */
  async approve(
    ruleId: string,
    actor: ActorContext,
    notes?: string,
  ): Promise<StateConsentRuleRecord | null> {
    return await this.transitionStatus(
      ruleId,
      'review',
      'approved',
      'approve',
      actor,
      {
        approvedBy: actor.userId,
        approvedByRole: actor.role,
        approvedAt: new Date().toISOString(),
        ...(notes !== undefined ? { notes } : {}),
      },
    )
  }

  /**
   * Activate an approved rule.
   * This supersedes any previously active rule for the same state_code + tenant.
   * Transition: approved → active (and previously active → superseded)
   */
  async activate(
    ruleId: string,
    actor: ActorContext,
    notes?: string,
  ): Promise<StateConsentRuleRecord | null> {
    return await transaction(async (client) => {
      // Get the rule to activate
      const ruleResult = await client.query<StateConsentRuleRow>(
        `SELECT * FROM ehr_state_consent_rules
         WHERE rule_id = $1 AND status = 'approved'`,
        [ruleId],
      )
      if (!ruleResult.rows[0]) return null
      const rule = ruleResult.rows[0]

      // Find and supersede any currently active rule for the same state_code + tenant
      const activeResult = await client.query<StateConsentRuleRow>(
        `SELECT * FROM ehr_state_consent_rules
         WHERE state_code = $1
           AND status = 'active'
           AND COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = COALESCE($2, '00000000-0000-0000-0000-000000000000'::uuid)`,
        [rule.state_code, rule.tenant_id],
      )

      const supersededRules: string[] = []
      for (const activeRow of activeResult.rows) {
        await client.query(
          `UPDATE ehr_state_consent_rules
           SET status = 'superseded', superseded_by = $1, updated_at = NOW()
           WHERE rule_id = $2`,
          [ruleId, activeRow.rule_id],
        )
        supersededRules.push(activeRow.rule_id)

        // Audit log for supersede
        await this.insertAuditLog(client, {
          ruleId: activeRow.rule_id,
          tenantId: activeRow.tenant_id,
          stateCode: activeRow.state_code,
          version: activeRow.version,
          action: 'supersede',
          actorId: actor.userId,
          actorRole: actor.role,
          oldStatus: 'active',
          newStatus: 'superseded',
          changes: { supersededBy: ruleId },
        })
      }

      // Activate the new rule
      const sets = ['status = $1', 'activated_at = $2', 'updated_at = NOW()']
      const params: unknown[] = ['active', new Date().toISOString()]
      let paramIdx = 3

      if (notes !== undefined) {
        sets.push(`notes = $${paramIdx++}`)
        params.push(notes)
      }

      params.push(ruleId)

      const result = await client.query<StateConsentRuleRow>(
        `UPDATE ehr_state_consent_rules
         SET ${sets.join(', ')}
         WHERE rule_id = $${paramIdx++}
         RETURNING *`,
        params,
      )

      if (!result.rows[0]) return null
      const row = result.rows[0]
      const record = mapRuleRow(row)

      // Audit log for activation
      await this.insertAuditLog(client, {
        ruleId: row.rule_id,
        tenantId: row.tenant_id,
        stateCode: row.state_code,
        version: row.version,
        action: 'activate',
        actorId: actor.userId,
        actorRole: actor.role,
        oldStatus: 'approved',
        newStatus: 'active',
        changes: { supersededRules },
      })

      return record
    })
  }

  /**
   * Archive a rule (superseded or draft).
   * Transition: superseded/draft → archived
   */
  async archive(
    ruleId: string,
    actor: ActorContext,
    notes?: string,
  ): Promise<StateConsentRuleRecord | null> {
    const rule = await this.getById(ruleId)
    if (!rule || rule.status === 'active') return null

    return await this.transitionStatus(
      ruleId,
      rule.status,
      'archived',
      'archive',
      actor,
      notes !== undefined ? { notes } : {},
    )
  }

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  /**
   * Permanently delete a draft rule.
   * Only draft rules can be deleted. Uses audit log.
   */
  async delete(ruleId: string, actor: ActorContext): Promise<boolean> {
    return await transaction(async (client) => {
      // Get the rule first for audit logging
      const ruleResult = await client.query<StateConsentRuleRow>(
        `SELECT * FROM ehr_state_consent_rules
         WHERE rule_id = $1 AND status = 'draft'`,
        [ruleId],
      )
      if (!ruleResult.rows[0]) return false
      const row = ruleResult.rows[0]

      await this.insertAuditLog(client, {
        ruleId: row.rule_id,
        tenantId: row.tenant_id,
        stateCode: row.state_code,
        version: row.version,
        action: 'delete',
        actorId: actor.userId,
        actorRole: actor.role,
        oldStatus: 'draft',
        newStatus: null,
        changes: { deleted: true },
      })

      const result = await client.query(
        `DELETE FROM ehr_state_consent_rules
         WHERE rule_id = $1 AND status = 'draft'`,
        [ruleId],
      )

      return (result.rowCount ?? 0) > 0
    })
  }

  // -------------------------------------------------------------------------
  // Audit log
  // -------------------------------------------------------------------------

  /**
   * Get audit log entries for a rule.
   */
  async getAuditLog(
    ruleId: string,
    limit = 50,
  ): Promise<StateRuleAuditRecord[]> {
    const result = await query<StateRuleAuditRow>(
      `SELECT * FROM ehr_state_consent_rules_audit
       WHERE rule_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [ruleId, limit],
    )
    return result.rows.map((row) => mapAuditRow(row))
  }

  /**
   * Get audit log entries for a state (all rules).
   */
  async getAuditLogByState(
    stateCode: string,
    limit = 100,
  ): Promise<StateRuleAuditRecord[]> {
    const result = await query<StateRuleAuditRow>(
      `SELECT * FROM ehr_state_consent_rules_audit
       WHERE state_code = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [stateCode.toUpperCase(), limit],
    )
    return result.rows.map((row) => mapAuditRow(row))
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Generic state transition with audit logging.
   */
  private async transitionStatus(
    ruleId: string,
    fromStatus: RuleStatus | null,
    toStatus: RuleStatus,
    action: AuditAction,
    actor: ActorContext,
    extraSets: Record<string, unknown> = {},
  ): Promise<StateConsentRuleRecord | null> {
    return await transaction(async (client) => {
      const sets: string[] = ['status = $1', 'updated_at = NOW()']
      const params: unknown[] = [toStatus]
      let paramIdx = 2

      // Map extra sets to SQL
      const columnMap: Record<string, string> = {
        reviewedBy: 'reviewed_by',
        reviewedByRole: 'reviewed_by_role',
        reviewedAt: 'reviewed_at',
        approvedBy: 'approved_by',
        approvedByRole: 'approved_by_role',
        approvedAt: 'approved_at',
        activatedAt: 'activated_at',
        notes: 'notes',
      }

      for (const [key, value] of Object.entries(extraSets)) {
        const column = columnMap[key]
        if (column) {
          sets.push(`${column} = $${paramIdx++}`)
          params.push(value)
        }
      }

      // Build WHERE clause
      const whereClause = fromStatus
        ? `WHERE rule_id = $${paramIdx++} AND status = $${paramIdx++}`
        : `WHERE rule_id = $${paramIdx++} AND status != 'active'`

      if (fromStatus) {
        params.push(ruleId, fromStatus)
      } else {
        params.push(ruleId)
      }

      const result = await client.query<StateConsentRuleRow>(
        `UPDATE ehr_state_consent_rules
         SET ${sets.join(', ')}
         ${whereClause}
         RETURNING *`,
        params,
      )

      if (!result.rows[0]) return null
      const row = result.rows[0]
      const record = mapRuleRow(row)

      // Audit log
      await this.insertAuditLog(client, {
        ruleId: row.rule_id,
        tenantId: row.tenant_id,
        stateCode: row.state_code,
        version: row.version,
        action,
        actorId: actor.userId,
        actorRole: actor.role,
        oldStatus: fromStatus,
        newStatus: toStatus,
        changes: extraSets,
      })

      return record
    })
  }

  /**
   * Insert an audit log entry.
   * Must be called within a transaction.
   */
  private async insertAuditLog(
    client: PoolClient,
    entry: {
      ruleId: string
      tenantId: string | null
      stateCode: string
      version: number
      action: AuditAction
      actorId: string
      actorRole: string
      oldStatus: RuleStatus | null
      newStatus: RuleStatus | null
      changes: Record<string, unknown>
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO ehr_state_consent_rules_audit
         (rule_id, tenant_id, state_code, version, action,
          actor_id, actor_role, old_status, new_status, changes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entry.ruleId,
        entry.tenantId,
        entry.stateCode,
        entry.version,
        entry.action,
        entry.actorId,
        entry.actorRole,
        entry.oldStatus,
        entry.newStatus,
        JSON.stringify(entry.changes),
      ],
    )
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const stateConsentRulesRepository = new StateConsentRulesRepository()
