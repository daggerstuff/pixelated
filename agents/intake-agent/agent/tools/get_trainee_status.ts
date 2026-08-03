import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { searchMemories } from '../foresight-client.js'

const SCHEMA = z.object({
  trainee_id: z.string().uuid().describe('UUID of the trainee.'),
})

export default defineTool({
  description:
    "Get a trainee's full profile, cohort assignment, curriculum progress, and " +
    'session count. Queries Foresight across trainee, enrollment, curriculum, ' +
    'and session categories.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const allMemories = await searchMemories({
      query: `trainee:${input.trainee_id}`,
      limit: 50,
      tag_filter: [`trainee:${input.trainee_id}`],
    })

    if (!allMemories || allMemories.length === 0) {
      return {
        trainee_id: input.trainee_id,
        found: false,
        message: 'No records found for this trainee ID.',
      }
    }

    let profile: Record<string, unknown> | null = null
    let cohort: Record<string, unknown> | null = null
    const curriculumSteps: Record<string, unknown>[] = []
    const sessionIds: string[] = []

    for (const m of allMemories) {
      try {
        const parsed = JSON.parse(m.content) as {
          type?: string
          trainee_id?: string
          status?: string
        }
        if (parsed.type === 'trainee_profile') profile = parsed
        else if (parsed.type === 'cohort_assignment') cohort = parsed
        else if (parsed.type === 'curriculum_step') curriculumSteps.push(parsed)
        else if (parsed.type === 'session_header') {
          if (parsed.trainee_id === input.trainee_id && parsed.status) {
            sessionIds.push(parsed.trainee_id)
          }
        }
      } catch { /* skip unparseable */ }
    }

    // Fetch session IDs from session records (tag-based query)
    const sessionMemories = await searchMemories({
      query: `trainee:${input.trainee_id} session`,
      limit: 20,
      tag_filter: [`trainee:${input.trainee_id}`],
    })
    const sessionIdsFromTag = (sessionMemories ?? [])
      .map((m) => {
        try {
          const parsed = JSON.parse(m.content) as { session_id?: string }
          return parsed.session_id ?? null
        } catch { return null }
      })
      .filter(Boolean)

    return {
      trainee_id: input.trainee_id,
      found: true,
      profile,
      cohort,
      curriculum: {
        completed_steps: curriculumSteps.filter((s) => (s as Record<string, unknown>).status === 'COMPLETED').length,
        total_steps: curriculumSteps.length,
        steps: curriculumSteps,
      },
      sessions: {
        total: sessionIdsFromTag.length,
        session_ids: sessionIdsFromTag,
      },
    }
  },
})
