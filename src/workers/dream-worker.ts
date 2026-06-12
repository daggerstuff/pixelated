import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('dream-worker')

const WORKER_ID = crypto.randomUUID()
const PROCESSING_INTERVAL = 60_000
const CONSOLIDATION_URL =
  process.env['DREAM_CONSOLIDATION_URL'] ?? 'http://localhost:5000'
const USER_WHITELIST = (process.env['DREAM_USER_WHITELIST'] ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

async function startWorker(): Promise<void> {
  logger.info('Starting dream worker', {
    workerId: WORKER_ID,
    consolidationUrl: CONSOLIDATION_URL,
  })

  if (USER_WHITELIST.length === 0) {
    logger.warn(
      'DREAM_USER_WHITELIST not set — worker will idle without processing',
    )
  } else {
    logger.info('Whitelisted users', { count: USER_WHITELIST.length })
  }

  while (true) {
    try {
      await runConsolidationCycle()
    } catch (error: unknown) {
      logger.error('Dream worker cycle error', { error: String(error) })
    }
    await new Promise((resolve) => setTimeout(resolve, PROCESSING_INTERVAL))
  }
}

async function runConsolidationCycle(): Promise<void> {
  const targets =
    USER_WHITELIST.length > 0 ? USER_WHITELIST : await fetchActiveUsers()
  if (targets.length === 0) {
    logger.debug('No users to process in this cycle')
    return
  }

  logger.info('Starting consolidation cycle', { userCount: targets.length })

  let processed = 0
  let failed = 0

  for (const userId of targets) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 300_000)

      const response = await fetch(
        `${CONSOLIDATION_URL}/api/dream/consolidate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
          signal: controller.signal,
        },
      )

      clearTimeout(timeout)

      if (response.ok) {
        const data = (await response.json()) as { dream_id?: string }
        logger.info('Consolidation complete', {
          userId,
          dreamId: data?.dream_id ?? '?',
        })
        processed++
      } else {
        const body = await response.text().catch(() => '')
        throw new Error(
          `HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('Consolidation failed', { userId, error: msg })
      failed++
    }
  }

  logger.info('Consolidation cycle complete', {
    processed,
    failed,
    total: targets.length,
  })
}

async function fetchActiveUsers(): Promise<string[]> {
  try {
    const response = await fetch(`${CONSOLIDATION_URL}/api/dream/users`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return []
    const data = (await response.json()) as { users?: string[] }
    return data?.users ?? []
  } catch {
    logger.warn('Failed to fetch active users — returning empty list')
    return []
  }
}

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM — shutting down dream worker', {
    workerId: WORKER_ID,
  })
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('Received SIGINT — shutting down dream worker', {
    workerId: WORKER_ID,
  })
  process.exit(0)
})

startWorker().catch((err) => {
  logger.error('Dream worker startup failed', { error: String(err) })
  process.exit(1)
})
