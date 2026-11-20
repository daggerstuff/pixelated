import { defineSchedule } from 'eve/schedules'

import slack from '../channels/slack.js'
import {
  listTrainingRecipes,
  probeTrainingInfra,
} from '../lib/training-infra-client.js'

// P3.3 — weekly recipe-registry review (Mondays 09:30 UTC).
//
// The pipeline-agent's `weekly-train` schedule owns the training trigger; the
// advisor owns *recipe hygiene*. This schedule never trains and never writes
// `recipes.yaml`. It reports the registry state to the operator and, when the
// registry looks unhealthy (unreachable MCP, empty registry, or a recipe whose
// GPU flavour is not single-GPU), tells the session to propose a corrected
// recipe through the reviewed-PR workflow instead of editing the file.

const REVIEW_CHANNEL =
  process.env.SLACK_TRAINING_CHANNEL_ID ?? 'training-pipeline'

// Mirrors the enforcement in `ai/training/mcp/recipes.py::_multi_node_errors`
// (see docs/MULTI_NODE_DECISION.md). If the MCP ever relaxes that rule, this
// detector is the thing that will start reporting healthy multi-GPU recipes as
// suspicious — so it is deliberately conservative and read-only.
function multiGpuReason(recipe: Record<string, unknown>): string | null {
  if (recipe.multi_node === true) return 'multi_node=true'
  for (const key of ['nodes', 'num_nodes', 'world_size']) {
    const value = recipe[key]
    if (typeof value === 'number' && value > 1) return `${key}=${value}`
  }
  const gpu = String(recipe.gpu ?? '').toLowerCase()
  if (!gpu) return null
  if (gpu.includes('multi')) return `gpu=${gpu}`
  const match = /(?:^|-)(\d+)-gpu$/.exec(gpu)
  if (match && Number(match[1]) > 1) return `gpu=${gpu}`
  return null
}

export default defineSchedule({
  cron: '30 9 * * 1',
  timezone: 'UTC',
  async run({ to, waitUntil, appAuth }) {
    const health = await probeTrainingInfra()
    const recipes =
      health.status === 'healthy' ? await listTrainingRecipes() : []

    const lines = recipes.map((r) => {
      const id = String(r.id ?? 'unknown')
      const gpu = String(r.gpu ?? 'none')
      const cost = String(r.cost_class ?? 'unknown')
      return `- ${id} (kind=${String(r.kind ?? '?')}, backend=${String(r.backend ?? '?')}, gpu=${gpu}, cost=${cost})`
    })

    const suspect = recipes
      .map((r) => ({
        id: String(r.id ?? 'unknown'),
        reason: multiGpuReason(r),
      }))
      .filter((r): r is { id: string; reason: string } => r.reason !== null)
      .map((r) => `${r.id} (${r.reason})`)

    const problems: string[] = []
    if (health.status !== 'healthy')
      problems.push(`MCP health is ${health.status}`)
    if (!recipes.length) problems.push('recipe registry returned no recipes')
    if (suspect.length)
      problems.push(
        `recipes violating the single-GPU rule: ${suspect.join(', ')}`,
      )

    const prompt = [
      'Weekly recipe-registry review (schedule: weekly-recipe-review).',
      '',
      `Training-infra health: ${health.status}`,
      `Recipes registered: ${recipes.length}`,
      lines.length ? lines.join('\n') : '(none)',
      '',
      problems.length
        ? [
            'Registry problems found:',
            ...problems.map((p) => `- ${p}`),
            '',
            'Do NOT edit recipes.yaml. For each problem, draft a corrected recipe',
            'entry and call validate_recipe on the training-infra MCP; if it returns',
            'valid=true, open a pull request against ai/training/mcp/recipes.yaml and',
            'post the diff link to the operator for review. Record your findings in',
            'Foresight. If validation fails, report the errors and propose nothing.',
          ].join('\n')
        : [
            'No registry problems detected. Report the registry summary to the',
            'operator. Do not open a PR and do not submit any job; the pipeline',
            'schedule owns training.',
          ].join('\n'),
    ].join('\n')

    waitUntil(
      to(slack, { channelId: REVIEW_CHANNEL }).send(prompt, { auth: appAuth }),
    )
  },
})
