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
 *   2. The `[key: string]: unknown` index signature accepts arbitrary
 *      `Record<string, unknown>` assignments and bracket writes.
 *   3. Middleware ad-hoc writes (e.g. `locals['admin'] = ...`) typecheck.
 *
 * Adding a new shared key to `App.Locals`? Add a positive assertion below.
 * Adding a new ad-hoc key? Add a negative assertion to lock in the
 * "declare it in App.Locals" rule.
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
const _userPreferencesBase = {
  darkMode: true,
  language: 'en',
  userAgent: 'Mozilla/5.0',
  isMobile: false,
  reducedMotion: false,
  isIOS: false,
  isAndroid: false,
  ip: '127.0.0.1',
}
const _userPreferences: App.Locals['userPreferences'] = _userPreferencesBase
const _userPreferencesAbsent: App.Locals['userPreferences'] = undefined

// Negative: `requestId` is NOT `number`. If someone changes the type, this
// line should fail to compile.
// @ts-expect-error — `requestId` is `string`, not `number`
const _requestIdWrong: App.Locals['requestId'] = 42

// Negative: `user` is nullable. Assigning a non-null value without the
// required fields should fail.
// @ts-expect-error — `user` requires `id`, `email`, etc.
const _userWrong: App.Locals['user'] = { id: 'u-1' }

// Negative: `vercelEdge` requires all 5 fields. Missing `ip` should fail.
// @ts-expect-error — `vercelEdge` requires `ip`
const _vercelEdgeWrong: App.Locals['vercelEdge'] = {
  country: 'US',
  region: 'CA',
  isAuthPage: false,
  userAgent: 'Mozilla/5.0',
}

// Negative: `headers` is `Record<string, string>`, not `Record<string, number>`.
// @ts-expect-error — `headers` values must be `string`
const _headersWrong: App.Locals['headers'] = { 'x-count': 42 }

// Negative: `userPreferences.darkMode` is `boolean`, not `string`.
// @ts-expect-error — `darkMode` is `boolean`, not `string`
const _userPreferencesWrong: App.Locals['userPreferences'] = {
  ..._userPreferencesBase,
  darkMode: 'yes',
}

// ---------------------------------------------------------------------------
// 2. Index signature accepts `Record<string, unknown>`
// ---------------------------------------------------------------------------

// A `Record<string, unknown>` is assignable to `App.Locals` (the index
// signature permits it; known props accept `unknown` because `unknown` is
// the top type).
const _recordLocals: Record<string, unknown> = { arbitrary: 'value' }
const _localsFromRecord: App.Locals = _recordLocals

// A `Partial<{ user?: ... }>` is assignable to `App.Locals` (this is the
// pattern that the agent-notes routes rely on via `resolveActorIdentity`).
const _partialLocals: Partial<{ user: { id: string; role: string } }> = {}
const _localsFromPartial: App.Locals = _partialLocals

// Ad-hoc keys (not declared in `App.Locals`) are accessible but typed
// as `unknown`.
declare const _someLocals: App.Locals
const _adHocKey: unknown = _someLocals['arbitraryAdHocKey']
const _adHocKeyNonExistent: unknown = _someLocals['doesNotExist']

// Negative: the index signature is `unknown`, not `any`. Assigning
// `unknown` to a specific type requires narrowing.
// @ts-expect-error — `_adHocKey` is `unknown`, not `string` (no narrowing)
const _adHocKeyAsString: string = _someLocals['arbitraryAdHocKey']

// ---------------------------------------------------------------------------
// 3. Middleware ad-hoc writes typecheck
// ---------------------------------------------------------------------------

// `adminGuard` writes `context.locals['admin'] = admin` using bracket
// notation. This pattern MUST typecheck (otherwise it's a latent bug).
declare const _ctx: { locals: App.Locals }
_ctx.locals['admin'] = { userId: 'u-1', isAdmin: true, hasPermission: true }
_ctx.locals['customKey'] = { anything: 'goes' }

// Negative: known props retain their types. Assigning a `string` to
// `requestId` (which is `string`) is fine, but assigning a `number`
// should fail.
// @ts-expect-error — `requestId` is `string`, not `number`
_ctx.locals['requestId'] = 42

// Negative: assigning `null` to a non-nullable known prop should fail.
// `user` is `T | null` so `null` IS allowed; we use `timestamp` instead.
// @ts-expect-error — `timestamp` is `string`, not `null`
_ctx.locals['timestamp'] = null

// ---------------------------------------------------------------------------
// 4. Lock in: adding a new shared key requires updating this contract
// ---------------------------------------------------------------------------

// If you add a new property to `App.Locals`, add a positive assertion
// above. If you remove a property, the corresponding assertion above will
// fail to compile — that's intentional (it's the drift detector).

// Export nothing — this is a compile-time-only file.
export {}
