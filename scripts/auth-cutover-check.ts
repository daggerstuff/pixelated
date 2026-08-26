/**
 * PIX-215 PR4: Auth cutover verification script.
 *
 * For each user ID provided, runs the new (IdentityProvider) path and the
 * legacy (auth0UserService) path side by side via `dualWriteGetUserById`
 * and reports any discrepancies. Exits 0 only when every requested user
 * matches (or was skipped).
 *
 * Usage:
 *   AUTH_DUAL_WRITE=true tsx scripts/auth-cutover-check.ts auth0|user-1 auth0|user-2
 *   AUTH_DUAL_WRITE=true tsx scripts/auth-cutover-check.ts < user-ids.txt
 *
 * Env:
 *   AUTH_DUAL_WRITE=true          required — script no-ops otherwise
 *   AUTH_DUAL_WRITE_SAMPLE=0.01   optional — sample-rate comparison instead of full
 *
 * Exit codes:
 *   0 — all users matched (or were skipped)
 *   1 — at least one user had a mismatch, or the script was invoked without dual-write enabled
 *   2 — unexpected error (no user IDs provided, etc.)
 */

import {
  dualWriteGetUserById,
  shouldDualWrite,
} from '../apps/web/src/lib/auth/dual-write'
import { getIdentityProvider } from '../apps/web/src/lib/auth/identity-provider'

async function readUserIds(): Promise<string[]> {
  const args = process.argv.slice(2)
  if (args.length > 0) return args.filter(Boolean)

  const chunks: string[] = []
  for await (const chunk of process.stdin as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'))
  }
  return chunks
    .join('')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function summarize(
  userId: string,
  result: Awaited<ReturnType<typeof dualWriteGetUserById>>,
): 'pass' | 'fail' {
  if (result.status === 'skipped') return 'pass'
  if (result.status === 'match') return 'pass'
  return 'fail'
}

async function main(): Promise<number> {
  if (!shouldDualWrite()) {
    console.error(
      '[auth-cutover-check] AUTH_DUAL_WRITE is not enabled. Set AUTH_DUAL_WRITE=true (or AUTH_DUAL_WRITE_SAMPLE>0) and re-run.',
    )
    return 1
  }

  const userIds = await readUserIds()
  if (userIds.length === 0) {
    console.error(
      '[auth-cutover-check] no user IDs provided. Pass them as args or pipe via stdin.',
    )
    return 2
  }

  const provider = getIdentityProvider()
  console.log(
    `[auth-cutover-check] provider=${provider.name} users=${userIds.length}`,
  )

  let pass = 0
  let fail = 0
  const failures: Array<{ userId: string; fields: string[] }> = []

  for (const userId of userIds) {
    try {
      const result = await dualWriteGetUserById(provider, userId)
      const verdict = summarize(userId, result)
      if (verdict === 'pass') {
        pass += 1
        console.log(`  PASS  ${userId}  status=${result.status}`)
      } else {
        fail += 1
        const fields =
          result.status === 'mismatch'
            ? result.discrepancies.map((d) => d.field)
            : []
        failures.push({ userId, fields })
        console.log(
          `  FAIL  ${userId}  status=${result.status}  fields=${fields.join(',')}`,
        )
      }
    } catch (err: unknown) {
      fail += 1
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  FAIL  ${userId}  status=error  error=${msg}`)
      failures.push({ userId, fields: ['__error__'] })
    }
  }

  console.log(`[auth-cutover-check] pass=${pass} fail=${fail}`)
  if (failures.length > 0) {
    console.log('[auth-cutover-check] failures:')
    for (const f of failures) {
      console.log(`  - ${f.userId}: ${f.fields.join(', ')}`)
    }
  }

  return fail === 0 ? 0 : 1
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error('[auth-cutover-check] unexpected error:', err)
    process.exit(2)
  },
)
