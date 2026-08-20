/**
 * Generic repository for FHIR resources stored in the `ehr_resource` table.
 *
 * Handles the 14 resource types without dedicated tables:
 * Condition, AllergyIntolerance, MedicationRequest, Medication, Immunization,
 * Procedure, DiagnosticReport, Schedule, Slot, ClaimResponse, Coverage,
 * ExplanationOfBenefit, Communication, CommunicationRequest.
 *
 * RLS is enforced by setting `app.tenant_id` and `request.jwt.claims` session
 * variables before each query, inside a transaction so SET LOCAL persists.
 */

import type { PoolClient } from "pg";

import { transaction } from "@/lib/db";

import type { FHIRRequestContext } from "../types.js";
import type { FHIRResourceType } from "../types.js";

/** Build individual SET LOCAL commands for RLS session variables. */
export function buildRlsSettings(ctx: FHIRRequestContext): string[] {
  const tenantId = ctx.tenantId.replace(/'/g, "''");
  const role = ctx.role.replace(/'/g, "''");
  const userId = ctx.userId.replace(/'/g, "''");
  const breakGlass = ctx.breakGlass ? "true" : "false";

  return [
    `SET LOCAL app.tenant_id = '${tenantId}'`,
    `SET LOCAL request.jwt.claims = '{"role": "${role}", "sub": "${userId}", "break_glass": "${breakGlass}"}'`,
  ];
}

/** Apply RLS session variables to a transaction client. */
export async function applyRlsSettings(
  client: PoolClient,
  ctx: FHIRRequestContext,
): Promise<void> {
  for (const cmd of buildRlsSettings(ctx)) {
    await client.query(cmd);
  }
}

/** Create a resource in the generic ehr_resource table. */
export async function createGenericResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  fhirResource: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  return transaction(async (client) => {
    await applyRlsSettings(client, ctx);
    const result = await client.query<{
      fhir_resource: Record<string, unknown>;
    }>(
      "INSERT INTO ehr_resource (resource_id, tenant_id, resource_type, active, fhir_resource) VALUES ($1, $2, $3, true, $4) RETURNING fhir_resource;",
      [resourceId, ctx.tenantId, resourceType, JSON.stringify(fhirResource)],
    );

    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0].fhir_resource;
  });
}

/** Read a resource from the generic ehr_resource table. */
export async function readGenericResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
): Promise<{
  resource: Record<string, unknown>;
  updatedAt: string;
  active: boolean;
} | null> {
  return transaction(async (client) => {
    await applyRlsSettings(client, ctx);
    const result = await client.query<{
      fhir_resource: Record<string, unknown>;
      updated_at: string;
      active: boolean;
    }>(
      "SELECT fhir_resource, updated_at, active FROM ehr_resource WHERE resource_id = $1 AND resource_type = $2 AND tenant_id = $3;",
      [resourceId, resourceType, ctx.tenantId],
    );

    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      resource: row.fhir_resource,
      updatedAt: row.updated_at,
      active: row.active,
    };
  });
}

/** Update a resource in the generic ehr_resource table. */
export async function updateGenericResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  fhirResource: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  return transaction(async (client) => {
    await applyRlsSettings(client, ctx);
    const result = await client.query<{
      fhir_resource: Record<string, unknown>;
    }>(
      "UPDATE ehr_resource SET fhir_resource = $4, updated_at = now() WHERE resource_id = $1 AND resource_type = $2 AND tenant_id = $3 RETURNING fhir_resource;",
      [resourceId, resourceType, ctx.tenantId, JSON.stringify(fhirResource)],
    );

    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0].fhir_resource;
  });
}

/** Soft-delete a resource in the generic ehr_resource table. */
export async function softDeleteGenericResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  fhirResource: Record<string, unknown>,
): Promise<boolean> {
  return transaction(async (client) => {
    await applyRlsSettings(client, ctx);
    const result = await client.query<{ resource_id: string }>(
      "UPDATE ehr_resource SET active = false, fhir_resource = $4, updated_at = now() WHERE resource_id = $1 AND resource_type = $2 AND tenant_id = $3 RETURNING resource_id;",
      [resourceId, resourceType, ctx.tenantId, JSON.stringify(fhirResource)],
    );
    return result.rows.length > 0;
  });
}

/** Search resources in the generic ehr_resource table. */
export async function searchGenericResources(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  searchParams: URLSearchParams,
): Promise<{ resources: Record<string, unknown>[]; total: number }> {
  const count = parseInt(searchParams.get("_count") ?? "20", 10);
  const offset = parseInt(searchParams.get("_offset") ?? "0", 10);
  const limitedCount = Math.min(Math.max(count, 0), 100);
  const limitedOffset = Math.max(offset, 0);

  const idParam = searchParams.get("_id");

  let whereClause = "WHERE resource_type = $1 AND tenant_id = $2";
  const params: unknown[] = [resourceType, ctx.tenantId];
  let paramIdx = 3;

  if (idParam) {
    whereClause += ` AND resource_id = $${paramIdx}`;
    params.push(idParam);
    paramIdx++;
  }

  const activeParam = searchParams.get("active");
  if (activeParam !== null) {
    whereClause += ` AND active = $${paramIdx}`;
    params.push(activeParam === "true");
    paramIdx++;
  } else {
    whereClause += " AND active = true";
  }

  const sql = `SELECT fhir_resource, count(*) OVER() AS total_count FROM ehr_resource ${whereClause} ORDER BY created_at DESC LIMIT ${limitedCount} OFFSET ${limitedOffset};`;

  return transaction(async (client) => {
    await applyRlsSettings(client, ctx);
    const result = await client.query<{
      fhir_resource: Record<string, unknown>;
      total_count: string;
    }>(sql, params);

    const total =
      result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const resources = result.rows.map((row) => row.fhir_resource);
    return { resources, total };
  });
}

/** Get version history for a generic resource. */
export async function getGenericResourceHistory(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
): Promise<
  Array<{
    resource: Record<string, unknown>;
    timestamp: string;
    action: string;
  }>
> {
  return transaction(async (client) => {
    await applyRlsSettings(client, ctx);
    const result = await client.query<{
      fhir_resource: Record<string, unknown>;
      created_at: string;
      action: string;
    }>(
      "SELECT fhir_resource, created_at, action FROM ehr_resource_history WHERE resource_type = $1 AND resource_id = $2 AND tenant_id = $3 ORDER BY created_at DESC;",
      [resourceType, resourceId, ctx.tenantId],
    );

    return result.rows.map((row) => ({
      resource: row.fhir_resource,
      timestamp: row.created_at,
      action: row.action,
    }));
  });
}

/** Insert a history entry for a generic resource. */
export async function insertGenericResourceHistory(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  action: string,
  fhirResource: Record<string, unknown>,
): Promise<void> {
  return transaction(async (client) => {
    await applyRlsSettings(client, ctx);
    await client.query(
      "INSERT INTO ehr_resource_history (resource_id, tenant_id, resource_type, version_id, action, fhir_resource, created_at) VALUES ($1, $2, $3, gen_random_uuid()::text, $4, $5, now());",
      [
        resourceId,
        ctx.tenantId,
        resourceType,
        action,
        JSON.stringify(fhirResource),
      ],
    );
  });
}
