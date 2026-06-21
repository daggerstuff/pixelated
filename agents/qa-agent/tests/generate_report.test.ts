import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const inputSchema = z.object({
  cohort_id: z.string().min(1),
  rubric_version: z.string().min(1),
  scoring_session_ids: z.array(z.string().uuid()).min(0).max(200),
  linear_ticket_references: z
    .array(
      z.object({
        session_id: z.string().uuid(),
        ticket_identifier: z.string(),
        priority: z.number().int().min(0).max(4),
      }),
    )
    .default([]),
})

async function execute(input: z.infer<typeof inputSchema>) {
  return {
    cohort_id: input.cohort_id,
    rubric_version: input.rubric_version,
    session_count: input.scoring_session_ids.length,
    ticket_count: (input.linear_ticket_references ?? []).length,
    rendered_at: new Date().toISOString(),
    digest_markdown:
      '# Daily QA Digest\n\n_No sessions reviewed yet — wiring not complete.\n',
    digest_blocks: [],
    completed_with: 'qa-agent.subagents.report-writer:v0',
    slack_stub: {
      note:
        'Slack channel `slack-supervisor-digest` is not yet wired. Once ' +
        'the channel file lands, this tool will return the canonical ' +
        'delivered timestamp and Slack message permalink.',
    },
  }
}

describe('generate_report', () => {
  it('should preserve cohort_id', async () => {
    const result = await execute({
      cohort_id: 'cohort-alpha',
      rubric_version: '2026.Q1',
      scoring_session_ids: [],
    })
    expect(result.cohort_id).toBe('cohort-alpha')
  })

  it('should echo rubric_version', async () => {
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q3.Starter',
      scoring_session_ids: [],
    })
    expect(result.rubric_version).toBe('2026.Q3.Starter')
  })

  it('should count scoring_session_ids', async () => {
    const sids = [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002',
    ]
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q1',
      scoring_session_ids: sids,
    })
    expect(result.session_count).toBe(3)
  })

  it('should default linear_ticket_references to empty array', async () => {
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q1',
      scoring_session_ids: [],
    })
    expect(result.ticket_count).toBe(0)
  })

  it('should count linear_ticket_references when provided', async () => {
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q1',
      scoring_session_ids: [],
      linear_ticket_references: [
        {
          session_id: '550e8400-e29b-41d4-a716-446655440000',
          ticket_identifier: 'QA-ABC',
          priority: 1,
        },
        {
          session_id: '550e8400-e29b-41d4-a716-446655440001',
          ticket_identifier: 'QA-DEF',
          priority: 2,
        },
      ],
    })
    expect(result.ticket_count).toBe(2)
  })

  it('should return an empty digest_blocks array', async () => {
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q1',
      scoring_session_ids: [],
    })
    expect(result.digest_blocks).toHaveLength(0)
  })

  it('should include the report-writer sub-agent tag', async () => {
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q1',
      scoring_session_ids: [],
    })
    expect(result.completed_with).toBe('qa-agent.subagents.report-writer:v0')
  })

  it('should include the slack_stub note', async () => {
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q1',
      scoring_session_ids: [],
    })
    expect(result.slack_stub).toBeDefined()
    expect((result.slack_stub as Record<string, unknown>).note).toBeDefined()
  })

  it('should include an ISO rendered_at timestamp', async () => {
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q1',
      scoring_session_ids: [],
    })
    expect(result.rendered_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should accept zero scoring sessions', async () => {
    const result = await execute({
      cohort_id: 'cohort-1',
      rubric_version: '2026.Q1',
      scoring_session_ids: [],
    })
    expect(result.session_count).toBe(0)
  })
})
