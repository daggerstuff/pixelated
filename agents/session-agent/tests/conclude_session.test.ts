import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const inputSchema = z.object({
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

async function execute(input: z.infer<typeof inputSchema>) {
  const final_state = input.final_state ?? 'CLOSED'
  return {
    session_id: input.session_id,
    exit_reason: input.exit_reason,
    state: final_state,
    closed_at: new Date().toISOString(),
    emit_session_closed: true,
  }
}

describe('conclude_session', () => {
  const sid = '550e8400-e29b-41d4-a716-446655440000'

  it('should return the session_id', async () => {
    const result = await execute({
      session_id: sid,
      exit_reason: 'trainee_ended',
    })
    expect(result.session_id).toBe(sid)
  })

  it('should echo the exit_reason', async () => {
    const result = await execute({
      session_id: sid,
      exit_reason: 'safety_violation',
    })
    expect(result.exit_reason).toBe('safety_violation')
  })

  it('should default final_state to CLOSED', async () => {
    const result = await execute({
      session_id: sid,
      exit_reason: 'trainee_ended',
    })
    expect(result.state).toBe('CLOSED')
  })

  it('should accept CLOSING as final_state', async () => {
    const result = await execute({
      session_id: sid,
      exit_reason: 'auto_cap',
      final_state: 'CLOSING',
    })
    expect(result.state).toBe('CLOSING')
  })

  it('should accept AWAITING_SUPERVISOR as final_state', async () => {
    const result = await execute({
      session_id: sid,
      exit_reason: 'supervisor_closed',
      final_state: 'AWAITING_SUPERVISOR',
    })
    expect(result.state).toBe('AWAITING_SUPERVISOR')
  })

  it('should accept all five valid exit_reason values', async () => {
    const reasons = [
      'trainee_ended',
      'auto_cap',
      'supervisor_closed',
      'safety_violation',
      'system_error',
    ] as const
    for (const reason of reasons) {
      const result = await execute({ session_id: sid, exit_reason: reason })
      expect(result.exit_reason).toBe(reason)
    }
  })

  it('should return closed_at as an ISO timestamp', async () => {
    const result = await execute({
      session_id: sid,
      exit_reason: 'trainee_ended',
    })
    expect(result.closed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should always emit session.closed event', async () => {
    const result = await execute({
      session_id: sid,
      exit_reason: 'trainee_ended',
    })
    expect(result.emit_session_closed).toBe(true)
  })

  it('should accept a summary without error', async () => {
    const result = await execute({
      session_id: sid,
      exit_reason: 'trainee_ended',
      summary: 'The trainee demonstrated strong empathy.',
    })
    expect(result.state).toBe('CLOSED')
  })
})
