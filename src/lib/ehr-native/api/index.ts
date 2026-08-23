/**
 * EHR Native — API Surface (F1.6)
 *
 * Shared helpers for EHR REST API route handlers. Provides RBAC enforcement
 * and RLS context resolution so every endpoint at /api/ehr/v1/ enforces
 * permission checks per ADR-005 before touching patient data.
 *
 * Routes use `withV1Contract` from the platform middleware for auth + error
 * boundary, then call `createEHRRLSContext` and `requireEHRPermission` inside
 * the handler body.
 */

import {
  checkPermission,
  checkPermissionWithBreakGlass,
} from '../auth/ehr-rbac'
import type { EHRPermission, BreakGlassParams } from '../auth/types'
import type { RLSContext } from '../repositories'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape returned by `requireEHRPermission` — either allowed or a 403 Response. */
export type EHRPermissionResult =
  | { allowed: true; rlsContext: RLSContext }
  | { allowed: false; response: Response }

// ---------------------------------------------------------------------------
// RLS context resolution
// ---------------------------------------------------------------------------

/**
 * Build an RLSContext from the authenticated caller's user identity.
 *
 * @param userId - The caller's platform user ID.
 * @param role - The caller's clinical role.
 * @param tenantId - The caller's tenant/account ID.
 * @param breakGlass - Whether break-glass access is active.
 * @returns RLSContext for repository queries.
 */
export function createEHRRLSContext(
  userId: string,
  role: string,
  tenantId: string,
  breakGlass = false,
): RLSContext {
  return { tenantId, userId, role, breakGlass }
}

// ---------------------------------------------------------------------------
// RBAC enforcement
// ---------------------------------------------------------------------------

/**
 * Check an EHR permission and return either an RLS context (allowed) or a
 * 403 Response (denied). Every route handler calls this before accessing
 * patient data.
 *
 * @param role - The caller's clinical role.
 * @param permission - The required EHR permission.
 * @param userId - The caller's platform user ID.
 * @param tenantId - The caller's tenant ID.
 * @param patientId - Optional patient ID for patient-scoped checks.
 * @param stateCode - Optional state code for state-rule checks.
 * @returns Either `{ allowed: true, rlsContext }` or `{ allowed: false, response }`.
 */
export async function requireEHRPermission(
  role: string,
  permission: EHRPermission,
  userId: string,
  tenantId: string,
  patientId?: string,
  stateCode?: string,
): Promise<EHRPermissionResult> {
  const result = await checkPermission(
    role as never,
    permission,
    patientId,
    tenantId,
    stateCode,
  )

  if (!result.granted) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: {
            code: 'forbidden',
            message: result.reason ?? 'Insufficient permissions for this operation.',
          },
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    }
  }

  return {
    allowed: true,
    rlsContext: createEHRRLSContext(userId, role, tenantId, false),
  }
}

/**
 * Check an EHR permission with break-glass support. If the caller has
 * break-glass access, the RLS context will have `breakGlass: true`.
 *
 * @param role - The caller's clinical role.
 * @param permission - The required EHR permission.
 * @param userId - The caller's platform user ID.
 * @param tenantId - The caller's tenant ID.
 * @param patientId - Optional patient ID for patient-scoped checks.
 * @param breakGlassParams - Optional break-glass justification.
 * @param stateCode - Optional state code for state-rule checks.
 * @returns Either `{ allowed: true, rlsContext }` or `{ allowed: false, response }`.
 */
export async function requireEHRPermissionWithBreakGlass(
  role: string,
  permission: EHRPermission,
  userId: string,
  tenantId: string,
  patientId: string,
  breakGlassParams?: Omit<BreakGlassParams, 'role' | 'patientId' | 'permission'>,
  stateCode?: string,
): Promise<EHRPermissionResult> {
  const result = await checkPermissionWithBreakGlass(
    role as never,
    permission,
    patientId,
    breakGlassParams,
    tenantId,
    stateCode,
  )

  if (!result.granted) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: {
            code: 'forbidden',
            message: result.reason ?? 'Insufficient permissions for this operation.',
          },
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    }
  }

  return {
    allowed: true,
    rlsContext: createEHRRLSContext(userId, role, tenantId, result.breakGlassActivated),
  }
}

// ---------------------------------------------------------------------------
// Tenant resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the tenant ID from the authenticated caller. Returns null if the
 * caller has no tenant association, which means EHR access is denied.
 *
 * @param accountId - The caller's account ID (from caller.user.accountId).
 * @returns The tenant ID or null if unavailable.
 */
export function resolveTenantId(accountId?: string): string | null {
  if (!accountId || accountId.trim() === '') {
    return null
  }
  return accountId
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Build a 400 validation error response.
 *
 * @param message - The validation error message.
 * @returns 400 Response with error envelope.
 */
export function ehrValidationError(message: string): Response {
  return new Response(
    JSON.stringify({ error: { code: 'validation_failed', message } }),
    { status: 400, headers: { 'Content-Type': 'application/json' } },
  )
}

/**
 * Build a 404 not-found response.
 *
 * @param resource - The resource type that was not found.
 * @param id - The resource ID that was not found.
 * @returns 404 Response with error envelope.
 */
export function ehrNotFound(resource: string, id: string): Response {
  return new Response(
    JSON.stringify({ error: { code: 'not_found', message: `${resource} ${id} not found.` } }),
    { status: 404, headers: { 'Content-Type': 'application/json' } },
  )
}

/**
 * Build a 200 success response with data.
 *
 * @param data - The response data.
 * @returns 200 Response with data envelope.
 */
export function ehrSuccess<T>(data: T): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Build a 201 created response with data.
 *
 * @param data - The created resource.
 * @returns 201 Response with data envelope.
 */
export function ehrCreated<T>(data: T): Response {
  return new Response(JSON.stringify({ data }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Build a 200 success response with data and pagination.
 *
 * @param data - The response data array.
 * @param pagination - Pagination metadata.
 * @returns 200 Response with data + pagination envelope.
 */
export function ehrPaginated<T>(
  data: T[],
  pagination: { limit: number; offset: number; total?: number },
): Response {
  return new Response(JSON.stringify({ data, pagination }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
