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
const SCHEMA = z.object({
  trainee_id: z.string().uuid(),
  include_sessions: z.boolean().optional().default(true),
  include_scores: z.boolean().optional().default(true),
})

async function execute(input: z.infer<typeof SCHEMA>) {
  const parsedInput = SCHEMA.parse(input)
  const allMemories = await searchMemoriesMock({
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
          if (parsedInput.include_sessions)
            events.push({ type: 'session', timestamp: ts, detail: parsed })
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

  events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
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
}
// ---- CUT ----

describe('query_trainee_timeline', () => {
  const TID = '550e8400-e29b-41d4-a716-446655440000'

  beforeEach(() => {
    searchMemoriesMock.mockReset()
  })

  it('should build chronological timeline of events', async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({
          type: 'trainee_profile',
          enrolled_at: '2026-01-15T09:00:00Z',
          name: 'Dr. Chen',
        }),
      },
      {
        content: JSON.stringify({
          type: 'cohort_assignment',
          assigned_at: '2026-01-20T10:00:00Z',
          cohort_id: 'CBT-2026-01',
        }),
      },
      {
        content: JSON.stringify({
          type: 'curriculum_step',
          recorded_at: '2026-02-01T11:00:00Z',
          step_id: 'M1',
        }),
      },
    ])

    const result = await execute({ trainee_id: TID })
    expect(result.events).toHaveLength(3)
    expect(result.events[0].type).toBe('enrollment')
    expect(result.events[1].type).toBe('cohort_assignment')
    expect(result.events[2].type).toBe('curriculum')
    expect(result.summary.first_event).toBe('2026-01-15T09:00:00Z')
  })

  it('should return empty when trainee not found', async () => {
    searchMemoriesMock.mockResolvedValue([])
    const result = await execute({ trainee_id: TID })
    expect(result.events).toHaveLength(0)
    expect(result.summary.note).toContain('No records found')
  })

  it('should include QA scores by default', async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({
          type: 'trainee_profile',
          enrolled_at: '2026-01-15T09:00:00Z',
        }),
      },
      {
        content: JSON.stringify({
          state: 'REVIEWED',
          scored_at: '2026-02-10T12:00:00Z',
          total_score: 85,
        }),
      },
    ])

    const result = await execute({ trainee_id: TID })
    expect(result.events.some((e) => e.type === 'qa_score')).toBe(true)
  })

  it('should exclude QA scores when include_scores=false', async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({
          type: 'trainee_profile',
          enrolled_at: '2026-01-15T09:00:00Z',
        }),
      },
      {
        content: JSON.stringify({
          state: 'REVIEWED',
          scored_at: '2026-02-10T12:00:00Z',
          total_score: 85,
        }),
      },
    ])

    const result = await execute({ trainee_id: TID, include_scores: false })
    expect(result.events.some((e) => e.type === 'qa_score')).toBe(false)
    expect(result.events).toHaveLength(1)
  })
})
