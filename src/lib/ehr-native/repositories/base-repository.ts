import type { PoolClient } from 'pg'
import { transaction, type DbQueryResult, type QueryResultRow } from '../../db'

/**
 * Context for Row-Level Security (RLS) policies.
 * All EHR repositories require this to be set before queries execute.
 */
export interface RLSContext {
  /** Tenant UUID for multi-tenant isolation */
  tenantId: string
  /** Authenticated user UUID */
  userId: string
  /** Clinical role of the authenticated user */
  role: string
  /** Whether break-glass access is active */
  breakGlass?: boolean
}

/**
 * Base repository providing RLS context management and common CRUD operations
 * for EHR-native FHIR resources stored as JSONB in PostgreSQL.
 *
 * All queries are executed within a transaction that sets RLS session variables
 * (`app.tenant_id` and `request.jwt.claims`) so Postgres RLS policies enforce
 * tenant isolation and consent checks transparently.
 */
export abstract class BaseRepository<TResource extends { id?: string }> {
  protected abstract readonly tableName: string
  protected abstract readonly idColumn: string
  protected abstract readonly resourceType: string

  constructor(protected readonly rlsContext: RLSContext) {}

  /**
   * Sets RLS session variables on a PoolClient so all subsequent queries
   * within the transaction are filtered by RLS policies.
   */
  protected async setRLSContext(client: PoolClient): Promise<void> {
    const claims = JSON.stringify({
      sub: this.rlsContext.userId,
      role: this.rlsContext.role,
      break_glass: this.rlsContext.breakGlass ?? false,
    })
    await client.query(`SET LOCAL app.tenant_id = $1`, [this.rlsContext.tenantId])
    await client.query(`SET LOCAL request.jwt.claims = $1`, [claims])
  }

  /**
   * Runs a callback within a transaction that has RLS context set.
   */
  protected async withRLS<TResult>(
    callback: (client: PoolClient) => Promise<TResult>
  ): Promise<TResult> {
    return transaction(async (client) => {
      await this.setRLSContext(client)
      return callback(client)
    })
  }

  /**
   * Finds a single resource by its UUID.
   * Returns null when not found or when RLS denies access.
   */
  async findById(id: string): Promise<TResource | null> {
    const result = await this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: TResource }>(
        `SELECT fhir_resource FROM ${this.tableName} WHERE ${this.idColumn} = $1`,
        [id]
      )
      return res.rows[0]?.fhir_resource ?? null
    })
    return result
  }

  /**
   * Retrieves all resources for a given patient, ordered by most recent first.
   */
  async findByPatient(patientId: string, limit = 50, offset = 0): Promise<TResource[]> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ fhir_resource: TResource }>(
        `SELECT fhir_resource FROM ${this.tableName}
         WHERE patient_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [patientId, limit, offset]
      )
      return res.rows.map((r) => r.fhir_resource)
    })
  }

  /**
   * Deletes a resource by its UUID. Only systemAdmin role typically passes RLS for deletes.
   */
  async delete(id: string): Promise<boolean> {
    return this.withRLS(async (client) => {
      const res = await client.query(
        `DELETE FROM ${this.tableName} WHERE ${this.idColumn} = $1`,
        [id]
      )
      return (res.rowCount ?? 0) > 0
    })
  }

  /**
   * Counts resources for a patient within the current tenant context.
   */
  async countByPatient(patientId: string): Promise<number> {
    return this.withRLS(async (client) => {
      const res = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM ${this.tableName} WHERE patient_id = $1`,
        [patientId]
      )
      return parseInt(res.rows[0]?.count ?? '0', 10)
    })
  }

  /**
   * Helper to execute a raw query within RLS context and return rows.
   */
  protected async queryWithRLS<TResult extends QueryResultRow>(
    text: string,
    params: unknown[]
  ): Promise<DbQueryResult<TResult>> {
    return this.withRLS(async (client) => {
      return client.query<TResult>(text, params) as unknown as DbQueryResult<TResult>
    })
  }
}
