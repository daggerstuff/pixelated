import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

function defineToolForTest<T extends z.ZodType>(opts: {
  description: string
  inputSchema: T
  execute: (input: z.infer<T>) => Promise<Record<string, unknown>>
}) {
  return opts
}

vi.mock('eve/tools', () => ({ defineTool: defineToolForTest }))

const searchMemoriesMock = vi.fn()
vi.mock('../agent/foresight-client.js', () => ({
  searchMemories: (...args: unknown[]) => searchMemoriesMock(...args),
}))

// ---- CUT ----
const SCHEMA = z.object({
  cohort_id: z.string().min(1),
  time_range: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
  dimensions: z.array(z.string()).optional(),
})

async function execute(input: z.infer<typeof SCHEMA>) {
  const memories = await searchMemoriesMock({
    query: `cohort_id:${input.cohort_id} score_record`,
    limit: 500,
    tag_filter: [`cohort_id:${input.cohort_id}`],
  })

  if (!memories || memories.length === 0) {
    return {
      cohort_id: input.cohort_id,
      trend: [],
      summary: { total_sessions_scored: 0, note: 'No score records found.' },
    }
  }

  const scoredSessions: Array<{
    scored_at: string
    dimensions: Array<{ name: string; score: number }>
    total_score: number
  }> = []

  for (const m of memories) {
    try {
      const parsed = JSON.parse(m.content) as {
        state?: string
        dimensions?: Array<{ name: string; score: number }>
        total_score?: number
        scored_at?: string
      }
      if (
        parsed.state === 'REVIEWED' &&
        parsed.dimensions &&
        parsed.scored_at
      ) {
        scoredSessions.push({
          scored_at: parsed.scored_at,
          dimensions: parsed.dimensions,
          total_score: parsed.total_score ?? 0,
        })
      }
    } catch {
      /* skip */
    }
  }

  let filtered = scoredSessions
  if (input.time_range) {
    const start = new Date(input.time_range.start).getTime()
    const end = new Date(input.time_range.end).getTime()
    filtered = scoredSessions.filter((s) => {
      const t = new Date(s.scored_at).getTime()
      return t >= start && t <= end
    })
  }

  if (filtered.length === 0) {
    return {
      cohort_id: input.cohort_id,
      trend: [],
      summary: {
        total_sessions_scored: 0,
        note: 'No sessions in the requested time range.',
      },
    }
  }

  const dimMap = new Map<string, number[]>()
  for (const s of filtered) {
    for (const d of s.dimensions) {
      if (input.dimensions && !input.dimensions.includes(d.name)) continue
      if (!dimMap.has(d.name)) dimMap.set(d.name, [])
      dimMap.get(d.name)!.push(d.score)
    }
  }

  const dimensions = Array.from(dimMap.entries()).map(([name, vals]) => ({
    name,
    mean: vals.reduce((a, b) => a + b, 0) / vals.length,
    min: Math.min(...vals),
    max: Math.max(...vals),
    sample_size: vals.length,
  }))

  const weeklyBuckets = new Map<string, number[]>()
  for (const s of filtered) {
    const week = s.scored_at.slice(0, 10)
    if (!weeklyBuckets.has(week)) weeklyBuckets.set(week, [])
    weeklyBuckets.get(week)!.push(s.total_score)
  }

  const trend = Array.from(weeklyBuckets.entries())
    .map(([week, scores]) => ({
      week,
      avg_total: scores.reduce((a, b) => a + b, 0) / scores.length,
      session_count: scores.length,
    }))
    .sort((a, b) => a.week.localeCompare(b.week))

  return {
    cohort_id: input.cohort_id,
    dimensions,
    trend,
    summary: { total_sessions_scored: filtered.length },
  }
}
// ---- CUT ----

describe('query_cohort_trends', () => {
  beforeEach(() => {
    searchMemoriesMock.mockReset()
  })

  it('should aggregate dimension scores across a cohort', async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({
          state: 'REVIEWED',
          dimensions: [
            { name: 'rapport', score: 8 },
            { name: 'boundaries', score: 7 },
          ],
          total_score: 15,
          scored_at: '2026-07-01T12:00:00Z',
        }),
      },
      {
        content: JSON.stringify({
          state: 'REVIEWED',
          dimensions: [
            { name: 'rapport', score: 9 },
            { name: 'boundaries', score: 6 },
          ],
          total_score: 15,
          scored_at: '2026-07-08T12:00:00Z',
        }),
      },
    ])

    const result = await execute({ cohort_id: 'CBT-2026-01' })
    expect(result.dimensions).toHaveLength(2)
    expect(result.dimensions.find((d) => d.name === 'rapport')?.mean).toBe(8.5)
    expect(result.summary.total_sessions_scored).toBe(2)
  })

  it('should return empty when no score records exist', async () => {
    searchMemoriesMock.mockResolvedValue([])
    const result = await execute({ cohort_id: 'EMPTY' })
    expect(result.trend).toHaveLength(0)
    expect(result.summary.note).toContain('No score records')
  })

  it('should filter by time_range', async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({
          state: 'REVIEWED',
          dimensions: [{ name: 'rapport', score: 5 }],
          total_score: 5,
          scored_at: '2026-06-01T12:00:00Z',
        }),
      },
      {
        content: JSON.stringify({
          state: 'REVIEWED',
          dimensions: [{ name: 'rapport', score: 8 }],
          total_score: 8,
          scored_at: '2026-07-15T12:00:00Z',
        }),
      },
    ])

    const result = await execute({
      cohort_id: 'CBT-2026-01',
      time_range: { start: '2026-07-01', end: '2026-07-31' },
    })
    expect(result.summary.total_sessions_scored).toBe(1)
  })

  it('should filter by specific dimensions', async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({
          state: 'REVIEWED',
          dimensions: [
            { name: 'rapport', score: 8 },
            { name: 'boundaries', score: 7 },
            { name: 'empathy', score: 9 },
          ],
          total_score: 24,
          scored_at: '2026-07-01T12:00:00Z',
        }),
      },
    ])

    const result = await execute({ cohort_id: 'TEST', dimensions: ['rapport'] })
    expect(result.dimensions).toHaveLength(1)
    expect(result.dimensions[0].name).toBe('rapport')
  })

  it('should build weekly trend', async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({
          state: 'REVIEWED',
          dimensions: [{ name: 'rapport', score: 7 }],
          total_score: 7,
          scored_at: '2026-07-01T12:00:00Z',
        }),
      },
      {
        content: JSON.stringify({
          state: 'REVIEWED',
          dimensions: [{ name: 'rapport', score: 9 }],
          total_score: 9,
          scored_at: '2026-07-08T12:00:00Z',
        }),
      },
    ])

    const result = await execute({ cohort_id: 'TEST' })
    expect(result.trend).toHaveLength(2)
    expect(result.trend[0].week).toBe('2026-07-01')
    expect(result.trend[1].avg_total).toBe(9)
  })
})
