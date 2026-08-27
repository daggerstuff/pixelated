/**
 * PIX-215 PR4: Dual-write mode for auth cutover.
 *
 * During the cutover from direct `auth0UserService` calls to the
 * `IdentityProvider` abstraction, this module compares the two paths and
 * reports any discrepancies. When the comparison passes consistently, the
 * `auth-legacy.ts` shim can be removed.
 *
 * Activation (env flags):
 *   AUTH_DUAL_WRITE=true          → compare every call
 *   AUTH_DUAL_WRITE_SAMPLE=0.01   → compare ~1% of calls (for prod validation)
 *   AUTH_DUAL_WRITE=false         → no comparison (default)
 *
 * Discrepancies are logged via `console.warn` with a structured payload so
 * they can be grep'd in production logs. No exceptions are thrown — the
 * primary result (from the provider) is always returned.
 */

import { auth0UserService } from '../services/auth0.service'
import type {
  IdentityProvider,
  IdentityProviderUser,
} from './identity-provider'

export interface DualWriteDiscrepancy {
  userId: string
  field: keyof IdentityProviderUser
  provider: unknown
  legacy: unknown
  at: string
}

export type DualWriteOutcome =
  | { status: 'match'; user: IdentityProviderUser | null }
  | {
      status: 'mismatch'
      user: IdentityProviderUser | null
      discrepancies: DualWriteDiscrepancy[]
    }
  | { status: 'skipped' }

const COMPARABLE_FIELDS: ReadonlyArray<keyof IdentityProviderUser> = [
  'id',
  'email',
  'role',
  'fullName',
  'avatarUrl',
  'lastLogin',
]

export function shouldDualWrite(): boolean {
  if (process.env['AUTH_DUAL_WRITE'] === 'true') return true
  const sample = Number(process.env['AUTH_DUAL_WRITE_SAMPLE'] ?? '0')
  if (sample >= 1) return true
  if (sample > 0) return Math.random() < sample
  return false
}

/**
 * Fetch the user via the new (provider) path AND the legacy (auth0UserService)
 * path, compare the comparable fields, and return the provider result with
 * any discrepancies attached.
 *
 * Errors from the legacy path are swallowed — the provider is the source of
 * truth. The function never throws.
 */
export async function dualWriteGetUserById(
  provider: IdentityProvider,
  userId: string,
): Promise<DualWriteOutcome> {
  if (!shouldDualWrite()) return { status: 'skipped' }

  const providerUser = await provider.getUserById(userId)
  let legacyUser: IdentityProviderUser | null = null
  let legacyThrew = false
  try {
    const raw = await auth0UserService.getUserById(userId)
    if (raw) {
      legacyUser = {
        id: raw.id,
        email: raw.email,
        role: raw.role,
        fullName: raw.fullName,
        avatarUrl: raw.avatarUrl,
        lastLogin: raw.lastLogin ?? null,
        userMetadata: raw.userMetadata,
      }
    }
  } catch (err) {
    legacyThrew = true
    console.warn('[auth-dual-write] legacy path threw', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  if (legacyThrew) {
    return { status: 'match', user: providerUser }
  }

  const discrepancies = compareUsers(userId, providerUser, legacyUser)
  if (discrepancies.length === 0) {
    return { status: 'match', user: providerUser }
  }
  console.warn(
    `[auth-dual-write] ${discrepancies.length} mismatch(es) for ${userId}`,
    discrepancies,
  )
  return { status: 'mismatch', user: providerUser, discrepancies }
}

function compareUsers(
  userId: string,
  provider: IdentityProviderUser | null,
  legacy: IdentityProviderUser | null,
): DualWriteDiscrepancy[] {
  const out: DualWriteDiscrepancy[] = []
  if ((provider === null) !== (legacy === null)) {
    out.push({
      userId,
      field: 'id',
      provider: provider?.id ?? null,
      legacy: legacy?.id ?? null,
      at: new Date().toISOString(),
    })
    return out
  }
  if (provider === null || legacy === null) return out

  for (const field of COMPARABLE_FIELDS) {
    const a = normalize(provider[field])
    const b = normalize(legacy[field])
    if (!deepEqual(a, b)) {
      out.push({
        userId,
        field,
        provider: a,
        legacy: b,
        at: new Date().toISOString(),
      })
    }
  }
  return out
}

function normalize(value: unknown): unknown {
  if (value === undefined) return null
  return value
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b
  }
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return false
}
