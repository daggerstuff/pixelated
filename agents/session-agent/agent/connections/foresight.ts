import { defineMcpClientConnection } from "eve/connections";

// Foresight stores session memory: per-session transcripts, per-trainee
// longitudinal trends, and emotional signal rollups. The server now supports
// SSE transport (launch with `foresight-mcp --port 8764`) exposing the MCP
// protocol at the `/sse` endpoint.
//
// Set FORESIGHT_MCP_URL to point at a deployed instance, or run locally:
//   FORESIGHT_MCP_PORT=8764 scripts/memory/foresight-mcp-server.sh

export default defineMcpClientConnection({
  url: process.env.FORESIGHT_MCP_URL ?? "http://127.0.0.1:8764/sse",
  description:
    "Foresight memory:MCP for conversation-rehearsal session context. Stores " +
    "transcripts, per-session state, and per-trainee longitudinal signals.",
  auth: process.env.FORESIGHT_MCP_URL
    ? {
        getToken: async () => ({
          token: process.env.FORESIGHT_MCP_TOKEN ?? "",
        }),
      }
    : undefined,
});
