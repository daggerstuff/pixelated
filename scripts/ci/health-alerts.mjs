#!/usr/bin/env node
/**
 * Production health alerts with severity-routed escalation.
 *
 * The Monitoring workflow probes the live site every 6 hours. This script
 * owns classification and routing:
 *
 *   CRITICAL — a required endpoint is down or errors. Pages the on-call
 *              channel (@here in Slack) and fails the run so the red X
 *              is visible on the Actions tab.
 *   HIGH     — an endpoint responds but blows its latency budget, or a
 *              secondary route errors. Posts to Slack (no page).
 *   WARN     — degradations inside budget. Step summary only.
 *
 * Routing is configured per-endpoint so new surfaces register their own
 * severity, budgets, and ownership in one place.
 *
 * Usage:
 *   node scripts/ci/health-alerts.mjs                       # probe + alert
 *   SLACK_WEBHOOK_URL=… node scripts/ci/health-alerts.mjs   # with routing
 *   node scripts/ci/health-alerts.mjs --base-url http://…    # other target
 *
 * Exit codes: 0 = healthy, 1 = CRITICAL or HIGH findings.
 */

const BASE_URL = (() => {
  const flag = process.argv.indexOf('--base-url')
  if (flag !== -1 && process.argv[flag + 1]) return process.argv[flag + 1].replace(/\/$/, '')
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '')
  return 'https://pixelatedempathy.com'
})()

const TIMEOUT_MS = 15_000

/**
 * Routing table. owner names the owning surface so the alert text tells the
 * responder where to look — alert routing without ownership is noise.
 * severity: a failing probe escalates to its configured severity; latency
 * breaches degrade one level (CRITICAL → HIGH) because the surface answers.
 */
const ROUTES = [
  {
    name: 'health',
    path: '/health',
    expectedStatus: 200,
    severity: 'CRITICAL',
    latencyBudgetMs: 2000,
    owner: 'platform',
  },
  {
    name: 'home',
    path: '/',
    expectedStatus: 200,
    severity: 'CRITICAL',
    latencyBudgetMs: 5000,
    owner: 'web',
  },
  {
    name: 'login',
    path: '/login',
    expectedStatus: 200,
    severity: 'HIGH',
    latencyBudgetMs: 5000,
    owner: 'auth',
  },
  {
    name: 'docs',
    path: '/docs',
    expectedStatus: 301,
    severity: 'HIGH',
    latencyBudgetMs: 5000,
    owner: 'web',
  },
]

/** @typedef {{route: object, kind: 'down'|'status'|'latency', got: number, ms: number}} Finding */

async function probe(route) {
  const started = Date.now()
  try {
    const res = await fetch(`${BASE_URL}${route.path}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const ms = Date.now() - started
    /** @type {Finding[]} */
    const findings = []
    if (res.status !== route.expectedStatus) {
      findings.push({ route, kind: 'status', got: res.status, ms })
    } else if (ms > route.latencyBudgetMs) {
      findings.push({ route, kind: 'latency', got: res.status, ms })
    }
    return { status: res.status, ms, findings }
  } catch (err) {
    const ms = Date.now() - started
    return {
      status: 0,
      ms,
      findings: [{ route, kind: 'down', got: 0, ms }],
      error: String(err?.cause?.code ?? err?.message ?? err),
    }
  }
}

function severityOf(finding) {
  if (finding.kind === 'down') return finding.route.severity
  if (finding.kind === 'status') return finding.route.severity
  // Latency breach: the surface answers, so degrade one level.
  if (finding.route.severity === 'CRITICAL') return 'HIGH'
  return 'WARN'
}

function describe(finding) {
  const { route, kind, got, ms } = finding
  const where = `${BASE_URL}${route.path} (${route.name}, owner: ${route.owner})`
  if (kind === 'down') return `${where} is unreachable — request failed after ${ms}ms`
  if (kind === 'status') return `${where} returned ${got}, expected ${route.expectedStatus} (${ms}ms)`
  return `${where} answered in ${ms}ms, over its ${route.latencyBudgetMs}ms budget`
}

function slackMessage(severities, findings) {
  const critical = severities.CRITICAL ?? 0
  const high = severities.HIGH ?? 0
  const warn = severities.WARN ?? 0
  const attention = critical > 0 ? '<!here> ' : ''
  const lines = findings
    .slice()
    .sort((a, b) => ['CRITICAL', 'HIGH', 'WARN'].indexOf(severityOf(a)) - ['CRITICAL', 'HIGH', 'WARN'].indexOf(severityOf(b)))
    .map((f) => `• [${severityOf(f)}] ${describe(f)}`)
  return {
    text: `${attention}🚨 Health alert: ${critical} CRITICAL, ${high} HIGH, ${warn} WARN`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${attention}🚨 *Health alert* — ${critical} CRITICAL, ${high} HIGH, ${warn} WARN\n${lines.join('\n')}`,
        },
      },
    ],
  }
}

async function postToSlack(payload) {
  const webhook = process.env.SLACK_WEBHOOK_URL
  if (!webhook) {
    console.log('SLACK_WEBHOOK_URL not set — Slack routing skipped.')
    return false
  }
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    console.error(`Slack webhook returned ${res.status} — alert delivery failed.`)
    return false
  }
  return true
}

async function main() {
  console.log(`Probing ${BASE_URL} …`)
  const results = []
  for (const route of ROUTES) {
    const result = await probe(route)
    results.push(result)
    const state = result.findings.length === 0 ? 'ok' : severityOf(result.findings[0]).toLowerCase()
    console.log(
      `  ${route.name.padEnd(8)} ${String(result.status).padEnd(4)} ${String(result.ms).padStart(5)}ms  ${state}`,
    )
    if (result.findings.length > 0) console.log(`    ↳ ${describe(result.findings[0])}`)
  }

  const findings = results.flatMap((r) => r.findings)
  const severities = {}
  for (const f of findings) {
    const sev = severityOf(f)
    severities[sev] = (severities[sev] ?? 0) + 1
  }

  if (findings.length === 0) {
    console.log(`\n✅ All ${ROUTES.length} probes healthy.`)
    return 0
  }

  console.log(
    `\n❌ Findings: ${severities.CRITICAL ?? 0} CRITICAL, ${severities.HIGH ?? 0} HIGH, ${severities.WARN ?? 0} WARN`,
  )

  const paging = (severities.CRITICAL ?? 0) + (severities.HIGH ?? 0)
  const delivered = await postToSlack(slackMessage(severities, findings))
  if (paging > 0 && !delivered) {
    console.error('CRITICAL/HIGH findings and no delivery channel — failing loudly.')
    return 1
  }

  return paging > 0 ? 1 : 0
}

process.exit(await main())
