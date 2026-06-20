import { defineMcpClientConnection } from 'eve/connections'

// Kubernetes MCP. Deploys models to staging and production namespaces.

export default defineMcpClientConnection({
  url: process.env.K8S_MCP_URL ?? 'http://127.0.0.1:8767/mcp',
  description:
    'Kubernetes MCP. Exposes tools for model deployment, rollback, and ' +
    'smoke-test probe execution across pixelated-staging and ' +
    'pixelated-prod namespaces.',
  auth: process.env.K8S_MCP_URL
    ? {
        getToken: async () => ({
          token: process.env.K8S_MCP_TOKEN ?? '',
        }),
      }
    : undefined,
})
