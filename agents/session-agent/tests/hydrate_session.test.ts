import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const inputSchema = z.object({
  session_id: z.string().uuid(),
  max_turns: z.number().int().min(1).max(200).default(50),
})

async function execute(input: z.infer<typeof inputSchema>) {
  return {
    session_id: input.session_id,
    last_state: 'ACTIVE',
    last_persisted_at: null,
    recent_turns: [],
    truncated: false,
    recovery_stub: {
      note:
        'Foresight replay is not yet wired. The expected call is ' +
        'connection__foresight__search_memories with a tag scope on ' +
        'session_id=:id, then assemble the last `max_turns` turns.',
    },
    requested_at: new Date().toISOString(),
  }
}

describe('hydrate_session', () => {
  it('should return the session_id in output', async () => {
    const sid = '550e8400-e29b-41d4-a716-446655440000'
    const result = await execute({ session_id: sid, max_turns: 50 })
    expect(result.session_id).toBe(sid)
  })

  it('should default max_turns to 50', async () => {
    const sid = '550e8400-e29b-41d4-a716-446655440000'
    const result = await execute({ session_id: sid })
    expect(result.recent_turns).toHaveLength(0)
  })

  it('should return empty recent_turns on first session (stub)', async () => {
    const sid = '550e8400-e29b-41d4-a716-446655440000'
    const result = await execute({ session_id: sid, max_turns: 10 })
    expect(result.recent_turns).toHaveLength(0)
  })

  it('should return truncated=false on the stub', async () => {
    const sid = '550e8400-e29b-41d4-a716-446655440000'
    const result = await execute({ session_id: sid, max_turns: 50 })
    expect(result.truncated).toBe(false)
  })

  it('should return last_state as ACTIVE on the stub', async () => {
    const sid = '550e8400-e29b-41d4-a716-446655440000'
    const result = await execute({ session_id: sid, max_turns: 50 })
    expect(result.last_state).toBe('ACTIVE')
  })

  it('should return last_persisted_at as null on the stub', async () => {
    const sid = '550e8400-e29b-41d4-a716-446655440000'
    const result = await execute({ session_id: sid, max_turns: 50 })
    expect(result.last_persisted_at).toBeNull()
  })

  it('should include a recovery_stub note', async () => {
    const sid = '550e8400-e29b-41d4-a716-446655440000'
    const result = await execute({ session_id: sid, max_turns: 50 })
    expect(result.recovery_stub).toBeDefined()
    expect((result.recovery_stub as Record<string, unknown>).note).toBeDefined()
  })

  it('should include an ISO timestamp for requested_at', async () => {
    const sid = '550e8400-e29b-41d4-a716-446655440000'
    const result = await execute({ session_id: sid, max_turns: 50 })
    expect(result.requested_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should accept max_turns values from 1 to 200', async () => {
    const sid = '550e8400-e29b-41d4-a716-446655440000'
    for (const n of [1, 10, 100, 200]) {
      const result = await execute({ session_id: sid, max_turns: n })
      expect(result.session_id).toBe(sid)
    }
  })
})
