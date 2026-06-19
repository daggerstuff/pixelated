import { defineAgent } from "eve";
import { z } from "zod";

export default defineAgent({
  description:
    "Specialist sub-agent that turns a structured session score into a short " +
    "trainer-facing report. Emits headline, strengths, gaps, rubric items, " +
    "and an optional next-session hint. Use this whenever the QA agent has " +
    "produced scores and is ready to summarize.",
  model: "anthropic/claude-sonnet-4.6",
  outputSchema: z.object({
    headline: z.string().max(280),
    strengths: z.array(z.string().max(160)).min(1).max(3),
    gaps: z.array(z.string().max(160)).max(3),
    rubric_items: z.array(
      z.object({
        item_id: z.string(),
        passed: z.boolean(),
        comment: z.string().max(160),
      }),
    ),
    next_session_hint: z.string().max(160).optional(),
  }),
});
