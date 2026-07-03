import { defineMcpClientConnection } from 'eve/connections'

// Foresight MCP. Stores dataset versions and training metadata for the
// pipeline orchestrator's memory layer.

export default defineMcpClientConnection({
  url: process.env.FORESIGHT_MCP_URL ?? 'http://127.0.0.1:8764/sse',
  description:
    'Foresight memory MCP for pipeline dataset versioning and training ' +
    'metadata. Stores curated dataset fingerprints and training run records.',
  auth: process.env.FORESIGHT_MCP_URL
    ? {
        getToken: async () => ({
          token: process.env.FORESIGHT_MCP_TOKEN ?? '',
        }),
      }
    : undefined,
})
