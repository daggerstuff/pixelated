import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

import { createLazyMcpClient } from '@/lib/context/optimization.js'

import { registerProcessShutdown } from './lib/process-shutdown.js'

const FORESIGHT_URL = process.env.FORESIGHT_URL ?? 'http://127.0.0.1:8764/sse'

/**
 * Lazy-loaded Foresight MCP client.
 *
 * The client is not created until the first tool call, keeping the session
 * agent's startup context small and avoiding an idle SSE connection when the
 * agent is not actively using Foresight.
 */
export const { getClient, close } = createLazyMcpClient<Client>(async () => {
  const transport = new SSEClientTransport(new URL(FORESIGHT_URL))
  const client = new Client(
    { name: 'session-agent', version: '1.0.0' },
    { capabilities: {} },
  )
  await client.connect(transport)
  return client
})

type ToolResultContent = Array<{ text?: string }>

function extractText(result: unknown): string {
  const r = result as { content?: unknown }
  const arr = (r.content ?? []) as ToolResultContent
  return arr.map((c) => c.text ?? '').join('')
}

export type MemoryStoreParams = {
  content: string
  category?: string
  scope?: string
  retention?: string
  importance?: number
  tags?: string[]
  session_id?: string
}

export async function storeMemory(
  params: MemoryStoreParams,
): Promise<{ memory_id: string } | null> {
  try {
    const c = await getClient()
    const result = await c.callTool({
      name: 'manage_memories',
      arguments: {
        action: 'store',
        content: params.content,
        options: {
          category: params.category ?? 'general',
          scope: params.scope ?? 'session',
          retention: params.retention ?? 'short_term',
          importance: params.importance ?? 0.5,
          tags: params.tags ?? [],
        },
      },
    })
    const text = extractText(result)
    const memoryId = text.match(/Stored memory (\S+)/i)?.[1] ?? null
    return memoryId ? { memory_id: memoryId } : null
  } catch (err) {
    console.error('[foresight-client] storeMemory failed:', err)
    return null
  }
}

export type SearchMemoryParams = {
  query: string
  limit?: number
  min_importance?: number
  tag_filter?: string[]
}

export async function searchMemories(
  params: SearchMemoryParams,
): Promise<{ content: string; memory_id?: string }[] | null> {
  try {
    const c = await getClient()
    const result = await c.callTool({
      name: 'search_memories',
      arguments: {
        query: params.query,
        options: {
          query_type: 'keyword',
          limit: params.limit ?? 10,
          min_importance: params.min_importance ?? 0.1,
        },
      },
    })
    const text = extractText(result)
    if (!text.trim() || text.includes('No memories found')) {
      return []
    }
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return parsed
      return [{ content: text }]
    } catch {
      return [{ content: text }]
    }
  } catch (err) {
    console.error('[foresight-client] searchMemories failed:', err)
    return null
  }
}

export async function getSystemStatus(): Promise<Record<
  string,
  unknown
> | null> {
  try {
    const c = await getClient()
    const result = await c.callTool({
      name: 'get_system_status',
      arguments: {},
    })
    const text = extractText(result)
    try {
      return JSON.parse(text)
    } catch {
      return { status: text }
    }
  } catch (err) {
    console.error('[foresight-client] getSystemStatus failed:', err)
    return null
  }
}

registerProcessShutdown(close)
