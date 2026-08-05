import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { searchMemories } from '../foresight-client.js'

const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const
const COHORT_STATUSES = ['UPCOMING', 'ACTIVE', 'COMPLETED'] as const

const SCHEMA = z.object({
  status: z
    .enum(COHORT_STATUSES)
    .optional()
    .describe('Filter by cohort status.'),
  skill_level: z
    .enum(SKILL_LEVELS)
    .optional()
    .describe('Filter by skill level.'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe('Max results.'),
})

export default defineTool({
  description:
    'List all cohorts with optional status and skill-level filters. Returns ' +
    'cohort metadata including name, skill level, date range, and trainee count.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const tagFilter: string[] = ['cohort_definition']
    if (input.status) tagFilter.push(`status:${input.status}`)
    if (input.skill_level) tagFilter.push(`level:${input.skill_level}`)

    const memories = await searchMemories({
      query: 'cohort',
      limit: input.limit,
      tag_filter: tagFilter,
    })

    const cohorts = (memories ?? [])
      .map((m) => {
        try {
          const parsed = JSON.parse(m.content)
          if (parsed.type === 'cohort_definition') return parsed
          return null
        } catch {
          return null
        }
      })
      .filter(Boolean)

    return {
      cohorts,
      total: cohorts.length,
      filters: {
        status: input.status ?? null,
        skill_level: input.skill_level ?? null,
      },
    }
  },
})
