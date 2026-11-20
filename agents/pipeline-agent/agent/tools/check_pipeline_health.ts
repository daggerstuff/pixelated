import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { getSystemStatus } from '../foresight-client.js'

// Health check for the pipeline infrastructure. Probes the training-infra
// MCP `health` tool live (initialize → tools/call over streamable-http) and
// reports Foresight/Slack/Linear configuration presence. NON-GATING.

const TRAINING_INFRA_URL =
  process.env.TRAINING_INFRA_MCP_URL ?? 'http://127.0.0.1:8766/mcp'

async function probeTrainingInfra(): Promise<
  | { status: 'healthy' | 'degraded'; detail: Record<string, unknown> }
  | { status: 'unreachable'; detail: { error: string } }
> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  }
  const token = process.env.TRAINING_INFRA_MCP_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  const post = async (payload: unknown, sessionId?: string) => {
    const res = await fetch(TRAINING_INFRA_URL, {
      method: 'POST',
      headers: sessionId
        ? { ...headers, 'mcp-session-id': sessionId }
        : headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    })
    const sid = res.headers.get('mcp-session-id') ?? sessionId
    const text = await res.text()
    let parsed: unknown = null
    for (const line of text.split('\n').reverse()) {
      if (line.startsWith('data:')) {
        try {
          parsed = JSON.parse(line.slice(5).trim())
        } catch {
          parsed = null
        }
        break
      }
    }
    if (parsed === null && text.trim()) {
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = null
      }
    }
    return { sid, parsed, ok: res.ok }
  }

  try {
    const init = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'pipeline-agent-health', version: '1.0' },
      },
    })
    if (!init.ok || !init.sid)
      return { status: 'unreachable', detail: { error: 'initialize failed' } }
    await post(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      init.sid,
    )
    const call = await post(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'health', arguments: {} },
      },
      init.sid,
    )
    const content = (
      call.parsed as { result?: { structuredContent?: unknown } }
    )?.result?.structuredContent
    if (
      typeof content === 'object' &&
      content !== null &&
      'healthy' in content
    ) {
      return {
        status: (content as { healthy: boolean }).healthy
          ? 'healthy'
          : 'degraded',
        detail: content as Record<string, unknown>,
      }
    }
    return {
      status: 'degraded',
      detail: { error: 'unexpected health response' },
    }
  } catch (error) {
    return {
      status: 'unreachable',
      detail: { error: error instanceof Error ? error.message : String(error) },
    }
  }
}

export default defineTool({
  description:
    'Preflight the pipeline infrastructure. Live-probes the training-infra ' +
    'MCP health tool and reports Foresight reachability plus Slack/Linear ' +
    'configuration presence. Non-gating.',
  inputSchema: z.object({}),
  async execute() {
    const status = await getSystemStatus()

    let foresight: string
    if (status === null) {
      foresight = 'unreachable'
    } else if (
      typeof status === 'object' &&
      'checked_at' in status &&
      typeof status.checked_at === 'string' &&
      !isNaN(new Date(status.checked_at).getTime())
    ) {
      foresight = 'healthy'
    } else {
      foresight = 'degraded'
    }

    const trainingInfra = await probeTrainingInfra()
    const slack = process.env.SLACK_BOT_TOKEN ? 'configured' : 'not_configured'
    const linear = process.env.LINEAR_AGENT_ACCESS_TOKEN
      ? 'configured'
      : 'not_configured'

    return {
      training_infra: trainingInfra.status,
      training_infra_detail: trainingInfra.detail,
      foresight,
      slack,
      linear,
      gating: false,
      probe_mode: 'live_mcp_health',
      note:
        'training_infra is a live probe of the MCP health tool; other ' +
        'statuses reflect env configuration presence. Non-gating.',
      checked_at: new Date().toISOString(),
    }
  },
})
