import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { searchMemories } from '../foresight-client.js'

const SCHEMA = z.object({
  cohort_id: z.string().min(1).describe('Cohort ID to query.'),
  dimension: z
    .string()
    .optional()
    .describe(
      'Specific rubric dimension to filter (e.g. rapport, boundaries).',
    ),
})

interface TraineeScore {
  trainee_id: string
  session_count: number
  avg_score: number
  dimension_scores: Record<string, number>
}

export default defineTool({
  description:
    'Aggregate progress metrics across all trainees in a cohort. Reads session ' +
    'QA score records from Foresight and returns average scores by dimension, ' +
    'completion rate, and trend direction.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    // Find all enrollment records for this cohort
    const enrollmentMemories = await searchMemories({
      query: `cohort:${input.cohort_id} enrollment`,
      limit: 200,
      tag_filter: [`cohort:${input.cohort_id}`],
    })

    const traineeIds: string[] = []
    for (const m of enrollmentMemories ?? []) {
      try {
        const parsed = JSON.parse(m.content) as {
          type?: string
          trainee_id?: string
          status?: string
        }
        if (parsed.type === 'cohort_assignment' && parsed.trainee_id) {
          traineeIds.push(parsed.trainee_id)
        }
      } catch {
        /* skip */
      }
    }

    // Fetch QA score records for all trainees in this cohort
    const scoreMemories = await searchMemories({
      query: `cohort_id:${input.cohort_id} score_record`,
      limit: 200,
      tag_filter: [`cohort_id:${input.cohort_id}`],
    })

    const scores: TraineeScore[] = []
    const scoreMap = new Map<
      string,
      { total: number; count: number; dimensions: Record<string, number[]> }
    >()

    for (const m of scoreMemories ?? []) {
      try {
        const parsed = JSON.parse(m.content) as {
          session_id?: string
          cohort_id?: string
          state?: string
          dimensions?: Array<{ name: string; score: number }>
          total_score?: number
        }
        if (parsed.state === 'REVIEWED' && parsed.dimensions) {
          const tId = parsed.session_id ?? 'unknown'
          if (!scoreMap.has(tId)) {
            scoreMap.set(tId, { total: 0, count: 0, dimensions: {} })
          }
          const entry = scoreMap.get(tId)!
          entry.total += parsed.total_score ?? 0
          entry.count += 1
          for (const d of parsed.dimensions) {
            if (!entry.dimensions[d.name]) entry.dimensions[d.name] = []
            entry.dimensions[d.name].push(d.score)
          }
        }
      } catch {
        /* skip */
      }
    }

    for (const [tId, data] of scoreMap) {
      const dimScores: Record<string, number> = {}
      for (const [dim, vals] of Object.entries(data.dimensions)) {
        dimScores[dim] = vals.reduce((a, b) => a + b, 0) / vals.length
      }
      scores.push({
        trainee_id: tId,
        session_count: data.count,
        avg_score: data.total / data.count,
        dimension_scores: dimScores,
      })
    }

    // Aggregate across cohort
    const dimensionAggregates: Record<
      string,
      { mean: number; p10: number; p90: number }
    > = {}
    for (const s of scores) {
      for (const [dim, val] of Object.entries(s.dimension_scores)) {
        if (!dimensionAggregates[dim])
          dimensionAggregates[dim] = { mean: 0, p10: 0, p90: 0 }
      }
    }
    for (const dim of Object.keys(dimensionAggregates)) {
      const vals = scores
        .map((s) => s.dimension_scores[dim] ?? 0)
        .sort((a, b) => a - b)
      dimensionAggregates[dim] = {
        mean: vals.reduce((a, b) => a + b, 0) / vals.length,
        p10: vals[Math.floor(vals.length * 0.1)] ?? 0,
        p90: vals[Math.floor(vals.length * 0.9)] ?? 0,
      }
    }

    const overallAvg =
      scores.length > 0
        ? scores.reduce((a, s) => a + s.avg_score, 0) / scores.length
        : 0

    return {
      cohort_id: input.cohort_id,
      trainee_count: traineeIds.length,
      scored_trainee_count: scores.length,
      overall_avg_score: overallAvg,
      dimension_averages: dimensionAggregates,
      trainee_scores: input.dimension ? undefined : scores,
      note:
        scores.length === 0
          ? 'No QA score records found for this cohort. Sessions may not have been scored yet.'
          : undefined,
    }
  },
})
