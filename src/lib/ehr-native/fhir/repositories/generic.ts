/**
 * Generic repository for FHIR resources stored in the `ehr_resource` table.
 *
 * Handles the 14 resource types without dedicated tables:
 * Condition, AllergyIntolerance, MedicationRequest, Medication, Immunization,
 * Procedure, DiagnosticReport, Schedule, Slot, ClaimResponse, Coverage,
 * ExplanationOfBenefit, Communication, CommunicationRequest.
 *
 * RLS is enforced by setting `app.tenant_id` and `request.jwt.claims` session
 * variables before each query.
 */

import { query } from '@/lib/db'
import type { FHIRRequestContext } from '../types.js'
import type { FHIRResourceType } from '../types.js'

/** Set RLS session variables for the current query context. */
export function buildRlsSettings(ctx: FHIRRequestContext): string {
  const tenantId = ctx.tenantId.replace(/'/g, "''")
  const role = ctx.role.replace(/'/g, "''")
  const userId = ctx.userId.replace(/'/g, "''")
  const breakGlass = ctx.breakGlass ? 'true' : 'false'

  return [
    `SET LOCAL app.tenant_id = '${tenantId}'`,
    `SET LOCAL request.jwt.claims = '{"role": "${role}", "sub": "${userId}", "break_glass": "${breakGlass}"}'`,
  ].join('; ')
}

/** Create a resource in the generic ehr_resource table. */
export async function createGenericResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  fhirResource: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const rls = buildRlsSettings(ctx)
  const sql = `
    ${rls};
    INSERT INTO ehr_resource (resource_id, tenant_id, resource_type, active, fhir_resource)
    VALUES ($1, $2, $3, true, $4)
    RETURNING fhir_resource;
  `

  const result = await query<{ fhir_resource: Record<string, unknown> }>(sql, [
    resourceId,
    ctx.tenantId,
    resourceType,
    JSON.stringify(fhirResource),
  ])

  if (result.rows.length === 0) {
    return null
  }

  return result.rows[0].fhir_resource
}

/** Read a resource from the generic ehr_resource table. */
export async function readGenericResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
): Promise<{
  resource: Record<string, unknown>
  updatedAt: string
  active: boolean
} | null> {
  const rls = buildRlsSettings(ctx)
  const sql = `
    ${rls};
    SELECT fhir_resource, updated_at, active
    FROM ehr_resource
    WHERE resource_id = $1 AND resource_type = $2 AND tenant_id = $3;
  `

  const result = await query<{
    fhir_resource: Record<string, unknown>
    updated_at: string
    active: boolean
  }>(sql, [resourceId, resourceType, ctx.tenantId])

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    resource: row.fhir_resource,
    updatedAt: row.updated_at,
    active: row.active,
  }
}

/** Update a resource in the generic ehr_resource table. */
export async function updateGenericResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  fhirResource: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const rls = buildRlsSettings(ctx)
  const sql = `
    ${rls};
    UPDATE ehr_resource
    SET fhir_resource = $4, updated_at = now()
    WHERE resource_id = $1 AND resource_type = $2 AND tenant_id = $3
    RETURNING fhir_resource;
  `

  const result = await query<{ fhir_resource: Record<string, unknown> }>(sql, [
    resourceId,
    resourceType,
    ctx.tenantId,
    JSON.stringify(fhirResource),
  ])

  if (result.rows.length === 0) {
    return null
  }

  return result.rows[0].fhir_resource
}

/** Soft-delete a resource in the generic ehr_resource table. */
export async function softDeleteGenericResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  fhirResource: Record<string, unknown>,
): Promise<boolean> {
  const rls = buildRlsSettings(ctx)
  const sql = `
    ${rls};
    UPDATE ehr_resource
    SET active = false, fhir_resource = $4, updated_at = now()
    WHERE resource_id = $1 AND resource_type = $2 AND tenant_id = $3
    RETURNING resource_id;
  `

  const result = await query<{ resource_id: string }>(sql, [
    resourceId,
    resourceType,
    ctx.tenantId,
    JSON.stringify(fhirResource),
  ])

  return result.rows.length > 0
}

/** Search resources in the generic ehr_resource table. */
export async function searchGenericResources(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  searchParams: URLSearchParams,
): Promise<{ resources: Record<string, unknown>[]; total: number }> {
  const rls = buildRlsSettings(ctx)
  const count = parseInt(searchParams.get('_count') ?? '20', 10)
  const offset = parseInt(searchParams.get('_offset') ?? '0', 10)
  const limitedCount = Math.min(Math.max(count, 0), 100)
  const limitedOffset = Math.max(offset, 0)

  const idParam = searchParams.get('_id')

  let whereClause = 'WHERE resource_type = $1 AND tenant_id = $2'
  const params: unknown[] = [resourceType, ctx.tenantId]

  if (idParam) {
    whereClause += ' AND resource_id = $3'
    params.push(idParam)
  }

  const sql = `
    ${rls};
    SELECT fhir_resource, count(*) OVER() AS total_count
    FROM ehr_resource
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limitedCount} OFFSET ${limitedOffset};
  `

  const result = await query<{
    fhir_resource: Record<string, unknown>
    total_count: string
  }>(sql, params)

  const total =
    result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0
  const resources = result.rows.map((row) => row.fhir_resource)

  return { resources, total }
}

/** Get version history for a generic resource. */
export async function getGenericResourceHistory(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
): Promise<
  Array<{
    resource: Record<string, unknown>
    timestamp: string
    action: string
  }>
> {
  const rls = buildRlsSettings(ctx)
  const sql = `
    ${rls};
    SELECT fhir_resource, timestamp, action
    FROM ehr_resource_history
    WHERE resource_type = $1 AND resource_id = $2 AND tenant_id = $3
    ORDER BY timestamp DESC;
  `

  const result = await query<{
    fhir_resource: Record<string, unknown>
    timestamp: string
    action: string
  }>(sql, [resourceType, resourceId, ctx.tenantId])

  return result.rows.map((row) => ({
    resource: row.fhir_resource,
    timestamp: row.timestamp,
    action: row.action,
  }))
}

/** Insert a history entry for a generic resource. */
export async function insertGenericResourceHistory(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  action: string,
  fhirResource: Record<string, unknown>,
): Promise<void> {
  const rls = buildRlsSettings(ctx)
  const sql = `
    ${rls};
    INSERT INTO ehr_resource_history (resource_id, tenant_id, resource_type, action, fhir_resource, timestamp)
    VALUES ($1, $2, $3, $4, $5, now());
  `

  await query(sql, [
    resourceId,
    ctx.tenantId,
    resourceType,
    action,
    JSON.stringify(fhirResource),
  ])
}
