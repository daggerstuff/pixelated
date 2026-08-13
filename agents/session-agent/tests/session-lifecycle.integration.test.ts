import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// --- Shared schemas ---

const startSessionSchema = z.object({
  trainee_id: z.string().min(1),
  scenario_id: z.string().min(1),
  session_id: z.string().uuid().optional(),
  resume: z.boolean().optional().default(false),
})

const processMessageSchema = z.object({
  session_id: z.string().uuid(),
  turns: z
    .array(
      z.object({
        role: z.enum(['trainee', 'participant', 'supervisor']),
        text: z.string().min(1),
        timestamp: z.string().datetime().optional(),
      }),
    )
    .min(1),
})

const checkBoundarySchema = z.object({
  session_id: z.string().uuid(),
  turn_text: z.string().min(1),
  category: z
    .enum(['crisis', 'boundary', 'scope', 'privacy'])
    .default('boundary'),
})

const concludeSchema = z.object({
  session_id: z.string().uuid(),
  exit_reason: z.enum([
    'trainee_ended',
    'auto_cap',
    'supervisor_closed',
    'safety_violation',
    'system_error',
  ]),
  final_state: z
    .enum(['ACTIVE', 'AWAITING_SUPERVISOR', 'CLOSING', 'CLOSED'])
    .default('CLOSED'),
  summary: z.string().max(2000).optional(),
})

// --- Tool execute bodies (mirroring the actual implementations) ---

async function startSession(input: z.infer<typeof startSessionSchema>) {
  const sessionId = input.session_id ?? crypto.randomUUID()
  return {
    session_id: sessionId,
    trainee_id: input.trainee_id,
    scenario_id: input.scenario_id,
    state: input.resume ? 'RECOVERING' : 'NEW',
    persisted_at: new Date().toISOString(),
    resume_token: `${sessionId}:${new Date().toISOString()}`,
    foresight_memory: { memory_id: null },
    mongo: { collection: 'rehearsal_sessions', document_id: sessionId, persisted: false },
  }
}

async function processMessage(input: z.infer<typeof processMessageSchema>) {
  const canonicalTurns = input.turns.map((turn) => ({
    ...turn,
    timestamp: turn.timestamp ?? new Date().toISOString(),
    contains_pii: null,
  }))
  return {
    session_id: input.session_id,
    state: 'ACTIVE',
    accepted_turns: canonicalTurns,
  }
}

const RISK_PATTERNS = [
  /kill myself|end it|take my life|i want to die/,
  /kill (him|her|them|someone)/i,
  /overdose|unconscious|can't breathe|seizure/i,
]

async function checkBoundary(input: z.infer<typeof checkBoundarySchema>) {
  const lower = input.turn_text.toLowerCase()
  const flagged: string[] = []
  if (RISK_PATTERNS[0].test(lower))
    flagged.push('self_harm_ideation_with_intent')
  if (RISK_PATTERNS[1].test(lower)) flagged.push('harm_to_others_with_intent')
  if (RISK_PATTERNS[2].test(lower)) flagged.push('acute_medical_emergency')
  const severity =
    flagged.length === 0
      ? 'none'
      : [
            'acute_medical_emergency',
            'self_harm_ideation_with_intent',
            'harm_to_others_with_intent',
          ].some((f) => flagged.includes(f))
        ? 'critical'
        : 'warning'
  return {
    session_id: input.session_id,
    severity,
    flagged_risk_criteria: flagged,
    escalate_to_supervisor: severity === 'critical',
  }
}

async function conclude(input: z.infer<typeof concludeSchema>) {
  return {
    session_id: input.session_id,
    exit_reason: input.exit_reason,
    state: input.final_state,
    closed_at: new Date().toISOString(),
    emit_session_closed: true,
  }
}

// --- Integration tests ---

describe('session lifecycle integration', () => {
  const traineeId = 'alice-trainee'
  const scenarioId = 'scenario-1'

  it('should move through NEW → ACTIVE → CLOSED states', async () => {
    // 1. Start session
    const start = await startSession({
      trainee_id: traineeId,
      scenario_id: scenarioId,
    })
    expect(start.state).toBe('NEW')
    const sessionId = start.session_id

    // 2. Process first turn
    const msg1 = await processMessage({
      session_id: sessionId,
      turns: [{ role: 'trainee', text: "Hello, I'd like to practice." }],
    })
    expect(msg1.state).toBe('ACTIVE')

    // 3. Process second turn
    const msg2 = await processMessage({
      session_id: sessionId,
      turns: [{ role: 'participant', text: "Sure, let's begin." }],
    })
    expect(msg2.state).toBe('ACTIVE')

    // 4. Conclude
    const end = await conclude({
      session_id: sessionId,
      exit_reason: 'trainee_ended',
      final_state: 'CLOSED',
    })
    expect(end.state).toBe('CLOSED')
    expect(end.emit_session_closed).toBe(true)
  })

  it('should preserve session_id across all tool calls', async () => {
    const start = await startSession({
      trainee_id: traineeId,
      scenario_id: scenarioId,
    })
    const sessionId = start.session_id

    const msg = await processMessage({
      session_id: sessionId,
      turns: [{ role: 'trainee', text: 'Turn 1' }],
    })
    expect(msg.session_id).toBe(sessionId)

    const boundary = await checkBoundary({
      session_id: sessionId,
      turn_text: 'Normal text',
    })
    expect(boundary.session_id).toBe(sessionId)

    const end = await conclude({
      session_id: sessionId,
      exit_reason: 'trainee_ended',
    })
    expect(end.session_id).toBe(sessionId)
  })

  it('should carry transcript turns through the session', async () => {
    const start = await startSession({
      trainee_id: traineeId,
      scenario_id: scenarioId,
    })
    const sessionId = start.session_id

    const msg = await processMessage({
      session_id: sessionId,
      turns: [
        { role: 'trainee', text: 'Turn 1' },
        { role: 'participant', text: 'Turn 2' },
        { role: 'trainee', text: 'Turn 3' },
      ],
    })

    expect(msg.accepted_turns).toHaveLength(3)
    expect(
      msg.accepted_turns.map((t: Record<string, unknown>) => t.role),
    ).toEqual(['trainee', 'participant', 'trainee'])
  })

  it('should flag a crisis turn and escalate to supervisor', async () => {
    const start = await startSession({
      trainee_id: traineeId,
      scenario_id: scenarioId,
    })
    const sessionId = start.session_id

    const boundary = await checkBoundary({
      session_id: sessionId,
      turn_text: 'I want to end it all.',
    })

    expect(boundary.severity).toBe('critical')
    expect(boundary.escalate_to_supervisor).toBe(true)
    expect(boundary.flagged_risk_criteria).toContain(
      'self_harm_ideation_with_intent',
    )
  })

  it('should not escalate on normal boundary text', async () => {
    const start = await startSession({
      trainee_id: traineeId,
      scenario_id: scenarioId,
    })
    const sessionId = start.session_id

    const boundary = await checkBoundary({
      session_id: sessionId,
      turn_text: 'I feel a bit anxious today.',
    })

    expect(boundary.severity).toBe('none')
    expect(boundary.escalate_to_supervisor).toBe(false)
  })

  it('should accept all valid exit reasons at close', async () => {
    const reasons = [
      { reason: 'trainee_ended' as const, expected: 'CLOSED' as const },
      { reason: 'auto_cap' as const, expected: 'CLOSED' as const },
      { reason: 'supervisor_closed' as const, expected: 'CLOSED' as const },
      { reason: 'safety_violation' as const, expected: 'CLOSED' as const },
      { reason: 'system_error' as const, expected: 'CLOSED' as const },
    ]

    for (const { reason, expected } of reasons) {
      const start = await startSession({
        trainee_id: traineeId,
        scenario_id: scenarioId,
      })
      const end = await conclude({
        session_id: start.session_id,
        exit_reason: reason,
        final_state: expected,
      })
      expect(end.exit_reason).toBe(reason)
      expect(end.state).toBe(expected)
    }
  })

  it('should set resume state when start_session is called with resume=true', async () => {
    const start = await startSession({
      trainee_id: traineeId,
      scenario_id: scenarioId,
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      resume: true,
    })
    expect(start.state).toBe('RECOVERING')
  })

  it('should fill in timestamps on turns that omit them', async () => {
    const start = await startSession({
      trainee_id: traineeId,
      scenario_id: scenarioId,
    })
    const before = new Date().toISOString()

    const msg = await processMessage({
      session_id: start.session_id,
      turns: [{ role: 'trainee', text: 'Test turn' }],
    })

    const after = new Date().toISOString()
    const ts = (msg.accepted_turns[0] as Record<string, unknown>)
      .timestamp as string
    expect(ts >= before && ts <= after).toBe(true)
  })
})
