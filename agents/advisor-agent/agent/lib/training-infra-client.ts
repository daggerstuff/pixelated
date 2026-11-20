import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import { createLazyMcpClient } from './lazy-mcp-client.js'

// Read-only training-infra MCP access for the advisor.
//
// The advisor is critique-only: it may inspect the recipe registry, validate a
// draft recipe, and read eval-gate verdicts. It must never submit or cancel a
// job, so only read tools are exposed here.

const TRAINING_INFRA_URL =
  process.env.TRAINING_INFRA_MCP_URL ?? 'http://127.0.0.1:8766/mcp'

const { getClient } = createLazyMcpClient<Client>(async () => {
  const headers: Record<string, string> = {}
  const token = process.env.TRAINING_INFRA_MCP_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  const transport = new StreamableHTTPClientTransport(
    new URL(TRAINING_INFRA_URL),
    { requestInit: { headers } },
  )
  const client = new Client(
    { name: 'advisor-agent', version: '1.0.0' },
    { capabilities: {} },
  )
  await client.connect(transport)
  return client
})

function extractStructured(result: unknown): Record<string, unknown> | null {
  const r = result as { structuredContent?: unknown; content?: unknown }
  if (r.structuredContent && typeof r.structuredContent === 'object') {
    return r.structuredContent as Record<string, unknown>
  }
  const arr = (r.content ?? []) as Array<{ text?: string }>
  const text = arr
    .map((c) => c.text ?? '')
    .join('')
    .trim()
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object')
      return parsed as Record<string, unknown>
    return null
  } catch {
    return null
  }
}

export async function listTrainingRecipes(): Promise<
  Array<Record<string, unknown>>
> {
  try {
    const c = await getClient()
    const result = await c.callTool({ name: 'list_recipes', arguments: {} })
    const parsed = extractStructured(result)
    const recipes = parsed?.recipes
    return Array.isArray(recipes)
      ? (recipes as Array<Record<string, unknown>>)
      : []
  } catch (err) {
    console.error('[advisor training-infra] listTrainingRecipes failed:', err)
    return []
  }
}

export async function validateTrainingRecipe(
  entry: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  try {
    const c = await getClient()
    const result = await c.callTool({
      name: 'validate_recipe',
      arguments: { entry },
    })
    return extractStructured(result)
  } catch (err) {
    console.error(
      '[advisor training-infra] validateTrainingRecipe failed:',
      err,
    )
    return null
  }
}

export async function checkTrainingEvalGate(params: {
  tag: string
  min_delta?: number
  min_pass_rate?: number
}): Promise<Record<string, unknown> | null> {
  try {
    const c = await getClient()
    const result = await c.callTool({
      name: 'eval_gate',
      arguments: {
        tag: params.tag,
        min_delta: params.min_delta ?? 0,
        min_pass_rate: params.min_pass_rate ?? 0,
      },
    })
    return extractStructured(result)
  } catch (err) {
    console.error('[advisor training-infra] checkTrainingEvalGate failed:', err)
    return null
  }
}

export async function probeTrainingInfra(): Promise<{
  status: string
  detail: unknown
}> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  }
  const token = process.env.TRAINING_INFRA_MCP_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const init = await fetch(TRAINING_INFRA_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'advisor-recipe-review', version: '1.0' },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const sid = init.headers.get('mcp-session-id')
    if (!init.ok || !sid)
      return { status: 'unreachable', detail: { stage: 'initialize' } }
    const call = await fetch(TRAINING_INFRA_URL, {
      method: 'POST',
      headers: { ...headers, 'mcp-session-id': sid },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'health', arguments: {} },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const text = await call.text()
    const line = text
      .split('\n')
      .reverse()
      .find((l) => l.startsWith('data:'))
    const parsed = line ? JSON.parse(line.slice(5).trim()) : JSON.parse(text)
    const content = parsed?.result?.structuredContent
    return {
      status: content?.healthy ? 'healthy' : 'degraded',
      detail: content ?? parsed,
    }
  } catch (error) {
    return {
      status: 'unreachable',
      detail: { error: error instanceof Error ? error.message : String(error) },
    }
  }
}
