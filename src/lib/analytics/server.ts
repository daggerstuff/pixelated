import crypto from 'node:crypto'
import type { Server } from 'node:http'

import type { Request, Response } from 'express'
import express from 'express'

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('AnalyticsService')

const app = express()
app.use(express.json())

const ANALYTICS_PORT = process.env['PORT'] ?? 8003

interface AnalyticsEvent {
  id: string
  type: string
  userId?: string
  data: Record<string, unknown>
  timestamp: Date
}

// In-memory store for events (TODO: replace with database for persistence)
const events: AnalyticsEvent[] = []

// Simple in-memory rate limiter
const rateLimitCache = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100

app.use('/events', (req: Request, res: Response, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown'
  const now = Date.now()
  const record = rateLimitCache.get(ip)

  if (!record || record.resetTime < now) {
    rateLimitCache.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return next()
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    res
      .status(429)
      .json({ error: 'Too many requests, please try again later.' })
    return
  }

  record.count++
  next()
})

// POST /events - Track a new event
app.post('/events', (req: Request, res: Response): void => {
  try {
    const body = req.body as Partial<AnalyticsEvent>
    const type = body.type
    const userId = body.userId
    const data = body.data

    if (!type) {
      res.status(400).json({ error: 'Event type is required' })
      return
    }

    const event: AnalyticsEvent = {
      id: crypto.randomUUID(),
      type,
      userId,
      data: data ?? {},
      timestamp: new Date(),
    }

    events.push(event)
    logger.debug('Tracked new event', { type: event.type })

    res.status(201).json({ success: true, eventId: event.id })
  } catch (error: unknown) {
    logger.error('Error tracking event', {
      error: error instanceof Error ? String(error) : String(error),
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /metrics - Get aggregated metrics
app.get('/metrics', (_req: Request, res: Response): void => {
  const totalEvents = events.length

  const eventsByType = events.reduce(
    (acc, event) => {
      acc[event.type] = (acc[event.type] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const uniqueUsers = new Set(events.map((e) => e.userId).filter(Boolean)).size

  res.json({
    totalEvents,
    uniqueUsers,
    eventsByType,
    uptime: process.uptime(),
  })
})

// GET /metrics/prometheus - Prometheus metrics format
app.get('/metrics/prometheus', (_req: Request, res: Response): void => {
  let promText = `# HELP http_requests_total Total number of analytics events
# TYPE http_requests_total counter\n`

  const eventsByType = events.reduce(
    (acc, event) => {
      acc[event.type] = (acc[event.type] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  for (const [type, count] of Object.entries(eventsByType)) {
    promText += `http_requests_total{type="${type}"} ${count}\n`
  }

  const uniqueUsers = new Set(events.map((e) => e.userId).filter(Boolean)).size
  promText += `\n# HELP active_users_total Total unique users\n# TYPE active_users_total gauge\n`
  promText += `active_users_total ${uniqueUsers}\n`

  res.set('Content-Type', 'text/plain')
  res.send(promText)
})

// GET /dashboard - Simple HTML dashboard
app.get('/dashboard', (_req: Request, res: Response): void => {
  const uniqueUsersCount = new Set(events.map((e) => e.userId).filter(Boolean))
    .size

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Analytics Dashboard</title>
        <style>
          body { font-family: sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; background: #111; color: #fff; }
          .card { border: 1px solid #333; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; background: #222; }
          h1, h3 { margin-top: 0; }
        </style>
      </head>
      <body>
        <h1>Analytics Dashboard</h1>
        <div class="card">
          <h3>Total Events</h3>
          <p>${events.length}</p>
        </div>
        <div class="card">
          <h3>Unique Users</h3>
          <p>${uniqueUsersCount}</p>
        </div>
      </body>
    </html>
  `
  res.send(html)
})

// GET /health - Health check
app.get('/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', service: 'analytics', uptime: process.uptime() })
})

let server: Server | null = null

const analyticsServer = {
  async start() {
    return new Promise((resolve) => {
      server = app.listen(Number(ANALYTICS_PORT), () => {
        logger.info(`Analytics Service started on port ${ANALYTICS_PORT}`)
        resolve({ status: 'running', port: Number(ANALYTICS_PORT) })
      })
    })
  },

  async stop() {
    logger.info('Analytics Service shutting down...')
    if (server) {
      server.close(() => {
        logger.info('Server closed')
        process.exit(0)
      })
    } else {
      process.exit(0)
    }
  },
}

// Graceful shutdown
process.on('SIGTERM', () => void analyticsServer.stop())
process.on('SIGINT', () => void analyticsServer.stop())

// Start server
analyticsServer.start().catch((error: unknown) => {
  logger.error('Failed to start analytics service:', {
    error: error instanceof Error ? String(error) : String(error),
  })
  process.exit(1)
})

export { app, analyticsServer }
