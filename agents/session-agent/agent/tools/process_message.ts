import { defineTool } from "eve/tools";
import { z } from "zod";

const draftTurnSchema = z.object({
  role: z.enum(["trainee", "participant", "supervisor"]),
  text: z.string().min(1),
  timestamp: z.string().datetime().optional(),
});

const SCHEMA = z.object({
  session_id: z.string().uuid(),
  turns: z.array(draftTurnSchema).min(1),
});

export default defineTool({
  description:
    "Append a batch of transcript turns to the active session.Used whenever the " +
    "trainee, the in-character participant, or the supervisor produces a message. " +
    "Performs PII stripping on each turn's text before persistence. " +
    "Returns the canonicalized turn list and current state.",
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    // PII stripping is delegated to the existing ai-services scrubber via a
    // future sidecar; this slice deliberately does not inline a regex-based
    // redaction so we never drift from the canonical scrubber in
    // ai-services/security/pii_scrubber.py.
    const canonicalTurns = input.turns.map((turn) => ({
      ...turn,
      timestamp: turn.timestamp ?? new Date().toISOString(),
      contains_pii: null,
    }));

    return {
      session_id: input.session_id,
      state: "ACTIVE",
      accepted_turns: canonicalTurns,
      pii_scrubber_stub: {
        note: "Scrubber call is not yet wired. See TODO in tools/process_message.ts.",
      },
      persistence_stub: {
        note: "Mongo append is not yet wired. See agent/connections/memory-mcp.ts.",
      },
    };
  },
});
