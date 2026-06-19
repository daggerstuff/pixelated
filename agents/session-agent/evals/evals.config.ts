import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  // Default judge model. Falls back to the agent's own if not configured.
  judge: { model: "anthropic/claude-sonnet-4.6" },
});
