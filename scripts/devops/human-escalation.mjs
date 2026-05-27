#!/usr/bin/env node
import process from 'node:process'
import { readFile } from 'node:fs/promises'

const TRIGGER_LABELS = new Map([
  ['conflict_after_rebase_attempt', 'Conflict after rebase attempt'],
  ['conflict_after_rebase', 'Conflict after rebase attempt'],
  ['rebase_conflict', 'Conflict after rebase attempt'],
  ['test_failure_after_fix', 'Test failure after fix'],
  ['low_confidence_fix', 'Low-confidence fix (<40%)'],
  ['llm_timeout_after_retries', 'LLM timeout after retries'],
  ['timeout_after_retries', 'LLM timeout after retries'],
  ['rate_limit_reached', 'Rate limit reached'],
  ['rate_limit', 'Rate limit reached'],
  ['workflow_failure', 'Workflow failure'],
])

function firstValue(...values) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim()
}

function humanizeTrigger(trigger) {
  const normalized = firstValue(trigger, 'workflow_failure')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (TRIGGER_LABELS.has(normalized)) {
    return TRIGGER_LABELS.get(normalized)
  }

  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatConfidence(confidence) {
  const value = firstValue(String(confidence ?? ''))
  if (!value) {
    return undefined
  }

  if (value.endsWith('%')) {
    return value
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return value
  }

  if (numeric > 0 && numeric <= 1) {
    return `${Math.round(numeric * 100)}%`
  }

  return `${numeric}%`
}

function buildRunUrl(env) {
  const explicit = firstValue(env.ESCALATION_RUN_URL, env.INPUT_RUN_URL)
  if (explicit) {
    return explicit
  }

  const serverUrl = firstValue(env.GITHUB_SERVER_URL, 'https://github.com')
  const repo = firstValue(env.GITHUB_REPOSITORY)
  const runId = firstValue(env.GITHUB_RUN_ID)
  if (!repo || !runId) {
    return undefined
  }

  return `${serverUrl}/${repo}/actions/runs/${runId}`
}

function addOptionalLine(lines, label, value) {
  if (value) {
    lines.push(`**${label}:** ${value}`)
  }
}

export function buildEscalationBody({
  trigger,
  whatWasTried,
  failureReason,
  nextSteps,
  confidence,
  runUrl,
  targetNumber,
  repo,
} = {}) {
  const confidenceText = formatConfidence(confidence)
  const targetText = repo && targetNumber ? `${repo}#${targetNumber}` : undefined

  const lines = ['### Human Escalation Required', '']
  addOptionalLine(lines, 'Trigger', humanizeTrigger(trigger))
  addOptionalLine(lines, 'Target', targetText)
  addOptionalLine(lines, 'Workflow run', runUrl)
  addOptionalLine(lines, 'Confidence', confidenceText)
  lines.push(
    '',
    '#### What was tried',
    firstValue(whatWasTried) ?? 'No attempt summary was provided.',
    '',
    '#### Why it failed',
    firstValue(failureReason) ?? 'The automation could not resolve the task without human review.',
    '',
    '#### Human next step',
    firstValue(nextSteps) ?? 'Review the workflow logs, decide the correct remediation, and resume manually.',
  )

  return lines.join('\n')
}

function parseInteger(value) {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function issueNumberFromPayload(eventPayload) {
  return (
    parseInteger(eventPayload?.pull_request?.number) ??
    parseInteger(eventPayload?.issue?.number) ??
    parseInteger(eventPayload?.workflow_run?.pull_requests?.[0]?.number)
  )
}

export function resolveGithubCommentTarget({ env = process.env, eventPayload = {} } = {}) {
  const repository = firstValue(env.ESCALATION_GITHUB_REPOSITORY, env.GITHUB_REPOSITORY)
  if (!repository || !repository.includes('/')) {
    return undefined
  }

  const [owner, repo] = repository.split('/', 2)
  const targetNumber =
    parseInteger(
      firstValue(
        env.ESCALATION_TARGET_NUMBER,
        env.ESCALATION_PR_NUMBER,
        env.GITHUB_PR_NUMBER,
        env.PR_NUMBER,
        env.ISSUE_NUMBER,
      ),
    ) ?? issueNumberFromPayload(eventPayload)

  if (!owner || !repo || !targetNumber) {
    return undefined
  }

  return { owner, repo, targetNumber }
}

async function requestJson(fetchImpl, url, init) {
  const response = await fetchImpl(url, init)
  const text = await response.text()
  let payload = {}

  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { raw: text }
    }
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${text}`.trim())
  }

  return payload
}

async function postGithubComment({ env, eventPayload, fetchImpl, body }) {
  const token = firstValue(env.ESCALATION_GITHUB_TOKEN, env.GITHUB_TOKEN)
  if (!token) {
    return { skipped: true }
  }

  const target = resolveGithubCommentTarget({ env, eventPayload })
  if (!target) {
    throw new Error('GitHub token is configured, but no PR or issue target could be resolved.')
  }

  const url = `https://api.github.com/repos/${target.owner}/${target.repo}/issues/${target.targetNumber}/comments`
  const payload = await requestJson(fetchImpl, url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ body }),
  })

  return { skipped: false, payload }
}

async function postSlackNotification({ env, fetchImpl, body }) {
  const webhookUrl = firstValue(env.ESCALATION_SLACK_WEBHOOK_URL, env.SLACK_WEBHOOK_URL)
  if (!webhookUrl) {
    return { skipped: true }
  }

  const payload = await requestJson(fetchImpl, webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: body }),
  })

  return { skipped: false, payload }
}

async function createLinearIssue({ env, fetchImpl, body, trigger }) {
  const apiKey = firstValue(env.ESCALATION_LINEAR_API_KEY, env.LINEAR_API_KEY)
  const teamId = firstValue(env.ESCALATION_LINEAR_TEAM_ID, env.LINEAR_TEAM_ID)
  if (!apiKey && !teamId) {
    return { skipped: true }
  }
  if (!apiKey || !teamId) {
    throw new Error('Linear escalation requires both LINEAR_API_KEY and LINEAR_TEAM_ID.')
  }

  const title = firstValue(env.ESCALATION_LINEAR_TITLE) ?? `Human escalation: ${humanizeTrigger(trigger)}`
  const mutation = `
    mutation CreateEscalationIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          identifier
          url
        }
      }
    }
  `

  const payload = await requestJson(fetchImpl, 'https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          teamId,
          title,
          description: body,
        },
      },
    }),
  })

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '))
  }
  if (!payload.data?.issueCreate?.success || !payload.data?.issueCreate?.issue) {
    throw new Error('Linear issueCreate did not succeed.')
  }

  return { skipped: false, payload }
}

export async function runEscalation({
  env = process.env,
  eventPayload = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required for escalation delivery.')
  }

  const target = resolveGithubCommentTarget({ env, eventPayload })
  const repo = firstValue(env.GITHUB_REPOSITORY, env.ESCALATION_GITHUB_REPOSITORY)
  const trigger = firstValue(env.ESCALATION_TRIGGER, env.INPUT_TRIGGER, 'workflow_failure')
  const body = buildEscalationBody({
    trigger,
    whatWasTried: firstValue(env.ESCALATION_WHAT_WAS_TRIED, env.INPUT_WHAT_WAS_TRIED),
    failureReason: firstValue(env.ESCALATION_FAILURE_REASON, env.INPUT_FAILURE_REASON),
    nextSteps: firstValue(env.ESCALATION_NEXT_STEPS, env.INPUT_NEXT_STEPS),
    confidence: firstValue(env.ESCALATION_CONFIDENCE, env.INPUT_CONFIDENCE),
    runUrl: buildRunUrl(env),
    targetNumber: target?.targetNumber,
    repo,
  })

  const result = {
    body,
    delivered: false,
    destinations: [],
    errors: [],
  }

  const deliveries = [
    ['github', () => postGithubComment({ env, eventPayload, fetchImpl, body })],
    ['slack', () => postSlackNotification({ env, fetchImpl, body })],
    ['linear', () => createLinearIssue({ env, fetchImpl, body, trigger })],
  ]

  for (const [name, deliver] of deliveries) {
    try {
      const delivery = await deliver()
      if (!delivery.skipped) {
        result.destinations.push(name)
        result.delivered = true
      }
    } catch (error) {
      result.errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return result
}

async function loadGithubEventPayload(env) {
  const eventPath = firstValue(env.GITHUB_EVENT_PATH)
  if (!eventPath) {
    return {}
  }

  try {
    return JSON.parse(await readFile(eventPath, 'utf8'))
  } catch (error) {
    console.warn(`::warning::Could not read GitHub event payload: ${error.message}`)
    return {}
  }
}

function truthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase())
}

async function main() {
  const eventPayload = await loadGithubEventPayload(process.env)
  const result = await runEscalation({ env: process.env, eventPayload })

  console.log(result.body)
  if (result.destinations.length > 0) {
    console.log(`Escalation delivered to: ${result.destinations.join(', ')}`)
  } else {
    console.warn('::warning::Escalation was not delivered to any destination.')
  }

  for (const error of result.errors) {
    console.warn(`::warning::Escalation delivery failed for ${error}`)
  }

  if (
    truthy(process.env.ESCALATION_REQUIRE_DELIVERY) ||
    truthy(process.env.INPUT_FAIL_ON_UNDELIVERED)
  ) {
    process.exitCode = result.delivered ? 0 : 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
