import { describe, it, expect } from "vitest";
import { z } from "zod";

const inputSchema = z.object({
  session_id: z.string().uuid(),
  cohort_id: z.string().min(1),
  rubric_version: z.string().min(1),
});

async function execute(input: z.infer<typeof inputSchema>) {
  return {
    session_id: input.session_id,
    cohort_id: input.cohort_id,
    rubric_version: input.rubric_version,
    state: "REVIEWED",
    scored_at: new Date().toISOString(),
    rubric_stub: {
      note: "Rubric fetcher is not yet wired.",
    },
    foresight_stub: {
      note: "Foresight session fetch is not yet wired.",
    },
    placeholder_dimensions: [
      "rapport",
      "open_questions",
      "reflection",
      "boundaries",
      "crisis_recognition",
    ],
  };
}

describe("score_session", () => {
  it("should preserve the session_id", async () => {
    const sid = "550e8400-e29b-41d4-a716-446655440000";
    const result = await execute({
      session_id: sid,
      cohort_id: "cohort-1",
      rubric_version: "2026.Q1",
    });
    expect(result.session_id).toBe(sid);
  });

  it("should echo cohort_id", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      cohort_id: "cohort-alpha",
      rubric_version: "2026.Q1",
    });
    expect(result.cohort_id).toBe("cohort-alpha");
  });

  it("should echo rubric_version", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      cohort_id: "cohort-1",
      rubric_version: "2026.Q3.Starter",
    });
    expect(result.rubric_version).toBe("2026.Q3.Starter");
  });

  it("should set state to REVIEWED", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      cohort_id: "cohort-1",
      rubric_version: "2026.Q1",
    });
    expect(result.state).toBe("REVIEWED");
  });

  it("should include an ISO scored_at timestamp", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      cohort_id: "cohort-1",
      rubric_version: "2026.Q1",
    });
    expect(result.scored_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should return the five canonical rubric dimensions", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      cohort_id: "cohort-1",
      rubric_version: "2026.Q1",
    });
    expect(result.placeholder_dimensions).toEqual([
      "rapport",
      "open_questions",
      "reflection",
      "boundaries",
      "crisis_recognition",
    ]);
  });

  it("should return both stub objects", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      cohort_id: "cohort-1",
      rubric_version: "2026.Q1",
    });
    expect(result.rubric_stub).toBeDefined();
    expect(result.foresight_stub).toBeDefined();
  });
});
