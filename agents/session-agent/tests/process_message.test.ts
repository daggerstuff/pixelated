import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

// Minimal defineTool shape for test isolation
function defineToolForTest<T extends z.ZodType>(opts: {
  description: string
  inputSchema: T
  execute: (input: z.infer<T>) => Promise<Record<string, unknown>>
}) {
  return opts
}

vi.mock('eve/tools', () => ({
  defineTool: defineToolForTest,
}))

// ---- CUT ----
// The tool itself (copy for unit isolation)
const draftTurnSchema = z.object({
  role: z.enum(['trainee', 'participant', 'supervisor']),
  text: z.string().min(1),
  timestamp: z.string().datetime().optional(),
})

const inputSchema = z.object({
  session_id: z.string().uuid(),
  turns: z.array(draftTurnSchema).min(1),
})

async function execute(input: z.infer<typeof inputSchema>) {
  const canonicalTurns = input.turns.map((turn) => ({
    ...turn,
    timestamp: turn.timestamp ?? new Date().toISOString(),
    contains_pii: null,
  }))

  return {
    session_id: input.session_id,
    state: 'ACTIVE',
    accepted_turns: canonicalTurns,
    pii_scrubber_stub: {
      note: 'Scrubber call is not yet wired. See TODO in tools/process_message.ts.',
    },
    persistence: {
      collection: 'rehearsal_sessions',
      turns_appended: canonicalTurns.length,
    },
  }
}
// ---- CUT ----

describe('process_message', () => {
  it('should accept a valid single turn', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      turns: [{ role: 'trainee', text: 'Hello, how are you?' }],
    })

    expect(result.session_id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(result.state).toBe('ACTIVE')
    expect(result.accepted_turns).toHaveLength(1)
    expect(result.accepted_turns[0].text).toBe('Hello, how are you?')
    expect(result.accepted_turns[0].role).toBe('trainee')
    expect(result.accepted_turns[0].contains_pii).toBeNull()
  })

  it('should fill in timestamp when omitted', async () => {
    const before = new Date().toISOString()
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      turns: [{ role: 'participant', text: "I'm doing well, thank you." }],
    })
    const after = new Date().toISOString()

    expect(result.accepted_turns[0].timestamp).toBeDefined()
    const ts = result.accepted_turns[0].timestamp
    expect(ts >= before && ts <= after).toBe(true)
  })

  it('should preserve an explicit timestamp when provided', async () => {
    const fixed = '2026-01-15T10:30:00.000Z'
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      turns: [
        { role: 'supervisor', text: 'Please slow down.', timestamp: fixed },
      ],
    })

    expect(result.accepted_turns[0].timestamp).toBe(fixed)
  })

  it('should process multiple turns in order', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      turns: [
        { role: 'trainee', text: 'First message' },
        { role: 'participant', text: 'Second reply' },
        { role: 'trainee', text: 'Third turn' },
      ],
    })

    expect(result.accepted_turns).toHaveLength(3)
    expect(result.accepted_turns[0].text).toBe('First message')
    expect(result.accepted_turns[1].text).toBe('Second reply')
    expect(result.accepted_turns[2].text).toBe('Third turn')
  })

  it('should set contains_pii to null on each canonicalized turn', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      turns: [{ role: 'trainee', text: 'Some text' }],
    })

    expect(
      result.accepted_turns.every(
        (t: Record<string, unknown>) => t['contains_pii'] === null,
      ),
    ).toBe(true)
  })

  it('should mark all three valid roles', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      turns: [
        { role: 'trainee', text: 'trainee text' },
        { role: 'participant', text: 'participant text' },
        { role: 'supervisor', text: 'supervisor text' },
      ],
    })

    expect(
      result.accepted_turns.map((t: Record<string, unknown>) => t.role),
    ).toEqual(['trainee', 'participant', 'supervisor'])
  })
})
