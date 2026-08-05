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
vi.mock('../agent/foresight-client.js', () => ({
  storeMemory: (...args: unknown[]) => storeMemoryMock(...args),
  searchMemories: vi.fn().mockResolvedValue([]),
}))

// ---- CUT ----
const COHORT_TYPES = ['TIME_BASED', 'SKILL_LEVEL'] as const
const COHORT_SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const

const inputSchema = z.object({
  trainee_id: z.string().uuid(),
  cohort_id: z.string().min(1),
  cohort_type: z.enum(COHORT_TYPES),
  skill_level: z.enum(COHORT_SKILL_LEVELS).optional(),
})

async function execute(input: z.infer<typeof inputSchema>) {
  const assignedAt = new Date().toISOString()

  const assignment = {
    type: 'cohort_assignment',
    trainee_id: input.trainee_id,
    cohort_id: input.cohort_id,
    cohort_type: input.cohort_type,
    skill_level: input.skill_level ?? null,
    status: 'ACTIVE',
    assigned_at: assignedAt,
  }

  const stored = await storeMemoryMock({
    content: JSON.stringify(assignment),
    category: 'cohort_assignment',
    scope: 'cohort',
    retention: 'long_term',
    importance: 0.7,
    tags: [
      `trainee:${input.trainee_id}`,
      `cohort:${input.cohort_id}`,
      `cohort_type:${input.cohort_type}`,
      ...(input.skill_level ? [`skill_level:${input.skill_level}`] : []),
    ],
  })

  return {
    trainee_id: input.trainee_id,
    cohort_id: input.cohort_id,
    cohort_type: input.cohort_type,
    skill_level: input.skill_level ?? null,
    status: 'ACTIVE',
    assigned_at: assignedAt,
    foresight_memory: stored ?? {
      memory_id: null,
      note: 'Foresight MCP write failed.',
    },
  }
}
// ---- CUT ----

describe('assign_cohort', () => {
  const validInput = {
    trainee_id: '550e8400-e29b-41d4-a716-446655440000',
    cohort_id: 'CBT-2026-01',
    cohort_type: 'TIME_BASED' as const,
  }

  beforeEach(() => {
    storeMemoryMock.mockReset()
    storeMemoryMock.mockResolvedValue({ memory_id: 'mem_def456' })
  })

  it('should assign a trainee to a time-based cohort', async () => {
    const result = await execute(validInput)

    expect(result.trainee_id).toBe(validInput.trainee_id)
    expect(result.cohort_id).toBe('CBT-2026-01')
    expect(result.cohort_type).toBe('TIME_BASED')
    expect(result.status).toBe('ACTIVE')
    expect(result.skill_level).toBeNull()
  })

  it('should assign a trainee to a skill-level cohort', async () => {
    const result = await execute({
      ...validInput,
      cohort_type: 'SKILL_LEVEL',
      skill_level: 'ADVANCED',
    })

    expect(result.cohort_type).toBe('SKILL_LEVEL')
    expect(result.skill_level).toBe('ADVANCED')
  })

  it('should include skill_level in storeMemory tags when provided', async () => {
    await execute({
      ...validInput,
      cohort_type: 'SKILL_LEVEL',
      skill_level: 'BEGINNER',
    })

    const call = storeMemoryMock.mock.calls[0][0]
    expect(call.tags).toContain('skill_level:BEGINNER')
    expect(call.tags).toContain('cohort:CBT-2026-01')
  })

  it('should reject an invalid cohort type', () => {
    expect(() => {
      inputSchema.parse({ ...validInput, cohort_type: 'HYBRID' })
    }).toThrow()
  })

  it('should reject a non-uuid trainee_id', () => {
    expect(() => {
      inputSchema.parse({ ...validInput, trainee_id: 'not-a-uuid' })
    }).toThrow()
  })
})
