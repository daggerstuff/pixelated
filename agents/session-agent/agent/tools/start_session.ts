import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { storeMemory, searchMemories } from '../foresight-client.js'
import { saveSessionHeader } from '../mongo-client.js'

const SCHEMA = z.object({
  trainee_id: z
    .string()
    .min(1)
    .describe('Stable synthetic ID for the trainee.'),
  scenario_id: z.string().min(1).describe('Practice scenario being rehearsed.'),
  session_id: z
    .string()
    .uuid()
    .optional()
    .describe('Existing session UUID when `resume=true`.'),
  resume: z.boolean().optional().default(false),
})

export default defineTool({
  description:
    'Initialize a new rehearsal session, or resume an existing one if `session_id` ' +
    'and `resume=true` are supplied. Persists the session header in Foresight ' +
    '(semantic memory) and writes the durable transcript record stub to MongoDB. ' +
    'Returns the session_id, the resume token, and any recovered context.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const sessionId = input.session_id ?? crypto.randomUUID()
    const persistedAt = new Date().toISOString()

    const memoryResult = await storeMemory({
      content: JSON.stringify({
        type: 'session_header',
        session_id: sessionId,
        trainee_id: input.trainee_id,
        scenario_id: input.scenario_id,
        state: input.resume ? 'RECOVERING' : 'NEW',
        started_at: persistedAt,
      }),
      category: 'session',
      scope: 'session',
      retention: 'long_term',
      importance: 0.7,
      tags: [
        'session',
        `trainee:${input.trainee_id}`,
        `scenario:${input.scenario_id}`,
      ],
    })

    // If resuming, try to recover recent context from Foresight
    let recoveredContext: {
      recent_turns: unknown[]
      last_state: string
    } | null = null
    if (input.resume && input.session_id) {
      const memories = await searchMemories({
        query: `session:${input.session_id}`,
        limit: 10,
        tag_filter: [`session:${input.session_id}`],
      })
      if (memories && memories.length > 0) {
        recoveredContext = {
          recent_turns: memories,
          last_state: 'ACTIVE',
        }
      }
    }

    const mongoId = await saveSessionHeader(
      sessionId,
      input.trainee_id,
      input.scenario_id,
      input.resume ? 'RECOVERING' : 'NEW',
    )

    return {
      session_id: sessionId,
      trainee_id: input.trainee_id,
      scenario_id: input.scenario_id,
      state: recoveredContext ? 'RECOVERING' : 'NEW',
      persisted_at: persistedAt,
      resume_token: `${sessionId}:${persistedAt}`,
      foresight_memory: memoryResult ?? {
        memory_id: null,
        note: 'Foresight MCP write failed or server unreachable on port 8764.',
      },
      recovered_context: recoveredContext,
      mongo: {
        collection: 'rehearsal_sessions',
        document_id: mongoId ?? sessionId,
        persisted: mongoId !== null,
      },
    }
  },
})
