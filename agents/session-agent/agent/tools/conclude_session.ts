import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { updateSessionState } from '../mongo-client.js'
import { storeMemory } from '../foresight-client.js'

// Finalize a session: stop accepting new turns, persist the closing state,
// emit a session.closed event. This is the durable boundary marker for
// downstream QA scoring.

const SCHEMA = z.object({
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

export default defineTool({
  description:
    'Close an active session. Persists the closing record with a handoff:qa ' +
    'tag so the qa-agent picks it up for scoring. Emits a durable ' +
    'session.closed event that downstream QA and billing chains can ' +
    'subscribe to.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const closedAt = new Date().toISOString()

    const closeRecord = {
      type: 'session_closed',
      session_id: input.session_id,
      exit_reason: input.exit_reason,
      state: input.final_state,
      summary: input.summary ?? null,
      closed_at: closedAt,
    }

    const stored = await storeMemory({
      content: JSON.stringify(closeRecord),
      category: 'session',
      scope: 'session',
      retention: 'long_term',
      importance: 0.7,
      tags: [`session:${input.session_id}`, 'session_closed', 'handoff:qa'],
    })

    const mongoUpdated = await updateSessionState(
      input.session_id,
      input.final_state,
      input.exit_reason,
      input.summary,
    )

    return {
      session_id: input.session_id,
      exit_reason: input.exit_reason,
      state: input.final_state,
      closed_at: closedAt,
      emit_session_closed: true,
      mongo_updated: mongoUpdated,
      handoff: {
        target: 'qa-agent',
        tag: 'handoff:qa',
        persisted: stored !== null,
      },
    }
  },
})
