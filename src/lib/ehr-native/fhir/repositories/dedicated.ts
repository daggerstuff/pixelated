/**
 * Dedicated table repository for FHIR resources with dedicated DB tables.
 *
 * Handles 9 resource types that have their own tables in migration 015:
 * Patient, Practitioner, Encounter, Observation, Appointment,
 * DocumentReference, Claim, Consent, ServiceRequest.
 *
 * Each table stores the full FHIR resource in a `fhir_resource` JSONB column
 * alongside extracted columns for indexing and querying.
 *
 * RLS is enforced via `applyRlsSettings()` session variables inside a
 * transaction so SET LOCAL persists for the main query.
 */

import { transaction } from "@/lib/db";

import type { FHIRRequestContext, FHIRResourceType } from "../types.js";
import { RESOURCE_TABLE_MAP, RESOURCE_PK_MAP } from "../types.js";
import { applyRlsSettings } from "./generic.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Extract the ID from a FHIR reference (handles both relative and absolute URLs). */
function extractFhirId(reference: string | undefined): string | null {
  if (!reference) return null;
  const parts = reference.split("/");
  return parts[parts.length - 1] || null;
}

/** Extracted column values per resource type from the FHIR resource. */
function extractColumns(
  resourceType: FHIRResourceType,
  resource: Record<string, unknown>,
): Record<string, unknown> {
  const extractors: Partial<
    Record<
      FHIRResourceType,
      (r: Record<string, unknown>) => Record<string, unknown>
    >
  > = {
    Patient: (r) => ({
      mrn: (r["identifier"] as Array<{ value?: string }>)?.[0]?.value ?? null,
      active: r["active"] ?? true,
      family_name:
        (r["name"] as Array<{ family?: string }>)?.[0]?.family ?? null,
      given_name:
        (r["name"] as Array<{ given?: string[] }>)?.[0]?.given?.[0] ?? null,
      birth_date: r["birthDate"] ?? null,
      gender: r["gender"] ?? null,
    }),
    Practitioner: (r) => ({
      npi: (r["identifier"] as Array<{ value?: string }>)?.[0]?.value ?? null,
      active: r["active"] ?? true,
      name:
        (r["name"] as Array<{ text?: string }>)?.[0]?.text ??
        ([
          (r["name"] as Array<{ family?: string; given?: string[] }>)?.[0]
            ?.given?.[0] ?? "",
          (r["name"] as Array<{ family?: string }>)?.[0]?.family ?? "",
        ]
          .filter(Boolean)
          .join(" ") ||
          null),
    }),
    Encounter: (r) => ({
      patient_id: extractFhirId(
        (r["subject"] as { reference?: string })?.reference ?? undefined,
      ),
      practitioner_id: extractFhirId(
        (
          r["participant"] as Array<{ individual?: { reference?: string } }>
        )?.[0]?.individual?.reference ?? undefined,
      ),
      status: r["status"] ?? "planned",
      class: (r["class"] as { code?: string })?.code ?? null,
      period_start: (r["period"] as { start?: string })?.start ?? null,
      period_end: (r["period"] as { end?: string })?.end ?? null,
    }),
    Observation: (r) => ({
      patient_id: extractFhirId(
        (r["subject"] as { reference?: string })?.reference ?? undefined,
      ),
      encounter_id: extractFhirId(
        (r["encounter"] as { reference?: string })?.reference ?? undefined,
      ),
      status: r["status"] ?? "final",
      code:
        (r["code"] as { coding?: Array<{ code?: string }> })?.coding?.[0]
          ?.code ?? null,
      effective_date:
        (r["effectiveDateTime"] as string) ??
        (r["effectiveDate"] as string) ??
        null,
    }),
    Appointment: (r) => {
      const participants =
        (r["participant"] as Array<{ actor?: { reference?: string } }>) ?? [];
      let patientId: string | null = null;
      let practitionerId: string | null = null;
      for (const p of participants) {
        const ref = p.actor?.reference ?? "";
        if (ref.includes("Patient/")) {
          patientId = extractFhirId(ref);
        } else if (ref.includes("Practitioner/")) {
          practitionerId = extractFhirId(ref);
        }
      }
      return {
        patient_id: patientId,
        practitioner_id: practitionerId,
        status: r["status"] ?? "proposed",
        start_time: r["start"] ?? null,
        end_time: r["end"] ?? null,
      };
    },
    DocumentReference: (r) => ({
      patient_id: extractFhirId(
        (r["subject"] as { reference?: string })?.reference ?? undefined,
      ),
      status: r["status"] ?? "current",
      type:
        (r["type"] as { coding?: Array<{ code?: string }> })?.coding?.[0]
          ?.code ?? null,
      created_date: r["created"] ?? new Date().toISOString(),
    }),
    Claim: (r) => ({
      patient_id: extractFhirId(
        (r["patient"] as { reference?: string })?.reference ?? undefined,
      ),
      encounter_id: extractFhirId(
        (r["encounter"] as { reference?: string })?.reference ?? undefined,
      ),
      status: r["status"] ?? "active",
      total: r["total"] ?? null,
      created_date: r["created"] ?? new Date().toISOString(),
    }),
    Consent: (r) => ({
      patient_id: extractFhirId(
        (r["patient"] as { reference?: string })?.reference ?? undefined,
      ),
      status: r["status"] ?? "active",
      scope:
        (r["scope"] as { coding?: Array<{ code?: string }> })?.coding?.[0]
          ?.code ?? null,
      category:
        (r["category"] as Array<{ coding?: Array<{ code?: string }> }>)?.[0]
          ?.coding?.[0]?.code ?? null,
      consent_level: "minimal",
      period_start: (r["period"] as { start?: string })?.start ?? null,
      period_end: (r["period"] as { end?: string })?.end ?? null,
    }),
    ServiceRequest: (r) => ({
      patient_id: extractFhirId(
        (r["subject"] as { reference?: string })?.reference ?? undefined,
      ),
      practitioner_id: extractFhirId(
        (r["requester"] as { reference?: string })?.reference ?? undefined,
      ),
      status: r["status"] ?? "active",
      intent: r["intent"] ?? "order",
      category:
        (r["category"] as Array<{ coding?: Array<{ code?: string }> }>)?.[0]
          ?.coding?.[0]?.code ?? null,
      code:
        (r["code"] as { coding?: Array<{ code?: string }> })?.coding?.[0]
          ?.code ?? null,
    }),
  };

  const extractor = extractors[resourceType];
  return extractor ? extractor(resource) : {};
}

/** Create a resource in a dedicated table. */
export async function createDedicatedResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  fhirResource: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const table = RESOURCE_TABLE_MAP[resourceType];
  const pk = RESOURCE_PK_MAP[resourceType];
  const extracted = extractColumns(resourceType, fhirResource);

  const columnParts: string[] = [pk, "tenant_id", "fhir_resource"];
  const valueParts: string[] = ["$1", "$2", "$3"];
  const values: unknown[] = [
    resourceId,
    ctx.tenantId,
    JSON.stringify(fhirResource),
  ];

  let paramIdx = 4;
  for (const [key, value] of Object.entries(extracted)) {
    if (value !== undefined) {
      columnParts.push(key);
      valueParts.push(`$${paramIdx}`);
      values.push(value);
      paramIdx++;
    }
  }

  const sql = `INSERT INTO ${table} (${columnParts.join(", ")}) VALUES (${valueParts.join(", ")}) RETURNING fhir_resource;`;

  return transaction(async (client) => {
    await applyRlsSettings(client, ctx);
    const result = await client.query<{
      fhir_resource: Record<string, unknown>;
    }>(sql, values);

    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0].fhir_resource;
  });
}

/** Read a resource from a dedicated table. */
export async function readDedicatedResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
): Promise<{
  resource: Record<string, unknown>;
  updatedAt: string;
  active: boolean;
} | null> {
  const table = RESOURCE_TABLE_MAP[resourceType];
  const pk = RESOURCE_PK_MAP[resourceType];

  const sql = `SELECT fhir_resource, updated_at, active FROM ${table} WHERE ${pk} = $1 AND tenant_id = $2;`;

  return transaction(async (client) => {
    await applyRlsSettings(client, ctx);
    const result = await client.query<{
      fhir_resource: Record<string, unknown>;
      updated_at: string;
      active: boolean;
    }>(sql, [resourceId, ctx.tenantId]);

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

/** Update a resource in a dedicated table. */
export async function updateDedicatedResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  fhirResource: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const table = RESOURCE_TABLE_MAP[resourceType];
  const pk = RESOURCE_PK_MAP[resourceType];
  const extracted = extractColumns(resourceType, fhirResource);

  const setParts: string[] = ["fhir_resource = $3", "updated_at = now()"];
  const values: unknown[] = [
    resourceId,
    ctx.tenantId,
    JSON.stringify(fhirResource),
  ];

  let paramIdx = 4;
  for (const [key, value] of Object.entries(extracted)) {
    if (value !== undefined) {
      setParts.push(`${key} = $${paramIdx}`);
      values.push(value);
      paramIdx++;
    }
  }

  const sql = `UPDATE ${table} SET ${setParts.join(", ")} WHERE ${pk} = $1 AND tenant_id = $2 RETURNING fhir_resource;`;

  return transaction(async (client) => {
    await applyRlsSettings(client, ctx);
    const result = await client.query<{
      fhir_resource: Record<string, unknown>;
    }>(sql, values);

    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0].fhir_resource;
  });
}

/** Soft-delete a resource in a dedicated table. */
export async function softDeleteDedicatedResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  fhirResource: Record<string, unknown>,
): Promise<boolean> {
  const table = RESOURCE_TABLE_MAP[resourceType];
  const pk = RESOURCE_PK_MAP[resourceType];

  const sql = `UPDATE ${table} SET active = false, fhir_resource = $3, updated_at = now() WHERE ${pk} = $1 AND tenant_id = $2 RETURNING ${pk};`;

  return transaction(async (client) => {
    await applyRlsSettings(client, ctx);
    const result = await client.query<{ [key: string]: string }>(sql, [
      resourceId,
      ctx.tenantId,
      JSON.stringify(fhirResource),
    ]);
    return result.rows.length > 0;
  });
}

/** Search resources in a dedicated table. */
export async function searchDedicatedResources(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  searchParams: URLSearchParams,
): Promise<{ resources: Record<string, unknown>[]; total: number }> {
  const table = RESOURCE_TABLE_MAP[resourceType];
  const pk = RESOURCE_PK_MAP[resourceType];
  const count = parseInt(searchParams.get("_count") ?? "20", 10);
  const offset = parseInt(searchParams.get("_offset") ?? "0", 10);
  const limitedCount = Math.min(Math.max(count, 0), 100);
  const limitedOffset = Math.max(offset, 0);

  let whereClause = `WHERE tenant_id = $1`;
  const params: unknown[] = [ctx.tenantId];
  let paramIdx = 2;

  const idParam = searchParams.get("_id");
  if (idParam) {
    whereClause += ` AND ${pk} = $${paramIdx}`;
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

  const sql = `SELECT fhir_resource, count(*) OVER() AS total_count FROM ${table} ${whereClause} ORDER BY created_at DESC LIMIT ${limitedCount} OFFSET ${limitedOffset};`;

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

/** Get version history from the dedicated audit_history table. */
export async function getDedicatedResourceHistory(
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
  const sql =
    "SELECT fhir_resource, timestamp, action FROM ehr_audit_history WHERE resource_type = $1 AND resource_id = $2 AND tenant_id = $3 ORDER BY timestamp DESC;";

  return transaction(async (client) => {
    await applyRlsSettings(client, ctx);
    const result = await client.query<{
      fhir_resource: Record<string, unknown>;
      timestamp: string;
      action: string;
    }>(sql, [resourceType, resourceId, ctx.tenantId]);

    return result.rows.map((row) => ({
      resource: row.fhir_resource,
      timestamp: row.timestamp,
      action: row.action,
    }));
  });
}

/** Insert a history entry into the dedicated audit_history table. */
export async function insertDedicatedResourceHistory(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  action: string,
  fhirResource: Record<string, unknown>,
): Promise<void> {
  const actorId = UUID_RE.test(ctx.userId) ? ctx.userId : null;

  const sql =
    "INSERT INTO ehr_audit_history (tenant_id, resource_type, resource_id, action, actor_id, actor_role, timestamp, fhir_resource) VALUES ($1, $2, $3, $4, $5, $6, now(), $7);";

  return transaction(async (client) => {
    await applyRlsSettings(client, ctx);
    await client.query(sql, [
      ctx.tenantId,
      resourceType,
      resourceId,
      action,
      actorId,
      ctx.role,
      JSON.stringify(fhirResource),
    ]);
  });
}
