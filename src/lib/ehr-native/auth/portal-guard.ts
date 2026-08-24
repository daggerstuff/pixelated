/**
 * Portal authentication guard for Auth0 `ehr:client` role enforcement.
 *
 * The Auth0 `ehr:client` role maps to the platform `patient` UserRole.
 * Portal endpoints require this role (or `admin` for debugging/support).
 * All other roles are denied with 403.
 *
 * See F1.11 Client Portal acceptance criterion #6.
 */

import type { UserRole } from '@/lib/auth/roles'
import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository'
import { createEHRRLSContext } from '@/lib/ehr-native/api'

/** Auth0 role name for client portal access. */
export const PORTAL_CLIENT_ROLE = 'ehr:client' as const

/** Platform roles permitted to access the client portal. */
const PORTAL_ALLOWED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'patient',
  'admin',
])

export interface PortalGuardResult {
  allowed: true
  rlsContext: RLSContext
}

export interface PortalGuardDenied {
  allowed: false
  response: Response
}

export type PortalGuardOutcome = PortalGuardResult | PortalGuardDenied

/**
 * Require the Auth0 `ehr:client` role (mapped to platform `patient` UserRole).
 * Admins are also permitted for debugging/support purposes.
 *
 * @param role - The caller's platform UserRole
 * @param userId - The caller's user ID
 * @param tenantId - The resolved tenant ID
 * @returns `PortalGuardResult` with RLS context on success, `PortalGuardDenied` with 403 on failure
 */
export function requirePortalClient(
  role: UserRole,
  userId: string,
  tenantId: string,
): PortalGuardOutcome {
  if (!PORTAL_ALLOWED_ROLES.has(role)) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: {
            code: 'forbidden',
            message:
              'Portal access requires ehr:client role. Current role is not authorized for client portal access.',
          },
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    }
  }

  const rlsContext = createEHRRLSContext(userId, role, tenantId, false)

  return { allowed: true, rlsContext }
}

/**
 * Resolve the patient ID for the authenticated portal user.
 *
 * For portal access, the patient is the user themselves.
 * In production, this would resolve from Auth0 metadata or a user→patient mapping.
 * For now, the patient ID is the user ID itself (patient self-service).
 */
export function resolvePortalPatientId(userId: string): string {
  return userId
}
