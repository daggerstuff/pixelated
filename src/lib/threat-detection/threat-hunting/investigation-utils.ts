/**
 * Lightweight utilities used by unit tests. These functions intentionally avoid
 * external dependencies and operate on the provided Redis-like client (mocked in tests).
 */

type RedisLike = {
  incr: (key: string) => Promise<number>
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<unknown>
}

export async function createInvestigation(
  redis: RedisLike,
  investigationData: Record<string, unknown>,
): Promise<Record<string, unknown> | { errors: string[] }> {
  const data = investigationData as { title?: unknown; priority?: unknown }
  if (!data.title || !data.priority) {
    return { errors: ['Invalid investigation data'] }
  }

  try {
    const id = await redis.incr('investigation:id')
    const investigation = {
      id: `inv_${id}`,
      ...investigationData,
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    await redis.set(`investigation:inv_${id}`, JSON.stringify(investigation))
    return investigation
  } catch (error) {
    return { errors: [error instanceof Error ? error.message : String(error)] }
  }
}

export async function updateInvestigation(
  redis: RedisLike,
  investigationId: string,
  updateData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const raw = await redis.get(`investigation:${investigationId}`)
  const existing = raw
    ? (JSON.parse(raw) as Record<string, unknown>)
    : undefined
  const updated = {
    ...(existing || {
      id: investigationId,
      status: 'active',
      createdAt: new Date().toISOString(),
    }),
    ...updateData,
    updatedAt: new Date().toISOString(),
  }
  await redis.set(`investigation:${investigationId}`, JSON.stringify(updated))
  return updated
}

export async function closeInvestigation(
  redis: RedisLike,
  investigationId: string,
  resolutionData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const raw = await redis.get(`investigation:${investigationId}`)
  const existing = raw
    ? (JSON.parse(raw) as Record<string, unknown>)
    : { id: investigationId }
  const closed = {
    ...existing,
    ...resolutionData,
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
  }
  await redis.set(`investigation:${investigationId}`, JSON.stringify(closed))
  return closed
}

export async function generateInvestigationReport(
  investigation: Record<string, unknown>,
  options: {
    includeTimeline?: boolean
    includeEvidence?: boolean
    includeRecommendations?: boolean
    format?: string
  } = {},
): Promise<Record<string, unknown>> {
  const {
    includeTimeline = true,
    includeEvidence = true,
    includeRecommendations = true,
    format = 'json',
  } = options

  type InvestigationLike = {
    id?: string
    title?: string
    status?: string
    priority?: string
    createdAt?: string | Date
    resolvedAt?: string | Date
    timeline?: unknown[]
    evidence?: unknown[]
  }
  const inv = investigation as InvestigationLike

  const createdAtRaw = inv.createdAt
  const resolvedAtRaw = inv.resolvedAt
  const createdAt =
    typeof createdAtRaw === 'string' || createdAtRaw instanceof Date
      ? new Date(createdAtRaw)
      : new Date()
  const resolvedAt =
    typeof resolvedAtRaw === 'string' || resolvedAtRaw instanceof Date
      ? new Date(resolvedAtRaw)
      : new Date()

  const summary = {
    id: inv.id,
    title: inv.title,
    status: inv.status,
    priority: inv.priority,
    durationMs: Math.max(0, resolvedAt.getTime() - createdAt.getTime()),
  }

  const report: Record<string, unknown> = {
    summary,
    investigation,
    format,
  }

  if (includeTimeline) {
    const tl = inv.timeline
    report.timeline = Array.isArray(tl) ? tl : []
  }
  if (includeEvidence) {
    const ev = inv.evidence
    report.evidence = Array.isArray(ev) ? ev : []
  }
  if (includeRecommendations) {
    // Simple heuristic recommendations for tests
    const recommendations: string[] = []
    const priority = inv.priority
    if (priority === 'critical' || priority === 'high') {
      recommendations.push('escalate_to_security_team')
      recommendations.push('increase_monitoring')
    } else {
      recommendations.push('review_security_controls')
    }
    report.recommendations = recommendations
  }

  return report
}

export async function exportInvestigationData(
  investigation: Record<string, unknown>,
  format: string,
): Promise<{ format: string; data: Record<string, unknown> }> {
  // For tests, simply return the structure; real export/serialization is out of scope
  return { format, data: investigation }
}
