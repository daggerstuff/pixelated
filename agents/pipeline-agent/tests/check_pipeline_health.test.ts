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

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('TRAINING_INFRA_MCP_URL', 'http://training-infra.local')
  vi.stubEnv('K8S_MCP_URL', 'http://k8s.local')
  vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test')
  vi.stubEnv('LINEAR_AGENT_ACCESS_TOKEN', 'lin-test')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('check_pipeline_health tool', () => {
  it('reports healthy when Foresight returns a status with a checked_at', async () => {
    ;(getSystemStatus as any).mockResolvedValue({
      checked_at: new Date().toISOString(),
    })
    const result = await checkPipelineHealth.execute({}, ctx)
    expect(result.foresight).toBe('healthy')
    expect(result.training_infra).toBe('configured')
    expect(result.k8s).toBe('configured')
    expect(result.slack).toBe('configured')
    expect(result.linear).toBe('configured')
  })

  it('reports unreachable when Foresight returns null', async () => {
    ;(getSystemStatus as any).mockResolvedValue(null)
    const result = await checkPipelineHealth.execute({}, ctx)
    expect(result.foresight).toBe('unreachable')
  })
})
