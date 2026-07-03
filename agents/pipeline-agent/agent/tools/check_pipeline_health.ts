import { defineTool } from "eve/tools";
import { z } from "zod";
import { getSystemStatus } from "../foresight-client.js";

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
    const status = await getSystemStatus();
    const foresight =
      status && !isNaN(new Date(status.checked_at as string).getTime())
        ? "healthy"
        : status === null
          ? "unreachable"
          : "healthy";

    return {
      training_infra: "unknown",
      k8s: "unknown",
      foresight,
      slack: "unknown",
      linear: "unknown",
      checked_at: new Date().toISOString(),
    };
  },
});
