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
  trainee_ids: z.array(z.string().uuid()).min(2).max(10),
  dimension: z.string().optional(),
})

async function execute(input: z.infer<typeof SCHEMA>) {
  const comparisons: Array<{
    trainee_id: string
    session_count: number
    avg_scores: Record<string, number>
    total_avg: number
    rank: number
  }> = []

  for (const tId of input.trainee_ids) {
    const memories = await searchMemoriesMock({
      query: `session_id score_record`,
      limit: 100,
      tag_filter: [`session_id:${tId}`],
    })

    if (!memories) continue

    const dimScores = new Map<string, number[]>()
    let totalScore = 0
    let sessionCount = 0

    for (const m of memories) {
      try {
        const parsed = JSON.parse(m.content) as {
          state?: string
          dimensions?: Array<{ name: string; score: number }>
          total_score?: number
        }
        if (parsed.state === 'REVIEWED' && parsed.dimensions) {
          sessionCount++
          totalScore += parsed.total_score ?? 0
          for (const d of parsed.dimensions) {
            if (input.dimension && d.name !== input.dimension) continue
            if (!dimScores.has(d.name)) dimScores.set(d.name, [])
            dimScores.get(d.name)!.push(d.score)
          }
        }
      } catch {
        /* skip */
      }
    }

    const avgScores: Record<string, number> = {}
    for (const [name, vals] of dimScores) {
      avgScores[name] = vals.reduce((a, b) => a + b, 0) / vals.length
    }

    comparisons.push({
      trainee_id: tId,
      session_count: sessionCount,
      avg_scores: avgScores,
      total_avg: sessionCount > 0 ? totalScore / sessionCount : 0,
      rank: 0,
    })
  }

  comparisons.sort((a, b) => b.total_avg - a.total_avg)
  comparisons.forEach((c, i) => {
    c.rank = i + 1
  })

  return {
    comparison: comparisons,
    dimension: input.dimension ?? 'all',
    summary: {
      top_trainee: comparisons[0]?.trainee_id ?? null,
      score_spread:
        comparisons.length >= 2
          ? comparisons[0].total_avg -
            comparisons[comparisons.length - 1].total_avg
          : 0,
    },
  }
}
// ---- CUT ----

describe('compare_trainees', () => {
  const UUID = () => crypto.randomUUID()

  beforeEach(() => {
    searchMemoriesMock.mockReset()
  })

  it('should rank trainees by total average score', async () => {
    searchMemoriesMock
      .mockResolvedValueOnce([
        {
          content: JSON.stringify({
            state: 'REVIEWED',
            dimensions: [{ name: 'rapport', score: 9 }],
            total_score: 9,
          }),
        },
      ])
      .mockResolvedValueOnce([
        {
          content: JSON.stringify({
            state: 'REVIEWED',
            dimensions: [{ name: 'rapport', score: 5 }],
            total_score: 5,
          }),
        },
      ])

    const result = await execute({
      trainee_ids: [
        'a'
          .repeat(36)
          .replace(/./g, (c, i) =>
            i === 8 || i === 13 || i === 18 || i === 23 ? '-' : c,
          ),
        'b'
          .repeat(36)
          .replace(/./g, (c, i) =>
            i === 8 || i === 13 || i === 18 || i === 23 ? '-' : c,
          ),
      ],
    })
    expect(result.comparison[0].rank).toBe(1)
    expect(result.comparison[0].total_avg).toBeGreaterThan(
      result.comparison[1].total_avg,
    )
  })

  it('should filter by dimension when provided', async () => {
    searchMemoriesMock
      .mockResolvedValueOnce([
        {
          content: JSON.stringify({
            state: 'REVIEWED',
            dimensions: [
              { name: 'rapport', score: 8 },
              { name: 'empathy', score: 7 },
            ],
            total_score: 15,
          }),
        },
      ])
      .mockResolvedValueOnce([
        {
          content: JSON.stringify({
            state: 'REVIEWED',
            dimensions: [
              { name: 'rapport', score: 6 },
              { name: 'empathy', score: 9 },
            ],
            total_score: 15,
          }),
        },
      ])

    const result = await execute({
      trainee_ids: [UUID(), UUID()],
      dimension: 'rapport',
    })

    expect(result.dimension).toBe('rapport')
    // avg_scores should only have 'rapport'
    for (const c of result.comparison) {
      expect(Object.keys(c.avg_scores)).toEqual(['rapport'])
    }
  })
})
