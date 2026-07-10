import { defineMcpClientConnection } from 'eve/connections'

// Workers AI MCP server deployed on Cloudflare Workers. Exposes tools the
// demo QA agent uses for thread scoring and lightweight corpus analysis.

export default defineMcpClientConnection({
  url: 'https://workers-ai-mcp.coburncd.workers.dev/mcp',
  description:
    'Workers AI inference MCP backed by @cf/meta/llama-3.2-3b-instruct ' +
    'on Cloudflare Workers. Exposes text analysis tools used by the demo ' +
    'QA agent for thread scoring and corpus review.',
  headers: {
    Accept: 'application/json, text/event-stream',
  },
})
