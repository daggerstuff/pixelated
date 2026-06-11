// @vitest-environment node

import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import {
  getSentryExpressHandlers,
  hasSentryExpressErrorHandler,
  registerSentryExpressErrorHandler,
} from './express'

describe('Sentry Express registration', () => {
  it('extracts supported Sentry handlers from the SDK object', () => {
    const setupExpressErrorHandler = vi.fn()
    const expressErrorHandler = vi.fn()
    const captureException = vi.fn()

    const handlers = getSentryExpressHandlers({
      setupExpressErrorHandler,
      expressErrorHandler,
      captureException,
      unrelated: true,
    })

    expect(handlers).toEqual({
      setupExpressErrorHandler,
      expressErrorHandler,
      captureException,
    })
    expect(hasSentryExpressErrorHandler(handlers)).toBe(true)
  })

  it('prefers setupExpressErrorHandler over the legacy error handler', () => {
    const app = express()
    const setupExpressErrorHandler = vi.fn()
    const expressErrorHandler = vi.fn()

    const registered = registerSentryExpressErrorHandler(app, {
      setupExpressErrorHandler,
      expressErrorHandler,
    })

    expect(registered).toBe(true)
    expect(setupExpressErrorHandler).toHaveBeenCalledWith(app)
    expect(expressErrorHandler).not.toHaveBeenCalled()
  })

  it('registers legacy Sentry error middleware after routes', async () => {
    const app = express()
    const capturedErrors: string[] = []

    app.get('/boom', (_req, _res, next) => {
      next(new Error('route exploded'))
    })

    registerSentryExpressErrorHandler(app, {
      expressErrorHandler:
        (): ErrorRequestHandler => (error, _req, _res, next) => {
          capturedErrors.push(
            error instanceof Error ? error.message : 'unknown',
          )
          next(error)
        },
    })

    app.use(
      (error: Error, _req: Request, res: Response, _next: NextFunction) => {
        res.status(500).json({ error: error.message })
      },
    )

    const response = await request(app).get('/boom')

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: 'route exploded' })
    expect(capturedErrors).toEqual(['route exploded'])
  })

  it('returns false when the SDK exposes no Express error handler', () => {
    const app = express()

    expect(registerSentryExpressErrorHandler(app, {})).toBe(false)
    expect(hasSentryExpressErrorHandler({})).toBe(false)
  })
})
