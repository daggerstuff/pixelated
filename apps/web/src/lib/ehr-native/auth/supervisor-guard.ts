/**
 * Supervisor authentication and RBAC guard for Auth0 `ehr:supervisor` role enforcement.
 *
 * Supervisor endpoints and UI surfaces require the `ehr:supervisor` role
 * (or platform `supervisor`, `admin`, `systemAdmin`, `physician` roles).
 * All other roles are denied with 403.
 *
 * See F3.2 Supervisor Tools acceptance criterion #7.
 */

import { createEHRRLSContext } from '@/lib/ehr-native/api'
import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository'

/** Auth0 role name for supervisor tools access. */
export const SUPERVISOR_ROLE = 'ehr:supervisor' as const

/** Platform and clinical roles permitted to access supervisor tools. */
export const SUPERVISOR_ALLOWED_ROLES: ReadonlySet<string> = new Set<string>([
  'ehr:supervisor',
  'supervisor',
  'admin',
  'systemAdmin',
  'physician',
])

interface SupervisorGuardResult {
  allowed: true
  rlsContext: RLSContext
}

interface SupervisorGuardDenied {
  allowed: false
  response: Response
}

export type SupervisorGuardOutcome =
  SupervisorGuardResult | SupervisorGuardDenied

/**
 * Check if a role is authorized for supervisor tooling.
 */
export function isSupervisorRole(role: string): boolean {
  return SUPERVISOR_ALLOWED_ROLES.has(role)
}

/**
 * Require the Auth0 `ehr:supervisor` role or equivalent supervisor/admin roles.
 *
 * @param role - The caller's role string
 * @param userId - The caller's user ID
 * @param tenantId - The resolved tenant ID
 * @returns `SupervisorGuardResult` with RLS context on success, `SupervisorGuardDenied` with 403 on failure
 */
export function requireSupervisorRole(
  role: string,
  userId: string,
  tenantId: string,
): SupervisorGuardOutcome {
  if (!isSupervisorRole(role)) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: {
            code: 'forbidden',
            message:
              'Supervisor access requires ehr:supervisor role. Current role is not authorized for supervisor tools.',
          },
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    }
  }

  const rlsContext = createEHRRLSContext(userId, role, tenantId, false)
  return { allowed: true, rlsContext }
}
