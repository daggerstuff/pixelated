import { defineTool } from "eve/tools";
import { z } from "zod";

const SCHEMA = z.object({
  trainee_id: z.string().min(1).describe("Stable synthetic ID for the trainee."),
  scenario_id: z.string().min(1).describe("Practice scenario being rehearsed."),
  session_id: z.string().uuid().optional().describe("Existing session UUID when `resume=true`."),
  resume: z.boolean().optional().default(false),
});

export default defineTool({
  description:
    "Initialize a new rehearsal session, or resume an existing one if `session_id` " +
    "and `resume=true` are supplied. Persists the session header in Foresight " +
    "(semantic memory) and writes the durable transcript record stub to MongoDB. " +
    "Returns the session_id, the resume token, and any recovered context.",
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const sessionId = input.session_id ?? crypto.randomUUID();

    // Persistence wiring lives behind a thin facade so we can swap the
    // implementation (Foresight vs. local file store) without touching the tool.
    const persistedAt = new Date().toISOString();

    return {
      session_id: sessionId,
      trainee_id: input.trainee_id,
      scenario_id: input.scenario_id,
      state: input.resume ? "RECOVERING" : "NEW",
      persisted_at: persistedAt,
      resume_token: `${sessionId}:${persistedAt}`,
      // Tool-side stub. Real implementation must call into Foresight MCP
      // (`connection__foresight__store_memory`) and Mongo via the memory MCP.
      foresight_stub: {
        memory_id: null,
        note: "Foresight MCP write is not yet wired in this slice. See agent/connections/foresight.ts.",
      },
      mongo_stub: {
        collection: "sessions",
        document_id: sessionId,
        note: "Mongo write is not yet wired in this slice. See agent/connections/memory-mcp.ts.",
      },
    };
  },
});
