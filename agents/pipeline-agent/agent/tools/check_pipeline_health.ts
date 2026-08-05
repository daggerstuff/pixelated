import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { getSystemStatus } from '../foresight-client.js'

// Health check for the pipeline infrastructure. Probes each MCP endpoint
// for readiness. The orchestrator calls this before starting a pipeline
// run to preflight the environment.
//
// NOTE: these statuses reflect ENV CONFIGURATION PRESENCE only, not live
// endpoint readiness. The check is intentionally NON-GATING.

export default defineTool({
  description:
    'Preflight the pipeline infrastructure configuration (training-infra MCP, ' +
    'K8s MCP, Foresight MCP, Slack channel, Linear channel). Reports env ' +
    'configuration presence only and is non-gating.',
  inputSchema: z.object({}),
  async execute() {
    const status = await getSystemStatus()

    let foresight: string
    if (status === null) {
      foresight = 'unreachable'
    } else if (
      typeof status === 'object' &&
      'checked_at' in status &&
      typeof status.checked_at === 'string' &&
      !isNaN(new Date(status.checked_at).getTime())
    ) {
      foresight = 'healthy'
    } else {
      foresight = 'degraded'
    }

    const trainingInfra = process.env.TRAINING_INFRA_MCP_URL
      ? 'configured'
      : 'not_configured'
    const k8s = process.env.K8S_MCP_URL ? 'configured' : 'not_configured'
    const slack = process.env.SLACK_BOT_TOKEN ? 'configured' : 'not_configured'
    const linear = process.env.LINEAR_AGENT_ACCESS_TOKEN
      ? 'configured'
      : 'not_configured'

    return {
      training_infra: trainingInfra,
      k8s,
      foresight,
      slack,
      linear,
      gating: false,
      probe_mode: 'config_presence_only',
      note:
        'Statuses reflect environment configuration presence, not live ' +
        'endpoint readiness. This preflight is non-gating.',
      checked_at: new Date().toISOString(),
    }
  },
})
