import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { saveSessionTranscript } from '../mongo-client.js'
import { storeMemory } from '../foresight-client.js'

// Persist a durable session artifact: the final transcript, a summary
// record, and the latest emotion rollups. Conforms to the requirement that
// "everything emotion tlanalysis results are stored in Foresight memory
// for longitudinal tracking."

const SCHEMA = z.object({
  session_id: z.string().uuid(),
  trainee_id: z.string().min(1),
  scenario_id: z.string().min(1),
  state: z.enum(['ACTIVE', 'CLOSING', 'CLOSED']),
  transcripts: z
    .array(
      z.object({
        role: z.enum(['trainee', 'participant', 'supervisor']),
        text: z.string(),
        timestamp: z.string().datetime(),
      }),
    )
    .min(1),
  emotion_rollups: z
    .array(
      z.object({
        primary_emotion: z.string(),
        intensity: z.number(),
        valence: z.number(),
        risk_flags: z.array(z.string()),
        timestamp: z.string().datetime(),
      }),
    )
    .default([]),
  summary: z.string().max(2000).optional(),
})

export default defineTool({
  description:
    'Persist the current session transcript, summary, and emotion rollups ' +
    'into both Foresight (semantic, queryable) and MongoDB (durable). ' +
    'Called automatically at session boundary and also on supervisor ' +
    'demand.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const memoryIds: string[] = []

    // 1. Persist the full transcript as a single Foresight memory so hydrate_session can replay it
    const transcriptResult = await storeMemory({
      content: JSON.stringify({
        type: 'transcript_turn',
        session_id: input.session_id,
        turns: input.transcripts,
      }),
      category: 'transcript',
      scope: 'session',
      retention: 'short_term',
      importance: 0.6,
      session_id: input.session_id,
      tags: [`session_id:${input.session_id}`, 'transcript', 'bulk'],
    })
    if (transcriptResult?.memory_id) memoryIds.push(transcriptResult.memory_id)

    // 2. Persist the session summary as a Foresight memory (if provided)
    if (input.summary) {
      const result = await storeMemory({
        content: `Session ${input.session_id} summary: ${input.summary}`,
        category: 'session',
        scope: 'session',
        retention: 'long_term',
        importance: 0.7,
        session_id: input.session_id,
        tags: [`session_id:${input.session_id}`, 'summary'],
      })
      if (result?.memory_id) memoryIds.push(result.memory_id)
    }

    // 2. Store each emotion rollup as an individual memory for longitudinal tracking
    for (const rollup of input.emotion_rollups) {
      const result = await storeMemory({
        content: JSON.stringify({
          type: 'emotion_rollup',
          session_id: input.session_id,
          primary_emotion: rollup.primary_emotion,
          intensity: rollup.intensity,
          valence: rollup.valence,
          risk_flags: rollup.risk_flags,
        }),
        category: 'emotion',
        scope: 'session',
        retention: 'short_term',
        importance: 0.5,
        session_id: input.session_id,
        tags: [
          `session_id:${input.session_id}`,
          'emotion',
          `emotion:${rollup.primary_emotion}`,
        ],
      })
      if (result?.memory_id) memoryIds.push(result.memory_id)
    }

    // 3. Persist the full transcript and emotion rollups to MongoDB (durable store)
    const mongoResult = await saveSessionTranscript(
      input.session_id,
      input.transcripts.map((t) => ({
        role: t.role,
        text: t.text,
        timestamp: t.timestamp,
      })),
      input.emotion_rollups.map((r) => ({
        primary_emotion: r.primary_emotion,
        intensity: r.intensity,
        valence: r.valence,
        risk_flags: r.risk_flags,
        timestamp: r.timestamp,
      })),
      input.summary,
    )

    return {
      session_id: input.session_id,
      persisted_at: new Date().toISOString(),
      record_count: input.transcripts.length,
      emotion_rollup_count: input.emotion_rollups.length,
      foresight_memory_ids: memoryIds,
      pii_scrubber_stub: {
        note:
          'The text redaction pass is not yet wired from ' +
          'ai-services/security/pii_scrubber.py. Persisted text MUST be ' +
          'scrubbed before reaching either backend.',
      },
      mongo: {
        collection: 'rehearsal_sessions',
        document_id: input.session_id,
        transcript_count: mongoResult.transcript_count,
        emotion_rollup_count: mongoResult.emotion_rollup_count,
        persisted: mongoResult.transcript_count > 0,
      },
      summary_written: input.summary ? true : false,
    }
  },
})
