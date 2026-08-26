import DevSentryTest from './dev/SentryTest'

/**
 * Backward-compatible Sentry test component entrypoint.
 *
 * Kept as a named export to avoid changing existing callers
 * (notably /test-sentry).
 */
export function SentryTest() {
  return <DevSentryTest />
}
