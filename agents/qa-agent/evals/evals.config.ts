import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  judge: { model: "anthropic/claude-sonnet-4.6" },
});
