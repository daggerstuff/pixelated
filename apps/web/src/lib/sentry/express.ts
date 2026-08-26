import type express from 'express'

type SentryExpressErrorHandler = (app: express.Application) => void
type SentryErrorHandler = (
  options?: Record<string, string>,
) => express.ErrorRequestHandler
type SentryCaptureHandler = (error: unknown) => void

export type SentryExpressHandlers = {
  setupExpressErrorHandler?: SentryExpressErrorHandler
  expressErrorHandler?: SentryErrorHandler
  captureException?: SentryCaptureHandler
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isSentryExpressErrorHandler = (
  value: unknown,
): value is SentryExpressErrorHandler => typeof value === 'function'

const isSentryExpressErrorRequestHandler = (
  value: unknown,
): value is SentryErrorHandler => typeof value === 'function'

const isSentryCaptureHandler = (
  value: unknown,
): value is SentryCaptureHandler => typeof value === 'function'

export const getSentryExpressHandlers = (
  source: unknown,
): SentryExpressHandlers => {
  if (!isRecord(source)) {
    return {}
  }

  const handlers: SentryExpressHandlers = {}

  if (isSentryExpressErrorHandler(source['setupExpressErrorHandler'])) {
    handlers.setupExpressErrorHandler = source['setupExpressErrorHandler']
  }

  if (isSentryExpressErrorRequestHandler(source['expressErrorHandler'])) {
    handlers.expressErrorHandler = source['expressErrorHandler']
  }

  if (isSentryCaptureHandler(source['captureException'])) {
    handlers.captureException = source['captureException']
  }

  return handlers
}

export const hasSentryExpressErrorHandler = (
  handlers: SentryExpressHandlers,
): boolean =>
  Boolean(handlers.setupExpressErrorHandler) ||
  Boolean(handlers.expressErrorHandler)

export const registerSentryExpressErrorHandler = (
  app: express.Application,
  handlers: SentryExpressHandlers,
): boolean => {
  if (handlers.setupExpressErrorHandler) {
    handlers.setupExpressErrorHandler(app)
    return true
  }

  if (handlers.expressErrorHandler) {
    app.use(handlers.expressErrorHandler())
    return true
  }

  return false
}
