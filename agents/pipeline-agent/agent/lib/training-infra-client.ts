import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import { createLazyMcpClient } from './lazy-mcp-client.js'

const TRAINING_INFRA_URL =
  process.env.TRAINING_INFRA_MCP_URL ?? 'http://127.0.0.1:8766/mcp'

const { getClient } = createLazyMcpClient<Client>(async () => {
  const headers: Record<string, string> = {}
  const token = process.env.TRAINING_INFRA_MCP_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  const transport = new StreamableHTTPClientTransport(
    new URL(TRAINING_INFRA_URL),
    {
      requestInit: { headers },
    },
  )
  const client = new Client(
    { name: 'pipeline-agent', version: '1.0.0' },
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

export type PlanJobParams = {
  recipe: string
  inputs?: Record<string, unknown>
  overrides?: Record<string, unknown>
  requested_by?: string
}

export async function planTrainingJob(
  params: PlanJobParams,
): Promise<Record<string, unknown> | null> {
  try {
    const c = await getClient()
    const result = await c.callTool({
      name: 'plan_job',
      arguments: {
        recipe: params.recipe,
        inputs: params.inputs ?? {},
        overrides: params.overrides ?? {},
        requested_by: params.requested_by ?? 'pipeline-agent',
      },
    })
    return extractStructured(result)
  } catch (err) {
    console.error('[training-infra-client] planTrainingJob failed:', err)
    return null
  }
}

export async function submitTrainingJob(params: {
  plan_hash: string
  requested_by?: string
  idempotency_key?: string
}): Promise<Record<string, unknown> | null> {
  try {
    const c = await getClient()
    const result = await c.callTool({
      name: 'submit_job',
      arguments: {
        plan_hash: params.plan_hash,
        requested_by: params.requested_by ?? 'pipeline-agent',
        idempotency_key: params.idempotency_key,
      },
    })
    return extractStructured(result)
  } catch (err) {
    console.error('[training-infra-client] submitTrainingJob failed:', err)
    return null
  }
}

export async function getTrainingJob(
  jobId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const c = await getClient()
    const result = await c.callTool({
      name: 'get_job',
      arguments: { job_id: jobId },
    })
    const parsed = extractStructured(result)
    if (parsed && typeof parsed.job === 'object' && parsed.job !== null) {
      return parsed.job as Record<string, unknown>
    }
    return parsed
  } catch (err) {
    console.error('[training-infra-client] getTrainingJob failed:', err)
    return null
  }
}

export async function checkEvalGate(params: {
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
        // Omit rather than sending 0: the MCP then applies its operator policy
        // (TRAINING_MCP_GATE_MIN_DELTA / _MIN_PASS_RATE). Sending 0 would turn
        // the promotion gate into a rubber stamp for a caller that forgets to
        // set thresholds.
        ...(params.min_delta === undefined
          ? {}
          : { min_delta: params.min_delta }),
        ...(params.min_pass_rate === undefined
          ? {}
          : { min_pass_rate: params.min_pass_rate }),
      },
    })
    return extractStructured(result)
  } catch (err) {
    console.error('[training-infra-client] checkEvalGate failed:', err)
    return null
  }
}
