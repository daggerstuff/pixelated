import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const inputSchema = z.object({
  cohort_id: z.string().min(1),
  rubric_version: z.string().min(1),
  since: z.string().datetime(),
})

async function execute(input: z.infer<typeof inputSchema>) {
  return {
    cohort_id: input.cohort_id,
    rubric_version: input.rubric_version,
    since: input.since,
    aggregates: {
      mean: {},
      p10: {},
      p90: {},
    },
    top_gap_trainees: [],
    aggregated_at: new Date().toISOString(),
  }
}

describe('summarize_cohort', () => {
  it('should preserve cohort_id', async () => {
    const result = await execute({
      cohort_id: 'cohort-alpha',
      rubric_version: '2026.Q1',
      since: '2026-01-01T00:00:00.000Z',
    })
    expect(result.cohort_id).toBe('cohort-alpha')
  })

  it('should echo rubric_version', async () => {
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q3.Starter',
      since: '2026-01-01T00:00:00.000Z',
    })
    expect(result.rubric_version).toBe('2026.Q3.Starter')
  })

  it('should echo the since timestamp', async () => {
    const since = '2026-01-01T00:00:00.000Z'
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q1',
      since,
    })
    expect(result.since).toBe(since)
  })

  it('should return mean, p10, p90 aggregates as empty objects in this stub', async () => {
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q1',
      since: '2026-01-01T00:00:00.000Z',
    })
    expect(result.aggregates).toHaveProperty('mean')
    expect(result.aggregates).toHaveProperty('p10')
    expect(result.aggregates).toHaveProperty('p90')
  })

  it('should return top_gap_trainees as empty array in this stub', async () => {
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q1',
      since: '2026-01-01T00:00:00.000Z',
    })
    expect(result.top_gap_trainees).toHaveLength(0)
  })

  it('should include an ISO aggregated_at timestamp', async () => {
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q1',
      since: '2026-01-01T00:00:00.000Z',
    })
    expect(result.aggregated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
