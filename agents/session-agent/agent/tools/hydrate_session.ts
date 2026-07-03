import { defineTool } from "eve/tools";
import { z } from "zod";
import { searchMemories } from "../foresight-client.js";

const SCHEMA = z.object({
  session_id: z.string().uuid(),
  max_turns: z.number().int().min(1).max(200).default(50),
});

export default defineTool({
  description:
    "Reconstruct a session's recent durable state by replaying the last " +
    "transcript turns stored in Foresight. Returns up to `max_turns` " +
    "prior turns plus the last persisted `state`. On first session this " +
    "returns an empty list and state `NEW`.",
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const results = await searchMemories({
      query: `session:${input.session_id}`,
      limit: input.max_turns,
      tag_filter: [`session_id:${input.session_id}`],
    });

    const recentTurns = (results ?? [])
      .flatMap((m) => {
        try {
          const parsed = JSON.parse(m.content);
          if (parsed.type !== "transcript_turn") return [];
          if (Array.isArray(parsed.turns)) {
            return parsed.turns.map((t: { role: string; text: string; timestamp: string }) => ({
              role: t.role as "trainee" | "participant" | "supervisor",
              text: t.text,
              timestamp: t.timestamp,
              memory_id: m.memory_id,
            }));
          }
          return [
            {
              role: parsed.role as "trainee" | "participant" | "supervisor",
              text: parsed.text,
              timestamp: parsed.timestamp,
              memory_id: m.memory_id,
            },
          ];
        } catch {
          return [];
        }
      })
      .slice(0, input.max_turns);

    return {
      session_id: input.session_id,
      last_state: recentTurns.length > 0 ? "ACTIVE" : "NEW",
      last_persisted_at:
        recentTurns.length > 0 ? recentTurns[recentTurns.length - 1]!.timestamp : null,
      recent_turns: recentTurns,
      truncated: (results ?? []).length > input.max_turns,
      pid_file: process.pid,
      requested_at: new Date().toISOString(),
    };
  },
});
