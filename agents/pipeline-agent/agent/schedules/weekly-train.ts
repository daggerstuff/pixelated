import { defineSchedule } from 'eve/schedules'

import slack from '../channels/slack.js'
import { planTrainingJob } from '../lib/training-infra-client.js'

// P3.1 — weekly training trigger (Mondays 09:00 UTC).
//
// The schedule is deterministic where it can afford to be: it probes the
// training-infra MCP, resolves (plans) a curation job so the human sees an
// exact command + cost, then hands a Slack approval card to the pipeline
// channel. The agent session it starts pauses for the operator; only on
// approval does it submit the plan_hash. GPU spend never starts here.

const TRAINING_INFRA_URL =
  process.env.TRAINING_INFRA_MCP_URL ?? 'http://127.0.0.1:8766/mcp'
const APPROVAL_CHANNEL =
  process.env.SLACK_TRAINING_CHANNEL_ID ?? 'training-pipeline'

type PlanSummary = {
  recipe: string
  plan_hash: string | null
  command: string | null
  est_cost_usd: number | null
  warnings: string[]
}

async function probeHealth(): Promise<{ status: string; detail: unknown }> {
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
          clientInfo: { name: 'weekly-train', version: '1.0' },
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

async function planCuration(): Promise<PlanSummary | null> {
  const planned = await planTrainingJob({
    recipe: 'curate-sft-v30',
    inputs: {
      corpus: process.env.HACKATHON_ROOT ?? '/data/corpus/latest',
    },
    requested_by: 'schedule:weekly-train',
  })
  if (!planned || planned.ok !== true) return null
  return {
    recipe: 'curate-sft-v30',
    plan_hash: (planned.plan_hash as string) ?? null,
    command: (planned.command as string) ?? null,
    est_cost_usd:
      typeof planned.est_cost_usd === 'number' ? planned.est_cost_usd : null,
    warnings: (planned.warnings as string[]) ?? [],
  }
}

export default defineSchedule({
  cron: '0 9 * * 1',
  timezone: 'UTC',
  async run({ to, waitUntil, appAuth }) {
    const health = await probeHealth()
    const plan = health.status === 'healthy' ? await planCuration() : null

    const planBlock = plan
      ? [
          `Recipe: ${plan.recipe}`,
          `Plan hash: ${plan.plan_hash ?? '(none)'}`,
          `Command: ${plan.command ?? '(none)'}`,
          `Estimated cost: ${plan.est_cost_usd ?? 'unknown'} USD`,
          plan.warnings.length
            ? `Warnings: ${plan.warnings.join('; ')}`
            : 'Warnings: none',
        ].join('\n')
      : 'No plan was resolved (MCP unreachable or plan rejected); the run must NOT submit anything.'

    const approvalRequired = Boolean(plan?.plan_hash)
    const prompt = [
      'Weekly training pipeline preflight (schedule: weekly-train).',
      '',
      `Training-infra health: ${health.status}`,
      '',
      'Resolved curation plan:',
      planBlock,
      '',
      approvalRequired
        ? [
            'Post an approval card to the operator with the plan above and WAIT for',
            'an explicit approval. Do not spend GPU before approval. On approval,',
            'submit the job through the training-infra MCP using the plan hash',
            `above (submit_job with plan_hash=${plan?.plan_hash}), then continue the`,
            'pipeline (plan -> eval gate -> promotion). On decline, stop and record',
            'the outcome; submit nothing.',
          ].join(' ')
        : 'Report the failure to the operator and stop. Submit nothing.',
    ].join('\n')

    waitUntil(
      to(slack, { channelId: APPROVAL_CHANNEL }).send(prompt, {
        auth: appAuth,
      }),
    )
  },
})
