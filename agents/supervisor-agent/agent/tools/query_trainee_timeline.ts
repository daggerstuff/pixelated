import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { searchMemories } from '../foresight-client.js'

const SCHEMA = z.object({
  trainee_id: z.string().uuid().describe('UUID of the trainee.'),
  include_sessions: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include session records.'),
  include_scores: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include QA score records.'),
})

export default defineTool({
  description:
    "Build a chronological timeline of a single trainee's journey through the program. " +
    'Includes enrollment, cohort assignments, curriculum progress, session activity, ' +
    'and QA scores.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const parsedInput = SCHEMA.parse(input)
    const allMemories = await searchMemories({
      query: `trainee:${parsedInput.trainee_id}`,
      limit: 200,
      tag_filter: [`trainee:${parsedInput.trainee_id}`],
    })

    if (!allMemories || allMemories.length === 0) {
      return {
        trainee_id: parsedInput.trainee_id,
        events: [],
        summary: { note: 'No records found for this trainee.' },
      }
    }

    const events: Array<{
      type: string
      timestamp: string
      detail: Record<string, unknown>
    }> = []

    for (const m of allMemories) {
      try {
        const parsed = JSON.parse(m.content) as Record<string, unknown>
        const ts = (parsed.enrolled_at ??
          parsed.assigned_at ??
          parsed.recorded_at ??
          parsed.scored_at ??
          parsed.evaluated_at ??
          '') as string

        switch (parsed.type) {
          case 'trainee_profile':
            events.push({ type: 'enrollment', timestamp: ts, detail: parsed })
            break
          case 'cohort_assignment':
            events.push({
              type: 'cohort_assignment',
              timestamp: ts,
              detail: parsed,
            })
            break
          case 'curriculum_step':
            events.push({ type: 'curriculum', timestamp: ts, detail: parsed })
            break
          case 'session_header':
            if (parsedInput.include_sessions) {
              events.push({ type: 'session', timestamp: ts, detail: parsed })
            }
            break
          default:
            if (parsed.state === 'REVIEWED' && parsedInput.include_scores) {
              events.push({ type: 'qa_score', timestamp: ts, detail: parsed })
            }
            break
        }
      } catch {
        /* skip */
      }
    }

    // Sort chronologically
    events.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

    return {
      trainee_id: parsedInput.trainee_id,
      events,
      summary: {
        total_events: events.length,
        first_event: events[0]?.timestamp ?? null,
        last_event: events[events.length - 1]?.timestamp ?? null,
      },
    }
  },
})
