import { describe, it, expect } from "vitest";
import { z } from "zod";

const inputSchema = z.object({
  session_id: z.string().uuid(),
  draft: z.string().min(1).max(8000),
  requires_crisis_prompt: z.boolean(),
});

async function execute(input: z.infer<typeof inputSchema>) {
  let response = input.draft.trim();
  const changes: string[] = [];

  if (input.requires_crisis_prompt && !/^i hear you/i.test(response)) {
    response =
      "I hear you, and what you're describing sounds really painful. " +
      "I'm here with you, and a supervisor will join us shortly. " +
      response;
    changes.push("prepended_crisis_prompt");
  }

  const beforeLen = response.length;
  response = response.replace(/\b[iI]\s*diagnos(e|es|ed)\b/gi, "[stripped]");
  response = response.replace(/\byou have\s+(depression|anxiety|ptsd|bipolar)\b/gi, "[stripped]");
  if (response.length !== beforeLen) changes.push("stripped_diagnostic");
  // Push when string same length but replacement actually occurred
  if (changes.length === 0 && /\[stripped\]/.test(response)) {
    changes.push("stripped_diagnostic");
  }

  return {
    session_id: input.session_id,
    repaired: response,
    changes,
    validator: "session-agent.validate_response:v0",
    validated_at: new Date().toISOString(),
  };
}

describe("validate_response", () => {
  it("should return the original text when no changes needed", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      draft: "That sounds like a difficult experience.",
      requires_crisis_prompt: false,
    });

    expect(result.repaired).toBe("That sounds like a difficult experience.");
    expect(result.changes).toHaveLength(0);
  });

  it("should prepend crisis prompt when required and not already present", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      draft: "Let's try to work through this.",
      requires_crisis_prompt: true,
    });

    expect(result.repaired.startsWith("I hear you")).toBe(true);
    expect(result.changes).toContain("prepended_crisis_prompt");
  });

  it("should not prepend crisis prompt when already present", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      draft: "I hear you, and I want to help.",
      requires_crisis_prompt: true,
    });

    expect(result.changes).not.toContain("prepended_crisis_prompt");
  });

  it("should strip 'i diagnose' diagnostic phrasing", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      draft: "I diagnose this.",
      requires_crisis_prompt: false,
    });

    expect(result.repaired).toContain("[stripped]");
    expect(result.changes).toContain("stripped_diagnostic");
  });

  it("should strip 'you have depression' diagnostic phrasing", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      draft: "You have anxiety and it is affecting your work.",
      requires_crisis_prompt: false,
    });

    expect(result.repaired).toContain("[stripped]");
    expect(result.changes).toContain("stripped_diagnostic");
  });

  it("should strip 'you have PTSD'", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      draft: "It sounds like you have PTSD.",
      requires_crisis_prompt: false,
    });

    expect(result.repaired).toContain("[stripped]");
    expect(result.changes).toContain("stripped_diagnostic");
  });

  it("should strip 'you have bipolar'", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      draft: "You have bipolar tendencies.",
      requires_crisis_prompt: false,
    });

    expect(result.repaired).toContain("[stripped]");
    expect(result.changes).toContain("stripped_diagnostic");
  });

  it("should perform both crisis prepend and diagnostic strip in one pass", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      draft: "I diagnose the situation. You have depression.",
      requires_crisis_prompt: true,
    });

    expect(result.repaired.startsWith("I hear you")).toBe(true);
    expect(result.changes).toContain("prepended_crisis_prompt");
    expect(result.changes).toContain("stripped_diagnostic");
  });

  it("should preserve the session_id in output", async () => {
    const sid = "550e8400-e29b-41d4-a716-446655440000";
    const result = await execute({ session_id: sid, draft: "Normal text", requires_crisis_prompt: false });
    expect(result.session_id).toBe(sid);
  });

  it("should include the validator version string", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      draft: "Normal text",
      requires_crisis_prompt: false,
    });
    expect(result.validator).toBe("session-agent.validate_response:v0");
  });

  it("should trim leading/trailing whitespace on the draft", async () => {
    const result = await execute({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      draft: "  Leading and trailing  ",
      requires_crisis_prompt: false,
    });

    expect(result.repaired).toBe("Leading and trailing");
  });
});
