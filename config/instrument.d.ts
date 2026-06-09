/**
 * Type declarations for config/instrument.mjs exports
 * This file resolves oxlint no-unsafe-* warnings by providing proper types for the Sentry instrumentation
 */
type SentrySpan = { end: () => void }
type SentryRequest = { data?: unknown }
type SentryEvent = { request?: SentryRequest }
type SentryBreadcrumb = {
  category?: string
  level?: string
  [key: string]: unknown
}
type SentryScope = {
  setTags: (tags: Record<string, string>) => void
  setExtras: (extras: Record<string, unknown>) => void
  setUser: (user: SentryUser) => void
}
type SentryUser = { id?: string; email?: string; username?: string }
type PrimitiveValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[]
type SentrySpanOptions = { id?: string; op: string; [key: string]: unknown }
type HttpIntegrationFactory = (options?: { tracing?: boolean }) => unknown
type BasicIntegrationFactory = () => unknown
type SentryMetrics = {
  count: (
    name: string,
    value: number,
    options?: { attributes?: Record<string, unknown> },
  ) => void
  distribution: (
    name: string,
    value: number,
    options?: { attributes?: Record<string, unknown> },
  ) => void
}
type CaptureHandler = (error: unknown) => void
type EventData = { category?: string; [key: string]: unknown }
type SentrySpanFactory = {
  startInactiveSpan: (options: SentrySpanOptions) => SentrySpan
  startSpan: (options: SentrySpanOptions) => SentrySpan
}
type QueryFunction = () => Promise<unknown>
type DatabaseQueryInput = string | QueryFunction
type SentryLike = {
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
}
type PrimitiveValueRecord = { [key: string]: unknown }
type CaptureErrorContext = {
  tags?: Record<string, string>
  extra?: PrimitiveValueRecord
  user?: SentryUser
}
type SentryStub = {
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
}
type SentryInstance = SentryLike & SentryStub
type NextHandler = (error?: unknown) => void
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
