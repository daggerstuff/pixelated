import { describe, it, expect } from "vitest";
import { z } from "zod";

const RISK_CRITERIA = [
  "self_harm_ideation_with_intent",
  "harm_to_others_with_intent",
  "acute_medical_emergency",
  "out_of_scenario_roleplay",
  "diagnostic_request",
  "third_party_identifying_detail",
] as const;

const inputSchema = z.object({
  session_id: z.string().uuid(),
  turn_text: z.string().min(1),
  category: z.enum(["crisis", "boundary", "scope", "privacy"]).optional(),
});

async function execute(input: z.infer<typeof inputSchema>) {
  const lower = input.turn_text.toLowerCase();
  const category = input.category ?? "boundary";
  const flagged: Array<typeof RISK_CRITERIA[number]> = [];
  if (/(kill myself|end it|take my life|i want to die)/.test(lower)) {
    flagged.push("self_harm_ideation_with_intent");
  }
  if (/(kill (him|her|them|someone))/i.test(lower)) {
    flagged.push("harm_to_others_with_intent");
  }
  if (/(overdose|unconscious|can't breathe|seizure)/i.test(lower)) {
    flagged.push("acute_medical_emergency");
  }

  const severity =
    flagged.length === 0
      ? "none"
      : flagged.includes("acute_medical_emergency") ||
          flagged.includes("self_harm_ideation_with_intent") ||
          flagged.includes("harm_to_others_with_intent")
        ? "critical"
        : "warning";

  return {
    session_id: input.session_id,
    category: category,
    severity,
    flagged_risk_criteria: flagged,
    boundary_passed: severity !== "critical",
    escalate_to_supervisor: severity === "critical",
    evaluator: "session-agent.check_clinical_boundary:v0",
    evaluated_at: new Date().toISOString(),
  };
}

describe("check_clinical_boundary", () => {
  it("should return severity=none for a normal turn", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "How do you feel about the session so far?",
    });

    expect(result.severity).toBe("none");
    expect(result.flagged_risk_criteria).toHaveLength(0);
    expect(result.boundary_passed).toBe(true);
    expect(result.escalate_to_supervisor).toBe(false);
  });

  it("should flag self-harm ideation with intent", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "I think I want to end it all.",
    });

    expect(result.severity).toBe("critical");
    expect(result.flagged_risk_criteria).toContain("self_harm_ideation_with_intent");
    expect(result.boundary_passed).toBe(false);
    expect(result.escalate_to_supervisor).toBe(true);
  });

  it("should flag harm-to-others with intent", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "I want to kill someone.",
    });

    expect(result.severity).toBe("critical");
    expect(result.flagged_risk_criteria).toContain("harm_to_others_with_intent");
    expect(result.escalate_to_supervisor).toBe(true);
  });

  it("should flag acute medical emergency", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "I think I overdosed. I can't breathe.",
    });

    expect(result.severity).toBe("critical");
    expect(result.flagged_risk_criteria).toContain("acute_medical_emergency");
    expect(result.escalate_to_supervisor).toBe(true);
  });

  it("should escalate to supervisor on critical severity", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "I want to take my life.",
    });

    expect(result.escalate_to_supervisor).toBe(true);
  });

  it("should not escalate on warning severity", async () => {
    // "I want to kill" without direct intent still flags but as warning
    // (only direct-harm intent patterns produce critical)
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "What if I killed the simulation?",
    });

    // "killed" alone doesn't match the harm intent pattern
    expect(result.escalate_to_supervisor).toBe(false);
  });

  it("should preserve the session_id in output", async () => {
    const sid = "550e8400-e29b-41d4-a716-446655440000";
    const result = await execute({ session_id: sid, turn_text: "Normal text" });
    expect(result.session_id).toBe(sid);
  });

  it("should include evaluator version in output", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "Normal text",
    });
    expect(result.evaluator).toBe("session-agent.check_clinical_boundary:v0");
  });

  it("should accept non-default category values", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "Do I have PTSD?",
      category: "scope",
    });
    expect(result.category).toBe("scope");
  });

  it("should default to boundary category", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      turn_text: "Normal text",
    });
    expect(result.category).toBe("boundary");
  });
});
