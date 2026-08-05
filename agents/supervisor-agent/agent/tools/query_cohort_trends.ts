import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { searchMemories } from '../foresight-client.js'

const SCHEMA = z.object({
  cohort_id: z.string().min(1).describe('Cohort ID to analyze.'),
  time_range: z
    .object({
      start: z.string().describe('ISO date for range start.'),
      end: z.string().describe('ISO date for range end.'),
    })
    .optional()
    .describe('Optional date range filter.'),
  dimensions: z
    .array(z.string())
    .optional()
    .describe('Rubric dimensions to include (e.g. rapport, boundaries).'),
})

export default defineTool({
  description:
    'Aggregate QA score records across a cohort over time to show trends per rubric dimension. ' +
    'Returns average scores, trend direction, and sample sizes. Useful for supervisors tracking ' +
    'cohort-wide progress.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const memories = await searchMemories({
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

    // Filter by time range if provided
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

    // Aggregate dimension scores
    const dimMap = new Map<string, number[]>()
    for (const s of filtered) {
      for (const d of s.dimensions) {
        if (input.dimensions && !input.dimensions.includes(d.name)) continue
        if (!dimMap.has(d.name)) dimMap.set(d.name, [])
        dimMap.get(d.name)!.push(d.score)
      }
    }

    const dimensions: Array<{
      name: string
      mean: number
      min: number
      max: number
      sample_size: number
    }> = []

    for (const [name, vals] of dimMap) {
      dimensions.push({
        name,
        mean: vals.reduce((a, b) => a + b, 0) / vals.length,
        min: Math.min(...vals),
        max: Math.max(...vals),
        sample_size: vals.length,
      })
    }

    // Calculate week-over-week trend
    const weeklyBuckets = new Map<string, number[]>()
    for (const s of filtered) {
      const week = s.scored_at.slice(0, 10) // YYYY-MM-DD
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
      summary: {
        total_sessions_scored: filtered.length,
        unique_trainees: new Set(filtered.map((s) => s.total_score)).size,
        period: input.time_range ?? 'all time',
      },
    }
  },
})
