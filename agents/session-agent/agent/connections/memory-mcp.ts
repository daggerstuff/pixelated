import { defineMcpClientConnection } from 'eve/connections'

// Mongo-backed durable session store. Persists each rehearsal session header
// and its transcript. The upstream server is not yet implemented in this slice;
// the entry below is a placeholder so the connection slot is exercised end-to-end.
//
// TODO:
//   1. Implement session-mcp (Node HTTP/SSE transport around the MongoDB
//      collection used by the existing ai-services memory_adapter).
//   2. Replace the URL with the deployed transport URL.
//   3. Wire `auth` to the chosen token issuance path.

export default defineMcpClientConnection({
  url: process.env.PIXELATED_SESSION_MCP_URL ?? 'http://127.0.0.1:8766/mcp',
  description:
    'Pixelated session memory MCP backed by MongoDB. Owns the session-header ' +
    'and turn-level records for rehearsal sessions.',
  auth: process.env.PIXELATED_SESSION_MCP_URL
    ? {
        getToken: async () => ({
          token: process.env.PIXELATED_SESSION_MCP_TOKEN ?? '',
        }),
      }
    : undefined,
})
