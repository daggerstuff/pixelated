import { Composio } from '@composio/core';
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

async function main() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    throw new Error('COMPOSIO_API_KEY environment variable is required');
  }

  const composio = new Composio({ apiKey });
  const externalUserId = process.env.COMPOSIO_TEST_USER_ID || 'pg-test-cc64d9dd-3d45-4e10-a63d-4b64c4453cf5';
  
  // Create tool router session
  const session = await composio.create(externalUserId);

  // Connect to the remote HTTP client using Vercel AI SDK MCP client
  const mcpClient = await createMCPClient({
    transport: {
      type: session.mcp.type, // "http"
      url: session.mcp.url,
      headers: session.mcp.headers as Record<string, string>,
    },
  });

  // Create local stdio server
  const localServer = new Server(
    { name: 'composio-bridge-server', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } }
  );

  // Expose tools
  localServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = await mcpClient.listTools();
    return result;
  });

  localServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await mcpClient.callTool({
      name: request.params.name,
      args: request.params.arguments,
    });
    return result;
  });

  // Expose resources
  localServer.setRequestHandler(ListResourcesRequestSchema, async () => {
    const result = await mcpClient.listResources();
    return result;
  });

  localServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const result = await mcpClient.readResource({
      uri: request.params.uri,
    });
    return result;
  });

  const stdioTransport = new StdioServerTransport();
  await localServer.connect(stdioTransport);
}

main().catch((err) => {
  console.error('Composio MCP Bridge Error:', err);
  process.exit(1);
});
