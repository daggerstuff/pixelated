import type { Request, Response, NextFunction } from 'express'

export const DEFAULT_TIMEOUT_MS = 30_000

export function timeoutMiddleware(timeoutMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          error: {
            code: 'GATEWAY_TIMEOUT',
            message: `Request exceeded timeout of ${timeoutMs}ms`,
          },
        })
      }
    }, timeoutMs)

    res.on('finish', () => {
      clearTimeout(timer)
    })

    next()
  }
}

export function createTimeoutMiddleware() {
  const raw = process.env['QUERY_TIMEOUT_MS']
  const parsed = raw ? parseInt(raw, 10) : DEFAULT_TIMEOUT_MS
  const timeoutMs =
    Number.isNaN(parsed) || parsed <= 0 ? DEFAULT_TIMEOUT_MS : parsed
  return timeoutMiddleware(timeoutMs)
}
