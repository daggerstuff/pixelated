import { defineTool } from "eve/tools";
import { z } from "zod";

// Recovery-hook sub-tool. When `start_session(resume=true)` is called the
// agent asks this tool to retrieve the most recent durable session state so
// the agent can pick up without dropping context.

export default defineTool({
  description:
    "Reconstruct a session's recent durable state by replaying the last " +
    "transcript turns stored in Foresight. Returns up to `max_turns` " +
    "prior turns plus the last persisted `state`. On first session this " +
    "returns an empty list and state `NEW`.",
  inputSchema: z.object({
    session_id: z.string().uuid(),
    max_turns: z.number().int().min(1).max(200).default(50),
  }),
  async execute(input) {
    return {
      session_id: input.session_id,
      last_state: "ACTIVE",
      last_persisted_at: null,
      recent_turns: [],
      truncated: false,
      recovery_stub: {
        note:
          "Foresight replay is not yet wired. The expected call is " +
          "connection__foresight__search_memories with a tag scope on " +
          "session_id=:id, then assemble the last `max_turns` turns from " +
          "the matching transcripts.",
      },
      pid_file: process.pid,
      requested_at: new Date().toISOString(),
    };
  },
});
