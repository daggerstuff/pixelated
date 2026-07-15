import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { getSystemStatus } from '../foresight-client.js'

// Health check for the pipeline infrastructure. Probes each MCP endpoint
// for readiness. The orchestrator calls this before starting a pipeline
// run to preflight the environment.

export default defineTool({
  description:
    'Probe the pipeline infrastructure components (training-infra MCP, ' +
    'K8s MCP, Foresight MCP, Slack channel, Linear channel) for ' +
    'readiness. The orchestrator calls this before initiating a run.',
  inputSchema: z.object({}),
  async execute() {
    const status = await getSystemStatus()
    const foresight =
      status && !isNaN(new Date(status.checked_at as string).getTime())
        ? 'healthy'
        : status === null
          ? 'unreachable'
          : 'healthy'

    const trainingInfra = process.env.TRAINING_INFRA_MCP_URL
      ? 'configured'
      : 'not_configured'
    const k8s = process.env.K8S_MCP_URL ? 'configured' : 'not_configured'
    const slack = process.env.SLACK_BOT_TOKEN ? 'configured' : 'not_configured'
    const linear = process.env.LINEAR_API_KEY ? 'configured' : 'not_configured'

    return {
      training_infra: trainingInfra,
      k8s,
      foresight,
      slack,
      linear,
      checked_at: new Date().toISOString(),
    }
  },
})
