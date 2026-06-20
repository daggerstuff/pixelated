import { describe, it, expect } from "vitest";
import { z } from "zod";

const inputSchema = z.object({
  session_id: z.string().uuid(),
  cohort_id: z.string().min(1),
  reference_period_days: z.number().int().min(1).max(180).optional(),
});

async function execute(input: z.infer<typeof inputSchema>) {
  return {
    session_id: input.session_id,
    cohort_id: input.cohort_id,
    reference_period_days: input.reference_period_days ?? 30,
    analyzed_at: new Date().toISOString(),
    pattern_flags: [],
    recommendation: "hold",
    python_pipeline_stub: {
      note:
        "ai-services/api.py:/api/ai/analyze-emotion cohort comparator " +
        "is not yet wired.",
    },
  };
}

describe("detect_emotional_patterns", () => {
  it("should preserve the session_id", async () => {
    const sid = "550e8400-e29b-41d4-a716-446655440000";
    const result = await execute({
      session_id: sid,
      cohort_id: "cohort-1",
      reference_period_days: 30,
    });
    expect(result.session_id).toBe(sid);
  });

  it("should default reference_period_days to 30", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      cohort_id: "cohort-1",
    });
    expect(result.reference_period_days).toBe(30);
  });

  it("should accept explicit reference_period_days values", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      cohort_id: "cohort-1",
      reference_period_days: 90,
    });
    expect(result.reference_period_days).toBe(90);
  });

  it("should return an empty pattern_flags array in this stub", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      cohort_id: "cohort-1",
    });
    expect(result.pattern_flags).toHaveLength(0);
  });

  it("should default recommendation to hold", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      cohort_id: "cohort-1",
    });
    expect(result.recommendation).toBe("hold");
  });

  it("should include an ISO analyzed_at timestamp", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      cohort_id: "cohort-1",
    });
    expect(result.analyzed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should include the python_pipeline_stub note", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      cohort_id: "cohort-1",
    });
    expect(result.python_pipeline_stub).toBeDefined();
    expect((result.python_pipeline_stub as Record<string, unknown>).note).toBeDefined();
  });

  it("should echo cohort_id in output", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      cohort_id: "cohort-alpha",
      reference_period_days: 14,
    });
    expect(result.cohort_id).toBe("cohort-alpha");
  });
});
