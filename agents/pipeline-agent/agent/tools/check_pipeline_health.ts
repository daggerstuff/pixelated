import { defineTool } from "eve/tools";
import { z } from "zod";

// Health check for the pipeline infrastructure. Probes each MCP endpoint
// for readiness. The orchestrator calls this before starting a pipeline
// run to preflight the environment.

export default defineTool({
  description:
    "Probe the pipeline infrastructure components (training-infra MCP, " +
    "K8s MCP, Foresight MCP, Slack channel, Linear channel) for " +
    "readiness. The orchestrator calls this before initiating a run.",
  inputSchema: z.object({}),
  async execute() {
    return {
      training_infra: "unknown",
      k8s: "unknown",
      foresight: "unknown",
      slack: "unknown",
      linear: "unknown",
      checked_at: new Date().toISOString(),
      note:
        "Each component's status is resolved by calling the corresponding " +
        "MCP's readiness probe. When those connections are wired, this " +
        "tool returns the live status and an overall readiness boolean.",
    };
  },
});
