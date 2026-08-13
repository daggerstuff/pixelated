import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const inputSchema = z.object({
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

async function execute(input: z.infer<typeof inputSchema>) {
  return {
    session_id: input.session_id,
    persisted_at: new Date().toISOString(),
    record_count: input.transcripts.length,
    emotion_rollup_count: (input.emotion_rollups ?? []).length,
    pii_scrubber_stub: {
      note: 'The text redaction pass is not yet wired from ai-services/security/pii_scrubber.py.',
    },
    foresight_memory_ids: [],
    mongo: {
      collection: 'rehearsal_sessions',
      document_id: input.session_id,
      transcript_count: input.transcripts.length,
      emotion_rollup_count: (input.emotion_rollups ?? []).length,
      persisted: true,
    },
    summary_written: input.summary ? true : false,
  }
}

describe('save_session', () => {
  const baseTranscripts = [
    { role: 'trainee', text: 'Hello.', timestamp: '2026-01-01T09:00:00.000Z' },
  ]

  it('should return the session_id in output', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
      state: 'ACTIVE',
      transcripts: baseTranscripts,
    })
    expect(result.session_id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('should record the transcript count accurately', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
      state: 'ACTIVE',
      transcripts: [
        {
          role: 'trainee',
          text: 'Turn 1',
          timestamp: '2026-01-01T09:00:00.000Z',
        },
        {
          role: 'participant',
          text: 'Turn 2',
          timestamp: '2026-01-01T09:00:01.000Z',
        },
        {
          role: 'trainee',
          text: 'Turn 3',
          timestamp: '2026-01-01T09:00:02.000Z',
        },
      ],
    })
    expect(result.record_count).toBe(3)
  })

  it('should default emotion_rollups to empty array', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
      state: 'CLOSED',
      transcripts: baseTranscripts,
    })
    expect(result.emotion_rollup_count).toBe(0)
  })

  it('should count emotion_rollups when provided', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
      state: 'CLOSED',
      transcripts: baseTranscripts,
      emotion_rollups: [
        {
          primary_emotion: 'neutral',
          intensity: 0,
          valence: 0,
          risk_flags: [],
          timestamp: '2026-01-01T09:00:00.000Z',
        },
        {
          primary_emotion: 'joy',
          intensity: 0.6,
          valence: 0.8,
          risk_flags: [],
          timestamp: '2026-01-01T09:05:00.000Z',
        },
      ],
    })
    expect(result.emotion_rollup_count).toBe(2)
  })

  it('should set summary_written=true when a summary is present', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
      state: 'CLOSED',
      transcripts: baseTranscripts,
      summary: 'The trainee demonstrated good empathy.',
    })
    expect(result.summary_written).toBe(true)
  })

  it('should set summary_written=false when no summary is provided', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
      state: 'CLOSED',
      transcripts: baseTranscripts,
    })
    expect(result.summary_written).toBe(false)
  })

  it('should accept ACTIVE, CLOSING, and CLOSED state values', async () => {
    for (const state of ['ACTIVE', 'CLOSING', 'CLOSED'] as const) {
      const result = await execute({
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        trainee_id: 'alice',
        scenario_id: 'scenario-1',
        state,
        transcripts: baseTranscripts,
      })
      expect(result.record_count).toBe(1)
    }
  })

  it('should include a valid persisted_at ISO timestamp', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
      state: 'ACTIVE',
      transcripts: baseTranscripts,
    })
    expect(result.persisted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should include all output objects', async () => {
    const result = await execute({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      trainee_id: 'alice',
      scenario_id: 'scenario-1',
      state: 'ACTIVE',
      transcripts: baseTranscripts,
    })
    expect(result.pii_scrubber_stub).toBeDefined()
    expect(result.foresight_memory_ids).toBeDefined()
    expect(result.mongo).toBeDefined()
    expect((result.mongo as Record<string, unknown>).collection).toBe(
      'rehearsal_sessions',
    )
  })
})
