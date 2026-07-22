import { defineAgent } from "eve";
import { profileAndLogAgentStartup } from "../../lib/context/startup-profiler.js";

import { AGENT_MODEL_CONTEXT_WINDOW_TOKENS, agentModel } from "./lib/workers-ai.js";

profileAndLogAgentStartup({
  agentName: "advisor-agent",
  agentDir: import.meta.dirname,
  connectionDescriptions: {
    foresight: "Foresight memory MCP for pipeline dataset versioning and training metadata.",
    linear: "Linear workspace: issues, projects, cycles, and comments.",
    notion: "Notion workspace: search and edit pages and databases.",
  },
});

export default defineAgent({
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
});
