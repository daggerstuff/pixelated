import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { storeMemory } from '../foresight-client.js'

const STEP_STATUSES = ['COMPLETED', 'IN_PROGRESS', 'SKIPPED'] as const

const SCHEMA = z.object({
  trainee_id: z.string().uuid().describe('UUID of the trainee.'),
  step_id: z.string().min(1).describe('Curriculum step identifier.'),
  status: z.enum(STEP_STATUSES).describe('Completion status for this step.'),
  notes: z
    .string()
    .max(1000)
    .optional()
    .describe('Optional notes about this step.'),
})

export default defineTool({
  description:
    'Record a curriculum step as completed, in-progress, or skipped for a trainee. ' +
    'Progress is tracked per-trainee (not per-cohort) so individuals in the same ' +
    'cohort can progress at different speeds. Append-only — never delete.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const recordedAt = new Date().toISOString()

    const stepRecord = {
      type: 'curriculum_step',
      trainee_id: input.trainee_id,
      step_id: input.step_id,
      status: input.status,
      notes: input.notes ?? null,
      recorded_at: recordedAt,
    }

    const stored = await storeMemory({
      content: JSON.stringify(stepRecord),
      category: 'curriculum',
      scope: 'trainee',
      retention: 'long_term',
      importance: 0.5,
      tags: [
        `trainee:${input.trainee_id}`,
        'curriculum',
        `step:${input.step_id}`,
        `step_status:${input.status}`,
      ],
    })

    return {
      trainee_id: input.trainee_id,
      step_id: input.step_id,
      status: input.status,
      recorded_at: recordedAt,
      foresight_memory: stored ?? {
        memory_id: null,
        note: 'Foresight MCP write may have failed.',
      },
    }
  },
})
