import { defineMcpClientConnection } from 'eve/connections'

export default defineMcpClientConnection({
  url: process.env.FORESIGHT_URL ?? 'http://127.0.0.1:8764/sse',
  description:
    'Foresight memory MCP for supervisor queries. Reads session QA scores, ' +
    'cohort trends, trainee records, and clinical boundary flags across all agents.',
  auth: process.env.FORESIGHT_URL
    ? {
        getToken: async () => ({
          token: process.env.FORESIGHT_TOKEN ?? '',
        }),
      }
    : undefined,
})
