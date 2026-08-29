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

const storeMemoryMock = vi.fn()
const searchMemoriesMock = vi.fn()
vi.mock('../agent/foresight-client.js', () => ({
  storeMemory: (...args: unknown[]) => storeMemoryMock(...args),
  searchMemories: (...args: unknown[]) => searchMemoriesMock(...args),
}))

// ---- CUT ----
const THRESHOLD_TYPES = [
  'flag_severity',
  'scoring_pass_threshold',
  'escalation_delay_minutes',
  'max_sessions_per_day',
  'curriculum_completion_ratio',
] as const
const SCHEMA = z.object({
  threshold_type: z.enum(THRESHOLD_TYPES),
  new_value: z.union([z.number(), z.string()]),
  reason: z.string().min(1).max(500),
  scope: z.string().optional().default('global'),
})

async function execute(input: z.infer<typeof SCHEMA>) {
  const parsedInput = SCHEMA.parse(input)
  const changedAt = new Date().toISOString()
  let previousValue: number | string | null = null

  const previousAdjustments = await searchMemoriesMock({
    query: `threshold:${parsedInput.threshold_type}`,
    limit: 1,
    tag_filter: ['threshold_change'],
  })

  if (previousAdjustments && previousAdjustments.length > 0) {
    try {
      previousValue =
        (
          JSON.parse(previousAdjustments[0].content) as {
            new_value?: number | string
          }
        ).new_value ?? null
    } catch {
      /* ignore */
    }
  }

  const record = {
    type: 'threshold_change',
    threshold_type: parsedInput.threshold_type,
    new_value: parsedInput.new_value,
    previous_value: previousValue,
    reason: parsedInput.reason,
    scope: parsedInput.scope,
    changed_by: 'supervisor-agent',
    changed_at: changedAt,
  }

  const stored = await storeMemoryMock({
    content: JSON.stringify(record),
    category: 'threshold',
    scope: parsedInput.scope,
    retention: 'long_term',
    importance: 0.8,
    tags: [
      'threshold_change',
      `threshold:${parsedInput.threshold_type}`,
      `scope:${parsedInput.scope}`,
      'supervisor_action',
    ],
  })

  return {
    threshold_type: parsedInput.threshold_type,
    previous_value: previousValue,
    new_value: parsedInput.new_value,
    scope: parsedInput.scope,
    reason: parsedInput.reason,
    changed_at: changedAt,
  }
}
// ---- CUT ----

describe('adjust_threshold', () => {
  beforeEach(() => {
    storeMemoryMock.mockReset()
    searchMemoriesMock.mockReset()
    storeMemoryMock.mockResolvedValue({ memory_id: 'mem_threshold_001' })
  })

  it('should adjust a numeric threshold', async () => {
    searchMemoriesMock.mockResolvedValue([])
    const result = await execute({
      threshold_type: 'scoring_pass_threshold',
      new_value: 75,
      reason: 'Raising bar for advanced cohort',
    })
    expect(result.threshold_type).toBe('scoring_pass_threshold')
    expect(result.new_value).toBe(75)
    expect(result.previous_value).toBeNull()
    expect(result.scope).toBe('global')
  })

  it('should adjust a string threshold', async () => {
    searchMemoriesMock.mockResolvedValue([])
    const result = await execute({
      threshold_type: 'flag_severity',
      new_value: 'critical',
      reason: 'Only critical flags escalate',
    })
    expect(result.new_value).toBe('critical')
  })

  it('should detect previous value from prior change', async () => {
    searchMemoriesMock.mockResolvedValue([
      { content: JSON.stringify({ new_value: 70 }) },
    ])
    const result = await execute({
      threshold_type: 'scoring_pass_threshold',
      new_value: 80,
      reason: 'Increase rigor',
    })
    expect(result.previous_value).toBe(70)
  })

  it('should scope to cohort when provided', async () => {
    searchMemoriesMock.mockResolvedValue([])
    const result = await execute({
      threshold_type: 'max_sessions_per_day',
      new_value: 3,
      reason: 'Reduce burnout',
      scope: 'cohort:CBT-2026-01',
    })
    expect(result.scope).toBe('cohort:CBT-2026-01')
  })

  it('should reject unknown threshold type', () => {
    expect(() => {
      SCHEMA.parse({
        threshold_type: 'unknown_type',
        new_value: 5,
        reason: 'test',
      })
    }).toThrow()
  })
})
