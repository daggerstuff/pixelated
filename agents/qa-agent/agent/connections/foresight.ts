import { defineMcpClientConnection } from 'eve/connections'

// Foresight MCP. Pulls aggregate session memory and the cohort's
// longitudinal emotional series for the QA agent's batch review.

export default defineMcpClientConnection({
  url: process.env.FORESIGHT_URL ?? 'http://127.0.0.1:8764/sse',
  description:
    'Foresight memory MCP for QA batch review. Pulls closed-session ' +
    'transcripts and cohort longitudinal emotion series.',
  auth: process.env.FORESIGHT_URL
    ? {
        getToken: async () => ({
          token: process.env.FORESIGHT_TOKEN ?? '',
        }),
      }
    : undefined,
})
