// Type declarations for config/instrument.mjs exports
// Provides proper types for the Sentry instrumentation module

interface SentrySpan {
  end: () => void
}

interface SentryRequest {
  data?: unknown
}

interface SentryEvent {
  request?: SentryRequest
}

interface SentryBreadcrumb {
  category?: string
  level?: string
  [key: string]: unknown
}

interface SentryUser {
  id?: string
  email?: string
  username?: string
}

interface SentryScope {
  setTags: (tags: Record<string, string>) => void
  setExtras: (extras: Record<string, unknown>) => void
  setUser: (user: SentryUser) => void
}

interface SentrySpanOptions {
  id?: string
  op: string
  [key: string]: unknown
}

interface SentryMetrics {
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

interface EventData {
  category?: string
  [key: string]: unknown
}

interface CaptureErrorContext {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  user?: SentryUser
}

type DatabaseQueryInput = string | (() => Promise<unknown>)

interface SentryInstance {
  init: (options: Record<string, unknown>) => void
  close: () => Promise<void> | void
  captureException: (error: unknown) => void
  setUser: (user: SentryUser | null) => void
  setContext: (key: string, context: EventData) => void
  withScope: (callback: (scope: SentryScope) => void) => void
  startInactiveSpan: (options: SentrySpanOptions) => SentrySpan
  startSpan: (options: SentrySpanOptions) => SentrySpan
  metrics: SentryMetrics
  setTag?: (key: string, value: string) => void
  setExtra?: (key: string, value: unknown) => void
}

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
