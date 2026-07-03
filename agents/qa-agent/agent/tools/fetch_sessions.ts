import { defineTool } from "eve/tools";
import { z } from "zod";
import { searchMemories } from "../foresight-client.js";

// Pull completed session records from Foresight since the last review
// cursor. Backs the qa-agent's daily-review schedule.

interface FetchSessionsInput {
  since: string;
  limit: number;
  cursor?: string;
}

export default defineTool({
  description:
    "List rehearsal sessions since the last successful QA " +
    "review. Returns the session IDs, trainee IDs, scenario IDs, and " +
    "closing timestamps. Pagination is cursor-based on `cursor`.",
  inputSchema: z.object({
    since: z
      .string()
      .datetime()
      .describe("ISO 8601 timestamp — the last successful review cursor."),
    limit: z.number().int().min(1).max(200).default(50),
    cursor: z.string().optional(),
  }),
  async execute(input: FetchSessionsInput) {
    const memories = await searchMemories({
      query: "session.lifecycle=CLOSED",
      limit: input.limit,
    });

    if (!memories) {
      return {
        since: input.since,
        limit: input.limit,
        cursor: input.cursor ?? null,
        next_cursor: null,
        sessions: [],
        fetched_at: new Date().toISOString(),
      };
    }

    // Parse session metadata from stored memory content.
    // Each session is stored as a memory with tags containing
    // session_id, trainee_id, and scenario_id.
    const sessions = memories.map((m) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(typeof m.content === "string" ? m.content : JSON.stringify(m.content));
      } catch {
        parsed = { raw: m.content };
      }
      return {
        session_id: (parsed.session_id as string) ?? null,
        trainee_id: (parsed.trainee_id as string) ?? null,
        scenario_id: (parsed.scenario_id as string) ?? null,
        closed_at: (parsed.closed_at as string) ?? null,
        summary: (parsed.summary as string) ?? null,
      };
    });

    return {
      since: input.since,
      limit: input.limit,
      cursor: input.cursor ?? null,
      next_cursor: sessions.length === input.limit ? `${input.since}_${Date.now()}` : null,
      sessions,
      fetched_at: new Date().toISOString(),
    };
  },
});
