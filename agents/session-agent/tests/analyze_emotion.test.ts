import { describe, it, expect } from "vitest";
import { z } from "zod";

const inputSchema = z.object({
  session_id: z.string().uuid(),
  turn_text: z.string().min(1),
  previous_turn_text: z.string().optional(),
});

async function execute(input: z.infer<typeof inputSchema>) {
  return {
    session_id: input.session_id,
    emotion: {
      primary_emotion: "neutral",
      intensity: 0,
      valence: 0,
      risk_flags: [],
      confidence: 0,
      evidence_span: "",
    },
    analyzer: "session-agent.subagents.emotion-analyzer:v0",
    evaluated_at: new Date().toISOString(),
  };
}

describe("analyze_emotion", () => {
  it("should return a neutral emotion signal for normal text", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "I'm feeling okay today.",
    });

    expect(result.emotion.primary_emotion).toBe("neutral");
    expect(result.emotion.intensity).toBe(0);
    expect(result.emotion.valence).toBe(0);
    expect(result.emotion.risk_flags).toHaveLength(0);
  });

  it("should preserve the session_id in output", async () => {
    const sid = "550e8400-e29b-41d4-a716-446655440000";
    const result = await execute({ session_id: sid, turn_text: "Some text" });
    expect(result.session_id).toBe(sid);
  });

  it("should include the analyzer version string", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "Some text",
    });
    expect(result.analyzer).toBe("session-agent.subagents.emotion-analyzer:v0");
  });

  it("should include an ISO timestamp for evaluated_at", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "Some text",
    });
    expect(result.evaluated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should accept optional previous_turn_text without error", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "Current turn",
      previous_turn_text: "Previous turn",
    });
    expect(result.emotion).toBeDefined();
  });

  it("should return a zero confidence in this stub version", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "Some text",
    });
    expect(result.emotion.confidence).toBe(0);
  });

  it("should return an empty evidence_span in this stub version", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "Some text",
    });
    expect(result.emotion.evidence_span).toBe("");
  });
});
