import { defineMcpClientConnection } from "eve/connections";

// Foresight stores session memory: per-session transcripts, per-trainee
// longitudinal trends, and emotional signal rollups. The src server runs as a
// stdio MCP from `foresight-mcp`. Until it's exposed over HTTP/SSE we ship
// this connection as a placeholder so the surrounding wire-up is captured.
//
// TODO:
//   1. Run the local foresight server behind an HTTP/SSE transport. The CLI
//      lives at scripts/memory/foresight-mcp-server.sh.
//   2. Replace `url` with the deployed transport URL.
//   3. Wire `auth` to whatever token the deployer chooses. The current
//      "health" health probe below is safe because eve still has to attempt
//      every tool call before it can return an answer.

export default defineMcpClientConnection({
  url: process.env.FORESIGHT_MCP_URL ?? "http://127.0.0.1:8765/mcp",
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
