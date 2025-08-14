#!/usr/bin/env node

/**
 * LEANN MCP Server
 * Exposes LEANN vector index functionality via MCP tools and resources.
 * - List available LEANN indexes
 * - Search indexes with semantic queries
 * - Ask questions (RAG) over indexed data
 * This replaces the template notes system.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Type alias for a note object.
 */
type Note = { title: string, content: string };

/**
 * Discover LEANN indexes by running `leann list` CLI.
 * Returns a map of indexId -> { name, path }
 */
async function getLeannIndexes(): Promise<{ [id: string]: { name: string, path: string } }> {
  try {
    const { stdout } = await execAsync("leann list --json");
    // Expecting JSON output: [{name, path, id}]
    const indexes = JSON.parse(stdout);
    const result: { [id: string]: { name: string, path: string } } = {};
    for (const idx of indexes) {
      result[idx.id || idx.name] = { name: idx.name, path: idx.path };
    }
    return result;
  } catch (err) {
    // Fallback: try plain text parsing
    try {
      const { stdout } = await execAsync("leann list");
      // Each line: INDEX_NAME PATH
      const lines = stdout.split("\n").filter(Boolean);
      const result: { [id: string]: { name: string, path: string } } = {};
      for (const line of lines) {
        const [name, path] = line.split(/\s+/);
        if (name && path) result[name] = { name, path };
      }
      return result;
    } catch (e) {
      return {};
    }
  }
}

/**
 * Create an MCP server with capabilities for resources (to list/read notes),
 * tools (to create new notes), and prompts (to summarize notes).
 */
const server = new Server(
  {
    name: "leann",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

/**
 * Handler for listing available LEANN indexes as resources.
 * Each index is exposed as a resource with:
 * - A leann-index:// URI scheme
 * - Metadata for name and path
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const leannIndexes = await getLeannIndexes();
  return {
    resources: Object.entries(leannIndexes).map(([id, idx]) => ({
      uri: `leann-index:///${id}`,
      mimeType: "application/json",
      name: idx.name,
      description: `LEANN vector index at ${idx.path}`
    }))
  };
});

/**
 * Handler for reading the metadata of a specific LEANN index.
 * Takes a leann-index:// URI and returns index info.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const leannIndexes = await getLeannIndexes();
  const url = new URL(request.params.uri);
  const id = url.pathname.replace(/^\//, '');
  const idx = leannIndexes[id];

  if (!idx) {
    throw new Error(`LEANN index ${id} not found`);
  }

  return {
    contents: [{
      uri: request.params.uri,
      mimeType: "application/json",
      text: JSON.stringify(idx)
    }]
  };
});

/**
 * Handler that lists available LEANN tools.
 * Exposes:
 * - leann_list: List available indexes
 * - leann_search: Semantic search over an index
 * - leann_ask: RAG Q&A over an index
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "leann_list",
        description: "List available LEANN indexes",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "leann_search",
        description: "Semantic search over a LEANN index",
        inputSchema: {
          type: "object",
          properties: {
            indexId: { type: "string", description: "Index ID" },
            query: { type: "string", description: "Search query" }
          },
          required: ["indexId", "query"]
        }
      },
      {
        name: "leann_ask",
        description: "Ask a question (RAG) over a LEANN index",
        inputSchema: {
          type: "object",
          properties: {
            indexId: { type: "string", description: "Index ID" },
            question: { type: "string", description: "Question to ask" }
          },
          required: ["indexId", "question"]
        }
      }
    ]
  };
});

/**
 * Handler for LEANN tools.
 * - leann_list: Returns available indexes.
 * - leann_search: Performs semantic search (stub).
 * - leann_ask: Performs RAG Q&A (stub).
 * TODO: Integrate with LEANN API/CLI for real functionality.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "leann_list": {
      const leannIndexes = await getLeannIndexes();
      const indexList = Object.entries(leannIndexes || {}).map(([id, idx]) => {
        return { id, ...(typeof idx === "object" && idx !== null ? idx : {}) };
      });
      return {
        content: [{
          type: "json",
          json: indexList
        }]
      };
    }
    case "leann_search": {
      const { indexId, query } = request.params.arguments || {};
      // TODO: Call LEANN API/CLI for semantic search
      return {
        content: [{
          type: "text",
          text: `Search results for query "${query}" on index "${indexId}" (stub)`
        }]
      };
    }
    case "leann_ask": {
      const { indexId, question } = request.params.arguments || {};
      // TODO: Call LEANN API/CLI for RAG Q&A
      return {
        content: [{
          type: "text",
          text: `Answer to question "${question}" on index "${indexId}" (stub)`
        }]
      };
    }
    default:
      throw new Error("Unknown tool");
  }
});

/**
 * Handler that lists available prompts.
 * (Optional: Could expose a "summarize_index" prompt for LEANN.)
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "summarize_index",
        description: "Summarize the contents of a LEANN index"
      }
    ]
  };
});

/**
 * Handler for the summarize_index prompt.
 * Returns a prompt that requests summarization of a LEANN index (stub).
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name !== "summarize_index") {
    throw new Error("Unknown prompt");
  }

  // Example: List all indexes and include their metadata in the prompt
  const leannIndexes = await getLeannIndexes();
  const indexSummaries = Object.entries(leannIndexes || {}).map(
    ([id, idx]) => `Index ${id}: ${JSON.stringify(idx)}`
  ).join("\n");

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please summarize the contents of the following LEANN indexes:\n${indexSummaries}`
        }
      }
    ]
  };
});

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
