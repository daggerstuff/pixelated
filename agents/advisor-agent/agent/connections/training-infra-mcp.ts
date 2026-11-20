import { defineMcpClientConnection } from 'eve/connections'

// Training infrastructure MCP. The advisor gets READ-ONLY access: it inspects
// the recipe registry, validates draft recipes, and reads eval-gate verdicts.
// Submit/cancel are blocked client-side so a critique-only agent can never
// launch or stop a GPU job.

export default defineMcpClientConnection({
  url: process.env.TRAINING_INFRA_MCP_URL ?? 'http://127.0.0.1:8766/mcp',
  description:
    'Training infrastructure MCP (read-only). Inspect the recipe registry, ' +
    'validate a draft recipe, and read eval-gate verdicts. Job submission and ' +
    'cancellation are blocked for this agent.',
  tools: { block: ['submit_job', 'cancel_job'] },
  // Gate on the token: the URL always has a default, so gating on it would
  // always be truthy and send an empty bearer token to the authed MCP.
  auth: process.env.TRAINING_INFRA_MCP_TOKEN
    ? {
        getToken: async () => ({
          token: process.env.TRAINING_INFRA_MCP_TOKEN ?? '',
        }),
      }
    : undefined,
})
