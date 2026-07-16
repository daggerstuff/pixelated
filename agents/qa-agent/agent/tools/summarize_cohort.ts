import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { searchMemories } from '../foresight-client.js'

interface SummarizeCohortInput {
  cohort_id: string
  rubric_version: string
  since: string
}

interface ParsedScore {
  session_id?: string
  cohort_id?: string
  rubric_version?: string
  state?: string
  scored_at?: string
  dimensions?: Array<{ name: string; score: number }>
  total_score?: number
  trainee_id?: string
}

export default defineTool({
  description:
    'Aggregate per-cohort scores over the QA review window. Returns the ' +
    'cohort rollup (mean, p10, p90 per rubric dimension) and the top-N ' +
    'trainees by gap-count. Only REVIEWED score records matching the exact ' +
    'cohort, rubric version, and scoring window are counted.',
  inputSchema: z.object({
    cohort_id: z.string().min(1),
    rubric_version: z.string().min(1),
    since: z.string().datetime(),
  }),
  async execute(input: SummarizeCohortInput) {
    const sinceMs = new Date(input.since).getTime()

    const memories = await searchMemories({
      query: `cohort:${input.cohort_id} state:REVIEWED`,
      limit: 200,
      tag_filter: [
        `cohort_id:${input.cohort_id}`,
        `rubric_version:${input.rubric_version}`,
        'state:REVIEWED',
      ],
    })

    const scoredSessions = (memories ?? [])
      .map((m): ParsedScore | null => {
        try {
          const parsed = JSON.parse(m.content) as ParsedScore
          if (parsed.state !== 'REVIEWED') return null
          if (parsed.cohort_id !== input.cohort_id) return null
          if (
            !Array.isArray(parsed.dimensions) ||
            parsed.dimensions.length === 0
          ) {
            return null
          }
          if (
            parsed.rubric_version &&
            parsed.rubric_version !== input.rubric_version
          ) {
            return null
          }
          const scoredAtMs = parsed.scored_at
            ? new Date(parsed.scored_at).getTime()
            : NaN
          if (!isNaN(scoredAtMs) && scoredAtMs < sinceMs) return null
          return parsed
        } catch {
          return null
        }
      })
      .filter((s): s is ParsedScore => s !== null)

    const dimensionNames = [
      'rapport',
      'open_questions',
      'reflection',
      'boundaries',
      'crisis_recognition',
    ]

    const aggregates: Record<
      string,
      { mean: number; p10: number; p90: number }
    > = {}

    for (const dim of dimensionNames) {
      const scores = scoredSessions
        .flatMap((s) => s.dimensions ?? [])
        .filter((d) => d.name === dim)
        .map((d) => d.score)
        .sort((a, b) => a - b)

      if (scores.length > 0) {
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length
        const p10Index = Math.floor(scores.length * 0.1)
        const p90Index = Math.floor(scores.length * 0.9)
        aggregates[dim] = {
          mean: Math.round(mean * 100) / 100,
          p10: scores[p10Index] ?? 0,
          p90: scores[p90Index] ?? 0,
        }
      }
    }

    const traineeGaps = new Map<string, number>()
    for (const session of scoredSessions) {
      const traineeId = session?.trainee_id ?? 'unknown'
      const gapCount =
        session?.dimensions?.filter((d) => d.score < 5).length ?? 0
      traineeGaps.set(traineeId, (traineeGaps.get(traineeId) ?? 0) + gapCount)
    }

    const topGapTrainees = Array.from(traineeGaps.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([trainee_id, gap_count]) => ({ trainee_id, gap_count }))

    return {
      cohort_id: input.cohort_id,
      rubric_version: input.rubric_version,
      since: input.since,
      session_count: scoredSessions.length,
      aggregates,
      top_gap_trainees: topGapTrainees,
      aggregated_at: new Date().toISOString(),
    }
  },
})
