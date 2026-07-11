import { defineMcpClientConnection } from 'eve/connections'

// Training infrastructure MCP. Launches and monitors SFT/DPO/GRPO jobs.

export default defineMcpClientConnection({
  url: process.env.TRAINING_INFRA_MCP_URL ?? 'http://127.0.0.1:8766/mcp',
  description:
    'Training infrastructure MCP. Exposes tools for dataset curation, ' +
    'training job launch, and training job status polling.',
  auth: process.env.TRAINING_INFRA_MCP_URL
    ? {
        getToken: async () => ({
          token: process.env.TRAINING_INFRA_MCP_TOKEN ?? '',
        }),
      }
    : undefined,
})
