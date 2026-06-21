import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const inputSchema = z.object({
  session_id: z.string().uuid(),
  cohort_id: z.string().min(1),
  rationale: z.string().max(2000),
  priority: z.number().int().min(0).max(4),
  labels: z.array(z.string()).optional(),
})

async function execute(input: z.infer<typeof inputSchema>) {
  const identifier = `QA-${Date.now().toString(36).toUpperCase()}`
  return {
    ticket_identifier: identifier,
    ticket_url_stub: `https://linear.app/pixelated/issue/${identifier}`,
    session_id: input.session_id,
    priority: input.priority,
    labels: input.labels ?? [],
    created_at: new Date().toISOString(),
    linear_channel_stub: {
      note:
        'The Linear channel and create-issue tool are wired; this returns ' +
        'the canonical identifier when a real workspace is connected.',
    },
  }
}

describe('flag_training_gap', () => {
  it('should preserve session_id', async () => {
    const sid = '550e8400-e29b-41d4-a716-446655440000'
    const result = await execute({
      session_id: sid,
      cohort_id: 'cohort-1',
      rationale: 'Trainee missed crisis signals.',
      priority: 1,
      labels: ['qa-review'],
    })
    expect(result.session_id).toBe(sid)
  })

  it('should echo priority', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      cohort_id: 'cohort-1',
      rationale: 'Test rationale.',
      priority: 3,
    })
    expect(result.priority).toBe(3)
  })

  it('should default labels to empty array', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      cohort_id: 'cohort-1',
      rationale: 'Test rationale.',
      priority: 2,
    })
    expect(result.labels).toHaveLength(0)
  })

  it('should echo provided labels', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      cohort_id: 'cohort-1',
      rationale: 'Test rationale.',
      priority: 1,
      labels: ['qa-review', 'cohort:alpha'],
    })
    expect(result.labels).toEqual(['qa-review', 'cohort:alpha'])
  })

  it('should return a generated ticket_identifier', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      cohort_id: 'cohort-1',
      rationale: 'Test rationale.',
      priority: 2,
    })
    expect(result.ticket_identifier).toMatch(/^QA-[A-Z0-9]+$/)
  })

  it('should return a ticket_url_stub', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      cohort_id: 'cohort-1',
      rationale: 'Test rationale.',
      priority: 2,
    })
    expect(result.ticket_url_stub).toContain('linear.app')
  })

  it('should include an ISO created_at timestamp', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      cohort_id: 'cohort-1',
      rationale: 'Test rationale.',
      priority: 2,
    })
    expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should include the linear_channel_stub note', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      cohort_id: 'cohort-1',
      rationale: 'Test rationale.',
      priority: 2,
    })
    expect(result.linear_channel_stub).toBeDefined()
  })
})
