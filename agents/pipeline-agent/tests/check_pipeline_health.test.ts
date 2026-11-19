import type { ToolContext } from 'eve/tools'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getSystemStatus } from '../agent/foresight-client.js'
import checkPipelineHealth from '../agent/tools/check_pipeline_health.js'

vi.mock('../agent/foresight-client.js', () => ({
  searchMemories: vi.fn(),
  storeMemory: vi.fn(),
  getSystemStatus: vi.fn(),
}))

const ctx = {} as ToolContext

function mockMcpFetch(healthy: boolean) {
  const sessionId = 'test-session'
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      const payload = JSON.parse(init?.body as string) as { method?: string }
      const isCall = payload.method === 'tools/call'
      const body = isCall
        ? `data: ${JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            result: {
              structuredContent: {
                service: 'pixelated-training-infra',
                healthy,
                checks: {},
              },
            },
          })}\n\n`
        : `data: ${JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { serverInfo: { name: 'pixelated-training-infra' } },
          })}\n\n`
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'mcp-session-id': sessionId,
        },
      })
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('TRAINING_INFRA_MCP_URL', 'http://training-infra.local/mcp')
  vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test')
  vi.stubEnv('LINEAR_AGENT_ACCESS_TOKEN', 'lin-test')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('check_pipeline_health tool', () => {
  it('reports healthy when Foresight returns a status with a checked_at', async () => {
    ;(getSystemStatus as any).mockResolvedValue({
      checked_at: new Date().toISOString(),
    })
    mockMcpFetch(true)
    const result = await checkPipelineHealth.execute({}, ctx)
    expect(result.foresight).toBe('healthy')
    expect(result.training_infra).toBe('healthy')
    expect(result.slack).toBe('configured')
    expect(result.linear).toBe('configured')
  })

  it('reports unreachable when Foresight returns null', async () => {
    ;(getSystemStatus as any).mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('conn refused')))
    const result = await checkPipelineHealth.execute({}, ctx)
    expect(result.foresight).toBe('unreachable')
    expect(result.training_infra).toBe('unreachable')
  })

  it('reports degraded when the MCP health tool reports unhealthy', async () => {
    ;(getSystemStatus as any).mockResolvedValue({
      checked_at: new Date().toISOString(),
    })
    mockMcpFetch(false)
    const result = await checkPipelineHealth.execute({}, ctx)
    expect(result.training_infra).toBe('degraded')
  })
})
