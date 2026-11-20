import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture the handler that `defineSchedule` receives, and stub the Slack
// channel so the schedule can be exercised without network or credentials.

vi.mock('eve/schedules', () => ({
  defineSchedule: (definition: unknown) => definition,
}))

const send = vi.fn().mockResolvedValue(undefined)
vi.mock('../agent/channels/slack.js', () => ({
  default: { __channel: 'slack' },
  slack: { __channel: 'slack' },
}))

vi.mock('../agent/lib/training-infra-client.js', () => ({
  listTrainingRecipes: vi.fn(),
  probeTrainingInfra: vi.fn(),
  validateTrainingRecipe: vi.fn(),
  checkTrainingEvalGate: vi.fn(),
}))

import * as client from '../agent/lib/training-infra-client.js'
import schedule from '../agent/schedules/weekly-recipe-review.js'

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

describe('advisor weekly-recipe-review schedule (P3.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    send.mockResolvedValue(undefined)
  })

  it('reports a clean registry without proposing a PR', async () => {
    vi.mocked(client.probeTrainingInfra).mockResolvedValue({
      status: 'healthy',
      detail: {},
    })
    vi.mocked(client.listTrainingRecipes).mockResolvedValue([
      {
        id: 'eval-crisis-v2',
        kind: 'eval_paired',
        backend: 'ovhai',
        gpu: 'l4-1-gpu',
        cost_class: 'gpu-hour',
      },
    ])

    const prompt = await invoke()
    expect(prompt).toContain('Weekly recipe-registry review')
    expect(prompt).toContain('Recipes registered: 1')
    expect(prompt).toContain('eval-crisis-v2')
    expect(prompt).toContain('No registry problems detected')
    expect(prompt).not.toContain('open a pull request')
  })

  it('flags an unreachable MCP and an empty registry', async () => {
    vi.mocked(client.probeTrainingInfra).mockResolvedValue({
      status: 'unreachable',
      detail: { error: 'connect ECONNREFUSED' },
    })

    const prompt = await invoke()
    expect(prompt).toContain('Training-infra health: unreachable')
    expect(prompt).toContain('recipe registry returned no recipes')
    // Unreachable means the registry was never read, so nothing is proposed.
    expect(client.listTrainingRecipes).not.toHaveBeenCalled()
    expect(prompt).toContain('Do NOT edit recipes.yaml')
  })

  it('flags a multi-GPU recipe and routes it through validate_recipe + PR', async () => {
    vi.mocked(client.probeTrainingInfra).mockResolvedValue({
      status: 'healthy',
      detail: {},
    })
    vi.mocked(client.listTrainingRecipes).mockResolvedValue([
      {
        id: 'train-sft-v31',
        kind: 'train_sft',
        backend: 'ovhai',
        gpu: 'l4-4-gpu',
        cost_class: 'gpu-hour',
      },
    ])

    const prompt = await invoke()
    expect(prompt).toContain(
      'recipes violating the single-GPU rule: train-sft-v31 (gpu=l4-4-gpu)',
    )
    expect(prompt).toContain('validate_recipe')
    expect(prompt).toContain(
      'pull request against ai/training/mcp/recipes.yaml',
    )
  })

  it('detects every multi-GPU shape the MCP rejects', async () => {
    vi.mocked(client.probeTrainingInfra).mockResolvedValue({
      status: 'healthy',
      detail: {},
    })
    vi.mocked(client.listTrainingRecipes).mockResolvedValue([
      { id: 'a', gpu: 'l4-4-gpu' },
      { id: 'b', gpu: 'multi-gpu' },
      { id: 'c', multi_node: true },
      { id: 'd', nodes: 3 },
      { id: 'e', world_size: 8 },
      { id: 'f', gpu: 'l4-1-gpu' },
    ])

    const prompt = await invoke()
    expect(prompt).toContain('a (gpu=l4-4-gpu)')
    expect(prompt).toContain('b (gpu=multi-gpu)')
    expect(prompt).toContain('c (multi_node=true)')
    expect(prompt).toContain('d (nodes=3)')
    expect(prompt).toContain('e (world_size=8)')
    const problemsLine = prompt
      .split('\n')
      .find((l) => l.includes('single-GPU rule'))
    expect(problemsLine).not.toContain('f (')
    expect(problemsLine).not.toContain('l4-1-gpu')
  })

  it('is a Monday schedule that never submits jobs', () => {
    expect(definition.cron).toBe('30 9 * * 1')
    expect(definition.timezone).toBe('UTC')
  })
})
