import { defineTool } from "eve/tools";
import { z } from "zod";

// Finalize a session: stop accepting new turns, persist the closing state,
// emit a session.closed event. This is the durable boundary marker for
// downstream QA scoring.

const SCHEMA = z.object({
  session_id: z.string().uuid(),
  exit_reason: z.enum([
    "trainee_ended",
    "auto_cap",
    "supervisor_closed",
    "safety_violation",
    "system_error",
  ]),
  final_state: z.enum(["ACTIVE", "AWAITING_SUPERVISOR", "CLOSING", "CLOSED"]).default("CLOSED"),
  summary: z.string().max(2000).optional(),
});

export default defineTool({
  description:
    "Close an active session. Persists the closing record and emits a " +
    "durable session.closed event that downstream QA and billing chains " +
    "can subscribe to.",
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    return {
      session_id: input.session_id,
      exit_reason: input.exit_reason,
      state: input.final_state,
      closed_at: new Date().toISOString(),
      emit_session_closed: true,
    };
  },
});
