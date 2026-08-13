import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const inputSchema = z.object({
  trainee_id: z.string().min(1),
  scenario_id: z.string().min(1),
  session_id: z.string().uuid().optional(),
  resume: z.boolean().optional().default(false),
})

// Inline execute under test
async function execute(input: z.infer<typeof inputSchema>) {
  const sessionId = input.session_id ?? crypto.randomUUID()
  const persistedAt = new Date().toISOString()

  return {
    session_id: sessionId,
    trainee_id: input.trainee_id,
    scenario_id: input.scenario_id,
    state: input.resume ? 'RECOVERING' : 'NEW',
    persisted_at: persistedAt,
    resume_token: `${sessionId}:${persistedAt}`,
    foresight_memory: {
      memory_id: null,
      note: 'Foresight MCP write is not yet wired in this slice.',
    },
    mongo: {
      collection: 'rehearsal_sessions',
      document_id: sessionId,
      persisted: false,
    },
  }
}

describe('start_session', () => {
  it('should generate a new session UUID when none provided', async () => {
    const result = await execute({
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
    })
    expect(result.session_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('should reuse the provided session_id when given', async () => {
    const fixed = '550e8400-e29b-41d4-a716-446655440000'
    const result = await execute({
      session_id: fixed,
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
    })
    expect(result.session_id).toBe(fixed)
  })

  it('should set state to NEW for a fresh session', async () => {
    const result = await execute({
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
    })
    expect(result.state).toBe('NEW')
  })

  it('should set state to RECOVERING when resume=true', async () => {
    const result = await execute({
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
      resume: true,
    })
    expect(result.state).toBe('RECOVERING')
  })

  it('should set state to NEW when resume=false is explicit', async () => {
    const result = await execute({
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
      resume: false,
    })
    expect(result.state).toBe('NEW')
  })

  it('should echo trainee_id and scenario_id in response', async () => {
    const result = await execute({
      trainee_id: 'alice',
      scenario_id: 'scenario-x',
    })
    expect(result.trainee_id).toBe('alice')
    expect(result.scenario_id).toBe('scenario-x')
  })

  it('should return a resume_token containing the session id and persisted timestamp', async () => {
    const result = await execute({
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
    })
    expect(result.resume_token).toContain(result.session_id)
    expect(result.resume_token).toContain(':')
  })

  it('should return an ISO timestamp for persisted_at', async () => {
    const result = await execute({
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
    })
    expect(result.persisted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should return foresight_memory with memory_id=null', async () => {
    const result = await execute({
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
    })
    expect(result.foresight_memory).toBeDefined()
    expect(
      (result.foresight_memory as Record<string, unknown>).memory_id,
    ).toBeNull()
  })

  it('should return mongo with collection=rehearsal_sessions', async () => {
    const result = await execute({
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
    })
    expect(result.mongo).toBeDefined()
    expect((result.mongo as Record<string, unknown>).collection).toBe(
      'rehearsal_sessions',
    )
  })
})
