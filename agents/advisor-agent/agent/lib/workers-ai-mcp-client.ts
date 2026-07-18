import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { createLazyResource } from "@/lib/context/optimization.js";

// Workers AI inference MCP — @cf/meta/llama-3.2-3b-instruct on Cloudflare Workers

const MCP_URL = "https://workers-ai-mcp.coburncd.workers.dev/mcp";

const lazyClient = createLazyResource<Client>(async () => {
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
  };

  const transport = new SSEClientTransport(new URL(MCP_URL), {
    requestInit: { headers },
  });

  const client = new Client({ name: "advisor-agent", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  return client;
});

export async function getClient(): Promise<Client> {
  return lazyClient.get();
}

export async function close(): Promise<void> {
  const client = lazyClient.isLoaded() ? await lazyClient.get() : null;
  await lazyClient.unload();
  if (client) {
    try {
      await client.close();
    } catch {
      /* ignore */
    }
  }
}
