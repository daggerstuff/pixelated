import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
import { Composio } from '@composio/core'

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
})

const externalUserId = process.env.COMPOSIO_TEST_USER_ID || 'pg-test-cc64d9dd-3d45-4e10-a63d-4b64c4453cf5'

async function main() {
  console.log('Connecting to Composio...')
  const session = await composio.create(externalUserId)
  console.log('Connecting to MCP server...')
  const client = await createMCPClient({
    transport: {
      type: session.mcp.type,
      url: session.mcp.url,
      headers: session.mcp.headers,
    },
  })
  const tools = await client.tools()
  console.log('Available tools:')
  for (const name of Object.keys(tools)) {
    console.log(`- ${name}`)
  }
}

main().catch(console.error)
