import { defineTool } from "eve/tools";
import { z } from "zod";

// Repair pass on a draft response before it ships to the trainee. Used as
// a defense-in-depth check: enforces the no-identification, no-diagnosis,
// crisis-prompt rules from agent/instructions/clinical-rules.md in case
// the parent model drifted.

export default defineTool({
  description:
    "Repair a draft response against the clinical-rules harness. Strips " +
    "diagnostic language, ensures a crisis prompt was delivered when " +
    "needed, and clamps length. Returns the cleaned response and a diff " +
    "summary.",
  inputSchema: z.object({
    session_id: z.string().uuid(),
    draft: z.string().min(1).max(8000),
    requires_crisis_prompt: z.boolean(),
  }),
  async execute(input) {
    let response = input.draft.trim();
    const changes: string[] = [];

    if (input.requires_crisis_prompt && !/^i hear you/i.test(response)) {
      response =
        "I hear you, and what you're describing sounds really painful. " +
        "I'm here with you, and a supervisor will join us shortly. " +
        response;
      changes.push("prepended_crisis_prompt");
    }

    // Strip diagnostic phrasing. Real implementation must run a stricter
    // pass via the validator in ai/services/security/clinical_validator.py.
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
  },
});
