import { defineEvalConfig } from "eve/evals";

import { agentModel } from "../agent/lib/workers-ai.js";

export default defineEvalConfig({
  judge: { model: agentModel },
});
