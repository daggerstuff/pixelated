import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture the handler `defineSchedule` receives and stub the Slack channel so
// the weekly training trigger can be exercised without network or creds.

vi.mock('eve/schedules', () => ({
  defineSchedule: (definition: unknown) => definition,
}))

const send = vi.fn().mockResolvedValue(undefined)
vi.mock('../agent/channels/slack.js', () => ({
  default: { __channel: 'slack' },
  slack: { __channel: 'slack' },
}))

vi.mock('../agent/lib/training-infra-client.js', () => ({
  planTrainingJob: vi.fn(),
}))

import { planTrainingJob } from '../agent/lib/training-infra-client.js'
import schedule from '../agent/schedules/weekly-train.js'

type Definition = {
  cron: string
  timezone?: string
  run: (args: {
    to: (channel: unknown, target: unknown) => { send: typeof send }
    waitUntil: (task: Promise<unknown>) => void
    appAuth: unknown
  }) => Promise<void>
}

const definition = schedule as unknown as Definition

const HEALTHY_SSE =
  'event: message\ndata: ' +
  JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    result: { structuredContent: { healthy: true, phase: 3 } },
  }) +
  '\n\n'

function stubFetch(healthy: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string }
      if (body.method === 'initialize') {
        if (!healthy) return new Response('', { status: 503 })
        return new Response('', {
          status: 200,
          headers: { 'mcp-session-id': 'test-session' },
        })
      }
      return new Response(HEALTHY_SSE, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
    }),
  )
}

async function invoke() {
  const pending: Array<Promise<unknown>> = []
  await definition.run({
    to: () => ({ send }),
    waitUntil: (task) => pending.push(task),
    appAuth: { authenticator: 'app' },
  })
  await Promise.all(pending)
  return String(send.mock.calls.at(-1)?.[0] ?? '')
}

describe('pipeline weekly-train schedule (P3.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    send.mockResolvedValue(undefined)
    vi.mocked(planTrainingJob).mockResolvedValue({
      ok: true,
      plan_hash: 'plan-curate-9',
      command: 'python -m training.build_agent_tool_sft_v30',
      est_cost_usd: 0,
      warnings: ['corpus path not verified'],
    })
  })

  it('is a Monday 09:00 UTC schedule', () => {
    expect(definition.cron).toBe('0 9 * * 1')
    expect(definition.timezone).toBe('UTC')
  })

  it('plans curation and asks for approval without submitting', async () => {
    stubFetch(true)
    const prompt = await invoke()

    expect(planTrainingJob).toHaveBeenCalledWith(
      expect.objectContaining({ recipe: 'curate-sft-v30' }),
    )
    expect(prompt).toContain('Training-infra health: healthy')
    expect(prompt).toContain('Plan hash: plan-curate-9')
    expect(prompt).toContain('Estimated cost: 0 USD')
    expect(prompt).toContain('corpus path not verified')
    expect(prompt).toContain('WAIT')
    // The schedule must never submit on its own; submission is the session's
    // job and only after approval.
    expect(prompt).not.toContain('submit_job(')
  })

  it('submits nothing when the MCP is unreachable', async () => {
    stubFetch(false)
    const prompt = await invoke()

    expect(prompt).toContain('Training-infra health: unreachable')
    expect(prompt).toContain('Submit nothing')
    expect(planTrainingJob).not.toHaveBeenCalled()
  })

  it('submits nothing when planning is rejected', async () => {
    stubFetch(true)
    vi.mocked(planTrainingJob).mockResolvedValueOnce(null)
    const prompt = await invoke()

    expect(prompt).toContain('the run must NOT submit anything')
    expect(prompt).toContain('Submit nothing')
  })
})
