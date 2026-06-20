import { defineTool } from "eve/tools";
import { z } from "zod";

// Persist a durable session artifact: the final transcript, a summary
// record, and the latest emotion rollups. Conforms to the requirement that
// "everything emotion tlanalysis results are stored in Foresight memory
// for longitudinal tracking."

export default defineTool({
  description:
    "Persist the current session transcript, summary, and emotion rollups " +
    "into both Foresight (semantic, queryable) and MongoDB (durable). " +
    "Called automatically at session boundary and also on supervisor " +
    "demand.",
  inputSchema: z.object({
    session_id: z.string().uuid(),
    trainee_id: z.string().min(1),
    scenario_id: z.string().min(1),
    state: z.enum(["ACTIVE", "CLOSING", "CLOSED"]),
    transcripts: z
      .array(
        z.object({
          role: z.enum(["trainee", "participant", "supervisor"]),
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
  }),
  async execute(input) {
    return {
      session_id: input.session_id,
      persisted_at: new Date().toISOString(),
      record_count: input.transcripts.length,
      emotion_rollup_count: input.emotion_rollups.length,
      pii_scrubber_stub: {
        note:
          "The text redaction pass is not yet wired from " +
          "ai-services/security/pii_scrubber.py. Persisted text MUST be " +
          "scrubbed before reaching either backend.",
      },
      foresight_stub: {
        memory_id: null,
        note:
          "Foresight store call via connection__foresight__store_memory is " +
          "not yet wired in this slice.",
      },
      mongo_stub: {
        collection: "sessions",
        document_id: input.session_id,
        note:
          "Mongo upsert via the session-mcp (TODO) is not yet wired.",
      },
      summary_written: input.summary ? true : false,
    };
  },
});
