// Type declarations for config/instrument.mjs exports
// This file resolves oxlint no-unsafe-* warnings by providing proper types for the Sentry instrumentation

/** @typedef {{ end: () => void }} SentrySpan */
/** @typedef {{ data?: unknown }} SentryRequest */
/** @typedef {{ request?: SentryRequest }} SentryEvent */
/** @typedef {{ category?: string; level?: string; [key: string]: unknown }} SentryBreadcrumb */
/** @typedef {{ setTags: (tags: Record<string, string>) => void; setExtras: (extras: Record<string, unknown>) => void; setUser: (user: SentryUser) => void }} SentryScope */
/** @typedef {{ id?: string; email?: string; username?: string }} SentryUser */
/** @typedef {{ [key: string]: string | number | boolean | null | Record<string, unknown> | unknown[] }} PrimitiveValue */
/** @typedef {{ id?: string; op: string; [key: string]: unknown }} SentrySpanOptions */
/** @typedef {(options?: { tracing?: boolean }) => unknown} HttpIntegrationFactory */
/** @typedef {() => unknown} BasicIntegrationFactory */
/** @typedef {{ count: (name: string, value: number, options?: { attributes?: Record<string, unknown> }) => void, distribution: (name: string, value: number, options?: { attributes?: Record<string, unknown> }) => void }} SentryMetrics */
/** @typedef {(error: unknown) => void} CaptureHandler */
/** @typedef {{ category?: string; [key: string]: unknown }} EventData */
/** @typedef {{ startInactiveSpan: (options: SentrySpanOptions) => SentrySpan, startSpan: (options: SentrySpanOptions) => SentrySpan }} SentrySpanFactory */
/** @typedef {() => Promise<unknown>} QueryFunction */
/** @typedef {string | QueryFunction} DatabaseQueryInput */
/** @typedef {{
  init: (options: Record<string, unknown>) => void
  close: () => Promise<void> | void
  captureException: CaptureHandler
  setUser: (user: SentryUser | null) => void
  setContext: (key: string, context: EventData) => void
  withScope: (callback: (scope: SentryScope) => void) => void
  startInactiveSpan: (options: SentrySpanOptions) => SentrySpan
  startSpan: (options: SentrySpanOptions) => SentrySpan
  metrics: SentryMetrics
  setTag?: (key: string, value: string) => void
  setExtra?: (key: string, value: unknown) => void
}} SentryLike */
/** @typedef {{ [key: string]: unknown }} PrimitiveValueRecord */
/** @typedef {{ tags?: Record<string, string>; extra?: PrimitiveValueRecord; user?: SentryUser }} CaptureErrorContext */
/** @typedef {ReturnType<typeof createStubSentry>} SentryStub */
/** @typedef {SentryLike & SentryStub} SentryInstance */
/** @typedef {{ user?: SentryUser }} SentryRequestLike */
/** @typedef {(error?: unknown) => void} NextHandler */

declare const Sentry: SentryInstance
declare const closeSentry: () => Promise<void>
declare const sentryMiddleware: (
  req: { user?: { id?: string; email?: string } },
  res: unknown,
  next: () => void,
) => void
declare const startTransaction: (name: string, operation?: string) => SentrySpan
declare const startSpan: (name: string, operation?: string) => SentrySpan
declare const captureError: (
  error: unknown,
  context?: CaptureErrorContext,
) => void
declare const setUserContext: (user: SentryUser) => void
declare const recordMetric: (
  name: string,
  value?: number,
  tags?: Record<string, unknown>,
) => void
declare const recordDurationMetric: (
  name: string,
  durationMs: number,
  tags?: Record<string, unknown>,
) => void
declare const healthCheck: () => {
  status: string
  timestamp: string
  error?: string
}
declare const instrumentDatabaseQuery: (
  query: DatabaseQueryInput,
  operation?: string,
) => Promise<unknown>

export {
  Sentry,
  closeSentry,
  sentryMiddleware,
  startTransaction,
  startSpan,
  captureError,
  setUserContext,
  recordMetric,
  recordDurationMetric,
  healthCheck,
  instrumentDatabaseQuery,
}
