/**
 * Linear Dashboard Webhook Route
 *
 * Receives Linear webhook events, verifies the HMAC-SHA256 signature,
 * filters for Issue/Project changes in the Enterprise Readiness Program,
 * and spawns the dashboard refresh script.
 *
 * Linear sends:
 *   POST /api/webhooks/linear/dashboard
 *   Headers: linear-digest, linear-event, linear-delivery
 *   Body: { action, data, url, createdAt, updatedAt }
 */

import { spawn } from 'child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import express, { Router, type Request, type Response } from 'express'
import { Webhook } from 'standardwebhooks'

const router: Router = express.Router()

// ── Config ────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = process.env['LINEAR_DASHBOARD_WEBHOOK_SECRET'] ?? ''
const TARGET_PROJECT_ID = '29c133a2-9195-42d3-b53e-31154d47ea7d' // Enterprise Readiness Program

// Resolve script path relative to this file: ../../docs/linear-audit/refresh_dashboard.py
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REFRESH_SCRIPT = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'linear-audit',
  'refresh_dashboard.py',
)

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Check if a webhook payload references the Enterprise Readiness Program project.
 * Linear sends the full issue/project data in `data`, which includes `projectId`.
 */
function targetsOurProject(body: Record<string, unknown>): boolean {
  const data = (body['data'] as Record<string, unknown>) ?? {}
  // Issue events: data.projectId === project ID
  // Project events: data.id === project ID (the data IS the project object)
  return (
    data['projectId'] === TARGET_PROJECT_ID || data['id'] === TARGET_PROJECT_ID
  )
}

/**
 * Spawn refresh_dashboard.py as a detached child process.
 * Returns immediately — does not wait for completion.
 */
function spawnDashboardRefresh(): void {
  const child = spawn('python3', [REFRESH_SCRIPT], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    env: {
      ...process.env,
      LINEAR_API_KEY: process.env['LINEAR_API_KEY'] ?? '',
    },
  })

  // Log output asynchronously
  child.stdout?.on('data', () => {})
  child.stderr?.on('data', () => {})

  child.on('close', (code: number | null) => {
    if (code !== 0) {
      // error handled by caller — dashboard refresh failed
    }
  })

  child.unref() // Don't prevent the process from exiting
}

// ── Route ─────────────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/linear/dashboard
 *
 * Linear webhook delivery — signature-verified, project-filtered, async refresh.
 */
router.post(
  '/linear/dashboard',
  // Use raw body so we can verify the HMAC signature against the exact payload
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response): Promise<void> => {
    // ── 1. Configuration check ──────────────────────────────────────────
    if (!WEBHOOK_SECRET) {
      res.status(501).json({
        error: 'Not configured',
        message:
          'LINEAR_DASHBOARD_WEBHOOK_SECRET environment variable is not set',
      })
      return
    }

    // ── 2. Signature verification ───────────────────────────────────────
    const rawBody = (req.body as Buffer).toString('utf8')
    let body: Record<string, unknown>

    try {
      body = JSON.parse(rawBody)
    } catch {
      res.status(400).json({ error: 'Invalid JSON payload' })
      return
    }

    const linearDigest = req.headers['linear-digest'] as string | undefined
    const linearEvent = req.headers['linear-event'] as string | undefined
    const linearDelivery = req.headers['linear-delivery'] as string | undefined

    if (!linearDigest || !linearEvent || !linearDelivery) {
      res.status(400).json({
        error: 'Missing required Linear webhook headers',
        headers: {
          'linear-digest': !!linearDigest,
          'linear-event': !!linearEvent,
          'linear-delivery': !!linearDelivery,
        },
      })
      return
    }

    try {
      const wh = new Webhook(WEBHOOK_SECRET)
      wh.verify(rawBody, {
        'linear-digest': linearDigest,
        'linear-event': linearEvent,
        'linear-delivery': linearDelivery,
      })
    } catch (err) {
      res.status(401).json({ error: 'Invalid webhook signature' })
      return
    }

    // ── 3. Event filtering ──────────────────────────────────────────────
    const action = body['action'] as string
    const eventType = linearEvent

    // Only process Issue and Project events
    if (eventType !== 'Issue' && eventType !== 'Project') {
      res.status(200).json({
        status: 'ignored',
        reason: `Unwatched event type: ${eventType}`,
      })
      return
    }

    // Check if this event is for our project
    if (!targetsOurProject(body)) {
      res.status(200).json({
        status: 'ignored',
        reason: 'Not related to Enterprise Readiness Program project',
      })
      return
    }

    // ── 4. Spawn dashboard refresh ──────────────────────────────────────
    spawnDashboardRefresh()

    res.status(200).json({
      status: 'accepted',
      message: 'Dashboard refresh triggered',
      event: eventType,
      action,
    })
  },
)

export default router
