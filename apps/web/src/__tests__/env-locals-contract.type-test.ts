/**
 * TYPE-LEVEL CONTRACT TEST for `App.Locals`.
 *
 * This file is checked by `tsc` (see `tsconfig.json`'s `include`) and is
 * intentionally NOT a vitest test — it has no runtime assertions. The
 * "tests" are compile-time type checks. If this file fails to compile, the
 * `App.Locals` contract has drifted.
 *
 * Contract (see `src/env.d.ts`):
 *   1. Known properties retain their strict types (autocomplete + drift detection).
 *   2. The `[key: string]: unknown` index signature accepts bracket
 *      reads/writes for ad-hoc keys (typed as `unknown`).
 *   3. Middleware ad-hoc writes (e.g. `locals['admin'] = ...`) typecheck.
 *
 * Adding a new shared key to `App.Locals`? Add a positive assertion below.
 * Adding a new ad-hoc key? Add a negative assertion to lock in the
 * "declare it in App.Locals" rule.
 *
 * NEGATIVE-ASSERTION CONVENTION: every negative assertion uses the
 * `[T] extends [U] ? true : false` tuple form (not the simple `T extends U`).
 * The simple form distributes over unions and can collapse to `boolean`
 * (e.g. `null extends string | null | undefined` → `true | false | false`
 * = `boolean`), which silently passes the const-`= false` drift detector.
 * The tuple form disables distribution, giving a deterministic `true` or
 * `false` regardless of how wide the union becomes. All 8 negatives below
 * use this form uniformly — copy the pattern for new negatives.
 */

// Reference the global namespace augmentation from `src/env.d.ts`.
import '../env.d.ts'

// ---------------------------------------------------------------------------
// 1. Known properties retain their strict types
// ---------------------------------------------------------------------------

// `requestId` is `string` (not `unknown`).
const _requestId: App.Locals['requestId'] = 'req-123'

// `timestamp` is `string`.
const _timestamp: App.Locals['timestamp'] = '2026-06-11T00:00:00Z'

// `user` is nullable with a specific shape.
const _user: App.Locals['user'] = {
  id: 'u-1',
  email: 'a@b.c',
  emailVerified: true,
  role: 'admin',
}

// `session` is nullable with `expiresAt: Date`.
const _session: App.Locals['session'] = {
  id: 's-1',
  userId: 'u-1',
  expiresAt: new Date(),
}

// `cspNonce` is optional `string`.
const _cspNonce: App.Locals['cspNonce'] = 'nonce-abc'
const _cspNonceAbsent: App.Locals['cspNonce'] = undefined

// `isSSR` is optional `boolean`.
const _isSSR: App.Locals['isSSR'] = true
const _isSSRAbsent: App.Locals['isSSR'] = undefined

// `vercelEdge` is optional with geo/UA fields.
const _vercelEdge: App.Locals['vercelEdge'] = {
  country: 'US',
  region: 'CA',
  ip: '127.0.0.1',
  isAuthPage: false,
  userAgent: 'Mozilla/5.0',
}
const _vercelEdgeAbsent: App.Locals['vercelEdge'] = undefined

// `headers` is optional `Record<string, string>`.
const _headers: App.Locals['headers'] = { 'x-custom': 'value' }
const _headersAbsent: App.Locals['headers'] = undefined

// `userPreferences` is optional with theme/UA/device fields. Extracted to
// a shared base so the positive (valid assignment) and the negative
// (one field wrong) can't drift apart when fields are added.
const userPreferencesBase = {
  darkMode: true,
  language: 'en',
  userAgent: 'Mozilla/5.0',
  isMobile: false,
  reducedMotion: false,
  isIOS: false,
  isAndroid: false,
  ip: '127.0.0.1',
}
const _userPreferences: App.Locals['userPreferences'] = userPreferencesBase
const _userPreferencesAbsent: App.Locals['userPreferences'] = undefined

// Negative: `requestId` is NOT `number`. If someone changes the type,
// the conditional flips to `true` and the const assignment fails — that's
// the drift detector.
type IsWrongRequestIdAssignable = [number] extends [App.Locals['requestId']]
  ? true
  : false
const _isWrongRequestIdAssignable: IsWrongRequestIdAssignable = false

// Negative: `user` requires `id`, `email`, `emailVerified`, `role`. A
// partial object (only `id`) is not assignable to the full user shape.
// If the required fields are loosened, the conditional flips to `true`
// and the const assignment fails.
type IsPartialUserAssignable = [{ id: string }] extends [
  NonNullable<App.Locals['user']>,
]
  ? true
  : false
const _isPartialUserAssignable: IsPartialUserAssignable = false

// Negative: `vercelEdge` requires all 5 fields including `ip`. The
// shape without `ip` is not assignable to the full shape. If `ip`
// becomes optional, the conditional flips to `true` and the const
// assignment fails.
type IsVercelEdgeWithoutIpAssignable = [
  Omit<NonNullable<App.Locals['vercelEdge']>, 'ip'>,
] extends [App.Locals['vercelEdge']]
  ? true
  : false
const _isVercelEdgeWithoutIpAssignable: IsVercelEdgeWithoutIpAssignable = false

// Negative: `headers` is `Record<string, string>`, not `Record<string, number>`.
// If the value type changes, the conditional flips to `true` and the
// const assignment fails.
type IsWrongHeadersValueTypeAssignable = [Record<string, number>] extends [
  NonNullable<App.Locals['headers']>,
]
  ? true
  : false
const _isWrongHeadersValueTypeAssignable: IsWrongHeadersValueTypeAssignable = false

// Negative: `userPreferences.darkMode` is `boolean`, not `string`.
// Type-level assertion (no `@ts-expect-error` needed, so no directive-
// placement issues with oxlint's type-aware mode). `Omit` + re-add is
// required because `boolean & string` is `never`; we want `darkMode: string`
// to override the base field. `[T] extends [U]` (tuple form) is used
// for uniform union-safety across the file.
type IsWrongDarkModeAssignable = [
  Omit<typeof userPreferencesBase, 'darkMode'> & { darkMode: string },
] extends [App.Locals['userPreferences']]
  ? true
  : false
const _isWrongDarkModeAssignable: IsWrongDarkModeAssignable = false

// ---------------------------------------------------------------------------
// 2. Index signature accepts bracket access for ad-hoc keys
// ---------------------------------------------------------------------------

// Ad-hoc keys (not declared in `App.Locals`) are accessible via bracket
// notation and typed as `unknown` (the index signature's value type).
declare const someLocals: App.Locals
const _adHocKey: unknown = someLocals['arbitraryAdHocKey']
const _adHocKeyNonExistent: unknown = someLocals['doesNotExist']

// Negative: the index signature is `unknown`, not `any` or `string`.
// Type-level assertion: a bracket read is not assignable to `string`
// without narrowing. If the index sig widens to `any` or `string`, the
// read becomes assignable, the conditional flips to `true`, and the
// const assignment fails. `[T] extends [U]` (tuple form) is used to
// avoid distributive behavior on `any`.
type AdHocKeyRead = (typeof someLocals)['arbitraryAdHocKey']
type IsAdHocKeyAssignableToString = [AdHocKeyRead] extends [string]
  ? true
  : false
const _isAdHocKeyAssignableToString: IsAdHocKeyAssignableToString = false

// ---------------------------------------------------------------------------
// 3. Middleware ad-hoc writes typecheck
// ---------------------------------------------------------------------------

// `adminGuard` writes `context.locals['admin'] = admin` using bracket
// notation. This pattern MUST typecheck (otherwise it's a latent bug).
declare const ctx: { locals: App.Locals }
ctx.locals['admin'] = { userId: 'u-1', isAdmin: true, hasPermission: true }
ctx.locals['customKey'] = { anything: 'goes' }

// Negative: known props retain their types. Assigning a `number` to
// `requestId` (which is `string`) should fail. If the field widens to
// `string | number` or just `number`, the conditional flips to `true`
// and the const assignment fails.
type IsWrongRequestIdValueAssignable = [number] extends [
  App.Locals['requestId'],
]
  ? true
  : false
const _isWrongRequestIdValueAssignable: IsWrongRequestIdValueAssignable = false

// Negative: assigning `null` to a non-nullable known prop should fail.
// `user` is `T | null` so `null` IS allowed; we use `timestamp` instead.
// If `timestamp` becomes nullable, the conditional flips to `true` and
// the const assignment fails.
type IsNullAssignableToTimestamp = [null] extends [App.Locals['timestamp']]
  ? true
  : false
const _isNullAssignableToTimestamp: IsNullAssignableToTimestamp = false

// ---------------------------------------------------------------------------
// 4. Lock in: adding a new shared key requires updating this contract
// ---------------------------------------------------------------------------

// If you add a new property to `App.Locals`, add a positive assertion
// above. If you remove a property, the corresponding assertion above will
// fail to compile — that's intentional (it's the drift detector).

// Export nothing — this is a compile-time-only file.
