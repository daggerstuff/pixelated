import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
import { openai } from '@ai-sdk/openai'
import { Composio } from '@composio/core'
import { stepCountIs, streamText } from 'ai'

// Initialize Composio
const composio = new Composio({
  // Note: For production use process.env.COMPOSIO_API_KEY
  apiKey: 'as6i8wxkuoiym9fipxbmgq',
})

const externalUserId = 'pg-test-cc64d9dd-3d45-4e10-a63d-4b64c4453cf5'

async function main() {
  console.log('Setting up Composio tool router session...')

  // Create a tool router session
  const session = await composio.create(externalUserId)

  console.log('Connecting to MCP server...')

  // Connect to MCP server and get tools
  const client = await createMCPClient({
    transport: {
      type: session.mcp.type,
      url: session.mcp.url,
      headers: session.mcp.headers,
    },
  })

  // Extract the actual tools from the MCP client
  const mcpTools = await client.tools()
  console.log(`Loaded ${Object.keys(mcpTools).length} tools from Composio.`)

  console.log('Starting streaming completion...')

  // Use Vercel AI SDK to stream text and execute tools using the MCP client tools
  // Cast tools to any to work around TypeScript generic mismatch between MCP client tools and AI SDK ToolSet
  const { textStream } = streamText({
    model: openai('gpt-4o'), // Replace with your model
    prompt: 'Can you briefly describe what repositories I have on my GitHub?',
    tools: mcpTools as any,
    // Enable multi-step behavior to allow the model to call tools and use their results
    stopWhen: stepCountIs(5),
    onStepFinish: (step) => {
      console.log(`\n--- Completed step [${step.stepNumber || 'unknown'}] ---`)
    },
  })

  for await (const chunk of textStream) {
    process.stdout.write(chunk)
  }
}

main().catch(console.error)
