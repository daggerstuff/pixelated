import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { createLazyResource } from "@/lib/context/optimization.js";

// Kubernetes MCP — deploys models to staging and production namespaces

const MCP_URL = process.env.K8S_MCP_URL ?? "http://127.0.0.1:8767/mcp";

const lazyClient = createLazyResource<Client>(async () => {
  const headers: Record<string, string> = {};

  // Add auth token if the env var is set (meaning we're pointing at a real server)
  if (process.env.K8S_MCP_URL) {
    headers["Authorization"] = `Bearer ${process.env.K8S_MCP_TOKEN ?? ""}`;
  }

  const transport = new SSEClientTransport(new URL(MCP_URL), {
    requestInit: { headers },
  });

  const client = new Client({ name: "pipeline-agent", version: "1.0.0" }, { capabilities: {} });
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
