import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { searchMemories } from '../foresight-client.js'

const SCHEMA = z.object({
  trainee_ids: z
    .array(z.string().uuid())
    .min(2)
    .max(10)
    .describe('UUIDs of trainees to compare.'),
  dimension: z
    .string()
    .optional()
    .describe('Filter to a specific rubric dimension.'),
})

export default defineTool({
  description:
    'Side-by-side comparison of 2-10 trainees across rubric dimensions. Reads QA ' +
    'score records from Foresight and returns per-trainee averages, rankings, and ' +
    'session counts.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const comparisons: Array<{
      trainee_id: string
      session_count: number
      avg_scores: Record<string, number>
      total_avg: number
      rank: number
    }> = []

    for (const tId of input.trainee_ids) {
      const memories = await searchMemories({
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
        rank: 0, // filled below
      })
    }

    // Rank by total_avg descending
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
  },
})
