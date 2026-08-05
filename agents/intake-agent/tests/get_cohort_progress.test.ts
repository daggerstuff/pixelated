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
const inputSchema = z.object({
  cohort_id: z.string().min(1),
})

async function execute(input: z.infer<typeof inputSchema>) {
  const assignments = await searchMemoriesMock({
    query: `cohort:${input.cohort_id} cohort_assignment`,
    limit: 100,
    tag_filter: [`cohort:${input.cohort_id}`, 'cohort_assignment'],
  })

  const curriculumSteps = await searchMemoriesMock({
    query: `cohort:${input.cohort_id} curriculum_step`,
    limit: 500,
    tag_filter: [`cohort:${input.cohort_id}`, 'curriculum_step'],
  })

  const traineeIds = new Set<string>()
  for (const a of assignments ?? []) {
    try {
      const parsed = JSON.parse(a.content) as { trainee_id?: string }
      if (parsed.trainee_id) traineeIds.add(parsed.trainee_id)
    } catch {
      /* skip */
    }
  }

  const stepByTrainee = new Map<string, number>()
  for (const s of curriculumSteps ?? []) {
    try {
      const parsed = JSON.parse(s.content) as { trainee_id?: string }
      if (parsed.trainee_id) {
        stepByTrainee.set(
          parsed.trainee_id,
          (stepByTrainee.get(parsed.trainee_id) ?? 0) + 1,
        )
      }
    } catch {
      /* skip */
    }
  }

  const progress: Array<{ trainee_id: string; completed_steps: number }> = []
  for (const tId of traineeIds) {
    progress.push({
      trainee_id: tId,
      completed_steps: stepByTrainee.get(tId) ?? 0,
    })
  }

  return {
    cohort_id: input.cohort_id,
    total_trainees: traineeIds.size,
    progress: progress.sort((a, b) => b.completed_steps - a.completed_steps),
  }
}
// ---- CUT ----

describe('get_cohort_progress', () => {
  beforeEach(() => {
    searchMemoriesMock.mockReset()
  })

  it('should return progress for all trainees in a cohort', async () => {
    searchMemoriesMock
      .mockResolvedValueOnce([
        {
          content: JSON.stringify({
            trainee_id: 't1',
            type: 'cohort_assignment',
          }),
        },
        {
          content: JSON.stringify({
            trainee_id: 't2',
            type: 'cohort_assignment',
          }),
        },
      ])
      .mockResolvedValueOnce([
        { content: JSON.stringify({ trainee_id: 't1', step: 1 }) },
        { content: JSON.stringify({ trainee_id: 't1', step: 2 }) },
      ])

    const result = await execute({ cohort_id: 'CBT-2026-01' })
    expect(result.total_trainees).toBe(2)
    expect(
      result.progress.find((p) => p.trainee_id === 't1')?.completed_steps,
    ).toBe(2)
    expect(
      result.progress.find((p) => p.trainee_id === 't2')?.completed_steps,
    ).toBe(0)
  })

  it('should return empty progress when no assignments exist', async () => {
    searchMemoriesMock.mockResolvedValue([]).mockResolvedValue([])
    const result = await execute({ cohort_id: 'EMPTY-COHORT' })
    expect(result.total_trainees).toBe(0)
    expect(result.progress).toHaveLength(0)
  })

  it('should sort by completed_steps descending', async () => {
    searchMemoriesMock
      .mockResolvedValueOnce([
        {
          content: JSON.stringify({
            trainee_id: 'a',
            type: 'cohort_assignment',
          }),
        },
        {
          content: JSON.stringify({
            trainee_id: 'b',
            type: 'cohort_assignment',
          }),
        },
        {
          content: JSON.stringify({
            trainee_id: 'c',
            type: 'cohort_assignment',
          }),
        },
      ])
      .mockResolvedValueOnce([
        { content: JSON.stringify({ trainee_id: 'b', step: 1 }) },
        { content: JSON.stringify({ trainee_id: 'b', step: 2 }) },
        { content: JSON.stringify({ trainee_id: 'b', step: 3 }) },
        { content: JSON.stringify({ trainee_id: 'a', step: 1 }) },
      ])

    const result = await execute({ cohort_id: 'TEST' })
    expect(result.progress[0].trainee_id).toBe('b')
    expect(result.progress[1].trainee_id).toBe('a')
    expect(result.progress[2].trainee_id).toBe('c')
  })
})
