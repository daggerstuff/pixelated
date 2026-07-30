import { defineAgent } from "eve";
import { profileAndLogAgentStartup } from "../../lib/context/startup-profiler.js";

import { AGENT_MODEL_CONTEXT_WINDOW_TOKENS, agentModel } from "./lib/workers-ai.js";

profileAndLogAgentStartup({
  agentName: "supervisor-agent",
  agentDir: import.meta.dirname,
  connectionDescriptions: {
    foresight:
      "Foresight memory MCP for cross-agent queries: session QA scores, " +
      "cohort trends, trainee records, clinical boundary flags, and training provenance.",
  },
});

export default defineAgent({
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  compaction: {
    thresholdPercent: 0.7,
  },
});
