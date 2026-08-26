import { Agent } from 'https'
import { URL } from 'url'

import * as cron from 'node-cron'

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('dream-scheduler')

export interface DreamSchedulerConfig {
  /** Cron expression for dream cycle scheduling (default: off-peak at 2 AM) */
  cronExpression: string
  /** Base URL of the dream consolidation API */
  consolidationUrl: string
  /** Timeout in ms for each consolidation request */
  requestTimeoutMs: number
  /** If set, only these user IDs are processed */
  userWhitelist: string[]
  /** Whether the scheduler starts automatically */
  autoStart: boolean
}

const DEFAULT_CONFIG: DreamSchedulerConfig = {
  cronExpression: '0 2 * * *',
  consolidationUrl:
    process.env['DREAM_CONSOLIDATION_URL'] ?? 'http://localhost:5000',
  requestTimeoutMs: 300_000,
  userWhitelist: [],
  autoStart: true,
}

export class DreamScheduler {
  private task: cron.ScheduledTask | null = null
  private readonly config: DreamSchedulerConfig
  private isRunning = false

  constructor(config: Partial<DreamSchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.validateConsolidationUrl()
  }

  /** Start the scheduled dream consolidation. Validates the cron expression and begins the schedule. */
  start(): void {
    if (this.task) {
      logger.warn('Dream scheduler already running')
      return
    }
    if (!cron.validate(this.config.cronExpression)) {
      logger.error('Invalid cron expression', {
        expression: this.config.cronExpression,
      })
      return
    }
    this.task = cron.schedule(this.config.cronExpression, () => {
      this.executeCycle().catch((err) => {
        logger.error('Dream consolidation cycle failed', { error: err })
      })
    })
    logger.info('Dream scheduler started', {
      cronExpression: this.config.cronExpression,
      consolidationUrl: this.config.consolidationUrl,
    })
  }

  /** Stop the scheduler and cancel any pending execution. */
  stop(): void {
    if (this.task) {
      this.task.stop()
      this.task = null
    }
    this.isRunning = false
    logger.info('Dream scheduler stopped')
  }

  /** Run a single consolidation cycle immediately, outside the cron schedule. Useful for manual triggering or testing. */
  async runOnce(userIds?: string[]): Promise<RunResult> {
    return this.executeCycle(userIds)
  }

  /** Whether the scheduler task is currently active. */
  get active(): boolean {
    return this.task !== null
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private async executeCycle(userIds?: string[]): Promise<RunResult> {
    if (this.isRunning) {
      logger.warn('Dream consolidation cycle already in progress — skipping')
      return {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        usersProcessed: 0,
        usersFailed: 0,
        errors: [],
        skipped: true,
        reason: 'Already running',
      }
    }
    this.isRunning = true
    const startTime = Date.now()
    const result: RunResult = {
      startedAt: new Date().toISOString(),
      completedAt: '',
      usersProcessed: 0,
      usersFailed: 0,
      errors: [],
    }
    try {
      const targets = userIds ?? this.config.userWhitelist
      if (targets.length === 0) {
        // Query the API for active users
        const users = await this.fetchActiveUsers()
        if (users.length === 0) {
          logger.info('No active users found for consolidation')
          result.completedAt = new Date().toISOString()
          return result
        }
        await this.consolidateUsers(users, result, 10) // Process in batches of 10
      } else {
        await this.consolidateUsers(targets, result, 10) // Process in batches of 10
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('Dream consolidation cycle error', { error: message })
      result.errors.push(message)
    } finally {
      this.isRunning = false
      result.completedAt = new Date().toISOString()
      result.durationMs = Date.now() - startTime
      logger.info('Dream consolidation cycle finished', {
        usersProcessed: result.usersProcessed,
        usersFailed: result.usersFailed,
        durationMs: result.durationMs,
      })
    }
    return result
  }

  private async consolidateUsers(
    userIds: string[],
    result: RunResult,
    batchSize: number,
  ): Promise<void> {
    const baseUrl = this.config.consolidationUrl
    const httpsAgent = new Agent({ rejectUnauthorized: true })
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (userId) => {
          try {
            const controller = new AbortController()
            const timeoutSignal = controller.signal
            const timeout = setTimeout(
              () => controller.abort(),
              this.config.requestTimeoutMs,
            )
            // WARNING: Ensure the configured consolidationUrl uses HTTPS and is deployed within a trusted network boundary.
            // The request body includes user IDs, and the code does not enforce transport encryption.
            const response = await fetch(`${baseUrl}/api/dream/consolidate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: userId }),
              signal: timeoutSignal,
              agent: httpsAgent,
            } as unknown as RequestInit)
            try {
              if (!response.ok) {
                const body = await response.text().catch(() => '')
                throw new Error(
                  `HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
                )
              }
              const data = (await response.json()) as { dream_id?: string }
              result.usersProcessed++
              logger.info('User consolidation complete', {
                userId,
                dreamId: data?.dream_id ?? 'unknown',
              })
            } finally {
              clearTimeout(timeout)
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            result.usersFailed++
            result.errors.push(`User ${userId}: ${message}`)
            logger.error('User consolidation failed', {
              userId,
              error: message,
            })
          }
        }),
      )
    }
  }

  private async fetchActiveUsers(): Promise<string[]> {
    const baseUrl = this.config.consolidationUrl
    const httpsAgent = new Agent({ rejectUnauthorized: true })
    try {
      const response = await fetch(`${baseUrl}/api/dream/users`, {
        signal: AbortSignal.timeout(10_000),
        agent: httpsAgent,
      } as unknown as RequestInit)
      if (!response.ok) return []
      const data = (await response.json()) as { users?: string[] }
      return data?.users ?? []
    } catch {
      logger.warn('Failed to fetch active users, falling back to whitelist')
      return this.config.userWhitelist
    }
  }

  private validateConsolidationUrl(): void {
    const url = new URL(this.config.consolidationUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Consolidation URL must use HTTP or HTTPS')
    }
    if (url.protocol === 'http:' && url.hostname !== 'localhost') {
      throw new Error('HTTP consolidation URL is only allowed for localhost')
    }
  }
}

export interface RunResult {
  startedAt: string
  completedAt: string
  durationMs?: number
  usersProcessed: number
  usersFailed: number
  errors: string[]
  skipped?: boolean
  reason?: string
}
