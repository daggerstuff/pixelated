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
 * RLS is enforced via `setRlsContext()` session variables within transactions.
 */

import { randomUUID } from 'node:crypto'

import { transaction } from '@/lib/db'

import type { FHIRRequestContext, FHIRResourceType } from '../types.js'
import { RESOURCE_TABLE_MAP, RESOURCE_PK_MAP } from '../types.js'
import { setRlsContext } from './generic.js'

/** Parse a FHIR reference string, returning the last path segment (the ID). */
function parseReferenceId(ref: string | undefined): string | null {
  if (!ref) {
    return null
  }
  // Handle both relative ("Patient/123") and absolute ("http://example.com/fhir/Patient/123") references
  const parts = ref.split('/')
  return parts[parts.length - 1] ?? null
}

/** Extract patient_id from a reference field. */
function extractPatientId(
  resource: Record<string, unknown>,
  field: string,
): string | null {
  const ref = (resource[field] as { reference?: string })?.reference
  return parseReferenceId(ref)
}

/** Extract actor references from Appointment participant array. */
function extractAppointmentParticipants(
  participants: Array<{ actor?: { reference?: string } }> | undefined,
): { patientId: string | null; practitionerId: string | null } {
  if (!participants) {
    return { patientId: null, practitionerId: null }
  }

  let patientId: string | null = null
  let practitionerId: string | null = null

  for (const participant of participants) {
    const ref = participant.actor?.reference
    if (!ref) {
      continue
    }
    if (ref.includes('Patient/')) {
      patientId = parseReferenceId(ref)
    } else if (ref.includes('Practitioner/')) {
      practitionerId = parseReferenceId(ref)
    }
  }

  return { patientId, practitionerId }
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
      mrn: (r['identifier'] as Array<{ value?: string }>)?.[0]?.value ?? null,
      active: r['active'] ?? true,
      family_name:
        (r['name'] as Array<{ family?: string }>)?.[0]?.family ?? null,
      given_name:
        (r['name'] as Array<{ given?: string[] }>)?.[0]?.given?.[0] ?? null,
      birth_date: r['birthDate'] ?? null,
      gender: r['gender'] ?? null,
    }),
    Practitioner: (r) => ({
      npi: (r['identifier'] as Array<{ value?: string }>)?.[0]?.value ?? null,
      active: r['active'] ?? true,
      name:
        (r['name'] as Array<{ text?: string }>)?.[0]?.text ??
        ([
          (r['name'] as Array<{ family?: string; given?: string[] }>)?.[0]
            ?.given?.[0] ?? '',
          (r['name'] as Array<{ family?: string }>)?.[0]?.family ?? '',
        ]
          .filter(Boolean)
          .join(' ') ||
          null),
    }),
    Encounter: (r) => ({
      patient_id: extractPatientId(r, 'subject'),
      practitioner_id: parseReferenceId(
        (
          r['participant'] as Array<{ individual?: { reference?: string } }>
        )?.[0]?.individual?.reference,
      ),
      status: r['status'] ?? 'planned',
      class: (r['class'] as { code?: string })?.code ?? null,
      period_start: (r['period'] as { start?: string })?.start ?? null,
      period_end: (r['period'] as { end?: string })?.end ?? null,
    }),
    Observation: (r) => ({
      patient_id: extractPatientId(r, 'subject'),
      encounter_id: parseReferenceId(
        (r['encounter'] as { reference?: string })?.reference,
      ),
      status: r['status'] ?? 'final',
      code:
        (r['code'] as { coding?: Array<{ code?: string }> })?.coding?.[0]
          ?.code ?? null,
      effective_date:
        (r['effectiveDateTime'] as string) ??
        (r['effectiveDate'] as string) ??
        null,
    }),
    Appointment: (r) => {
      const { patientId, practitionerId } = extractAppointmentParticipants(
        r['participant'] as Array<{ actor?: { reference?: string } }>,
      )
      return {
        patient_id: patientId,
        practitioner_id: practitionerId,
        status: r['status'] ?? 'proposed',
        start_time: r['start'] ?? null,
        end_time: r['end'] ?? null,
      }
    },
    DocumentReference: (r) => ({
      patient_id: extractPatientId(r, 'subject'),
      status: r['status'] ?? 'current',
      type:
        (r['type'] as { coding?: Array<{ code?: string }> })?.coding?.[0]
          ?.code ?? null,
      created_date: r['created'] ?? new Date().toISOString(),
    }),
    Claim: (r) => ({
      patient_id: extractPatientId(r, 'patient'),
      encounter_id: parseReferenceId(
        (r['encounter'] as { reference?: string })?.reference,
      ),
      status: r['status'] ?? 'active',
      total: r['total'] ?? null,
      created_date: r['created'] ?? new Date().toISOString(),
    }),
    Consent: (r) => ({
      patient_id: extractPatientId(r, 'patient'),
      status: r['status'] ?? 'active',
      scope:
        (r['scope'] as { coding?: Array<{ code?: string }> })?.coding?.[0]
          ?.code ?? null,
      category:
        (r['category'] as Array<{ coding?: Array<{ code?: string }> }>)?.[0]
          ?.coding?.[0]?.code ?? null,
      consent_level: 'minimal',
      period_start: (r['period'] as { start?: string })?.start ?? null,
      period_end: (r['period'] as { end?: string })?.end ?? null,
    }),
    ServiceRequest: (r) => ({
      patient_id: extractPatientId(r, 'subject'),
      practitioner_id: parseReferenceId(
        (r['requester'] as { reference?: string })?.reference,
      ),
      status: r['status'] ?? 'active',
      intent: r['intent'] ?? 'order',
      category:
        (r['category'] as Array<{ coding?: Array<{ code?: string }> }>)?.[0]
          ?.coding?.[0]?.code ?? null,
      code:
        (r['code'] as { coding?: Array<{ code?: string }> })?.coding?.[0]
          ?.code ?? null,
    }),
  }

  const extractor = extractors[resourceType]
  return extractor ? extractor(resource) : {}
}

/** Build SET clause for extracted columns. */
function buildSetClause(columns: Record<string, unknown>): {
  clause: string
  values: unknown[]
} {
  const entries = Object.entries(columns).filter(([, v]) => v !== undefined)
  if (entries.length === 0) {
    return { clause: '', values: [] }
  }

  const parts = entries.map(([key], idx) => `${key} = $${idx + 1}`)
  return {
    clause: parts.join(', '),
    values: entries.map(([, v]) => v),
  }
}

/** Validate that a string is a valid UUID. */
function isValidUuid(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

/** Create a resource in a dedicated table. */
export async function createDedicatedResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  fhirResource: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const table = RESOURCE_TABLE_MAP[resourceType]
  const pk = RESOURCE_PK_MAP[resourceType]
  const extracted = extractColumns(resourceType, fhirResource)

  return transaction(async (client) => {
    await setRlsContext(client, ctx)

    const columnParts: string[] = [pk, 'tenant_id', 'fhir_resource']
    const valueParts: string[] = ['$1', '$2', '$3']
    const values: unknown[] = [
      resourceId,
      ctx.tenantId,
      JSON.stringify(fhirResource),
    ]

    let paramIdx = 4
    for (const [key, value] of Object.entries(extracted)) {
      if (value !== undefined) {
        columnParts.push(key)
        valueParts.push(`$${paramIdx}`)
        values.push(value)
        paramIdx++
      }
    }

    const result = await client.query<{
      fhir_resource: Record<string, unknown>
    }>(
      `INSERT INTO ${table} (${columnParts.join(', ')})
       VALUES (${valueParts.join(', ')})
       RETURNING fhir_resource`,
      values,
    )

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0].fhir_resource
  })
}

/** Read a resource from a dedicated table. */
export async function readDedicatedResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
): Promise<{
  resource: Record<string, unknown>
  updatedAt: string
  active: boolean
} | null> {
  const table = RESOURCE_TABLE_MAP[resourceType]
  const pk = RESOURCE_PK_MAP[resourceType]

  return transaction(async (client) => {
    await setRlsContext(client, ctx)

    const result = await client.query<{
      fhir_resource: Record<string, unknown>
      updated_at: string
      active: boolean
    }>(
      `SELECT fhir_resource, updated_at, active
       FROM ${table}
       WHERE ${pk} = $1 AND tenant_id = $2`,
      [resourceId, ctx.tenantId],
    )

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      resource: row.fhir_resource,
      updatedAt: row.updated_at,
      active: row.active,
    }
  })
}

/** Update a resource in a dedicated table. */
export async function updateDedicatedResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  fhirResource: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const table = RESOURCE_TABLE_MAP[resourceType]
  const pk = RESOURCE_PK_MAP[resourceType]
  const extracted = extractColumns(resourceType, fhirResource)

  return transaction(async (client) => {
    await setRlsContext(client, ctx)

    const setParts: string[] = ['fhir_resource = $3', 'updated_at = now()']
    const values: unknown[] = [
      resourceId,
      ctx.tenantId,
      JSON.stringify(fhirResource),
    ]

    let paramIdx = 4
    for (const [key, value] of Object.entries(extracted)) {
      if (value !== undefined) {
        setParts.push(`${key} = $${paramIdx}`)
        values.push(value)
        paramIdx++
      }
    }

    const result = await client.query<{
      fhir_resource: Record<string, unknown>
    }>(
      `UPDATE ${table}
       SET ${setParts.join(', ')}
       WHERE ${pk} = $1 AND tenant_id = $2
       RETURNING fhir_resource`,
      values,
    )

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0].fhir_resource
  })
}

/** Soft-delete a resource in a dedicated table. */
export async function softDeleteDedicatedResource(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  fhirResource: Record<string, unknown>,
): Promise<boolean> {
  const table = RESOURCE_TABLE_MAP[resourceType]
  const pk = RESOURCE_PK_MAP[resourceType]

  return transaction(async (client) => {
    await setRlsContext(client, ctx)

    const result = await client.query<{ [key: string]: string }>(
      `UPDATE ${table}
       SET active = false, fhir_resource = $3, updated_at = now()
       WHERE ${pk} = $1 AND tenant_id = $2
       RETURNING ${pk}`,
      [resourceId, ctx.tenantId, JSON.stringify(fhirResource)],
    )

    return result.rows.length > 0
  })
}

/** Search resources in a dedicated table. */
export async function searchDedicatedResources(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  searchParams: URLSearchParams,
): Promise<{ resources: Record<string, unknown>[]; total: number }> {
  const table = RESOURCE_TABLE_MAP[resourceType]
  const pk = RESOURCE_PK_MAP[resourceType]
  const count = parseInt(searchParams.get('_count') ?? '20', 10)
  const offset = parseInt(searchParams.get('_offset') ?? '0', 10)
  const limitedCount = Math.min(Math.max(count, 0), 100)
  const limitedOffset = Math.max(offset, 0)

  const idParam = searchParams.get('_id')
  const activeParam = searchParams.get('active')

  return transaction(async (client) => {
    await setRlsContext(client, ctx)

    // Default to active=true unless explicitly overridden
    let whereClause = `WHERE tenant_id = $1 AND active = true`
    const params: unknown[] = [ctx.tenantId]
    let paramIdx = 2

    if (idParam) {
      whereClause += ` AND ${pk} = $${paramIdx}`
      params.push(idParam)
      paramIdx++
    }

    // Allow overriding active filter
    if (activeParam !== null) {
      whereClause = whereClause.replace('AND active = true', '')
      whereClause += ` AND active = $${paramIdx}`
      params.push(activeParam === 'true')
      paramIdx++
    }

    params.push(limitedCount, limitedOffset)

    const result = await client.query<{
      fhir_resource: Record<string, unknown>
      total_count: string
    }>(
      `SELECT fhir_resource, count(*) OVER() AS total_count
       FROM ${table}
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params,
    )

    const total =
      result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0
    const resources = result.rows.map((row) => row.fhir_resource)

    return { resources, total }
  })
}

/** Get version history from the dedicated audit_history table. */
export async function getDedicatedResourceHistory(
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
  return transaction(async (client) => {
    await setRlsContext(client, ctx)

    const result = await client.query<{
      fhir_resource: Record<string, unknown>
      timestamp: string
      action: string
    }>(
      `SELECT fhir_resource, timestamp, action
       FROM ehr_audit_history
       WHERE resource_type = $1 AND resource_id = $2 AND tenant_id = $3
       ORDER BY timestamp DESC`,
      [resourceType, resourceId, ctx.tenantId],
    )

    return result.rows.map((row) => ({
      resource: row.fhir_resource,
      timestamp: row.timestamp,
      action: row.action,
    }))
  })
}

/** Insert a history entry into the dedicated audit_history table. */
export async function insertDedicatedResourceHistory(
  ctx: FHIRRequestContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  action: string,
  fhirResource: Record<string, unknown>,
): Promise<void> {
  // Validate actor_id is a valid UUID (ehr_audit_history.actor_id is UUID NOT NULL)
  const actorId = isValidUuid(ctx.userId) ? ctx.userId : null

  await transaction(async (client) => {
    await setRlsContext(client, ctx)

    await client.query(
      `INSERT INTO ehr_audit_history (tenant_id, resource_type, resource_id, action, actor_id, actor_role, timestamp, fhir_resource)
       VALUES ($1, $2, $3, $4, $5, $6, now(), $7)`,
      [
        ctx.tenantId,
        resourceType,
        resourceId,
        action,
        actorId,
        ctx.role,
        JSON.stringify(fhirResource),
      ],
    )
  })
}
