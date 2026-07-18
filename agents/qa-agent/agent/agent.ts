import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { defineAgent } from "eve";
import { profileAndLogAgentStartup } from "@/lib/context/startup-profiler.js";

import { AGENT_MODEL_CONTEXT_WINDOW_TOKENS, agentModel } from "./lib/workers-ai.js";

// Lazy MCP client for direct programmatic access

const __dirname = dirname(fileURLToPath(import.meta.url));

profileAndLogAgentStartup({
  agentName: "qa-agent",
  agentDir: __dirname,
  connectionDescriptions: {
    foresight:
      "Foresight memory:MCP for QA batch review. Pulls closed-session transcripts and cohort longitudinal emotion series.",
  },
});

export default defineAgent({
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  compaction: {
    // Scoring reports are short. Compact sooner than default.
    thresholdPercent: 0.7,
  },
});
